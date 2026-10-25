import { PIN_COLOR } from "@shared/pin";
import * as THREE from "three";
import { ROW_HEIGHT } from "@/lib/arena";
import {
  AXIS,
  DOT_SHADOW_OFFSET,
  DOT_SHADOW_OPACITY,
  DOT_SIZE,
  HEAD_R,
  PHOTO_INSET,
  PIN_LIFT_AT_REST,
  PIN_LIFT_MOVING,
  pinGrowth,
  SHADOW_LENGTH,
  SHADOW_LIFTED_OPACITY,
  TEARDROP_BOX,
  TIP_R,
} from "@/lib/pinShape";
import { type FloorView, standHeight, TILT_DEG, viewScale } from "@/lib/tilt";

// Pins built in 3D, to stand on the arena `buildArena` builds: each in
// drawing units about the point it stands over, z up off the floor and y
// away from you along it, the pin itself standing up the screen, scaled to stay one size on screen however far the map
// is zoomed. Its head's photo or initials face the eye, wherever it leans.

/** A picture of what's on a pin's head, as a file: a photo, or initials. */
export type PinFace = { uri: string; kind: "photo" | "initials" };

// The radius of the white dot on the head of a pin that's no one's.
const NO_ONE_DOT = 16;
// How far the floor's things float over it, in drawing units, so the floor
// doesn't show through.
const OVER_FLOOR = 1;

/**
 * The pin's side from its foot to its crown, to be turned about its axis:
 * x out from the axis, y up it from the small ball's centre.
 */
function side() {
  // Where the cone touches each ball, this far below its middle.
  const touch = Math.asin((HEAD_R - TIP_R) / AXIS);
  const points: THREE.Vector2[] = [];
  const arc = (r: number, y: number, from: number, to: number, n: number) => {
    for (let k = 0; k <= n; k++) {
      const t = from + ((to - from) * k) / n;
      points.push(
        new THREE.Vector2(Math.max(r * Math.cos(t), 0), y + r * Math.sin(t)),
      );
    }
  };
  arc(TIP_R, 0, -Math.PI / 2, -touch, 6);
  arc(HEAD_R, AXIS, -touch, Math.PI / 2, 32);
  return points;
}

const SIDE = side();
// Turned about y, then stood up along z.
const BODY = new THREE.LatheGeometry(SIDE, 48).rotateX(Math.PI / 2);
// The pin laid flat away from you, shortened: its tip on 0, its head up y.
const SHADOW = new THREE.ShapeGeometry(
  new THREE.Shape([
    ...SIDE.map(
      ({ x, y }) => new THREE.Vector2(x, (y + TIP_R) * SHADOW_LENGTH),
    ),
    ...[...SIDE]
      .reverse()
      .map(({ x, y }) => new THREE.Vector2(-x, (y + TIP_R) * SHADOW_LENGTH)),
  ]),
);
const DISC = new THREE.CircleGeometry(1, 48);

// How much of its own depth a pin keeps about the point it stands on: enough
// for its parts to cover each other, not enough to sink into the stands
// behind it, which it leans back over, standing up the screen.
const DEPTH_KEPT = 0.05;
// How far in front of the point each part is drawn, in depth (about 0.75 a
// map height): its shadow and dot over the seats round it, its body over
// them, its face over its body. Only what's clearly in front, a column,
// covers it.
const NEARER = { floor: 0.006, body: 0.008, face: 0.01 };

/**
 * Draws a pin's material as if all of the pin were at the depth `depth`
 * holds, the point it stands on's, `nearer` in front of it: what's in front
 * of that covers it, what's behind doesn't.
 */
function atDepth<M extends THREE.Material>(
  material: M,
  depth: { value: number },
  nearer: number,
) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.pinDepth = depth;
    shader.vertexShader = `uniform float pinDepth;\n${shader.vertexShader.replace(
      "#include <project_vertex>",
      `#include <project_vertex>
      gl_Position.z = (pinDepth - ${nearer.toFixed(4)} + (gl_Position.z / gl_Position.w - pinDepth) * ${DEPTH_KEPT.toFixed(3)}) * gl_Position.w;`,
    )}`;
  };
  // Shaders differ by how much nearer.
  material.customProgramCacheKey = () => `pin ${nearer}`;
  return material;
}

/**
 * How a pin stands: where (map percentages), seen how, how big on screen at
 * rest (in map heights), lifted how far (as `PIN_LIFT_*`), leaning `angle`
 * sideways and tipped `pitch` away (+) from you, in radians; and how dark
 * its shadow is.
 */
export type PinPose = {
  view: FloorView;
  percentageX: number;
  percentageY: number;
  height: number;
  lift: number;
  angle: number;
  pitch: number;
  shadowOpacity: number;
};

/**
 * A pin in `color`, with a dot on the floor under it or not, standing on an
 * arena `frame.width` × `frame.height` big. `root` goes in the arena's group;
 * `face`, which is turned to the eye, in the scene itself.
 */
export function buildPin(
  frame: { width: number; height: number },
  color: string,
  dot: boolean,
) {
  const root = new THREE.Group();
  // Upright on screen, as the flat pin is, rather than off the floor: seen
  // from almost straight above, its head would hide its point.
  const upright = new THREE.Group();
  upright.rotation.x = ((TILT_DEG - 90) * Math.PI) / 180;
  root.add(upright);
  // Leaning and tipped about the point.
  const tilt = new THREE.Group();
  upright.add(tilt);
  // The depth of the point it stands on, as the eye sees it.
  const depth = { value: 0 };
  // Matte, as the arena's flat colours are.
  const bodyMaterial = atDepth(
    new THREE.MeshLambertMaterial({ color }),
    depth,
    NEARER.body,
  );
  const body = new THREE.Mesh(BODY, bodyMaterial);
  tilt.add(body);
  const head = new THREE.Object3D();
  tilt.add(head);

  // Lying on the floor: the shadow turns with the lean, not the tip.
  const lying = new THREE.Group();
  root.add(lying);
  const floorMaterial = (paint: THREE.ColorRepresentation, opacity = 1) =>
    atDepth(
      new THREE.MeshBasicMaterial({
        color: paint,
        transparent: true,
        opacity,
        depthWrite: false,
      }),
      depth,
      NEARER.floor,
    );
  const shadowMaterial = floorMaterial(0x000000);
  const shadow = new THREE.Mesh(SHADOW, shadowMaterial);
  // At one depth, so drawn in order: shadow, the dot's shadow, the dot.
  shadow.renderOrder = 1;
  lying.add(shadow);
  const dotShadowMaterial = floorMaterial(0x000000);
  const dotMaterial = floorMaterial(PIN_COLOR);
  if (dot) {
    const under = new THREE.Mesh(DISC, dotShadowMaterial);
    under.scale.setScalar(DOT_SIZE / 2);
    under.position.set(0, DOT_SIZE * DOT_SHADOW_OFFSET, OVER_FLOOR);
    under.renderOrder = 2;
    const top = new THREE.Mesh(DISC, dotMaterial);
    top.scale.setScalar(DOT_SIZE / 2);
    top.position.z = 2 * OVER_FLOOR;
    top.renderOrder = 3;
    root.add(under, top);
  }

  const faceMaterial = atDepth(
    new THREE.MeshBasicMaterial({ transparent: true }),
    depth,
    NEARER.face,
  );
  const face = new THREE.Mesh(DISC, faceMaterial);
  face.visible = false;
  // Its radius in drawing units.
  let faceSize = 0;
  // Drawing units on screen, in map heights, as last placed.
  let unit = 0;
  const at = new THREE.Vector3();
  const toEye = new THREE.Vector3();

  return {
    root,
    face,
    /** Paints its head: a picture of a face, or no one's white dot (`null`). */
    setFace(picture: { kind: PinFace["kind"]; texture: THREE.Texture } | null) {
      faceMaterial.map = picture?.kind === "photo" ? picture.texture : null;
      // Initials are white where the picture is.
      faceMaterial.alphaMap =
        picture?.kind === "initials" ? picture.texture : null;
      faceMaterial.needsUpdate = true;
      faceSize = !picture
        ? NO_ONE_DOT
        : picture.kind === "photo"
          ? HEAD_R - PHOTO_INSET
          : HEAD_R;
      face.visible = true;
    },
    place(pose: PinPose) {
      const { percentageX: x, percentageY: y, lift, angle, pitch } = pose;
      unit = (pose.height * pinGrowth(pose.view.zoom)) / TEARDROP_BOX.height;
      // On the top of the stands there, or the seats on them.
      root.position.set(
        (x / 100 - 0.5) * (frame.width / frame.height),
        0.5 - y / 100,
        standHeight(x, y) + ROW_HEIGHT / frame.height,
      );
      // Turned back from the arena's turn: y is away from you.
      root.rotation.z = (pose.view.turn * Math.PI) / 180;
      root.scale.setScalar(unit / viewScale(pose.view));
      // Dragged right, the head leans right of the point; tipped away, it
      // goes up the floor.
      tilt.rotation.set(-pitch, angle, 0);
      body.position.z = TEARDROP_BOX.height * (lift - 1) + TIP_R;
      head.position.z = body.position.z + AXIS;

      lying.rotation.z = -angle;
      // Mine floats above its dot, so its shadow starts the gap's shadow away
      // from it, and slides further off as it's lifted.
      shadow.position.set(
        0,
        TEARDROP_BOX.height *
          (dot ? SHADOW_LENGTH * (lift - 1) : PIN_LIFT_AT_REST - 1),
        OVER_FLOOR,
      );
      // From at rest (0) to lifted (1).
      const up =
        (lift - PIN_LIFT_AT_REST) / (PIN_LIFT_MOVING - PIN_LIFT_AT_REST);
      shadowMaterial.opacity =
        pose.shadowOpacity * (1 - up * (1 - SHADOW_LIFTED_OPACITY));
      dotShadowMaterial.opacity = pose.shadowOpacity * DOT_SHADOW_OPACITY;
    },
    /**
     * Sets its face on the front of its head, seen by `camera`, and its
     * depth; once placed, with the scene's matrices updated.
     */
    aim(camera: THREE.Camera) {
      root.getWorldPosition(at);
      depth.value = at.project(camera).z;
      const eye = camera.position;
      head.getWorldPosition(at);
      toEye.subVectors(eye, at).normalize();
      // Just in front of the ball, so the ball doesn't cut into it.
      face.position.copy(at).addScaledVector(toEye, HEAD_R * unit * 1.02);
      face.scale.setScalar(faceSize * unit);
    },
    dispose() {
      for (const material of [
        bodyMaterial,
        shadowMaterial,
        dotShadowMaterial,
        dotMaterial,
        faceMaterial,
      ]) {
        material.dispose();
      }
    },
  };
}

export type ScenePinModel = ReturnType<typeof buildPin>;
