import { ARENA_DARK_PALETTE, ARENA_PALETTE } from "@shared/arena";
import { VENUE_DARK_PALETTE, VENUE_PALETTE } from "@shared/venue";
import { createContext, type ReactNode, useContext } from "react";
import { useColorScheme } from "react-native";

// The app's colours, light and dark; the phone's appearance setting picks.

const light = {
  dark: false,
  background: "#ffffff",
  groupedBackground: "#f2f2f7",
  card: "#ffffff",
  text: "#18181b",
  secondaryText: "#52525b",
  tertiaryText: "#71717a",
  separator: "#e4e4e7",
  border: "#d4d4d8",
  danger: "#dc2626",
  // Behind a button where there's no Liquid Glass.
  buttonFill: "rgba(120,120,128,0.16)",
  roundButtonFill: "rgba(255,255,255,0.92)",
  pinShadowOpacity: 0.18,
  arena: ARENA_PALETTE,
  venue: VENUE_PALETTE,
};

export type Theme = typeof light;

const dark: Theme = {
  dark: true,
  background: "#1c1c1e",
  groupedBackground: "#1c1c1e",
  card: "#2c2c2e",
  text: "#f4f4f5",
  secondaryText: "#a1a1aa",
  tertiaryText: "#8e8e93",
  separator: "#38383a",
  border: "#3f3f46",
  danger: "#f87171",
  buttonFill: "rgba(120,120,128,0.32)",
  roundButtonFill: "rgba(58,58,60,0.92)",
  pinShadowOpacity: 0.4,
  arena: ARENA_DARK_PALETTE,
  venue: VENUE_DARK_PALETTE,
};

/** Sharing with friends, live: the friends button while I do, a friend's dot. */
export const SHARING_COLOR = "#16a34a";

const Forced = createContext<Theme | null>(null);

/** The colours to draw with: dark when the phone is, unless forced light. */
export function useTheme(): Theme {
  const forced = useContext(Forced);
  const scheme = useColorScheme();
  return forced ?? (scheme === "dark" ? dark : light);
}

/** Keeps what's inside light, like the shared image, whatever the phone's. */
export function LightTheme({ children }: { children: ReactNode }) {
  return <Forced.Provider value={light}>{children}</Forced.Provider>;
}
