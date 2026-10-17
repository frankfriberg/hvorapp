// biome-ignore-all lint/performance/noImgElement: next/og (Satori) renders with plain <img>; next/image is not supported in ImageResponse.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { arenaToSvg } from "@shared/arena";
import salen from "@shared/arenas/salen";
import { gridToPercentage, parseGridCoordinates } from "@shared/grid";
import {
  PIN_COLOR,
  PIN_DOT_TRANSFORM,
  PIN_DOT_VW,
  PIN_ICON_TRANSFORM,
  PIN_WIDTH_VW,
} from "@shared/pin";
import { ImageResponse } from "next/og";

export const alt = "Jeg sitter her!";
export const size = {
  width: 562,
  height: 1000,
};

export const contentType = "image/png";

type Props = {
  params: Promise<{ location: string }>;
};

export default async function Image({ params }: Props) {
  const { location } = await params;

  const coords = parseGridCoordinates(location);
  if (!coords) {
    return new ImageResponse(
      <div
        style={{
          fontSize: 64,
          background: "white",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#333",
          fontWeight: "bold",
        }}
      >
        Invalid Location
      </div>,
      { ...size },
    );
  }

  const { percentageX, percentageY } = gridToPercentage(coords.x, coords.y);

  const pinData = await readFile(
    join(process.cwd(), "public/pin.svg"),
    "base64",
  );

  const logoData = await readFile(
    join(process.cwd(), "public/logo.svg"),
    "base64",
  );

  const mapSource = `data:image/svg+xml;base64,${Buffer.from(arenaToSvg(salen)).toString("base64")}`;
  const pinSource = `data:image/svg+xml;base64,${pinData}`;
  const logoSource = `data:image/svg+xml;base64,${logoData}`;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "white",
        flexDirection: "column",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          height: "10%",
          padding: "15px",
        }}
      >
        <img
          src={logoSource}
          alt="Logo"
          style={{ margin: "auto", height: "100%" }}
        />
      </div>
      <div
        style={{
          display: "flex",
          padding: "20px",
        }}
      >
        <div
          style={{
            display: "flex",
            position: "relative",
            marginLeft: "40px",
            marginRight: "40px",
          }}
        >
          <img src={mapSource} alt="Salen Arena Map" />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              position: "absolute",
              width: `${PIN_WIDTH_VW}vw`,
              left: `${percentageX}%`,
              top: `${percentageY}%`,
            }}
          >
            <img
              src={pinSource}
              alt="Pin"
              style={{
                position: "absolute",
                transform: PIN_ICON_TRANSFORM,
              }}
            />
            <div
              style={{
                width: `${PIN_DOT_VW}vw`,
                height: `${PIN_DOT_VW}vw`,
                transform: PIN_DOT_TRANSFORM,
                borderRadius: "100%",
                backgroundColor: PIN_COLOR,
              }}
            />
          </div>
        </div>
      </div>
    </div>,
    {
      ...size,
    },
  );
}
