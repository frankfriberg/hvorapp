import { createHash, randomBytes } from "node:crypto";
import type { User } from "@shared/api";
import type { Db } from "./db";

export type Provider = "apple" | "google" | "dev";

export type { User };

type UserRow = { id: string; name: string; invite_code: string };

const toUser = (row: UserRow): User => ({
  id: row.id,
  name: row.name,
  inviteCode: row.invite_code,
});

const INVITE_ALPHABET =
  "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** 10 characters without look-alikes (0/O, 1/l/I): ~57 bits. */
function inviteCode(): string {
  return Array.from(
    randomBytes(10),
    (byte) => INVITE_ALPHABET[byte % INVITE_ALPHABET.length],
  ).join("");
}

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

/**
 * The user behind a provider identity, created on first sign-in. `name` fills
 * an empty name only: Apple sends it on the first sign-in and never again.
 */
export async function signIn(
  db: Db,
  provider: Provider,
  providerSub: string,
  name?: string,
): Promise<User> {
  const [row] = await db.query<UserRow>(
    `INSERT INTO users (provider, provider_sub, name, invite_code)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (provider, provider_sub) DO UPDATE
       SET name = CASE WHEN users.name = '' THEN EXCLUDED.name ELSE users.name END
     RETURNING id, name, invite_code`,
    [provider, providerSub, name?.trim() ?? "", inviteCode()],
  );
  return toUser(row);
}

/** A new session for `userId`; the token is returned once and stored hashed. */
export async function createSession(db: Db, userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.query("INSERT INTO sessions (token_hash, user_id) VALUES ($1, $2)", [
    hashToken(token),
    userId,
  ]);
  return token;
}

export async function userForToken(
  db: Db,
  token: string,
): Promise<User | null> {
  const [row] = await db.query<UserRow>(
    `SELECT u.id, u.name, u.invite_code FROM sessions s
     JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1`,
    [hashToken(token)],
  );
  return row ? toUser(row) : null;
}

export async function endSession(db: Db, token: string): Promise<void> {
  await db.query("DELETE FROM sessions WHERE token_hash = $1", [
    hashToken(token),
  ]);
}

export const MAX_NAME_LENGTH = 40;

export async function rename(
  db: Db,
  userId: string,
  name: string,
): Promise<User> {
  const [row] = await db.query<UserRow>(
    "UPDATE users SET name = $2 WHERE id = $1 RETURNING id, name, invite_code",
    [userId, name.trim().slice(0, MAX_NAME_LENGTH)],
  );
  return toUser(row);
}

/** Deletes the account and, by cascade, its sessions, friendships and shares. */
export async function deleteAccount(db: Db, userId: string): Promise<void> {
  await db.query("DELETE FROM users WHERE id = $1", [userId]);
}

export async function userByInviteCode(
  db: Db,
  code: string,
): Promise<User | null> {
  const [row] = await db.query<UserRow>(
    "SELECT id, name, invite_code FROM users WHERE invite_code = $1",
    [code],
  );
  return row ? toUser(row) : null;
}
