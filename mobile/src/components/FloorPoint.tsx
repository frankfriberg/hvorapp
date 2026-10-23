import { createContext, type ReactNode, useContext } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import { toScreen } from "@/lib/tilt";

/** The turning floor a `FloorPoint` stands on: its size and its turn. */
export const FloorContext = createContext<{
  width: number;
  height: number;
  turn: SharedValue<number>;
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
    const at = toScreen(
      floor.turn.value,
      typeof percentageX === "number" ? percentageX : percentageX.value,
      typeof percentageY === "number" ? percentageY : percentageY.value,
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
