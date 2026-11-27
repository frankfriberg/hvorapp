import { createContext, type ReactNode, useContext } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import type { Floor } from "@/lib/floor";
import { toScreen } from "@/lib/tilt";

/**
 * The turning floor a `FloorPoint` stands on: its size and its turn, how far
 * it's zoomed and moved (neither without them), and what floor it is, to
 * stand on top of what's built on it (salen's flat floor without it).
 */
export const FloorContext = createContext<{
  width: number;
  height: number;
  turn: SharedValue<number>;
  zoom?: SharedValue<number>;
  pan?: SharedValue<{ x: number; y: number }>;
  floor?: Pick<Floor, "aspect" | "heightAt" | "pinScale">;
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
      floor.floor ? floor.floor.heightAt(x, y) : 0,
      floor.floor?.aspect,
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
