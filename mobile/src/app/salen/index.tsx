import ShareMap from "@/components/ShareMap";
import { salenFloor } from "@/lib/floor";
import { DUMMY_FRIENDS, useFriends } from "@/lib/friends";

/** Inside salen: where I sit, and where my friends do. */
export default function Salen() {
  const { friends, refresh } = useFriends();
  return (
    <ShareMap
      arena="salen"
      floor={salenFloor}
      friends={[...(friends?.friends ?? []), ...(__DEV__ ? DUMMY_FRIENDS : [])]}
      onSharedWithFriends={refresh}
    />
  );
}
