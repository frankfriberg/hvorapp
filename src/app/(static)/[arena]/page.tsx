import TouchMap from "@/components/map/touchMap";
import Salen from "@public/arena/salen.svg";

type Props = {
  params: Promise<{ arena: string }>;
};

export default async function GeneratePage({ params }: Props) {
  const { arena } = await params;

  // For now, we only support salen arena
  if (arena !== "salen") {
    return <div>Arena not found</div>;
  }

  return (
    <div className="touch-none select-none px-10 pt-20">
      <TouchMap map={Salen} generate />
    </div>
  );
}
