import type { ExpoWebGLRenderingContext } from "expo-gl";
import * as THREE from "three";
import { PERSPECTIVE } from "@/lib/tilt";

// What the 3D maps (`ArenaScene`, `VenueMap`) share: three on expo-gl, and
// an eye that sees a map in a box of the view as `tilt` sees the floor.

/** A renderer drawing into expo-gl's context, as big as it is. */
export function createRenderer(gl: ExpoWebGLRenderingContext) {
  const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;
  // three refuses any context that is a WebGLRenderingContext, taking it
  // for WebGL 1; expo-gl's WebGL 2 context is one too, as in the spec, so
  // the constructor is hidden from three while it checks.
  const global = globalThis as { WebGLRenderingContext?: unknown };
  const webgl1 = global.WebGLRenderingContext;
  global.WebGLRenderingContext = undefined;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      // three wants a canvas; this one only says how big it is.
      canvas: {
        width,
        height,
        style: {},
        addEventListener: () => {},
        removeEventListener: () => {},
        clientHeight: height,
      } as unknown as HTMLCanvasElement,
      context: gl as unknown as WebGL2RenderingContext,
    });
  } finally {
    global.WebGLRenderingContext = webgl1;
  }
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  return renderer;
}

/**
 * Has `renderer` draw over all of `gl`'s picture as big as it is now: the
 * view can still be settling into its size, as when it's pushed in, when the
 * context is made.
 */
export function fitRenderer(
  renderer: THREE.WebGLRenderer,
  gl: ExpoWebGLRenderingContext,
) {
  const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;
  const had = renderer.getSize(new THREE.Vector2());
  if (had.x !== width || had.y !== height) {
    renderer.setSize(width, height, false);
  }
}

// Depth only from a map height in front of the map's centre to one behind,
// which the whole map is within, so the low steps' fronts aren't lost in it.
const NEAR = PERSPECTIVE - 1;
const FAR = PERSPECTIVE + 1;

/**
 * The eye straight in front of the map's centre, PERSPECTIVE map heights
 * away; aimed with `aimAt`.
 */
export function createCamera() {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 0, PERSPECTIVE);
  return camera;
}

/**
 * Has `camera` see the map in `box`, a map height tall at the map, its centre
 * straight ahead, and the rest of a view `size` big round it; both in points.
 * False until both are laid out.
 */
export function aimAt(
  camera: THREE.PerspectiveCamera,
  box: { x: number; y: number; width: number; height: number },
  size: { width: number; height: number },
) {
  if (!box.height || !size.width) return false;
  // Map heights at the near plane, for each point.
  const unit = NEAR / PERSPECTIVE / box.height;
  const [cx, cy] = [box.x + box.width / 2, box.y + box.height / 2];
  camera.projectionMatrix.makePerspective(
    -cx * unit,
    (size.width - cx) * unit,
    cy * unit,
    -(size.height - cy) * unit,
    NEAR,
    FAR,
  );
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  return true;
}
