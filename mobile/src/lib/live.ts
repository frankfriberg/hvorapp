import type { GridPosition } from "@shared/grid";
import type { Venue } from "@shared/venue";
import { requireOptionalNativeModule } from "expo";
import type { LocationSubscription } from "expo-location";
import { useEffect, useRef } from "react";
import { onVenue } from "@/lib/floor";

// Sharing my location live: the phone's position on a venue's map, followed
// while the app is open. Not in the background: it asks for no more than
// "while using the app", and a phone in a pocket keeps its last place.

// Loaded as it's first needed, and only in a build that has it: it's native,
// and a build made before it was added still opens every map, only not live.
const LOCATION = requireOptionalNativeModule("ExpoLocation") !== null;
const location = () => import("expo-location");

// A new place at most every few metres or seconds: walking pace, without
// the API hearing of every step.
const LIVE_METRES = 5;
const LIVE_MS = 5000;

/**
 * Asks to see the phone's location, then finds where it is on `venue`'s
 * map: there, or "denied" without leave, or "away" off the map.
 */
export async function locateOn(
  venue: Venue,
): Promise<GridPosition | "denied" | "away"> {
  if (!LOCATION) return "denied";
  const Location = await location();
  const { granted } = await Location.requestForegroundPermissionsAsync();
  if (!granted) return "denied";
  const { coords } = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  return onVenue(venue, coords.longitude, coords.latitude) ?? "away";
}

/**
 * Follows the phone's location on `venue`'s map while `on`: `onMove` with
 * each new place, or null once it's off the map.
 */
export function useLiveLocation(
  venue: Venue | undefined,
  on: boolean,
  onMove: (position: GridPosition | null) => void,
) {
  const latest = useRef(onMove);
  latest.current = onMove;
  useEffect(() => {
    if (!on || !venue || !LOCATION) return;
    let watch: LocationSubscription | null = null;
    let stopped = false;
    location()
      .then((Location) =>
        Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: LIVE_METRES,
            timeInterval: LIVE_MS,
          },
          ({ coords }) =>
            latest.current(onVenue(venue, coords.longitude, coords.latitude)),
        ),
      )
      .then((started) => {
        if (stopped) started.remove();
        else watch = started;
      })
      .catch(() => latest.current(null));
    return () => {
      stopped = true;
      watch?.remove();
    };
  }, [on, venue]);
}
