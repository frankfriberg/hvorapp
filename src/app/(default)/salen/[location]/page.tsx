import { readdirSync } from "node:fs";
import path from "node:path";
import ShareMap from "@/components/map/shareMap";
import { gridToPercentage, parseGridCoordinates } from "@/lib/grid";
import Salen from "@public/arena/salen.svg";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ location: string }>;
};

export function generateStaticParams() {
  const dir = path.resolve(process.cwd(), "salen");
  const files = readdirSync(dir);
  const locationsMap = files.map((file) => {
    const locationName = file.includes(".")
      ? file.substring(0, file.lastIndexOf("."))
      : file;

    return {
      location: locationName,
    };
  });

  return locationsMap;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { location } = await params;

  return {
    title: location,
    openGraph: {
      images: `https://res.cloudinary.com/dwmrh6hct/image/upload/v1745048711/hvorapp/salen/${location}.png`,
    },
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
