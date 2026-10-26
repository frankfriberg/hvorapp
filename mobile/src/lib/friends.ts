import type { Friends } from "@shared/api";
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
