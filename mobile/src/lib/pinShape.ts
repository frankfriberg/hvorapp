import { PIN_DOT_VW, PIN_WIDTH_VW } from "@shared/pin";

// The pin's shape, drawn flat (`Pin`, in the shared image) and built in 3D
// (`pinScene`, on the map), in drawing units.

// The upright pin's drawing: a 100 × 128 box with the head's centre at HEAD.
export const TEARDROP_BOX = { width: 100, height: 128 };
export const TEARDROP_HEAD = { x: 50, y: 50 };

// public/pin.svg's box, which PIN_WIDTH_VW is the width of.
const WEB_PIN_ASPECT = 316 / 250;

// The web's pin transforms, translate(-50%, -115%) at rest and -150% while
// dragging, expressed as fractions of the pin's height.
export const PIN_LIFT_AT_REST = 1.15;
export const PIN_LIFT_MOVING = 1.5;
// Picked up quick, with one small overshoot; set down without a bounce.
export const LIFT_SPRING = {
  up: { damping: 38, stiffness: 700 },
  down: { damping: 60, stiffness: 700 },
};

// The pin as a solid: a ball of radius HEAD_R and a small ball of radius
// TIP_R, joined by the cone touching both, AXIS apart. Upright it is the
// friend pin's teardrop. It pivots about the point it stands over, the dot,
// with the gap it floats above it, as one stiff thing.
export const HEAD_R = 48;
export const TIP_R = 6;
export const AXIS = TEARDROP_BOX.height - TIP_R - TEARDROP_HEAD.y;
// How far in from the head's edge a profile photo stops, in drawing units:
// a ring of the pin's colour round it.
export const PHOTO_INSET = 5;
// The dot under my pin, across, against the pin as on the web.
export const DOT_SIZE =
  (TEARDROP_BOX.height * PIN_DOT_VW) / (PIN_WIDTH_VW * WEB_PIN_ASPECT);

// The shadow: the pin laid flat on the floor, falling away from you, in the
// floor's perspective; a gap away from the dot under my pin, which floats
// above it, from the tip of a friend's, which has no dot. Its length against the pin's, and how
// dark (`pinShadowOpacity` in the theme); lifted, it fades.
export const SHADOW_LENGTH = 0.7;
export const SHADOW_LIFTED_OPACITY = 0.5;
// The dot's own shadow, falling away from you, barely there: how far, against
// the dot, and how much of the pin's shadow's darkness it has.
export const DOT_SHADOW_OFFSET = 0.15;
export const DOT_SHADOW_OPACITY = 0.5;

// A friend pin's size against mine, so mine stands out.
export const FRIEND_PIN_SCALE = 0.7;

/**
 * How big a pin at rest is on screen, in points: its width and height, and
 * how far above its point its tip floats.
 */
export function pinSize(viewportWidth: number, scale = 1) {
  const height =
    ((viewportWidth * PIN_WIDTH_VW) / 100) * WEB_PIN_ASPECT * scale;
  return {
    width: (height * TEARDROP_BOX.width) / TEARDROP_BOX.height,
    height,
    float: height * (PIN_LIFT_AT_REST - 1),
  };
}

/**
 * How much bigger pins are on a map zoomed in `zoom` times: some, so they
 * stand among the seats as they grow, not all, so they don't fill the screen.
 */
export function pinGrowth(zoom: number) {
  "worklet";
  return Math.sqrt(zoom);
}

/** How big a friend pin is on screen, as `pinSize`. */
export const friendPinSize = (windowWidth: number) =>
  pinSize(windowWidth, FRIEND_PIN_SCALE);
