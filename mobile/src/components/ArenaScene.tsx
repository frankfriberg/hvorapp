import type { Arena, ArenaLevels } from "@shared/arena";
import { type ExpoWebGLRenderingContext, GLView } from "expo-gl";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import {
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
} from "react-native-reanimated";
import * as THREE from "three";
import { buildArena } from "@/lib/arenaScene";
import { buildPin, type PinFace, type ScenePinModel } from "@/lib/pinScene";
import { PIN_LIFT_AT_REST } from "@/lib/pinShape";
import { useTheme } from "@/lib/theme";
import { type FloorView, PERSPECTIVE, TILT_DEG, viewScale } from "@/lib/tilt";

/** A number that's still, or one that moves. */
type Moving = number | SharedValue<number>;

/** A pin standing on the arena, built by `buildPin`. */
export type ScenePin = {
  id: string;
  /** The point it stands over, as map percentages. */
  percentageX: Moving;
  percentageY: Moving;
  color: string;
  /** How tall it is on screen at rest, in map heights. */
  height: number;
  /** The dot on the floor under it; mine only. */
  dot?: boolean;
  /** As `PinPose`; standing still upright at rest without them. */
  lift?: SharedValue<number>;
  angle?: SharedValue<number>;
  pitch?: SharedValue<number>;
  /** What's on its head: a picture, no one's dot, or nothing until pictured. */
  face: PinFace | "no one" | null;
};

/** What a moving number is now. */
function now(value: Moving | undefined, otherwise = 0) {
  "worklet";
  if (value === undefined) return otherwise;
  return typeof value === "number" ? value : value.value;
}

type Props = {
  /** The map the pins are placed on: only its size, to centre the scene. */
  arena: Arena;
  /** Its levels, seats and columns, which are all that's built in 3D. */
  levels: ArenaLevels;
  /** How the floor is seen, as `tilt` places things on it. */
  view: SharedValue<FloorView>;
  /** The pins standing on it. */
  pins?: ScenePin[];
  /** Where the map's box is in `style`'s, in points. */
  box: { x: number; y: number; width: number; height: number };
  style?: StyleProp<ViewStyle>;
};

/**
 * The arena in 3D with its pins, drawn over all of `style`'s box, seen as
 * `tilt` sees the floor in the map's `box`: so things placed there with
 * `toScreen` stand on the same points of it.
 */
export default memo(function ArenaScene({
  arena,
  levels,
  view,
  pins = [],
  box,
  style,
}: Props) {
  const theme = useTheme();
  const palette = theme.arena;
  // The ground round the hall, apart from its floor.
  const background = useRef(theme.background);
  background.current = theme.background;
  const shadowOpacity = useRef(theme.pinShadowOpacity);
  shadowOpacity.current = theme.pinShadowOpacity;
  const model = useMemo(() => buildArena(levels, arena), [arena, levels]);
  // The pins, turned and scaled with the arena; their faces, facing the eye.
  const pinLayer = useMemo(() => new THREE.Group(), []);
  const faceLayer = useMemo(() => new THREE.Group(), []);
  const built = useRef(
    new Map<
      string,
      { model: ScenePinModel; look: string; face: ScenePin["face"] }
    >(),
  );
  const shown = useRef(pins);
  shown.current = pins;
  const mapBox = useRef(box);
  mapBox.current = box;
  // How big this view is, in points.
  const size = useRef({ width: 0, height: 0 });
  // The context's pictures, by file, and how to make one; once there's one.
  const pictures = useRef(new Map<string, THREE.Texture>());
  const picture = useRef<((face: PinFace) => THREE.Texture) | null>(null);
  // Draws a frame; set once there's a context.
  const draw = useRef<(() => void) | null>(null);
  const frame = useRef<number | null>(null);

  /** Draws on the next frame, once however often it's asked. */
  const request = useCallback(() => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      draw.current?.();
    });
  }, []);

  /** Builds the pins shown and takes down the rest, with their faces. */
  function sync() {
    const ids = new Set(shown.current.map(({ id }) => id));
    for (const [id, { model: pin }] of built.current) {
      if (ids.has(id)) continue;
      pinLayer.remove(pin.root);
      faceLayer.remove(pin.face);
      pin.dispose();
      built.current.delete(id);
    }
    for (const { id, color, dot = false, face } of shown.current) {
      const look = `${color} ${dot}`;
      let entry = built.current.get(id);
      if (entry?.look !== look) {
        if (entry) {
          pinLayer.remove(entry.model.root);
          faceLayer.remove(entry.model.face);
          entry.model.dispose();
        }
        const pin = buildPin(arena, color, dot);
        pinLayer.add(pin.root);
        faceLayer.add(pin.face);
        entry = { model: pin, look, face: null };
        built.current.set(id, entry);
      }
      if (face === entry.face || !picture.current) continue;
      if (face === "no one") entry.model.setFace(null);
      else if (face) {
        entry.model.setFace({
          kind: face.kind,
          texture: picture.current(face),
        });
      }
      entry.face = face;
    }
    // Pictures no pin has any more.
    const used = new Set(
      shown.current.flatMap(({ face }) =>
        face && face !== "no one" ? [face.uri] : [],
      ),
    );
    for (const [uri, texture] of pictures.current) {
      if (used.has(uri)) continue;
      texture.dispose();
      pictures.current.delete(uri);
    }
    request();
  }

  useEffect(sync);

  useEffect(() => {
    model.paint(palette);
    request();
  }, [model, palette, request]);

  useEffect(() => () => model.dispose(), [model]);

  useEffect(
    () => () => {
      for (const { model: pin } of built.current.values()) pin.dispose();
      for (const texture of pictures.current.values()) texture.dispose();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  useAnimatedReaction(() => {
    const { turn, zoom, panX, panY } = view.value;
    const seen = [turn, zoom, panX, panY];
    for (const pin of pins) {
      seen.push(
        now(pin.percentageX),
        now(pin.percentageY),
        now(pin.lift),
        now(pin.angle),
        now(pin.pitch),
      );
    }
    return seen;
  }, () => {
    runOnJS(request)();
  }, [pins]);

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
    // away; what it sees is set as it draws, where the map's box is. Depth
    // only from a map height in front of the centre to one behind, which the
    // whole map is within, so the low steps' fronts aren't lost in it.
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, PERSPECTIVE);
    const [near, far] = [PERSPECTIVE - 1, PERSPECTIVE + 1];

    // Turned clockwise on screen, scaled and moved, inside the lean.
    const lean = new THREE.Group();
    lean.rotation.x = (-TILT_DEG * Math.PI) / 180;
    lean.add(model.group, pinLayer);
    const scene = new THREE.Scene();
    // Only the pins are lit: the arena is in flat colours. Mostly all round,
    // as flat as it, and a little from above, left and in front.
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(-1, 2, 3);
    scene.add(lean, faceLayer, new THREE.AmbientLight(0xffffff, 2.2), sun);

    picture.current = (face) => {
      const known = pictures.current.get(face.uri);
      if (known) return known;
      const texture = gl.createTexture();
      // Bound through three, which keeps track of what's bound.
      renderer.state.bindTexture(gl.TEXTURE_2D, texture);
      // Rows from the bottom up, as GL has them.
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        // A photo's colours are sRGB; initials only say where white goes.
        face.kind === "photo" ? gl.SRGB8_ALPHA8 : gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        // expo-gl reads the file itself.
        { localUri: face.uri } as unknown as TexImageSource,
      );
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const external = new THREE.ExternalTexture(texture);
      external.dispose = () => gl.deleteTexture(texture);
      pictures.current.set(face.uri, external);
      return external;
    };

    draw.current = () => {
      const { x, y, width: across, height: tall } = mapBox.current;
      const { width: wide, height: high } = size.current;
      if (!tall || !wide) return;
      // The map's box a map height tall at the map, its centre straight
      // ahead, and the rest of the view round it: map heights at the near
      // plane, for each point.
      const unit = near / PERSPECTIVE / tall;
      const [cx, cy] = [x + across / 2, y + tall / 2];
      camera.projectionMatrix.makePerspective(
        -cx * unit,
        (wide - cx) * unit,
        cy * unit,
        -(high - cy) * unit,
        near,
        far,
      );
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

      const value = view.value;
      for (const layer of [model.group, pinLayer]) {
        layer.scale.setScalar(viewScale(value));
        layer.rotation.set(0, 0, (-value.turn * Math.PI) / 180);
        // Down the screen is down the map; three's y is up.
        layer.position.set(value.panX, -value.panY, 0);
      }
      for (const pin of shown.current) {
        built.current.get(pin.id)?.model.place({
          view: value,
          percentageX: now(pin.percentageX),
          percentageY: now(pin.percentageY),
          height: pin.height,
          lift: now(pin.lift, PIN_LIFT_AT_REST),
          angle: now(pin.angle),
          pitch: now(pin.pitch),
          shadowOpacity: shadowOpacity.current,
        });
      }
      scene.updateMatrixWorld();
      camera.updateMatrixWorld();
      for (const { model: pin } of built.current.values()) pin.aim(camera);
      renderer.setClearColor(background.current);
      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    sync();
    draw.current();
  }

  return (
    // GLView takes touches; the wrapper keeps it from taking the drag away
    // from the map underneath.
    <View
      style={style}
      pointerEvents="none"
      onLayout={(e) => {
        size.current = e.nativeEvent.layout;
        request();
      }}
    >
      <GLView
        style={StyleSheet.absoluteFill}
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
