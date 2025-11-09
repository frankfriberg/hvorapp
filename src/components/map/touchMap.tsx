"use client";

import {
  snapToGrid,
  gridToPercentage,
  formatGridCoordinates,
} from "@/lib/grid";
import { cn } from "@/lib/utils";
import type { GridPosition } from "@/types/grid";
import pinIcon from "@public/pin.svg";
import { NextURL } from "next/dist/server/web/next-url";
import Image, { type StaticImageData } from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import DebugOverlay from "./debugOverlay";

function getRelativePosition(
  x: number,
  y: number,
  current: HTMLDivElement,
  offsetY?: number,
): GridPosition {
  const { left, top, width, height } = current.getBoundingClientRect();

  const relativeX = x - left;
  const relativeY = offsetY ? y - offsetY - top : y - top;

  const clampedX = Math.min(Math.max(relativeX, 0), width);
  const clampedY = Math.min(Math.max(relativeY, 0), height);

  const snapped = snapToGrid(clampedX, clampedY, width, height);

  const { percentageX, percentageY } = gridToPercentage(snapped.x, snapped.y);

  return {
    percentageX,
    percentageY,
    gridX: snapped.x,
    gridY: snapped.y,
  };
}

type Props = {
  map: string | StaticImageData;
  arena?: string;
  generate?: boolean;
  setUrl?: (url: NextURL | undefined) => void;
  position?: GridPosition;
};

export default function TouchMap({
  arena,
  map,
  setUrl,
  generate,
  position,
}: Props) {
  const [isMoving, setIsMoving] = useState(false);
  const [current, setCurrent] = useState<GridPosition | undefined>();

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (position && containerRef.current) {
      setCurrent({
        percentageX: position.percentageX,
        percentageY: position.percentageY,
        gridX: position.gridX,
        gridY: position.gridY,
      });
    }
  }, [position]);

  const offsetY = generate ? 0 : 60;

  function onEnd(x: number, y: number) {
    if (!containerRef.current) return;

    const { gridX, gridY } = getRelativePosition(
      x,
      y,
      containerRef.current,
      offsetY,
    );

    setIsMoving(false);

    if (setUrl) {
      setUrl(
        new NextURL(
          `${window.location.origin}/${arena}/${formatGridCoordinates(gridX, gridY)}`,
        ),
      );
    }
  }

  const onMove = useCallback(
    (x: number, y: number) => {
      if (!containerRef.current) return;

      const { percentageX, percentageY, gridX, gridY } = getRelativePosition(
        x,
        y,
        containerRef.current,
        offsetY,
      );

      setCurrent({ gridX: gridX, gridY: gridY, percentageX, percentageY });

      if (setUrl) {
        setUrl(undefined);
      }
    },
    [setUrl, offsetY],
  );

  return (
    <div
      id="touchzone"
      ref={containerRef}
      className="relative w-full"
      onTouchStart={(e) => {
        setIsMoving(true);
        onMove(e.changedTouches[0].pageX, e.changedTouches[0].pageY);
      }}
      onTouchEnd={(e) =>
        onEnd(e.changedTouches[0].pageX, e.changedTouches[0].pageY)
      }
      onTouchMove={(e) =>
        onMove(e.changedTouches[0].pageX, e.changedTouches[0].pageY)
      }
      onMouseDown={(e) => {
        setIsMoving(true);
        onMove(e.pageX, e.pageY);
      }}
      onMouseUp={(e) => onEnd(e.pageX, e.pageY)}
      onMouseMove={(e) => {
        if (isMoving) {
          onMove(e.pageX, e.pageY);
        }
      }}
    >
      {process.env.NODE_ENV === "development" && (
        <DebugOverlay current={current} />
      )}

      <div
        className="absolute w-[10vw] select-none"
        style={{
          top: `${current?.percentageY}%`,
          left: `${current?.percentageX}%`,
        }}
      >
        <Image
          priority
          className={cn(
            "pointer-events-none absolute -translate-x-[50%] -translate-y-[115%] touch-none select-none",
            !current && "-translate-y-[4000%]",
            !generate && "transition-transform",
            !generate && isMoving && "-translate-y-[150%]",
          )}
          src={pinIcon}
          alt="Pin Icon"
        />
        <div
          className={cn(
            "h-[1.5vw] w-[1.5vw] -translate-x-[50%] -translate-y-[50%] rounded-full bg-[#E45F53]",
            !current && "hidden",
          )}
        />
      </div>
      <Image
        priority
        src={map}
        alt=""
        width={868}
        height={1593}
        className="pointer-events-none touch-none select-none"
      />
    </div>
  );
}
