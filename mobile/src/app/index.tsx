import ShareMap from "@/components/ShareMap";
import { useFriends } from "@/lib/friends";

export default function Home() {
  const { friends, refresh } = useFriends();
  return (
    <ShareMap
      arena="salen"
      friends={friends?.friends}
      onSharedWithFriends={refresh}
    />
  );
}
