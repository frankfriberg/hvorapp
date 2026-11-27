import salen from "@shared/arenas/salen";
import salenLevels from "@shared/arenas/salen-levels";
import {
  Easing,
  IOSReferenceFrame,
  SensorType,
  useAnimatedReaction,
  useAnimatedSensor,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { arenaHeights } from "@/lib/arena";

// The map is a floor seen in perspective, turned so the end the phone faces is
// ahead (north or south): it turns about its centre, shrinks to fit the view
// while turning, and leans away so far rows shrink and near rows grow. Pins stand upright on top,
// placed where their floor point lands on screen.

/** How far the floor leans back, in degrees. */
export const TILT_DEG = 28;
/** Distance from the eye to the map, in map heights. */
export const PERSPECTIVE = 2;

const ASPECT = salen.width / salen.height;
const SIN = Math.sin((TILT_DEG * Math.PI) / 180);
const COS = Math.cos((TILT_DEG * Math.PI) / 180);

/** How much the floor shrinks so it fits the view turned by `turn` degrees. */
export function fit(turn: number) {
  "worklet";
  const rad = (turn * Math.PI) / 180;
  const c = Math.abs(Math.cos(rad));
  const s = Math.abs(Math.sin(rad));
  return Math.min(ASPECT / (ASPECT * c + s), 1 / (ASPECT * s + c));
}

/**
 * The lean alone, for something lying on a floor `height` px tall but drawn
 * apart from it: roughly the floor's perspective, without its turn.
 */
export function floorLean(height: number) {
  "worklet";
  return [{ perspective: PERSPECTIVE * height }, { rotateX: `${TILT_DEG}deg` }];
}

/** The transform that turns and leans a floor `height` px tall. */
export function floorTransform(height: number, turn: number) {
  "worklet";
  return [
    { perspective: PERSPECTIVE * height },
    { rotateX: `${TILT_DEG}deg` },
    { scale: fit(turn) },
    { rotateZ: `${turn}deg` },
  ];
}

/**
 * How the floor is seen: turned `turn` degrees clockwise, zoomed in `zoom`
 * times, and moved `panX`, `panY` map heights across the screen, right and
 * down, before it leans.
 */
export type FloorView = {
  turn: number;
  zoom: number;
  panX: number;
  panY: number;
};

/** How much a floor seen as `view` is scaled: shrunk to fit, zoomed in. */
export function viewScale(view: FloorView) {
  "worklet";
  return fit(view.turn) * view.zoom;
}

/**
 * Where a point on the floor, `height` map heights above it, shows on
 * screen, both as map percentages.
 */
export function toScreen(
  view: FloorView,
  percentageX: number,
  percentageY: number,
  height = 0,
) {
  "worklet";
  const rad = (view.turn * Math.PI) / 180;
  const k = viewScale(view);
  // In map heights, from the centre; turned clockwise on screen, scaled and
  // moved.
  const dx = (percentageX / 100 - 0.5) * ASPECT;
  const dy = percentageY / 100 - 0.5;
  const rx = k * (dx * Math.cos(rad) - dy * Math.sin(rad)) + view.panX;
  const ry = k * (dx * Math.sin(rad) + dy * Math.cos(rad)) + view.panY;
  // Up off the leaning floor: up the screen and towards you.
  const up = k * height;
  const scale = PERSPECTIVE / (PERSPECTIVE - ry * SIN - up * COS);
  return {
    percentageX: ((rx * scale) / ASPECT + 0.5) * 100,
    percentageY: ((ry * COS - up * SIN) * scale + 0.5) * 100,
  };
}

/**
 * Where a point on screen, as map percentages, lies on the leaning floor
 * `up` map heights higher before it's turned, scaled and moved: the plane
 * `FloorView` moves things in, in map heights from the centre.
 */
export function toPlane(percentageX: number, percentageY: number, up = 0) {
  const sx = (percentageX / 100 - 0.5) * ASPECT;
  const sy = percentageY / 100 - 0.5;
  const ry =
    (sy * (PERSPECTIVE - up * COS) + PERSPECTIVE * up * SIN) /
    (PERSPECTIVE * COS + sy * SIN);
  const rx = (sx * (PERSPECTIVE - ry * SIN - up * COS)) / PERSPECTIVE;
  return { x: rx, y: ry };
}

/**
 * The point on the floor under a point on screen, as if the floor were
 * `height` map heights higher; `toScreen` undone.
 */
export function toFloor(
  view: FloorView,
  percentageX: number,
  percentageY: number,
  height = 0,
) {
  const rad = (view.turn * Math.PI) / 180;
  const k = viewScale(view);
  const plane = toPlane(percentageX, percentageY, k * height);
  const rx = plane.x - view.panX;
  const ry = plane.y - view.panY;
  const dx = (rx * Math.cos(rad) + ry * Math.sin(rad)) / k;
  const dy = (-rx * Math.sin(rad) + ry * Math.cos(rad)) / k;
  return {
    percentageX: (dx / ASPECT + 0.5) * 100,
    percentageY: (dy + 0.5) * 100,
  };
}

const stands = arenaHeights(salenLevels);
const [WIDTH, HEIGHT] = [salen.width, salen.height];

/** How high the stands are at a point of the map, in map heights. */
export function standHeight(percentageX: number, percentageY: number) {
  "worklet";
  return (
    stands.heightAt((percentageX / 100) * WIDTH, (percentageY / 100) * HEIGHT) /
    HEIGHT
  );
}

/**
 * The point on the stands under a point on screen: where it meets the
 * floor, raised to the height there, a few times over.
 */
export function toStands(
  view: FloorView,
  percentageX: number,
  percentageY: number,
) {
  let point = toFloor(view, percentageX, percentageY);
  for (let i = 0; i < 4; i++) {
    const height = standHeight(point.percentageX, point.percentageY);
    point = toFloor(view, percentageX, percentageY, height);
  }
  return point;
}

// Facing within 45° of north or south turns the map; anywhere between keeps
// it as it is, so it only turns when you really face the other way.
const SWITCH_COS = Math.SQRT1_2;
const TURN_MS = 700;

/**
 * How far the floor is turned, in degrees clockwise: 0 facing south, 180
 * facing north. It turns between the two when the phone does, never with it,
 * unless `manual`: turned by hand, it stays as it's left until `resume`.
 */
export function useCompassTurn() {
  const sensor = useAnimatedSensor(SensorType.ROTATION, {
    // Ten readings a second is plenty to notice a turn, and spares the battery
    // the screen's 60–120.
    interval: 100,
    iosReferenceFrame: IOSReferenceFrame.XMagneticNorthZVertical,
  });
  const turn = useSharedValue(0);
  const north = useSharedValue(false);
  const manual = useSharedValue(false);

  /** Turns to face the way the phone does, from however it was left. */
  const face = (facingNorth: boolean) => {
    "worklet";
    const from = ((turn.value % 360) + 360) % 360;
    let to = facingNorth ? 180 : 0;
    if (from - to > 180) to += 360;
    turn.value = from;
    turn.value = withTiming(to, {
      duration: TURN_MS,
      easing: Easing.inOut(Easing.cubic),
    });
  };

  useAnimatedReaction(
    () => {
      // Where the phone looks: its top tipped away, like the back of a phone
      // held up to read, turned into the compass frame (x north, y west).
      const { qx, qy, qz, qw } = sensor.sensor.value;
      const [vx, vy, vz] = [0, 1, -1];
      // q · v · q⁻¹, written out.
      const tx = 2 * (qy * vz - qz * vy);
      const ty = 2 * (qz * vx - qx * vz);
      const tz = 2 * (qx * vy - qy * vx);
      const toNorth = vx + qw * tx + (qy * tz - qz * ty);
      const toWest = vy + qw * ty + (qz * tx - qx * tz);
      const length = Math.hypot(toNorth, toWest);
      // Cosine of the heading; 0 (no change) looking straight up or down.
      return length > 0.1 ? toNorth / length : 0;
    },
    (cosHeading) => {
      const next =
        cosHeading > SWITCH_COS
          ? true
          : cosHeading < -SWITCH_COS
            ? false
            : north.value;
      if (next === north.value) return;
      north.value = next;
      if (!manual.value) face(next);
    },
  );

  function resume() {
    manual.value = false;
    face(north.value);
  }

  return { turn, manual, resume };
}
