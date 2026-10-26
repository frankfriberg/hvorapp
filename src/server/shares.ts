import { ARENAS, type Seat } from "@shared/api";
import { columns, rows } from "@shared/grid";
import type { Db } from "./db";

/** How long a shared seat stays visible to friends. */
export const SEAT_SHARE_HOURS = 4;

export type { Seat };

/** A seat from untrusted input, or null when it isn't one. */
export function parseSeat(input: unknown): Seat | null {
  if (typeof input !== "object" || input === null) return null;
  const { arena, gridX, gridY } = input as Record<string, unknown>;
  const onGrid = (value: unknown, max: number) =>
    Number.isInteger(value) &&
    (value as number) >= 0 &&
    (value as number) <= max;

  if (!ARENAS.includes(arena as Seat["arena"])) return null;
  if (!onGrid(gridX, columns) || !onGrid(gridY, rows)) return null;
  return {
    arena: arena as Seat["arena"],
    gridX: gridX as number,
    gridY: gridY as number,
  };
}

/** Shares `seat` with every friend for SEAT_SHARE_HOURS, replacing any earlier seat. */
export async function shareSeat(
  db: Db,
  userId: string,
  seat: Seat,
  now: Date = new Date(),
): Promise<{ expiresAt: Date }> {
  const expiresAt = new Date(now.getTime() + SEAT_SHARE_HOURS * 3_600_000);
  await db.query(
    `INSERT INTO shares (user_id, kind, place, shared_at, expires_at)
     VALUES ($1, 'seat', $2::jsonb, $3, $4)
     ON CONFLICT (user_id, kind) DO UPDATE
       SET place = EXCLUDED.place, shared_at = EXCLUDED.shared_at, expires_at = EXCLUDED.expires_at`,
    [userId, JSON.stringify(seat), now, expiresAt],
  );
  return { expiresAt };
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
