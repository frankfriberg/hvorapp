import salen from "@shared/arenas/salen";
import {
  Easing,
  IOSReferenceFrame,
  SensorType,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedSensor,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

// The map is a floor seen in perspective, turned so the end the phone faces is
// ahead (north or south): it turns about its centre, shrinks to fit the view
// while turning, and leans away so far rows shrink and near rows grow. Pins stand upright on top,
// placed where their floor point lands on screen.

/** How far the floor leans back, in degrees. */
const TILT_DEG = 28;
/** Distance from the eye to the map, in map heights. */
const PERSPECTIVE = 2;

const ASPECT = salen.width / salen.height;
const SIN = Math.sin((TILT_DEG * Math.PI) / 180);
const COS = Math.cos((TILT_DEG * Math.PI) / 180);

/** How much the floor shrinks so it fits the view turned by `turn` degrees. */
function fit(turn: number) {
  "worklet";
  const rad = (turn * Math.PI) / 180;
  const c = Math.abs(Math.cos(rad));
  const s = Math.abs(Math.sin(rad));
  return Math.min(ASPECT / (ASPECT * c + s), 1 / (ASPECT * s + c));
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

/** Where a point on the floor shows on screen, both as map percentages. */
export function toScreen(
  turn: number,
  percentageX: number,
  percentageY: number,
) {
  "worklet";
  const rad = (turn * Math.PI) / 180;
  const k = fit(turn);
  // In map heights, from the centre; turned clockwise on screen, then shrunk.
  const dx = (percentageX / 100 - 0.5) * ASPECT;
  const dy = percentageY / 100 - 0.5;
  const rx = k * (dx * Math.cos(rad) - dy * Math.sin(rad));
  const ry = k * (dx * Math.sin(rad) + dy * Math.cos(rad));
  const scale = PERSPECTIVE / (PERSPECTIVE - ry * SIN);
  return {
    percentageX: ((rx * scale) / ASPECT + 0.5) * 100,
    percentageY: (ry * COS * scale + 0.5) * 100,
  };
}

/** The point on the floor under a point on screen; `toScreen` undone. */
export function toFloor(
  turn: number,
  percentageX: number,
  percentageY: number,
) {
  const rad = (turn * Math.PI) / 180;
  const k = fit(turn);
  const sx = (percentageX / 100 - 0.5) * ASPECT;
  const sy = percentageY / 100 - 0.5;
  const ry = (sy * PERSPECTIVE) / (PERSPECTIVE * COS + sy * SIN);
  const rx = (sx * (PERSPECTIVE - ry * SIN)) / PERSPECTIVE;
  const dx = (rx * Math.cos(rad) + ry * Math.sin(rad)) / k;
  const dy = (-rx * Math.sin(rad) + ry * Math.cos(rad)) / k;
  return {
    percentageX: (dx / ASPECT + 0.5) * 100,
    percentageY: (dy + 0.5) * 100,
  };
}

// Facing within 60° of north or south turns the map; east and west keep it.
const SWITCH_COS = 0.5;
const TURN_MS = 700;

/**
 * How far the floor is turned, in degrees clockwise: 0 facing south, 180
 * facing north. It turns between the two when the phone does, never with it.
 */
export function useCompassTurn(): SharedValue<number> {
  const sensor = useAnimatedSensor(SensorType.ROTATION, {
    iosReferenceFrame: IOSReferenceFrame.XMagneticNorthZVertical,
  });
  const turn = useSharedValue(0);
  const north = useSharedValue(false);

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
      turn.value = withTiming(next ? 180 : 0, {
        duration: TURN_MS,
        easing: Easing.inOut(Easing.cubic),
      });
    },
  );

  return turn;
}
