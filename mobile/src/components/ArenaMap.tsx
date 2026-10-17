import {
  ARENA_COLORS,
  ARENA_OUTLINE_WIDTH,
  type Arena,
  type ArenaColors,
} from "@shared/arena";
import { memo } from "react";
import { type StyleProp, View, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";

type Props = {
  arena: Arena;
  colors?: ArenaColors;
  style?: StyleProp<ViewStyle>;
};

// Memoised: the map sits under the pin and must not redraw its ~400 paths on
// every drag frame.
export default memo(function ArenaMap({
  arena,
  colors = ARENA_COLORS,
  style,
}: Props) {
  return (
    // Svg ignores `pointerEvents`; the wrapper keeps it from taking the drag
    // away from the map underneath.
    <View style={style} pointerEvents="none">
      <Svg
        viewBox={`0 0 ${arena.width} ${arena.height}`}
        width="100%"
        height="100%"
      >
        {arena.shapes.map(({ kind, d }, i) =>
          kind === "outline" ? (
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
          ) : (
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
      </Svg>
    </View>
  );
});
