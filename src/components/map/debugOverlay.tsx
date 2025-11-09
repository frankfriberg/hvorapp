"use client";

import type { GridPosition } from "@/types/grid";

export default function DebugOverlay({ current }: { current?: GridPosition }) {
  if (!current) return null;
  return (
    <div className="absolute bottom-4 left-4 z-10 bg-black/80 text-white p-3 rounded-lg text-sm font-mono">
      <div>
        Grid: ({current.gridX}, {current.gridY})
      </div>
      <div className="flex gap-1 ">
        <span>Percentage: ({current.percentageX.toFixed(1)}%</span>
        <span>{current.percentageY.toFixed(1)}%)</span>
      </div>
    </div>
  );
}
