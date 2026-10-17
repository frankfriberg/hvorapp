import Salen from "@public/arena/salen.svg";
import { gridToPercentage, parseGridCoordinates } from "@shared/grid";
import type { Metadata } from "next";
import ShareMap from "@/components/map/shareMap";

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

  if (!points) {
    return (
      <div className="flex flex-col gap-3 px-6 py-3">
        <h1 className="text-2xl font-bold">Ugyldig plassering</h1>
        <p>Denne lenken peker ikke til en gyldig plassering.</p>
      </div>
    );
  }

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
