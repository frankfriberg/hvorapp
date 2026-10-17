import { userByInviteCode } from "./accounts";
import type { Db } from "./db";
import type { Seat } from "./shares";

export type Person = { id: string; name: string };

export type Friend = Person & {
  /** Their seat, while they share one. */
  seat: (Seat & { sharedAt: Date; expiresAt: Date }) | null;
};

export type Friends = {
  friends: Friend[];
  /** People asking to be my friend. */
  incoming: Person[];
  /** People I've asked, who haven't answered. */
  outgoing: Person[];
};

const pair = (a: string, b: string) => (a < b ? [a, b] : [b, a]);

export async function areFriends(db: Db, a: string, b: string) {
  const rows = await db.query(
    "SELECT 1 FROM friendships WHERE user_a = $1 AND user_b = $2",
    pair(a, b),
  );
  return rows.length > 0;
}

async function befriend(db: Db, a: string, b: string) {
  await db.query(
    `WITH gone AS (
       DELETE FROM friend_requests
       WHERE (from_user = $1 AND to_user = $2) OR (from_user = $2 AND to_user = $1)
     )
     INSERT INTO friendships (user_a, user_b) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    pair(a, b),
  );
}

export type RequestResult =
  | { status: "requested"; to: Person }
  | { status: "friends"; with: Person }
  | { status: "already-friends"; with: Person }
  | { status: "own-link" }
  | { status: "unknown-link" };

/**
 * Asks the owner of `inviteCode` to be friends. If they had already asked me,
 * this accepts their request instead.
 */
export async function requestFriend(
  db: Db,
  fromId: string,
  inviteCode: string,
): Promise<RequestResult> {
  const owner = await userByInviteCode(db, inviteCode);
  if (!owner) return { status: "unknown-link" };
  if (owner.id === fromId) return { status: "own-link" };

  const to = { id: owner.id, name: owner.name };
  if (await areFriends(db, fromId, owner.id)) {
    return { status: "already-friends", with: to };
  }

  const theyAsked = await db.query(
    "SELECT 1 FROM friend_requests WHERE from_user = $1 AND to_user = $2",
    [owner.id, fromId],
  );
  if (theyAsked.length > 0) {
    await befriend(db, fromId, owner.id);
    return { status: "friends", with: to };
  }

  await db.query(
    "INSERT INTO friend_requests (from_user, to_user) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [fromId, owner.id],
  );
  return { status: "requested", to };
}

/** Accepts `fromId`'s request; false when there is no such request. */
export async function acceptRequest(
  db: Db,
  userId: string,
  fromId: string,
): Promise<boolean> {
  const rows = await db.query(
    "SELECT 1 FROM friend_requests WHERE from_user = $1 AND to_user = $2",
    [fromId, userId],
  );
  if (rows.length === 0) return false;
  await befriend(db, userId, fromId);
  return true;
}

/** Declines a request to me, or withdraws one I sent. */
export async function dropRequest(
  db: Db,
  userId: string,
  otherId: string,
): Promise<void> {
  await db.query(
    `DELETE FROM friend_requests
     WHERE (from_user = $1 AND to_user = $2) OR (from_user = $2 AND to_user = $1)`,
    [userId, otherId],
  );
}

export async function unfriend(
  db: Db,
  userId: string,
  friendId: string,
): Promise<void> {
  await db.query(
    "DELETE FROM friendships WHERE user_a = $1 AND user_b = $2",
    pair(userId, friendId),
  );
}

type FriendRow = {
  id: string;
  name: string;
  place: Seat | null;
  shared_at: Date | null;
  expires_at: Date | null;
};

export async function listFriends(
  db: Db,
  userId: string,
  now: Date = new Date(),
): Promise<Friends> {
  const friendRows = await db.query<FriendRow>(
    `SELECT u.id, u.name, s.place, s.shared_at, s.expires_at
     FROM friendships f
     JOIN users u ON u.id = CASE WHEN f.user_a = $1 THEN f.user_b ELSE f.user_a END
     LEFT JOIN shares s ON s.user_id = u.id AND s.kind = 'seat' AND s.expires_at > $2
     WHERE f.user_a = $1 OR f.user_b = $1
     ORDER BY u.name`,
    [userId, now],
  );
  const incoming = await db.query<Person>(
    `SELECT u.id, u.name FROM friend_requests r JOIN users u ON u.id = r.from_user
     WHERE r.to_user = $1 ORDER BY r.created_at`,
    [userId],
  );
  const outgoing = await db.query<Person>(
    `SELECT u.id, u.name FROM friend_requests r JOIN users u ON u.id = r.to_user
     WHERE r.from_user = $1 ORDER BY r.created_at`,
    [userId],
  );

  return {
    friends: friendRows.map((row) => ({
      id: row.id,
      name: row.name,
      seat:
        row.place && row.shared_at && row.expires_at
          ? {
              ...row.place,
              sharedAt: row.shared_at,
              expiresAt: row.expires_at,
            }
          : null,
    })),
    incoming,
    outgoing,
  };
}
