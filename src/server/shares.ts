import {
  PLACES,
  SEAT_SHARE_HOURS,
  type Seat,
  type SeatShareHours,
} from "@shared/api";
import { columns, rows } from "@shared/grid";
import type { Db } from "./db";

export type { Seat };

/**
 * How long to share a seat for, from untrusted input: one of
 * SEAT_SHARE_HOURS, the first when not given, or null when it isn't one.
 */
export function parseShareHours(input: unknown): SeatShareHours | null {
  const { hours } = (input ?? {}) as Record<string, unknown>;
  if (hours === undefined) return SEAT_SHARE_HOURS[0];
  return SEAT_SHARE_HOURS.includes(hours as SeatShareHours)
    ? (hours as SeatShareHours)
    : null;
}

/** A seat from untrusted input, or null when it isn't one. */
export function parseSeat(input: unknown): Seat | null {
  if (typeof input !== "object" || input === null) return null;
  const { arena, gridX, gridY, live } = input as Record<string, unknown>;
  // Anywhere on the grid, not only on whole cells.
  const onGrid = (value: unknown, max: number) =>
    Number.isFinite(value) &&
    (value as number) >= 0 &&
    (value as number) <= max;

  if (!PLACES.includes(arena as Seat["arena"])) return null;
  if (!onGrid(gridX, columns) || !onGrid(gridY, rows)) return null;
  if (live !== undefined && typeof live !== "boolean") return null;
  return {
    arena: arena as Seat["arena"],
    gridX: gridX as number,
    gridY: gridY as number,
    ...(live && { live }),
  };
}

/** Shares `seat` with every friend for `hours`, replacing any earlier seat. */
export async function shareSeat(
  db: Db,
  userId: string,
  seat: Seat,
  hours: SeatShareHours,
  now: Date = new Date(),
): Promise<{ expiresAt: Date }> {
  const expiresAt = new Date(now.getTime() + hours * 3_600_000);
  await db.query(
    `INSERT INTO shares (user_id, kind, place, shared_at, expires_at)
     VALUES ($1, 'seat', $2::jsonb, $3, $4)
     ON CONFLICT (user_id, kind) DO UPDATE
       SET place = EXCLUDED.place, shared_at = EXCLUDED.shared_at, expires_at = EXCLUDED.expires_at`,
    [userId, JSON.stringify(seat), now, expiresAt],
  );
  return { expiresAt };
}

/**
 * Moves my shared seat to `seat`, keeping when it ends, as a live location
 * does; null when none is shared.
 */
export async function moveSeat(
  db: Db,
  userId: string,
  seat: Seat,
  now: Date = new Date(),
): Promise<{ expiresAt: Date } | null> {
  const [row] = await db.query<{ expires_at: Date }>(
    `UPDATE shares SET place = $2::jsonb
     WHERE user_id = $1 AND kind = 'seat' AND expires_at > $3
     RETURNING expires_at`,
    [userId, JSON.stringify(seat), now],
  );
  return row ? { expiresAt: row.expires_at } : null;
}

export async function stopSharingSeat(db: Db, userId: string): Promise<void> {
  await db.query("DELETE FROM shares WHERE user_id = $1 AND kind = 'seat'", [
    userId,
  ]);
}

/** My own seat, while it's shared. */
export async function mySeat(
  db: Db,
  userId: string,
  now: Date = new Date(),
): Promise<(Seat & { expiresAt: Date }) | null> {
  const [row] = await db.query<{ place: Seat; expires_at: Date }>(
    "SELECT place, expires_at FROM shares WHERE user_id = $1 AND kind = 'seat' AND expires_at > $2",
    [userId, now],
  );
  return row ? { ...row.place, expiresAt: row.expires_at } : null;
}
