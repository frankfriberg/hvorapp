import salen from "@shared/arenas/salen";
import { type GridPosition, percentageToGrid } from "@shared/grid";
import * as Haptics from "expo-haptics";
import { type ComponentRef, type ReactNode, useRef, useState } from "react";
import {
  type GestureResponderEvent,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { floorTransform, toFloor, toScreen, useCompassTurn } from "@/lib/tilt";
import ArenaMap from "./ArenaMap";
import FloorPoint, { FloorContext } from "./FloorPoint";
import { friendPinSize } from "./FriendPin";
import Pin from "./Pin";

// Vertical lift (px) applied to the placed marker so the user's fingertip
// doesn't cover it while dragging. Same as the web's touchMap.
const MARKER_LIFT_PX = 60;

// The pin swings like a weighted toy pulled by its tip: its head trails the
// way it's dragged, sideways as a lean and along the hall as a tip towards or
// away from you, and springs back upright past centre when the finger stops.
// TARGET is how far it leans per px/s, STIFFNESS and DAMPING the spring
// (≈1.5 Hz, about three visible swings).
const SWING_TARGET = 0.0007;
const SWING_MAX = 0.6;
// Tipping along the hall is foreshortened by the floor's lean, so it needs more.
const PITCH_TARGET = 0.0012;
const PITCH_MAX = 0.8;
const SWING_STIFFNESS = 90;
const SWING_DAMPING = 4.5;
// How long the swing keeps simulating after release, in ms.
const SWING_SETTLE_MS = 3000;
// How long the pin takes to glide to where the finger is, in ms: a touch away
// from it slides it over rather than making it jump.
const GLIDE_MS = 120;
// Only a finger held still this long (ms) picks the pin up; a quicker touch
// is a tap, and one that slides off first does nothing.
const HOLD_MS = 250;
const HOLD_SLOP_PX = 10;
// Room around a friend pin that still counts as tapping it, in px.
const TAP_SLOP_PX = 8;

type Props = {
  position?: GridPosition;
  /** The placed position on release; `undefined` while the pin is dragged. */
  onPlace?: (position: GridPosition | undefined) => void;
  /** Drawn over the floor under my pin: friends' seats, as `FloorPoint`s. */
  overlay?: ReactNode;
  /** The friend pins in `overlay`, by id, for telling which one is tapped. */
  friendPins?: { id: string; percentageX: number; percentageY: number }[];
  /** A tap: on a friend pin, its id; anywhere else, null. */
  onTap?: (id: string | null) => void;
};

export default function TouchMap({
  position,
  onPlace,
  overlay,
  friendPins = [],
  onTap,
}: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [isMoving, setIsMoving] = useState(false);
  const [current, setCurrent] = useState<GridPosition | undefined>(position);
  const origin = useRef({ x: 0, y: 0 });
  const viewRef = useRef<ComponentRef<typeof View>>(null);

  const finger = useSharedValue({ x: 0, y: 0 });
  const angle = useSharedValue(0);
  const pitch = useSharedValue(0);
  const spin = useSharedValue({ angle: 0, pitch: 0 });
  const last = useSharedValue({ x: 0, y: 0, vx: 0, vy: 0 });
  const swing = useFrameCallback(({ timeSincePreviousFrame }) => {
    const dt = Math.min((timeSincePreviousFrame ?? 16) / 1000, 0.05);
    if (dt <= 0) return;
    // Smoothed so a jittery finger doesn't shake the pin.
    const { x, y } = finger.value;
    const vx = last.value.vx * 0.75 + ((x - last.value.x) / dt) * 0.25;
    const vy = last.value.vy * 0.75 + ((y - last.value.y) / dt) * 0.25;
    last.value = { x, y, vx, vy };
    const clamp = (value: number, max: number) =>
      Math.max(-max, Math.min(max, value));
    const step = (target: number, at: number, speed: number) =>
      speed + (SWING_STIFFNESS * (target - at) - SWING_DAMPING * speed) * dt;
    // Dragged right, the head leans left; dragged up the screen, away from
    // you, it tips towards you.
    const angleSpin = step(
      clamp(-vx * SWING_TARGET, SWING_MAX),
      angle.value,
      spin.value.angle,
    );
    const pitchSpin = step(
      clamp(vy * PITCH_TARGET, PITCH_MAX),
      pitch.value,
      spin.value.pitch,
    );
    spin.value = { angle: angleSpin, pitch: pitchSpin };
    angle.value += angleSpin * dt;
    pitch.value += pitchSpin * dt;
  }, false);
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined);
  // The touch until it's held long enough to pick the pin up: where it began,
  // where the finger is now, and the timer that picks the pin up.
  const press = useRef<{
    start: { x: number; y: number };
    at: { x: number; y: number };
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const holding = useRef(false);

  const pinX = useSharedValue(position?.percentageX ?? 0);
  const pinY = useSharedValue(position?.percentageY ?? 0);
  function moveTo(next: GridPosition) {
    // The first time it appears it's already there.
    const glide = current ? { duration: GLIDE_MS } : { duration: 0 };
    pinX.value = withTiming(next.percentageX, glide);
    pinY.value = withTiming(next.percentageY, glide);
    setCurrent(next);
  }

  const turn = useCompassTurn();
  // The rows show their side towards you: the map's bottom facing south, its
  // top once turned to face north. Flipped halfway through the turn, when the
  // sides are edge-on.
  const [facingNorth, setFacingNorth] = useState(false);
  useAnimatedReaction(
    () => turn.value > 90,
    (north, before) => {
      if (north !== before) runOnJS(setFacingNorth)(north);
    },
  );
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
    const clamp = (value: number) => Math.min(Math.max(value, 0), 100);
    const percentageX = clamp(floor.percentageX);
    const percentageY = clamp(floor.percentageY);
    // Not snapped: the link and friends get the pin where it stands.
    return {
      percentageX,
      percentageY,
      ...percentageToGrid(percentageX, percentageY),
    };
  }

  /** The friend pin under a point on screen, nearest first, or null. */
  function friendAt(pageX: number, pageY: number) {
    const x = pageX - origin.current.x;
    const y = pageY - origin.current.y;
    const { width, height, float } = friendPinSize(windowWidth);
    let nearest: { id: string; distance: number } | null = null;
    for (const pin of friendPins) {
      const at = toScreen(turn.value, pin.percentageX, pin.percentageY);
      const px = (at.percentageX / 100) * size.width;
      const py = (at.percentageY / 100) * size.height;
      // The pin stands above its seat, floating a little.
      const inside =
        Math.abs(x - px) <= width / 2 + TAP_SLOP_PX &&
        y <= py - float + TAP_SLOP_PX &&
        y >= py - float - height - TAP_SLOP_PX;
      const distance = Math.hypot(x - px, y - (py - float - height / 2));
      if (inside && (!nearest || distance < nearest.distance)) {
        nearest = { id: pin.id, distance };
      }
    }
    return nearest?.id ?? null;
  }

  function onGrant(e: GestureResponderEvent) {
    const { pageX, pageY } = e.nativeEvent;
    // Re-measure on every touch: the map can move with layout changes.
    viewRef.current?.measureInWindow((x, y) => {
      origin.current = { x, y };
    });
    press.current = {
      start: { x: pageX, y: pageY },
      at: { x: pageX, y: pageY },
      timer: setTimeout(pickUp, HOLD_MS),
    };
  }

  function pickUp() {
    if (!press.current) return;
    const { x: pageX, y: pageY } = press.current.at;
    press.current = null;
    holding.current = true;
    clearTimeout(settle.current);
    finger.value = { x: pageX, y: pageY };
    last.value = { x: pageX, y: pageY, vx: 0, vy: 0 };
    swing.setActive(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsMoving(true);
    moveTo(positionAt(pageX, pageY));
    onPlace?.(undefined);
  }

  function onMove(e: GestureResponderEvent) {
    const { pageX, pageY } = e.nativeEvent;
    if (!holding.current) {
      // Slid away before it was held: not a hold, nor a tap.
      const touch = press.current;
      if (!touch) return;
      touch.at = { x: pageX, y: pageY };
      if (
        Math.hypot(pageX - touch.start.x, pageY - touch.start.y) > HOLD_SLOP_PX
      ) {
        clearTimeout(touch.timer);
        press.current = null;
      }
      return;
    }
    finger.value = { x: pageX, y: pageY };
    moveTo(positionAt(pageX, pageY));
  }

  function onRelease(e: GestureResponderEvent) {
    if (!holding.current) {
      const touch = press.current;
      press.current = null;
      if (touch) {
        clearTimeout(touch.timer);
        onTap?.(friendAt(touch.start.x, touch.start.y));
      }
      return;
    }
    holding.current = false;
    const placed = positionAt(e.nativeEvent.pageX, e.nativeEvent.pageY);
    moveTo(placed);
    setIsMoving(false);
    onPlace?.(placed);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    settle.current = setTimeout(() => {
      swing.setActive(false);
      angle.value = 0;
      pitch.value = 0;
      spin.value = { angle: 0, pitch: 0 };
    }, SWING_SETTLE_MS);
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
          <ArenaMap
            arena={salen}
            style={StyleSheet.absoluteFill}
            raised={facingNorth ? "north" : "south"}
          />
        </Animated.View>
      </View>
      <FloorContext.Provider value={{ ...size, turn }}>
        {overlay}
        {current && (
          <FloorPoint percentageX={pinX} percentageY={pinY}>
            <Pin
              percentageX={0}
              percentageY={0}
              viewportWidth={windowWidth}
              lifted={isMoving}
              angle={angle}
              pitch={pitch}
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
