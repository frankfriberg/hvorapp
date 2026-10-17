/**
 * The shapes the API sends and receives, imported by the server
 * (src/server, src/app/api) and the app (mobile/src/lib/api.ts) alike.
 * Times are ISO strings on the wire.
 */

export const ARENAS = ["salen"] as const;

export type Seat = {
  arena: (typeof ARENAS)[number];
  gridX: number;
  gridY: number;
};

export type User = { id: string; name: string; inviteCode: string };

export type Person = { id: string; name: string };

export type Friend = Person & {
  /** Their seat, while they share one. */
  seat: (Seat & { sharedAt: string; expiresAt: string }) | null;
};

export type Friends = {
  friends: Friend[];
  /** People asking to be my friend. */
  incoming: Person[];
  /** People I've asked, who haven't answered. */
  outgoing: Person[];
};

export type RequestResult =
  | { status: "requested"; to: Person }
  | { status: "friends"; with: Person }
  | { status: "already-friends"; with: Person }
  | { status: "own-link" }
  | { status: "unknown-link" };

/** POST /api/auth/* */
export type SessionResponse = { token: string; user: User };

/** GET /api/me */
export type MeResponse = {
  user: User;
  seat: (Seat & { expiresAt: string }) | null;
};
