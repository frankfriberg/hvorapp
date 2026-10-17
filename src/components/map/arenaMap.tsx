import {
  ARENA_COLORS,
  ARENA_OUTLINE_WIDTH,
  type Arena,
  type ArenaColors,
} from "@shared/arena";

type Props = {
  arena: Arena;
  colors?: ArenaColors;
  className?: string;
};

export default function ArenaMap({
  arena,
  colors = ARENA_COLORS,
  className,
}: Props) {
  return (
    <svg
      viewBox={`0 0 ${arena.width} ${arena.height}`}
      className={className}
      role="img"
    >
      <title>Kart over salen</title>
      {arena.shapes.map(({ kind, d }, i) =>
        kind === "outline" ? (
          <path
            // biome-ignore lint/suspicious/noArrayIndexKey: shapes are static and never reorder.
            key={i}
            d={d}
            fill="none"
            stroke={colors.outline}
            strokeWidth={ARENA_OUTLINE_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <path
            // biome-ignore lint/suspicious/noArrayIndexKey: shapes are static and never reorder.
            key={i}
            d={d}
            fill={colors[kind]}
            fillRule="evenodd"
            clipRule="evenodd"
          />
        ),
      )}
    </svg>
  );
}
