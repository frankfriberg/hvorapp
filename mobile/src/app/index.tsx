import ShareMap from "@/components/ShareMap";
import { DUMMY_FRIENDS, useFriends } from "@/lib/friends";

export default function Home() {
  const { friends, refresh } = useFriends();
  return (
    <ShareMap
      arena="salen"
      friends={[...(friends?.friends ?? []), ...(__DEV__ ? DUMMY_FRIENDS : [])]}
      onSharedWithFriends={refresh}
    />
  );
}
