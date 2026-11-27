/**
 * The shapes the API sends and receives, imported by the server
 * (src/server, src/app/api) and the app (mobile/src/lib/api.ts) alike.
 * Times are ISO strings on the wire.
 */

export const ARENAS = ["salen"] as const;

/** Each arena's name, as it's shown. */
export const ARENA_NAMES: Record<(typeof ARENAS)[number], string> = {
  salen: "Salen",
};

/** The venues, whose outside maps (`shared/venues/<name>.ts`) a pin can be on. */
export const VENUES = ["brunstad"] as const;

/** Where a pin can be: inside an arena, or outside on a venue's map. */
export const PLACES = [...ARENAS, ...VENUES] as const;

/**
 * Where someone is: a point on the grid of a place's map, in an arena (a
 * seat) or outside on a venue's; one at a time.
 */
export type Seat = {
  arena: (typeof PLACES)[number];
  gridX: number;
  gridY: number;
  /** Moved as their phone does, while it's sharing its location live. */
  live?: boolean;
};

/** How long a seat can be shared with friends, in hours; the first is the default. */
export const SEAT_SHARE_HOURS = [1, 2, 4] as const;

export type SeatShareHours = (typeof SEAT_SHARE_HOURS)[number];

/** PUT /api/seat */
export type ShareSeatRequest = Seat & { hours?: SeatShareHours };

/** PATCH /api/seat: moves the shared seat, keeping when it ends. */
export type MoveSeatRequest = Seat;

export type Person = {
  id: string;
  name: string;
  /**
   * Their profile photo, as a path under the web app
   * (`/api/avatars/<id>?v=<n>`), or null without one.
   */
  avatarUrl: string | null;
};

export type User = Person & { inviteCode: string };

/** PUT /api/me/avatar: a JPEG or PNG body of at most this many bytes. */
export const AVATAR_MAX_BYTES = 100_000;

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
