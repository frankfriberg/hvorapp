import type { Friend, Friends, Seat } from "@shared/api";
import { ARENAS } from "@shared/api";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { api } from "./api";
import { t, time } from "./i18n";
import { useToken } from "./session";

// Friends move between sessions; half a minute keeps the map current without
// hammering the API from a hall full of phones.
const POLL_MS = 30_000;

/** My friends and requests, refreshed while the calling screen is focused. */
export function useFriends() {
  const token = useToken();
  const [friends, setFriends] = useState<Friends | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return setFriends(null);
    try {
      setFriends(await api<Friends>("/friends", { token }));
    } catch {
      // Keep showing the last answer; the next poll tries again.
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      const timer = setInterval(refresh, POLL_MS);
      return () => clearInterval(timer);
    }, [refresh]),
  );

  return { friends, refresh };
}

// Pretend friends sitting around the hall, so a development build shows
// friend pins on the map without real friends sharing.
// Some with sample portraits from randomuser.me, some with initials.
const PORTRAITS = "https://randomuser.me/api/portraits";
// Two outside: one at the beach, one by the sports hall, live.
const DUMMY_SEATS = [
  ["Ola Nordmann", "salen", 12, 14, `${PORTRAITS}/men/32.jpg`, false],
  ["Kari Hansen", "salen", 30, 22, `${PORTRAITS}/women/44.jpg`, false],
  ["Per Olsen", "salen", 40, 46, null, false],
  ["Ingrid Berg", "salen", 18, 64, `${PORTRAITS}/women/68.jpg`, false],
  ["Lars Johansen", "salen", 34, 78, null, false],
  ["Sofie Lund", "brunstad", 32, 76, `${PORTRAITS}/women/21.jpg`, false],
  ["Emil Strand", "brunstad", 6, 30, null, true],
] as const;

export const DUMMY_FRIENDS: Friend[] = DUMMY_SEATS.map(
  ([name, arena, gridX, gridY, avatarUrl, live], i) => ({
    id: `dummy-${i}`,
    name,
    avatarUrl,
    seat: {
      arena,
      gridX,
      gridY,
      ...(live && { live }),
      sharedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    },
  }),
);

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "?";

// Friend pin colours: none near the location pin's red (#E45F53) or the map's row
// blue (#7299d6), and each dark enough for white initials (≥ 4.5:1).
const FRIEND_COLORS = [
  "#0f766e", // teal
  "#7c3aed", // violet
  "#b45309", // amber
  "#15803d", // green
  "#be185d", // pink
  "#4338ca", // indigo
  "#0e7490", // cyan
  "#334155", // slate
];

/** A friend's pin colour, fixed by their initials. */
export function colorForInitials(letters: string): string {
  let hash = 0;
  for (const char of letters) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return FRIEND_COLORS[hash % FRIEND_COLORS.length];
}

/** Where a friend's shared seat is and until when, in words. */
export function seatStatus(seat: Seat & { expiresAt: string }) {
  const until = time(seat.expiresAt);
  if (ARENAS.includes(seat.arena as (typeof ARENAS)[number])) {
    return t.sitsInSalenUntil(until);
  }
  return seat.live ? t.liveUntil(until) : t.outsideUntil(until);
}
