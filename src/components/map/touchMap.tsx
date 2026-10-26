"use client";

import pinIcon from "@public/pin.svg";
import salen from "@shared/arenas/salen";
import type { GridPosition } from "@shared/grid";
import { formatGridCoordinates, snapToGrid } from "@shared/grid";
import {
  PIN_COLOR,
  PIN_DOT_TRANSFORM,
  PIN_DOT_VW,
  PIN_ICON_TRANSFORM,
  PIN_WIDTH_VW,
} from "@shared/pin";
import { NextURL } from "next/dist/server/web/next-url";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import ArenaMap from "./arenaMap";
import DebugOverlay from "./debugOverlay";

// Vertical lift (px) applied to the placed marker so the user's fingertip
// doesn't cover it while dragging.
const MARKER_LIFT_PX = 60;

function getRelativePosition(
  clientX: number,
  clientY: number,
  container: HTMLDivElement,
): GridPosition {
  // getBoundingClientRect and the pointer's client coordinates are both
  // viewport-relative, so this stays correct regardless of page scroll.
  const { left, top, width, height } = container.getBoundingClientRect();

  const relativeX = clientX - left;
  const relativeY = clientY - top - MARKER_LIFT_PX;

  const clampedX = Math.min(Math.max(relativeX, 0), width);
  const clampedY = Math.min(Math.max(relativeY, 0), height);

  const percentageX = (clampedX / width) * 100;
  const percentageY = (clampedY / height) * 100;

  const snapped = snapToGrid(clampedX, clampedY, width, height);

  return {
    percentageX,
    percentageY,
    gridX: snapped.x,
    gridY: snapped.y,
  };
}

type Props = {
  arena?: string;
  setUrlAction?: (url: NextURL | undefined) => void;
  position?: GridPosition;
};

export default function TouchMap({ arena, setUrlAction, position }: Props) {
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

  // React registers onTouchStart/onTouchMove as passive listeners, so their
  // preventDefault() is a no-op. Attach non-passive native listeners so we can
  // stop the browser from starting a text selection / touch callout while the
  // user drags the pin.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const preventTouch = (e: TouchEvent) => e.preventDefault();
    el.addEventListener("touchstart", preventTouch, { passive: false });
    el.addEventListener("touchmove", preventTouch, { passive: false });

    return () => {
      el.removeEventListener("touchstart", preventTouch);
      el.removeEventListener("touchmove", preventTouch);
    };
  }, []);

  function onEnd(clientX: number, clientY: number) {
    if (!containerRef.current) return;

    const { gridX, gridY } = getRelativePosition(
      clientX,
      clientY,
      containerRef.current,
    );

    setIsMoving(false);

    if (setUrlAction) {
      setUrlAction(
        new NextURL(
          `${window.location.origin}/${arena}/${formatGridCoordinates(gridX, gridY)}`,
        ),
      );
    }
  }

  const onMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return;

      const { percentageX, percentageY, gridX, gridY } = getRelativePosition(
        clientX,
        clientY,
        containerRef.current,
      );

      setCurrent({ gridX, gridY, percentageX, percentageY });

      if (setUrlAction) {
        setUrlAction(undefined);
      }
    },
    [setUrlAction],
  );

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: touch/mouse drag surface for placing the pin; not a semantic interactive control.
    <div
      id="touchzone"
      ref={containerRef}
      className="relative w-full select-none touch-none"
      style={{ WebkitTouchCallout: "none" }}
      onTouchStart={(e) => {
        setIsMoving(true);
        onMove(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      }}
      onTouchEnd={(e) =>
        onEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY)
      }
      onTouchMove={(e) =>
        onMove(e.changedTouches[0].clientX, e.changedTouches[0].clientY)
      }
      onMouseDown={(e) => {
        // Prevent the browser from starting a text/element selection of the
        // page while dragging the pin.
        e.preventDefault();
        setIsMoving(true);
        onMove(e.clientX, e.clientY);
      }}
      onMouseUp={(e) => onEnd(e.clientX, e.clientY)}
      onMouseMove={(e) => {
        if (isMoving) {
          onMove(e.clientX, e.clientY);
        }
      }}
      onDragStart={(e) => e.preventDefault()}
    >
      {process.env.NODE_ENV === "development" && (
        <DebugOverlay current={current} />
      )}

      <div
        className="absolute select-none"
        style={{
          top: `${current?.percentageY}%`,
          left: `${current?.percentageX}%`,
          width: `${PIN_WIDTH_VW}vw`,
        }}
      >
        <Image
          priority
          draggable={false}
          className="pointer-events-none absolute touch-none select-none transition-transform"
          style={{
            transform: !current
              ? "translate(-50%, -4000%)"
              : isMoving
                ? "translate(-50%, -150%)"
                : PIN_ICON_TRANSFORM,
          }}
          src={pinIcon}
          alt="Pin Icon"
        />
        <div
          className={cn("rounded-full", !current && "hidden")}
          style={{
            width: `${PIN_DOT_VW}vw`,
            height: `${PIN_DOT_VW}vw`,
            transform: PIN_DOT_TRANSFORM,
            background: PIN_COLOR,
          }}
        />
      </div>
      <ArenaMap
        arena={salen}
        className="pointer-events-none block h-auto w-full max-w-[868px] touch-none select-none"
      />
    </div>
  );
}
