import type { Friend, Friends } from "@shared/api";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { api } from "./api";
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
const DUMMY_SEATS = [
  ["Ola Nordmann", 12, 14],
  ["Kari Hansen", 30, 22],
  ["Per Olsen", 40, 46],
  ["Ingrid Berg", 18, 64],
  ["Lars Johansen", 34, 78],
] as const;

export const DUMMY_FRIENDS: Friend[] = DUMMY_SEATS.map(
  ([name, gridX, gridY], i) => ({
    id: `dummy-${i}`,
    name,
    seat: {
      arena: "salen",
      gridX,
      gridY,
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
