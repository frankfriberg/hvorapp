import { createHash, randomBytes } from "node:crypto";
import type { Person, User } from "@shared/api";
import type { Db } from "./db";

export type Provider = "apple" | "google" | "dev";

export type { User };

/** A person's columns, for `toPerson`: unqualified, so also for RETURNING. */
export const PERSON_COLUMNS =
  "id, name, avatar IS NOT NULL AS has_avatar, avatar_version";
const USER_COLUMNS = `${PERSON_COLUMNS}, invite_code`;

export type PersonRow = {
  id: string;
  name: string;
  has_avatar: boolean;
  avatar_version: number;
};
type UserRow = PersonRow & { invite_code: string };

export const toPerson = (row: PersonRow): Person => ({
  id: row.id,
  name: row.name,
  avatarUrl: row.has_avatar
    ? `/api/avatars/${row.id}?v=${row.avatar_version}`
    : null,
});

const toUser = (row: UserRow): User => ({
  ...toPerson(row),
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
     RETURNING ${USER_COLUMNS}`,
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
    `SELECT ${USER_COLUMNS} FROM sessions s
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
    `UPDATE users SET name = $2 WHERE id = $1 RETURNING ${USER_COLUMNS}`,
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
    `SELECT ${USER_COLUMNS} FROM users WHERE invite_code = $1`,
    [code],
  );
  return row ? toUser(row) : null;
}

export type Avatar = {
  bytes: Uint8Array<ArrayBuffer>;
  type: "image/jpeg" | "image/png";
};

/** What kind of image `bytes` hold, by their first bytes; null for neither. */
export function avatarType(bytes: Uint8Array): Avatar["type"] | null {
  const starts = (...magic: number[]) =>
    magic.every((byte, i) => bytes[i] === byte);
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x89, 0x50, 0x4e, 0x47)) return "image/png";
  return null;
}

/** Sets my profile photo, or removes it with null; a new photo, a new URL. */
export async function setAvatar(
  db: Db,
  userId: string,
  avatar: Avatar | null,
): Promise<User> {
  const [row] = await db.query<UserRow>(
    `UPDATE users SET avatar = $2, avatar_type = $3,
       avatar_version = avatar_version + 1
     WHERE id = $1 RETURNING ${USER_COLUMNS}`,
    [userId, avatar?.bytes ?? null, avatar?.type ?? null],
  );
  return toUser(row);
}

export async function getAvatar(
  db: Db,
  userId: string,
): Promise<Avatar | null> {
  const [row] = await db.query<{
    avatar: Uint8Array | null;
    avatar_type: Avatar["type"] | null;
  }>("SELECT avatar, avatar_type FROM users WHERE id = $1", [userId]);
  return row?.avatar && row.avatar_type
    ? { bytes: new Uint8Array(row.avatar), type: row.avatar_type }
    : null;
}
