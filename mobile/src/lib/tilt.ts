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

/**
 * How much a floor `aspect` wide against its height (salen's without it)
 * shrinks so it fits the view turned by `turn` degrees.
 */
export function fit(turn: number, floorAspect?: number) {
  "worklet";
  // In the body: a worklet's default parameters can't see module constants.
  const aspect = floorAspect ?? ASPECT;
  const rad = (turn * Math.PI) / 180;
  const c = Math.abs(Math.cos(rad));
  const s = Math.abs(Math.sin(rad));
  return Math.min(aspect / (aspect * c + s), 1 / (aspect * s + c));
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
export function viewScale(view: FloorView, aspect?: number) {
  "worklet";
  return fit(view.turn, aspect) * view.zoom;
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
  floorAspect?: number,
) {
  "worklet";
  // In the body: a worklet's default parameters can't see module constants.
  const aspect = floorAspect ?? ASPECT;
  const rad = (view.turn * Math.PI) / 180;
  const k = viewScale(view, aspect);
  // In map heights, from the centre; turned clockwise on screen, scaled and
  // moved.
  const dx = (percentageX / 100 - 0.5) * aspect;
  const dy = percentageY / 100 - 0.5;
  const rx = k * (dx * Math.cos(rad) - dy * Math.sin(rad)) + view.panX;
  const ry = k * (dx * Math.sin(rad) + dy * Math.cos(rad)) + view.panY;
  // Up off the leaning floor: up the screen and towards you.
  const up = k * height;
  const scale = PERSPECTIVE / (PERSPECTIVE - ry * SIN - up * COS);
  return {
    percentageX: ((rx * scale) / aspect + 0.5) * 100,
    percentageY: ((ry * COS - up * SIN) * scale + 0.5) * 100,
  };
}

/**
 * Where a point on screen, as map percentages, lies on the leaning floor
 * `up` map heights higher before it's turned, scaled and moved: the plane
 * `FloorView` moves things in, in map heights from the centre. For a floor
 * `aspect` wide against its height; salen's without it.
 */
export function toPlane(
  percentageX: number,
  percentageY: number,
  up = 0,
  aspect = ASPECT,
) {
  const sx = (percentageX / 100 - 0.5) * aspect;
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
  aspect = ASPECT,
) {
  const rad = (view.turn * Math.PI) / 180;
  const k = viewScale(view, aspect);
  const plane = toPlane(percentageX, percentageY, k * height, aspect);
  const rx = plane.x - view.panX;
  const ry = plane.y - view.panY;
  const dx = (rx * Math.cos(rad) + ry * Math.sin(rad)) / k;
  const dy = (-rx * Math.sin(rad) + ry * Math.cos(rad)) / k;
  return {
    percentageX: (dx / aspect + 0.5) * 100,
    percentageY: (dy + 0.5) * 100,
  };
}

/**
 * A slide that keeps some of a floor `aspect` wide on screen, seen as
 * `seen`: its middle no further off than the edge of the floor, as turned,
 * is from it; or, kept `inside`, no further than keeps its edge out of the
 * map's box.
 */
export function clampPan(
  x: number,
  y: number,
  seen: FloorView,
  aspect = ASPECT,
  inside = false,
) {
  const half = viewScale(seen, aspect) / 2;
  const rad = (seen.turn * Math.PI) / 180;
  const [cos, sin] = [Math.abs(Math.cos(rad)), Math.abs(Math.sin(rad))];
  // The box is the floor's own size, unzoomed, unturned.
  const across = Math.max(
    half * (aspect * cos + sin) - (inside ? aspect / 2 : 0),
    0,
  );
  const along = Math.max(half * (aspect * sin + cos) - (inside ? 0.5 : 0), 0);
  return {
    x: Math.min(Math.max(x, -across), across),
    y: Math.min(Math.max(y, -along), along),
  };
}

type Point = { x: number; y: number };

/**
 * How two fingers, from `start` to `now` on the plane (`toPlane`), see a
 * floor `aspect` wide that was seen as `from`: zoomed, turned and slid so
 * the floor under each finger stays under it, as near as zooming in no
 * further than `maxZoom`, the same close whichever way it's turned, nor out
 * past `minZoom` (the whole floor without); turned only once twisted past
 * `twistDeg`, or already `twisted`.
 */
export function pinchView(
  from: FloorView,
  [a0, b0]: readonly [Point, Point],
  [a1, b1]: readonly [Point, Point],
  {
    aspect = ASPECT,
    minZoom,
    maxZoom,
    twistDeg,
    twisted,
    inside = false,
  }: {
    aspect?: number;
    /** As `maxZoom`, how far out. */
    minZoom?: number;
    maxZoom: number;
    twistDeg: number;
    twisted: boolean;
    /** Kept inside its edge, as `clampPan`. */
    inside?: boolean;
  },
) {
  const spread =
    Math.hypot(b1.x - a1.x, b1.y - a1.y) /
    (Math.hypot(b0.x - a0.x, b0.y - a0.y) || 1);
  let twist =
    ((Math.atan2(b1.y - a1.y, b1.x - a1.x) -
      Math.atan2(b0.y - a0.y, b0.x - a0.x)) *
      180) /
    Math.PI;
  twist = ((twist + 540) % 360) - 180;
  const turning = twisted || Math.abs(twist) > twistDeg;
  if (!turning) twist = 0;
  const turn = from.turn + twist;
  // Turned across the screen the floor is shrunk to fit; zooming in makes up
  // for that, so it gets as close as when it's straight.
  const zoom = Math.min(
    Math.max(
      from.zoom * spread,
      minZoom === undefined ? 1 : minZoom / fit(turn, aspect),
    ),
    maxZoom / fit(turn, aspect),
  );
  // The point between the fingers stays between them: the floor's offset
  // from it scaled and turned with the floor.
  const ratio =
    (fit(turn, aspect) * zoom) / (fit(from.turn, aspect) * from.zoom);
  const rad = (twist * Math.PI) / 180;
  const [mx0, my0] = [(a0.x + b0.x) / 2, (a0.y + b0.y) / 2];
  const [mx1, my1] = [(a1.x + b1.x) / 2, (a1.y + b1.y) / 2];
  const [ox, oy] = [from.panX - mx0, from.panY - my0];
  const pan = clampPan(
    mx1 + ratio * (ox * Math.cos(rad) - oy * Math.sin(rad)),
    my1 + ratio * (ox * Math.sin(rad) + oy * Math.cos(rad)),
    { ...from, turn, zoom },
    aspect,
    inside,
  );
  return {
    view: { turn, zoom, panX: pan.x, panY: pan.y },
    twisted: turning,
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
 * floor, raised to the height there (`heightAt`, salen's stands without
 * it), a few times over. For a floor `aspect` wide against its height.
 */
export function toStands(
  view: FloorView,
  percentageX: number,
  percentageY: number,
  heightAt: (x: number, y: number) => number = standHeight,
  aspect = ASPECT,
) {
  let point = toFloor(view, percentageX, percentageY, 0, aspect);
  for (let i = 0; i < 4; i++) {
    const height = heightAt(point.percentageX, point.percentageY);
    point = toFloor(view, percentageX, percentageY, height, aspect);
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
 * Unless it `follow`s the compass: then it stays turned `home`, but by hand,
 * and `resume` turns it back.
 */
export function useCompassTurn(follow = true, home = 0) {
  const sensor = useAnimatedSensor(SensorType.ROTATION, {
    // Ten readings a second is plenty to notice a turn, and spares the battery
    // the screen's 60–120.
    interval: 100,
    iosReferenceFrame: IOSReferenceFrame.XMagneticNorthZVertical,
  });
  const turn = useSharedValue(follow ? 0 : home);
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
      if (!manual.value && follow) face(next);
    },
  );

  function resume() {
    manual.value = false;
    if (follow) face(north.value);
    else {
      // Home, the short way round.
      const from = ((((turn.value - home + 180) % 360) + 360) % 360) - 180;
      turn.value = home + from;
      turn.value = withTiming(home, {
        duration: TURN_MS,
        easing: Easing.inOut(Easing.cubic),
      });
    }
  }

  return { turn, manual, resume };
}
