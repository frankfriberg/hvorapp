import { nearestSeat } from "@shared/arena";
import salen from "@shared/arenas/salen";
import salenLevels from "@shared/arenas/salen-levels";
import { type GridPosition, percentageToGrid } from "@shared/grid";
import { PIN_COLOR } from "@shared/pin";
import * as Haptics from "expo-haptics";
import {
  type ComponentRef,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type GestureResponderEvent,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { colorForInitials, initials } from "@/lib/friends";
import { t } from "@/lib/i18n";
import type { PinFace } from "@/lib/pinScene";
import {
  friendPinSize,
  LIFT_SPRING,
  PIN_LIFT_AT_REST,
  PIN_LIFT_MOVING,
  pinGrowth,
  pinSize,
} from "@/lib/pinShape";
import { useSession } from "@/lib/session";
import {
  type FloorView,
  fit,
  standHeight,
  toPlane,
  toScreen,
  toStands,
  useCompassTurn,
} from "@/lib/tilt";
import ArenaScene, { type ScenePin } from "./ArenaScene";
import { FloorContext } from "./FloorPoint";
import PinFaces, { type FaceRequest } from "./PinFaces";
import RoundButton from "./RoundButton";

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
// How much of the swing a glide to where the finger was held gets: it moves
// far faster than a drag, and in full it would swing wildly.
const GLIDE_SWING = 0.5;
// How long the pin takes to glide to where the finger is, in ms: a touch away
// from it slides it over rather than making it jump.
const GLIDE_MS = 120;
// Picked up away from where it stands, it glides over for about half a swing,
// so its head trails on the way and overshoots as it stops.
const PICK_UP_GLIDE_MS = 350;
// Only a finger held still this long (ms) picks the pin up; a quicker touch
// is a tap, and one that slides off first does nothing.
const HOLD_MS = 150;
const HOLD_SLOP_PX = 10;
// Room around a friend pin that still counts as tapping it, in px.
const TAP_SLOP_PX = 8;
// How far in two fingers zoom the map, against the whole map facing north
// or south, and how far they must twist it, in degrees, before it stops
// following the compass and turns with them.
const MAX_ZOOM = 6;
const TWIST_DEG = 8;
// How long the map takes to go back to how the compass has it, in ms.
const RESET_MS = 500;

type Props = {
  position?: GridPosition;
  /** The placed position on release; `undefined` while the pin is dragged. */
  onPlace?: (position: GridPosition | undefined) => void;
  /** Drawn over the map: labels on it, as `FloorPoint`s. */
  overlay?: ReactNode;
  /** Friends' pins, standing on their seats. */
  friendPins?: {
    id: string;
    name: string;
    avatarUrl: string | null;
    percentageX: number;
    percentageY: number;
  }[];
  /** A tap: on a friend pin, its id; anywhere else, null. */
  onTap?: (id: string | null) => void;
  /** Room above the map, which it's drawn under. */
  top?: number;
};

export default function TouchMap({
  position,
  onPlace,
  overlay,
  friendPins = [],
  onTap,
  top = 0,
}: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const [size, setSize] = useState({ width: 0, height: 0 });
  // Where the map's box is in the surface around it, which it's drawn over.
  const [box, setBox] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [isMoving, setIsMoving] = useState(false);
  const [current, setCurrent] = useState<GridPosition | undefined>(position);
  const origin = useRef({ x: 0, y: 0 });
  const viewRef = useRef<ComponentRef<typeof View>>(null);

  const { session } = useSession();
  const me = session.status === "signed-in" ? session.user : null;

  const pinX = useSharedValue(position?.percentageX ?? 0);
  const pinY = useSharedValue(position?.percentageY ?? 0);
  const { turn, manual, resume } = useCompassTurn();
  const zoom = useSharedValue(1);
  const pan = useSharedValue({ x: 0, y: 0 });
  const view = useDerivedValue<FloorView>(() => ({
    turn: turn.value,
    zoom: zoom.value,
    panX: pan.value.x,
    panY: pan.value.y,
  }));
  // Zoomed, moved or turned by hand: then there's a way back.
  const [moved, setMoved] = useState(false);
  const layout = useSharedValue({ width: 0, height: 0 });
  /** Where the pin stands on screen, in px from the map's corner. */
  function pinOnScreen(percentageX: number, percentageY: number) {
    "worklet";
    const at = toScreen(
      view.value,
      percentageX,
      percentageY,
      standHeight(percentageX, percentageY),
    );
    return {
      x: (at.percentageX / 100) * layout.value.width,
      y: (at.percentageY / 100) * layout.value.height,
    };
  }
  const angle = useSharedValue(0);
  const pitch = useSharedValue(0);
  const spin = useSharedValue({ angle: 0, pitch: 0 });
  const last = useSharedValue({ x: 0, y: 0, vx: 0, vy: 0 });
  const lift = useSharedValue(PIN_LIFT_AT_REST);
  useEffect(() => {
    lift.value = withSpring(
      isMoving ? PIN_LIFT_MOVING : PIN_LIFT_AT_REST,
      isMoving ? LIFT_SPRING.up : LIFT_SPRING.down,
    );
  }, [isMoving, lift]);
  // How much of the swing the pin's motion gets; less while it glides over.
  const reach = useSharedValue(1);
  const swing = useFrameCallback(({ timeSincePreviousFrame }) => {
    const dt = Math.min((timeSincePreviousFrame ?? 16) / 1000, 0.05);
    if (dt <= 0) return;
    // The pin's own motion, so a glide across the map swings it as a drag
    // does. Smoothed so a jittery finger doesn't shake the pin.
    const { x, y } = pinOnScreen(pinX.value, pinY.value);
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
      clamp(-vx * SWING_TARGET, SWING_MAX) * reach.value,
      angle.value,
      spin.value.angle,
    );
    const pitchSpin = step(
      clamp(vy * PITCH_TARGET, PITCH_MAX) * reach.value,
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
  // Fingers moving the map rather than the pin: one sliding it, two zooming,
  // turning and sliding it, or done with that until they all lift.
  const moving = useRef<
    | { fingers: 1; start: { x: number; y: number }; from: FloorView }
    | {
        fingers: 2;
        start: [{ x: number; y: number }, { x: number; y: number }];
        from: FloorView;
        twisted: boolean;
      }
    | { fingers: 0 }
    | null
  >(null);

  // When the glide under way ends, so a drag doesn't cut it short.
  const glideEnd = useRef(0);
  function moveTo(next: GridPosition, duration = GLIDE_MS) {
    const now = Date.now();
    // The first time it appears it's already there.
    const glide = {
      duration: current ? Math.max(duration, glideEnd.current - now) : 0,
    };
    glideEnd.current = now + glide.duration;
    pinX.value = withTiming(next.percentageX, glide);
    pinY.value = withTiming(next.percentageY, glide);
    setCurrent(next);
  }

  function positionAt(pageX: number, pageY: number): GridPosition {
    const { width, height } = size;
    // The finger is on the turned, leaning floor; find the point under it.
    const floor = toStands(
      view.value,
      ((pageX - origin.current.x) / width) * 100,
      ((pageY - origin.current.y - MARKER_LIFT_PX) / height) * 100,
    );
    const clamp = (value: number) => Math.min(Math.max(value, 0), 100);
    const percentageX = clamp(floor.percentageX);
    const percentageY = clamp(floor.percentageY);
    // Not snapped while dragged; `onSeat` puts it on a seat when dropped.
    return {
      percentageX,
      percentageY,
      ...percentageToGrid(percentageX, percentageY),
    };
  }

  /** On the seat nearest it, if it was dropped on or by one. */
  function onSeat(position: GridPosition): GridPosition {
    const seat = nearestSeat(
      salenLevels.seats,
      (position.percentageX / 100) * salen.width,
      (position.percentageY / 100) * salen.height,
    );
    if (!seat) return position;
    const percentageX = (seat.x / salen.width) * 100;
    const percentageY = (seat.y / salen.height) * 100;
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
    // As big as it's grown with the zoom.
    const grown = pinGrowth(view.value.zoom);
    const size = friendPinSize(windowWidth);
    const [width, height, float] = [
      size.width * grown,
      size.height * grown,
      size.float * grown,
    ];
    let nearest: { id: string; distance: number } | null = null;
    for (const pin of friendPins) {
      const at = toScreen(
        view.value,
        pin.percentageX,
        pin.percentageY,
        standHeight(pin.percentageX, pin.percentageY),
      );
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
    moving.current = null;
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
    const next = positionAt(pageX, pageY);
    // From where it stands now; the first time, from where it appears.
    const from = current
      ? pinOnScreen(pinX.value, pinY.value)
      : pinOnScreen(next.percentageX, next.percentageY);
    last.value = { ...from, vx: 0, vy: 0 };
    reach.value = GLIDE_SWING;
    setTimeout(() => {
      reach.value = 1;
    }, PICK_UP_GLIDE_MS);
    swing.setActive(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsMoving(true);
    moveTo(next, PICK_UP_GLIDE_MS);
    onPlace?.(undefined);
  }

  /** Where a finger is on the plane the map moves in. */
  function onPlane({ x, y }: { x: number; y: number }) {
    return toPlane(
      ((x - origin.current.x) / size.width) * 100,
      ((y - origin.current.y) / size.height) * 100,
    );
  }

  function onMove(e: GestureResponderEvent) {
    const { pageX, pageY, touches } = e.nativeEvent;
    if (!holding.current) {
      if (touches.length >= 2) {
        // Two fingers: no pin, no tap; the map zooms and turns with them.
        if (press.current) clearTimeout(press.current.timer);
        press.current = null;
        const fingers = [
          { x: touches[0].pageX, y: touches[0].pageY },
          { x: touches[1].pageX, y: touches[1].pageY },
        ] as const;
        if (moving.current?.fingers !== 2) {
          moving.current = {
            fingers: 2,
            start: [fingers[0], fingers[1]],
            from: view.value,
            twisted: false,
          };
          return;
        }
        pinch(moving.current, fingers);
        return;
      }
      if (moving.current?.fingers === 2) {
        // One lifted: the rest of the touch does nothing.
        moving.current = { fingers: 0 };
      }
      if (moving.current?.fingers === 0) return;
      if (moving.current?.fingers === 1) {
        const start = onPlane(moving.current.start);
        const now = onPlane({ x: pageX, y: pageY });
        const { from } = moving.current;
        pan.value = clampPan(
          from.panX + now.x - start.x,
          from.panY + now.y - start.y,
          from,
        );
        return;
      }
      // Slid away before it was held: not a hold, nor a tap, but sliding the
      // map.
      const touch = press.current;
      if (!touch) return;
      touch.at = { x: pageX, y: pageY };
      if (
        Math.hypot(pageX - touch.start.x, pageY - touch.start.y) > HOLD_SLOP_PX
      ) {
        clearTimeout(touch.timer);
        press.current = null;
        moving.current = { fingers: 1, start: touch.start, from: view.value };
      }
      return;
    }
    moveTo(positionAt(pageX, pageY));
  }

  /**
   * Zooms, turns and slides the map so the floor under each finger stays
   * under it, as near as zooming in no further than MAX_ZOOM, the same
   * close whichever way it's turned, nor out past the whole map allows; turning only once twisted past TWIST_DEG, when the
   * map stops following the compass.
   */
  function pinch(
    gesture: Extract<NonNullable<typeof moving.current>, { fingers: 2 }>,
    fingers: readonly [{ x: number; y: number }, { x: number; y: number }],
  ) {
    const [a0, b0] = gesture.start.map(onPlane);
    const [a1, b1] = fingers.map(onPlane);
    const { from } = gesture;
    const spread =
      Math.hypot(b1.x - a1.x, b1.y - a1.y) /
      (Math.hypot(b0.x - a0.x, b0.y - a0.y) || 1);
    let twist =
      ((Math.atan2(b1.y - a1.y, b1.x - a1.x) -
        Math.atan2(b0.y - a0.y, b0.x - a0.x)) *
        180) /
      Math.PI;
    twist = ((twist + 540) % 360) - 180;
    if (!gesture.twisted && Math.abs(twist) > TWIST_DEG) {
      gesture.twisted = true;
      manual.value = true;
      setMoved(true);
    }
    if (!gesture.twisted) twist = 0;
    const nextTurn = from.turn + twist;
    // Turned across the screen the map is shrunk to fit; zooming in makes
    // up for that, so it gets as close as when it's straight.
    const nextZoom = Math.min(
      Math.max(from.zoom * spread, 1),
      MAX_ZOOM / fit(nextTurn),
    );
    // The point between the fingers stays between them: the map's offset
    // from it scaled and turned with the map.
    const ratio = (fit(nextTurn) * nextZoom) / (fit(from.turn) * from.zoom);
    const rad = (twist * Math.PI) / 180;
    const [mx0, my0] = [(a0.x + b0.x) / 2, (a0.y + b0.y) / 2];
    const [mx1, my1] = [(a1.x + b1.x) / 2, (a1.y + b1.y) / 2];
    const [ox, oy] = [from.panX - mx0, from.panY - my0];
    if (gesture.twisted) turn.value = nextTurn;
    zoom.value = nextZoom;
    pan.value = clampPan(
      mx1 + ratio * (ox * Math.cos(rad) - oy * Math.sin(rad)),
      my1 + ratio * (ox * Math.sin(rad) + oy * Math.cos(rad)),
      { ...from, turn: nextTurn, zoom: nextZoom },
    );
  }

  /**
   * A slide that keeps some of the map on screen: its middle no further off
   * than the edge of the map, as turned, is from it.
   */
  function clampPan(x: number, y: number, seen: FloorView) {
    const half = (fit(seen.turn) * seen.zoom) / 2;
    const aspect = salen.width / salen.height;
    const rad = (seen.turn * Math.PI) / 180;
    const [cos, sin] = [Math.abs(Math.cos(rad)), Math.abs(Math.sin(rad))];
    const across = half * (aspect * cos + sin);
    const along = half * (aspect * sin + cos);
    return {
      x: Math.min(Math.max(x, -across), across),
      y: Math.min(Math.max(y, -along), along),
    };
  }

  /** Back to the whole map, turned as the compass says. */
  function resetView() {
    resume();
    zoom.value = withTiming(1, { duration: RESET_MS });
    pan.value = withTiming({ x: 0, y: 0 }, { duration: RESET_MS });
    setMoved(false);
  }

  function onRelease(e: GestureResponderEvent) {
    if (moving.current) {
      // Moved the map: no tap, and a way back to how it was.
      moving.current = null;
      if (zoom.value !== 1 || pan.value.x !== 0 || pan.value.y !== 0) {
        setMoved(true);
      }
      return;
    }
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
    const placed = onSeat(positionAt(e.nativeEvent.pageX, e.nativeEvent.pageY));
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

  // Pictures of the faces on the pins' heads, by who and which photo.
  const [faces, setFaces] = useState<Record<string, PinFace>>({});
  const myFace = me && {
    key: `${initials(me.name)} ${me.avatarUrl}`,
    label: initials(me.name),
    avatarUrl: me.avatarUrl ?? null,
  };
  const friendFaces = friendPins.map(({ name, avatarUrl }) => ({
    key: `${initials(name)} ${avatarUrl}`,
    label: initials(name),
    avatarUrl,
  }));
  const wanted = new Map<string, FaceRequest>();
  for (const face of [...friendFaces, ...(myFace ? [myFace] : [])]) {
    if (!faces[face.key]) wanted.set(face.key, face);
  }

  // Heights on screen against the map's.
  const pins: ScenePin[] = !size.height
    ? []
    : [
        ...friendPins.map(({ id, name, percentageX, percentageY }, i) => ({
          id,
          percentageX,
          percentageY,
          color: colorForInitials(initials(name)),
          height: friendPinSize(windowWidth).height / size.height,
          face: faces[friendFaces[i].key] ?? null,
        })),
        ...(current
          ? [
              {
                id: "me",
                percentageX: pinX,
                percentageY: pinY,
                color: PIN_COLOR,
                height: pinSize(windowWidth).height / size.height,
                dot: true,
                lift,
                angle,
                pitch,
                face: myFace
                  ? (faces[myFace.key] ?? null)
                  : ("no one" as const),
              },
            ]
          : []),
      ];

  return (
    // The whole screen moves the map and the pin, past the map's box too.
    <View
      style={styles.surface}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={onGrant}
      onResponderMove={onMove}
      onResponderRelease={onRelease}
      // A drag cut short by the system (a call, a gesture) still places the pin.
      onResponderTerminate={onRelease}
    >
      <ArenaScene
        arena={salen}
        levels={salenLevels}
        view={view}
        pins={pins}
        box={box}
        style={StyleSheet.absoluteFill}
      />
      <PinFaces
        faces={[...wanted.values()]}
        onFace={(key, face) => setFaces((had) => ({ ...had, [key]: face }))}
      />
      <View
        ref={viewRef}
        // An explicit width: from the margins alone, the layout takes `top`
        // off the height that `aspectRatio` gives, and the box comes out
        // narrower, against the left.
        style={[
          styles.map,
          { marginTop: top, width: windowWidth - 2 * MAP_MARGIN },
        ]}
        pointerEvents="box-none"
        onLayout={(e) => {
          const { x, y, width, height } = e.nativeEvent.layout;
          setSize({ width, height });
          setBox({ x, y, width, height });
          layout.value = { width, height };
        }}
      >
        <FloorContext.Provider
          value={{ ...size, turn, zoom, pan, stands: true }}
        >
          {overlay}
        </FloorContext.Provider>
        {moved && (
          <View style={styles.reset}>
            <RoundButton
              icon={{ ios: "location.north.line.fill", android: "explore" }}
              label={t.resetView}
              onPress={resetView}
            />
          </View>
        )}
      </View>
    </View>
  );
}

// As narrow as the leaning floor allows: its near edge is ~13% wider than the
// map, and should stay clear of the screen's edges.
const MAP_MARGIN = 28;

const styles = StyleSheet.create({
  surface: { flex: 1 },
  map: {
    alignSelf: "center",
    aspectRatio: salen.width / salen.height,
  },
  reset: { position: "absolute", left: 0, top: 0 },
});
