import ShareMap from "@/components/map/shareMap";
import { gridToPercentage, parseGridCoordinates } from "@/lib/grid";
import Salen from "@public/arena/salen.svg";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ location: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { location } = await params;

  return {
    title: "Jeg sitter her",
    description: `${location} Salen`,
  };
}

export default async function LocationPage({ params }: Props) {
  const { location } = await params;

  const points = parseGridCoordinates(location);

  if (!points) return null;

  const percentage = gridToPercentage(points.x, points.y);

  return (
    <ShareMap
      arena="salen"
      map={Salen.src}
      position={{
        gridX: points.x,
        gridY: points.y,
        percentageX: percentage.percentageX,
        percentageY: percentage.percentageY,
      }}
    />
  );
}
