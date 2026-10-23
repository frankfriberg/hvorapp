import {
  ARENA_COLORS,
  ARENA_COLUMN_TOP_COLOR,
  ARENA_OUTLINE_WIDTH,
  ARENA_ROW_SIDE_COLOR,
  ARENA_STAGE_SIDE_COLOR,
  ARENA_TIER_SIDE_COLOR,
  type Arena,
  type ArenaColors,
  type ArenaSegment,
  pathSegments,
} from "@shared/arena";
import { memo, useMemo } from "react";
import { type StyleProp, View, type ViewStyle } from "react-native";
import Svg, { G, Path } from "react-native-svg";

// How tall rows stand, in arena units: about 2 points on a phone.
const ROW_HEIGHT = 10;
// How tall the columns (the map's markers) stand, and how far apart the
// copies of their base are drawn to fill in their side: under the base's
// diameter (about 10), so the side looks solid.
const COLUMN_HEIGHT = 45; // About 9 points on a phone.
const COLUMN_STEP = 5;
const COLUMN_STEPS = Array.from(
  { length: COLUMN_HEIGHT / COLUMN_STEP },
  (_, i) => i * COLUMN_STEP,
);
// How much each step up to the stage rises (under 1 point on a phone): the
// stage stands a rise for each step and one more, and each step a rise lower
// than the one above it, so every step has room to stand on. And how far apart
// the copies of a base are drawn to fill in its side.
const STEP_RISE = 3.75;
const STAGE_STEP = 2;
// How tall a tier's side stands, about 1.5 points on a phone.
const TIER_RISE = 7.5;

// Tier edges shorter than this, end to end, are the short ones at the ends
// of the rows; in `tall-tiers` the long ones stand twice as tall.
const SHORT_TIER = 100;

/**
 * The faces of the tiers the seats stand on that look towards the viewer:
 * those in the far half of the map, as path data, the long edges' apart from
 * the short ones' so those can be drawn over them. Each hangs from its edge
 * towards the viewer, like the side of a step, the same height whichever
 * way the edge runs, except along the view, where it has none.
 */
function tierFaces(arena: Arena, raised: "south" | "north") {
  const towards = raised === "south" ? 1 : -1;
  const half = arena.height / 2;
  // The segments joined end to end into the lines they were drawn as.
  const lines: { tall: boolean; segments: ArenaSegment[] }[] = [];
  for (const { d, part } of arena.shapes) {
    if (part !== "tiers" && part !== "tall-tiers") continue;
    for (const segment of pathSegments(d)) {
      const line = lines.at(-1);
      const last = line?.segments.at(-1);
      if (line && last && last[2] === segment[0] && last[3] === segment[1]) {
        line.segments.push(segment);
      } else lines.push({ tall: part === "tall-tiers", segments: [segment] });
    }
  }
  const faces = { long: "", short: "" };
  for (const { tall, segments } of lines) {
    const length = segments.reduce(
      (sum, [x1, y1, x2, y2]) => sum + Math.hypot(x2 - x1, y2 - y1),
      0,
    );
    const short = length < SHORT_TIER;
    for (const [x1, y1, x2, y2] of segments) {
      const far = raised === "south" ? y1 + y2 < 2 * half : y1 + y2 > 2 * half;
      const drop = towards * TIER_RISE * (tall && !short ? 2 : 1);
      if (far && Math.abs(x2 - x1) > 0.5) {
        faces[short ? "short" : "long"] +=
          `M${x1} ${y1}L${x2} ${y2}L${x2} ${y2 + drop}L${x1} ${y1 + drop}Z`;
      }
    }
  }
  return faces;
}

type Props = {
  arena: Arena;
  colors?: ArenaColors;
  style?: StyleProp<ViewStyle>;
  /**
   * Gives rows height and stands markers up as columns, seen from the bottom
   * of the map (`"south"`) or the top (`"north"`): from whoever looks at the
   * floor in perspective. Flat without it.
   */
  raised?: "south" | "north";
};

// Memoised: the map sits under the pin and must not redraw its ~1000 paths on
// every drag frame.
export default memo(function ArenaMap({
  arena,
  colors = ARENA_COLORS,
  style,
  raised,
}: Props) {
  // Room around the map for the rows' sides and the columns at its edges,
  // the SVG grown by as much as it's moved out so the map stays put.
  const margin = raised ? COLUMN_HEIGHT : 0;
  const away = raised === "south" ? -1 : 1;
  const stairs = arena.shapes.filter(({ part }) => part === "stair");
  // Stairs first, lowest step first, then the stage, so each stands in front
  // of what's lower; each the outline's fill, which closes the open steps.
  const blocks = raised
    ? [
        // Lowest first, so the first is one rise tall.
        ...stairs.map(({ d }, i) => ({ d, height: STEP_RISE * (i + 1) })),
        ...arena.shapes
          .filter(({ part }) => part === "stage")
          .map(({ d }) => ({ d, height: STEP_RISE * (stairs.length + 1) })),
      ]
    : [];
  const tiers = useMemo(
    () => (raised ? tierFaces(arena, raised) : { long: "", short: "" }),
    [arena, raised],
  );
  return (
    // Svg ignores `pointerEvents`; the wrapper keeps it from taking the drag
    // away from the map underneath.
    <View style={style} pointerEvents="none">
      <Svg
        viewBox={`${-margin} ${-margin} ${arena.width + 2 * margin} ${arena.height + 2 * margin}`}
        style={{
          position: "absolute",
          left: `${(-margin / arena.width) * 100}%`,
          top: `${(-margin / arena.height) * 100}%`,
          width: `${((arena.width + 2 * margin) / arena.width) * 100}%`,
          height: `${((arena.height + 2 * margin) / arena.height) * 100}%`,
        }}
      >
        {raised && (
          // Each row's side: the row again, in grey, shifted towards the
          // viewer and drawn under the row itself.
          <G
            transform={`translate(0 ${raised === "south" ? ROW_HEIGHT : -ROW_HEIGHT})`}
            fill={ARENA_ROW_SIDE_COLOR}
          >
            {arena.shapes.map(({ kind, d }, i) =>
              kind === "row" ? (
                <Path
                  // biome-ignore lint/suspicious/noArrayIndexKey: shapes are static and never reorder.
                  key={i}
                  d={d}
                  fillRule="evenodd"
                  clipRule="evenodd"
                />
              ) : null,
            )}
          </G>
        )}
        {raised && (
          // Under the rows and the tiers' edges, so a face only shows between
          // an edge and the rows on the tier above it.
          // The short edges' faces over the long ones'.
          <G fill={ARENA_TIER_SIDE_COLOR}>
            <Path d={tiers.long} />
            <Path d={tiers.short} />
          </G>
        )}
        {arena.shapes.map(({ kind, d, part }, i) =>
          raised && (part === "stage" || part === "stair") ? null : kind ===
            "outline" ? (
            <Path
              // biome-ignore lint/suspicious/noArrayIndexKey: shapes are static and never reorder.
              key={i}
              d={d}
              fill="none"
              stroke={colors.outline}
              strokeWidth={ARENA_OUTLINE_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : raised && kind === "marker" ? null : (
            <Path
              // biome-ignore lint/suspicious/noArrayIndexKey: shapes are static and never reorder.
              key={i}
              d={d}
              fill={colors[kind]}
              fillRule="evenodd"
              clipRule="evenodd"
            />
          ),
        )}
        {blocks.map(({ d, height }, i) => (
          // A block raised like a column, its top the floor's white with the
          // outline drawn round it.
          // biome-ignore lint/suspicious/noArrayIndexKey: shapes are static and never reorder.
          <G key={i}>
            {Array.from(
              { length: Math.ceil(height / STAGE_STEP) },
              (_, i) => i * STAGE_STEP,
            ).map((step) => (
              <Path
                key={step}
                d={d}
                fill={ARENA_STAGE_SIDE_COLOR}
                // The base outlined too, for the foot of the side.
                stroke={step === 0 ? colors.outline : undefined}
                strokeWidth={ARENA_OUTLINE_WIDTH}
                transform={`translate(0 ${away * step})`}
              />
            ))}
            <Path
              d={d}
              fill="#fff"
              stroke={colors.outline}
              strokeWidth={ARENA_OUTLINE_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
              transform={`translate(0 ${away * height})`}
            />
          </G>
        ))}
        {raised &&
          // Each column after the rows, so it stands in front of those behind
          // it: its base stepped away from the viewer to make its side, and
          // its top in a lighter grey.
          arena.shapes.map(({ kind, d }, i) => {
            if (kind !== "marker") return null;
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: shapes are static and never reorder.
              <G key={i}>
                {COLUMN_STEPS.map((step) => (
                  <Path
                    key={step}
                    d={d}
                    fill={colors.marker}
                    transform={`translate(0 ${away * step})`}
                  />
                ))}
                <Path
                  d={d}
                  fill={ARENA_COLUMN_TOP_COLOR}
                  transform={`translate(0 ${away * COLUMN_HEIGHT})`}
                />
              </G>
            );
          })}
      </Svg>
    </View>
  );
});
