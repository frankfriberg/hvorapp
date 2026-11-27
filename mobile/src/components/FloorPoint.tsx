import { createContext, type ReactNode, useContext } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import { standHeight, toScreen } from "@/lib/tilt";

/**
 * The turning floor a `FloorPoint` stands on: its size and its turn, how far
 * it's zoomed and moved (neither without them), and whether it has the
 * stands built on it, to stand on top of.
 */
export const FloorContext = createContext<{
  width: number;
  height: number;
  turn: SharedValue<number>;
  zoom?: SharedValue<number>;
  pan?: SharedValue<{ x: number; y: number }>;
  stands?: boolean;
} | null>(null);

type Props = {
  /** The point on the floor, as map percentages; shared values to animate it. */
  percentageX: number | SharedValue<number>;
  percentageY: number | SharedValue<number>;
  /** Drawn upright with its origin on the point: a pin at 0%, 0%. */
  children: ReactNode;
};

/** Keeps its children on a point of the floor as the floor turns. */
export default function FloorPoint({
  percentageX,
  percentageY,
  children,
}: Props) {
  const floor = useContext(FloorContext);
  const style = useAnimatedStyle(() => {
    if (!floor) return {};
    const x = typeof percentageX === "number" ? percentageX : percentageX.value;
    const y = typeof percentageY === "number" ? percentageY : percentageY.value;
    const at = toScreen(
      {
        turn: floor.turn.value,
        zoom: floor.zoom?.value ?? 1,
        panX: floor.pan?.value.x ?? 0,
        panY: floor.pan?.value.y ?? 0,
      },
      x,
      y,
      floor.stands ? standHeight(x, y) : 0,
    );
    return {
      transform: [
        { translateX: (at.percentageX / 100) * floor.width },
        { translateY: (at.percentageY / 100) * floor.height },
      ],
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[styles.origin, style]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Above the leaning floor, which stands partly in front of the screen.
  origin: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    zIndex: 1,
  },
});
