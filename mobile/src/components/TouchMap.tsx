import salen from "@shared/arenas/salen";
import type { GridPosition } from "@shared/grid";
import { formatGridCoordinates, snapToGrid } from "@shared/grid";
import { PIN_COLOR, PIN_DOT_VW, PIN_WIDTH_VW } from "@shared/pin";
import { Image } from "expo-image";
import { type ComponentRef, useRef, useState } from "react";
import {
  type GestureResponderEvent,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { locationUrl } from "@/lib/links";
import ArenaMap from "./ArenaMap";

const pinIcon = require("@public/pin.svg");

// Intrinsic size of public/pin.svg.
const PIN_ASPECT = 316 / 250;

// Vertical lift (px) applied to the placed marker so the user's fingertip
// doesn't cover it while dragging. Same as the web's touchMap.
const MARKER_LIFT_PX = 60;

// The web's pin transforms, translate(-50%, -115%) at rest and -150% while
// dragging, expressed as fractions of the pin's height.
const PIN_LIFT_AT_REST = 1.15;
const PIN_LIFT_MOVING = 1.5;

type Props = {
  arena: string;
  position?: GridPosition;
  onUrlChange?: (url: string | undefined) => void;
};

export default function TouchMap({ arena, position, onUrlChange }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [isMoving, setIsMoving] = useState(false);
  const [current, setCurrent] = useState<GridPosition | undefined>(position);
  const origin = useRef({ x: 0, y: 0 });
  const viewRef = useRef<ComponentRef<typeof View>>(null);

  // The pin is sized in `vw` on the web, so size it off the window here.
  const pinWidth = (windowWidth * PIN_WIDTH_VW) / 100;
  const pinHeight = pinWidth * PIN_ASPECT;
  const dot = (windowWidth * PIN_DOT_VW) / 100;

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
      onUrlChange?.(undefined);
    });
  }

  function onMove(e: GestureResponderEvent) {
    setCurrent(positionAt(e.nativeEvent.pageX, e.nativeEvent.pageY));
  }

  function onRelease(e: GestureResponderEvent) {
    const { gridX, gridY } = positionAt(
      e.nativeEvent.pageX,
      e.nativeEvent.pageY,
    );
    setIsMoving(false);
    onUrlChange?.(locationUrl(arena, formatGridCoordinates(gridX, gridY)));
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
    >
      <ArenaMap arena={salen} style={StyleSheet.absoluteFill} />
      {current && (
        <View
          pointerEvents="none"
          style={[
            styles.anchor,
            { left: `${current.percentageX}%`, top: `${current.percentageY}%` },
          ]}
        >
          <Image
            source={pinIcon}
            style={{
              position: "absolute",
              width: pinWidth,
              height: pinHeight,
              transform: [
                { translateX: -pinWidth / 2 },
                {
                  translateY:
                    -pinHeight *
                    (isMoving ? PIN_LIFT_MOVING : PIN_LIFT_AT_REST),
                },
              ],
            }}
          />
          <View
            style={{
              position: "absolute",
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              backgroundColor: PIN_COLOR,
              transform: [{ translateX: -dot / 2 }, { translateY: -dot / 2 }],
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  map: { width: "100%", aspectRatio: salen.width / salen.height },
  anchor: { position: "absolute", width: 0, height: 0 },
});
