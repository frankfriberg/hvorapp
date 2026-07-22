/**
 * Single source of truth for how the location pin is drawn.
 *
 * The pin is rendered in two places that must look identical:
 * - `src/components/map/touchMap.tsx` (interactive, in the browser)
 * - `src/app/salen/[location]/opengraph-image.tsx` (static, via next/og)
 *
 * Both consume these constants so the geometry can only be changed in one
 * place. Sizes are expressed in `vw` because it is the one unit that resolves
 * relative to the map in both environments (the viewport in the browser, and
 * the image width inside Satori/next-og).
 */

/** Fill colour of the location dot. */
export const PIN_COLOR = "#E45F53";

/** Width of the pin icon, in `vw`. */
export const PIN_WIDTH_VW = 10;

/** Diameter of the location dot, in `vw`. */
export const PIN_DOT_VW = 1.5;

/** Resting transform for the pin icon: centre on the point, lift the tip onto it. */
export const PIN_ICON_TRANSFORM = "translate(-50%, -115%)";

/** Transform for the location dot: centre it exactly on the point. */
export const PIN_DOT_TRANSFORM = "translate(-50%, -50%)";
