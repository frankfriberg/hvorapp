import type { Arena, ArenaLevels } from "@shared/arena";
import { type ExpoWebGLRenderingContext, GLView } from "expo-gl";
import { memo, useEffect, useMemo, useRef } from "react";
import { type StyleProp, View, type ViewStyle } from "react-native";
import {
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
} from "react-native-reanimated";
import * as THREE from "three";
import { buildArena } from "@/lib/arenaScene";
import { useTheme } from "@/lib/theme";
import { type FloorView, PERSPECTIVE, TILT_DEG, viewScale } from "@/lib/tilt";

// Room drawn round the map on every side, against its height: the near rows,
// nearer the eye, spread past its edges, and the columns stand above them.
const MARGIN = 0.12;

type Props = {
  /** The map the pins are placed on: only its size, to centre the scene. */
  arena: Arena;
  /** Its levels, seats and columns, which are all that's built in 3D. */
  levels: ArenaLevels;
  /** How the floor is seen, as `tilt` places things on it. */
  view: SharedValue<FloorView>;
  style?: StyleProp<ViewStyle>;
};

/**
 * The arena in 3D, filling `style`'s box, seen as `tilt` sees the floor: so
 * pins placed with `toScreen` stand on the same points of it.
 */
export default memo(function ArenaScene({ arena, levels, view, style }: Props) {
  const palette = useTheme().arena;
  const floor = useRef(palette.floor);
  floor.current = palette.floor;
  const model = useMemo(() => buildArena(levels, arena), [arena, levels]);
  // Draws a frame of the floor seen so; set once there's a context.
  const draw = useRef<((view: FloorView) => void) | null>(null);

  useEffect(() => {
    model.paint(palette);
    draw.current?.(view.value);
  }, [model, palette, view]);

  useEffect(() => () => model.dispose(), [model]);

  function redraw(value: FloorView) {
    draw.current?.(value);
  }
  useAnimatedReaction(
    () => view.value,
    (value, before) => {
      if (value !== before) runOnJS(redraw)(value);
    },
  );

  function onContextCreate(gl: ExpoWebGLRenderingContext) {
    const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;
    // three refuses any context that is a WebGLRenderingContext, taking it
    // for WebGL 1; expo-gl's WebGL 2 context is one too, as in the spec, so
    // the constructor is hidden from three while it checks.
    const global = globalThis as { WebGLRenderingContext?: unknown };
    const webgl1 = global.WebGLRenderingContext;
    global.WebGLRenderingContext = undefined;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = createRenderer(gl, width, height);
    } finally {
      global.WebGLRenderingContext = webgl1;
    }
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);

    // The eye straight in front of the map's centre, PERSPECTIVE map heights
    // away, seeing the map and its margin round it. Depth only from a map
    // height in front of the centre to one behind, which the whole map is
    // within, so the low steps' fronts aren't lost in it.
    const camera = new THREE.PerspectiveCamera(
      (2 * Math.atan((0.5 + MARGIN) / PERSPECTIVE) * 180) / Math.PI,
      width / height,
      PERSPECTIVE - 1,
      PERSPECTIVE + 1,
    );
    camera.position.set(0, 0, PERSPECTIVE);

    // Turned clockwise on screen, scaled and moved, inside the lean.
    const lean = new THREE.Group();
    lean.rotation.x = (-TILT_DEG * Math.PI) / 180;
    lean.add(model.group);
    const scene = new THREE.Scene();
    scene.add(lean);

    draw.current = (value: FloorView) => {
      model.group.scale.setScalar(viewScale(value));
      model.group.rotation.set(0, 0, (-value.turn * Math.PI) / 180);
      // Down the screen is down the map; three's y is up.
      model.group.position.set(value.panX, -value.panY, 0);
      renderer.setClearColor(floor.current);
      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    draw.current(view.value);
  }

  // The margin in the box's width and height, as percentages.
  const across = (MARGIN * 100 * arena.height) / arena.width;
  const along = MARGIN * 100;
  return (
    // GLView takes touches; the wrapper keeps it from taking the drag away
    // from the map underneath.
    <View style={style} pointerEvents="none">
      <GLView
        style={{
          position: "absolute",
          left: `${-across}%`,
          right: `${-across}%`,
          top: `${-along}%`,
          bottom: `${-along}%`,
        }}
        onContextCreate={onContextCreate}
      />
    </View>
  );
});

function createRenderer(
  gl: ExpoWebGLRenderingContext,
  width: number,
  height: number,
) {
  return new THREE.WebGLRenderer({
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
}
