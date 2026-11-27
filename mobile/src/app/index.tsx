import brunstad from "@shared/venues/brunstad";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import ShareMap from "@/components/ShareMap";
import { salenFloor, venueFloor } from "@/lib/floor";
import { DUMMY_FRIENDS, useFriends } from "@/lib/friends";

// Seen first over the convention centre and the camp down to the beach,
// turned so they run up the screen.
const floor = venueFloor(brunstad, "brunstad", {
  turn: 30,
  zoom: 1.85,
  panX: -0.04,
  panY: 0.42,
});

/**
 * The venue from outside: where friends are on it, my own place, live if I
 * like; tapping a building with an arena goes in.
 */
export default function Home() {
  const router = useRouter();
  const { friends, refresh } = useFriends();
  // Salen's scene worked out while the venue sits there, so going in is quick.
  useEffect(() => {
    const idle = requestIdleCallback(() => salenFloor.prepare?.());
    return () => cancelIdleCallback(idle);
  }, []);
  return (
    <ShareMap
      arena="brunstad"
      floor={floor}
      venue={brunstad}
      friends={[...(friends?.friends ?? []), ...(__DEV__ ? DUMMY_FRIENDS : [])]}
      onSharedWithFriends={refresh}
      onOpen={(arena) => router.push(`/${arena}`)}
    />
  );
}
