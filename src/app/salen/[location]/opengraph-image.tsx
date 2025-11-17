import { ImageResponse } from "next/og";
import { gridToPercentage, parseGridCoordinates } from "@/lib/grid";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

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

  const mapData = await readFile(
    join(process.cwd(), "public/arena/salen.svg"),
    "base64",
  );

  const pinData = await readFile(
    join(process.cwd(), "public/pin.svg"),
    "base64",
  );

  const logoData = await readFile(
    join(process.cwd(), "public/logo.svg"),
    "base64",
  );

  const mapSource = `data:image/svg+xml;base64,${mapData}`;
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
              width: "10vw",
              left: `${percentageX}%`,
              top: `${percentageY}%`,
            }}
          >
            <img
              src={pinSource}
              alt="Pin"
              style={{
                position: "absolute",
                transform: "translate(-50%, -115%)",
              }}
            />
            <div
              style={{
                width: "1.5vw",
                height: "1.5vw",
                transform: "translate(-50%, -50%)",
                borderRadius: "100%",
                backgroundColor: "#E45F53",
              }}
            />
          </div>
        </div>
      </div>
    </div>,
  );
}
