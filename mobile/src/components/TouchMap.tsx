import salen from "@shared/arenas/salen";
import { type GridPosition, snapToGrid } from "@shared/grid";
import { type ComponentRef, type ReactNode, useRef, useState } from "react";
import {
  type GestureResponderEvent,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import ArenaMap from "./ArenaMap";
import Pin from "./Pin";

// Vertical lift (px) applied to the placed marker so the user's fingertip
// doesn't cover it while dragging. Same as the web's touchMap.
const MARKER_LIFT_PX = 60;

type Props = {
  position?: GridPosition;
  /** The placed position on release; `undefined` while the pin is dragged. */
  onPlace?: (position: GridPosition | undefined) => void;
  /** Drawn on the map under my pin: friends' seats. */
  overlay?: ReactNode;
};

export default function TouchMap({ position, onPlace, overlay }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [isMoving, setIsMoving] = useState(false);
  const [current, setCurrent] = useState<GridPosition | undefined>(position);
  const origin = useRef({ x: 0, y: 0 });
  const viewRef = useRef<ComponentRef<typeof View>>(null);

  function positionAt(pageX: number, pageY: number): GridPosition {
    const { width, height } = size;
    const x = Math.min(Math.max(pageX - origin.current.x, 0), width);
    const y = Math.min(
      Math.max(pageY - origin.current.y - MARKER_LIFT_PX, 0),
      height,
    );
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
      <ArenaMap arena={salen} style={StyleSheet.absoluteFill} />
      {overlay}
      {current && (
        <Pin
          percentageX={current.percentageX}
          percentageY={current.percentageY}
          viewportWidth={windowWidth}
          lifted={isMoving}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  map: { width: "100%", aspectRatio: salen.width / salen.height },
});
