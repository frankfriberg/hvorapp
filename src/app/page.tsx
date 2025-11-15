import ShareMap from "@/components/map/shareMap";
import Salen from "@public/arena/salen.svg";

export default async function Home() {
  return <ShareMap arena="salen" map={Salen} />;
}
