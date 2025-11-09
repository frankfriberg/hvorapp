"use client";

import type { NextURL } from "next/dist/server/web/next-url";
import { useState } from "react";
import ShareMenu from "./shareMenu";
import TouchMap from "./touchMap";
import type { StaticImageData } from "next/image";
import type { GridPosition } from "@/types/grid";

type Props = {
  arena: "salen";
  map: StaticImageData | string;
  position?: GridPosition;
};

export default function ShareMap(props: Props) {
  const [url, setUrl] = useState<NextURL | undefined>();

  return (
    <div className="touch-none select-none px-10">
      <TouchMap setUrl={setUrl} {...props} />
      <ShareMenu url={url} />
    </div>
  );
}
