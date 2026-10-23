import salen from "@shared/arenas/salen";
import { type GridPosition, snapToGrid } from "@shared/grid";
import { type ComponentRef, type ReactNode, useRef, useState } from "react";
import {
  type GestureResponderEvent,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { floorTransform, toFloor, useCompassTurn } from "@/lib/tilt";
import ArenaMap from "./ArenaMap";
import FloorPoint, { FloorContext } from "./FloorPoint";
import Pin from "./Pin";

// Vertical lift (px) applied to the placed marker so the user's fingertip
// doesn't cover it while dragging. Same as the web's touchMap.
const MARKER_LIFT_PX = 60;

type Props = {
  position?: GridPosition;
  /** The placed position on release; `undefined` while the pin is dragged. */
  onPlace?: (position: GridPosition | undefined) => void;
  /** Drawn over the floor under my pin: friends' seats, as `FloorPoint`s. */
  overlay?: ReactNode;
};

export default function TouchMap({ position, onPlace, overlay }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [isMoving, setIsMoving] = useState(false);
  const [current, setCurrent] = useState<GridPosition | undefined>(position);
  const origin = useRef({ x: 0, y: 0 });
  const viewRef = useRef<ComponentRef<typeof View>>(null);

  const turn = useCompassTurn();
  const floorStyle = useAnimatedStyle(() => ({
    transform: floorTransform(size.height || 1, turn.value),
  }));

  function positionAt(pageX: number, pageY: number): GridPosition {
    const { width, height } = size;
    // The finger is on the turned, leaning floor; find the point under it.
    const floor = toFloor(
      turn.value,
      ((pageX - origin.current.x) / width) * 100,
      ((pageY - origin.current.y - MARKER_LIFT_PX) / height) * 100,
    );
    const x = Math.min(Math.max((floor.percentageX / 100) * width, 0), width);
    const y = Math.min(Math.max((floor.percentageY / 100) * height, 0), height);
    const snapped = snapToGrid(x, y, width, height);

    return {
      percentageX: (x / width) * 100,
      percentageY: (y / height) * 100,
      gridX: snapped.x,
      gridY: snapped.y,
    };
  }

  function onGrant(e: GestureResponderEvent) {
    const { pageX, pageY } = e.nativeEvent;
    // Re-measure on every touch: the map can move with layout changes.
    viewRef.current?.measureInWindow((x, y) => {
      origin.current = { x, y };
      setIsMoving(true);
      setCurrent(positionAt(pageX, pageY));
      onPlace?.(undefined);
    });
  }

  function onMove(e: GestureResponderEvent) {
    setCurrent(positionAt(e.nativeEvent.pageX, e.nativeEvent.pageY));
  }

  function onRelease(e: GestureResponderEvent) {
    const placed = positionAt(e.nativeEvent.pageX, e.nativeEvent.pageY);
    setCurrent(placed);
    setIsMoving(false);
    onPlace?.(placed);
  }

  return (
    <View
      ref={viewRef}
      style={styles.map}
      onLayout={(e) => setSize(e.nativeEvent.layout)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={onGrant}
      onResponderMove={onMove}
      onResponderRelease={onRelease}
      // A drag cut short by the system (a call, a gesture) still places the pin.
      onResponderTerminate={onRelease}
    >
      {/* The leaning floor's near half stands in front of the screen, and iOS
          would draw it over the pins; a flat wrapper flattens it behind them. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Animated.View style={[StyleSheet.absoluteFill, floorStyle]}>
          <ArenaMap arena={salen} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </View>
      <FloorContext.Provider value={{ ...size, turn }}>
        {overlay}
        {current && (
          <FloorPoint
            percentageX={current.percentageX}
            percentageY={current.percentageY}
          >
            <Pin
              percentageX={0}
              percentageY={0}
              viewportWidth={windowWidth}
              lifted={isMoving}
            />
          </FloorPoint>
        )}
      </FloorContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { width: "100%", aspectRatio: salen.width / salen.height },
});
