import { PIN_COLOR, PIN_DOT_VW, PIN_WIDTH_VW } from "@shared/pin";
import { Image } from "expo-image";
import { useContext, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import Svg, { Circle, Path, Text as SvgText } from "react-native-svg";
import { webUrl } from "@/lib/api";
import { initials } from "@/lib/friends";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";
import { floorLean } from "@/lib/tilt";
import { FloorContext } from "./FloorPoint";

// The upright pin's drawing: a 100 × 128 box with the head's centre at HEAD.
const TEARDROP_BOX = { width: 100, height: 128 };
const TEARDROP_HEAD = { x: 50, y: 50 };
// Its outline upright: a circle of radius 48 round HEAD drawn out along the
// outer tangents to a tip rounded with radius 6, lowest at (50, 128).
const TEARDROP =
  "M11.01 78A48 48 0 1 1 88.99 78L54.87 125.5A6 6 0 0 1 45.13 125.5Z";

// public/pin.svg's box, which PIN_WIDTH_VW is the width of.
const WEB_PIN_ASPECT = 316 / 250;

// The web's pin transforms, translate(-50%, -115%) at rest and -150% while
// dragging, expressed as fractions of the pin's height.
const PIN_LIFT_AT_REST = 1.15;
const PIN_LIFT_MOVING = 1.5;

// The pin as a solid: a ball of radius HEAD_R and a small ball of radius
// TIP_R, joined by the cone touching both, AXIS apart. Upright it is the
// friend pin's teardrop. It pivots about the point it stands over, the dot,
// with the gap it floats above it, as one stiff thing.
const HEAD_R = 48;
const TIP_R = 6;
const AXIS = TEARDROP_BOX.height - TIP_R - TEARDROP_HEAD.y;
// How far in from the head's edge a profile photo stops, in drawing units:
// a ring of the pin's colour round it.
const PHOTO_INSET = 5;
// How far away the eye is, in drawing units: a head tipped towards you grows.
const EYE = 400;
// Half the canvas the pin is drawn on around its pivot, room for any lean
// while lifted.
const REACH = 260;
// The shadow: the pin laid flat on the floor, falling away from you, in the
// floor's perspective; a gap away from the dot under my pin, which floats
// above it, from the tip of a friend's, which has no dot. Its length against the pin's, and how
// dark (`pinShadowOpacity` in the theme); lifted, it fades.
const SHADOW_LENGTH = 0.7;
const SHADOW_LIFTED_OPACITY = 0.5;
// The dot's own shadow, falling away from you, barely there: how far, against
// the dot, and how much of the pin's shadow's darkness it has.
const DOT_SHADOW_OFFSET = 0.15;
const DOT_SHADOW_OPACITY = 0.5;

const AnimatedPath = Animated.createAnimatedComponent(Path);

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
 * Where the pin's head falls on screen, how big it looks, and the outline
 * of the whole pin, its small ball's centre `base` above the pivot, tipped
 * `angle` sideways and `pitch` towards (−) or away from (+) you about it.
 * Coordinates are drawing units from the pivot.
 */
function tippedPin(angle: number, pitch: number, base: number) {
  "worklet";
  const toward = -Math.sin(pitch);
  // The point `along` the pin from the pivot, and how big it looks there.
  const at = (along: number) => {
    const scale = EYE / (EYE - along * toward);
    return {
      x: along * scale * Math.sin(angle) * Math.cos(pitch),
      y: -along * scale * Math.cos(angle) * Math.cos(pitch),
      scale,
    };
  };
  const tip = at(base);
  const { x, y, scale } = at(base + AXIS);
  const r = HEAD_R * scale;
  const tipR = TIP_R * tip.scale;
  const apart = Math.hypot(x - tip.x, y - tip.y);
  const n = (value: number) => value.toFixed(2);
  if (apart <= r - tipR) {
    // Pointing at you: the head hides the rest.
    return {
      x,
      y,
      scale,
      d: `M${n(x - r)} ${n(y)}A${n(r)} ${n(r)} 0 1 1 ${n(x + r)} ${n(y)}A${n(r)} ${n(r)} 0 1 1 ${n(x - r)} ${n(y)}Z`,
    };
  }
  // The cone touches both balls where their radii are β off the line from
  // head to tip.
  const ux = (tip.x - x) / apart;
  const uy = (tip.y - y) / apart;
  const cos = (r - tipR) / apart;
  const sin = Math.sqrt(1 - cos * cos);
  const side = (s: 1 | -1) => ({
    x: ux * cos - s * uy * sin,
    y: s * ux * sin + uy * cos,
  });
  const left = side(1);
  const right = side(-1);
  return {
    x,
    y,
    scale,
    d: [
      `M${n(x + r * left.x)} ${n(y + r * left.y)}`,
      `A${n(r)} ${n(r)} 0 1 1 ${n(x + r * right.x)} ${n(y + r * right.y)}`,
      `L${n(tip.x + tipR * right.x)} ${n(tip.y + tipR * right.y)}`,
      `A${n(tipR)} ${n(tipR)} 0 0 1 ${n(tip.x + tipR * left.x)} ${n(tip.y + tipR * left.y)}`,
      "Z",
    ].join(""),
  };
}

/** Initials on a pin's head, sized to fit one or two letters. */
function Initials({
  label,
  x,
  y,
  size,
}: {
  label: string;
  x: number;
  y: number;
  size: number;
}) {
  return (
    <SvgText
      x={x}
      y={y}
      fill="#fff"
      fontSize={label.length > 1 ? size * 0.83 : size}
      fontWeight="700"
      textAnchor="middle"
      alignmentBaseline="central"
    >
      {label}
    </SvgText>
  );
}

/** The pin's body in flat colour, redrawn as it tips. */
function Body({
  outline,
  color,
}: {
  outline: Partial<{ d: string }>;
  color: string;
}) {
  return <AnimatedPath animatedProps={outline} fill={color} />;
}

/** My initials on the head, or a white dot for no one. */
function Head({ label }: { label: string | null }) {
  return label ? (
    <Initials label={label} x={0} y={3} size={48} />
  ) : (
    <Circle cx={0} cy={3} r={16} fill="#fff" />
  );
}

type Props = {
  percentageX: number;
  percentageY: number;
  /**
   * The width `vw` units resolve against: the window on screen, the card in
   * the shared image.
   */
  viewportWidth: number;
  lifted?: boolean;
  /** How far the pin leans sideways, in radians, about its tip. */
  angle?: SharedValue<number>;
  /** How far the pin tips towards (−) or away from (+) you, in radians. */
  pitch?: SharedValue<number>;
  /** Whose pin: their initials on it, in their colour. Mine without it. */
  owner?: { name: string; color: string; avatarUrl?: string | null };
  /** The dot on the floor under the pin; mine only. */
  dot?: boolean;
  /** How big against my pin. */
  scale?: number;
  /** The profile photo on the head, where there is one; initials without. */
  photo?: boolean;
};

/**
 * The pin, its shadow and its dot, placed at a point on the map that
 * contains it.
 */
export default function Pin({
  percentageX,
  percentageY,
  viewportWidth,
  lifted = false,
  angle,
  pitch,
  owner,
  dot: withDot = true,
  scale = 1,
  photo = true,
}: Props) {
  const { session } = useSession();
  const me = session.status === "signed-in" ? session.user : null;
  const label = owner ? initials(owner.name) : me ? initials(me.name) : null;
  const avatarUrl = photo ? (owner ? owner.avatarUrl : me?.avatarUrl) : null;
  const { height } = pinSize(viewportWidth, scale);
  // Screen points per drawing unit.
  const unit = height / TEARDROP_BOX.height;
  const dot = (viewportWidth * PIN_DOT_VW) / 100;

  const lift = useSharedValue(lifted ? PIN_LIFT_MOVING : PIN_LIFT_AT_REST);
  useEffect(() => {
    // Picked up quick, with one small overshoot; set down without a bounce.
    lift.value = withSpring(
      lifted ? PIN_LIFT_MOVING : PIN_LIFT_AT_REST,
      lifted
        ? { damping: 38, stiffness: 700 }
        : { damping: 60, stiffness: 700 },
    );
  }, [lifted, lift]);

  // Drawn tipped towards or away from you only; the lean turns the whole pin,
  // head and all, about the point.
  const shape = useDerivedValue(() =>
    tippedPin(
      0,
      pitch?.value ?? 0,
      // The small ball's centre above the point: the gap under the old box's
      // bottom, and the ball's radius.
      TEARDROP_BOX.height * (lift.value - 1) + TIP_R,
    ),
  );
  const outline = useAnimatedProps(() => ({ d: shape.value.d }));
  const lean = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${angle?.value ?? 0}rad` }],
  }));
  const head = useAnimatedStyle(() => ({
    transform: [
      { translateX: shape.value.x * unit },
      { translateY: shape.value.y * unit },
      { scale: shape.value.scale },
    ],
  }));

  const canvas = REACH * unit;
  const headSize = 2 * HEAD_R * unit;
  const floor = useContext(FloorContext);
  const theme = useTheme();
  const shadow = {
    width: TEARDROP_BOX.width * unit,
    height: height * SHADOW_LENGTH,
  };
  const shadowStyle = useAnimatedStyle(() => {
    // From at rest (0) to lifted (1).
    const up =
      (lift.value - PIN_LIFT_AT_REST) / (PIN_LIFT_MOVING - PIN_LIFT_AT_REST);
    return {
      opacity: 1 - up * (1 - SHADOW_LIFTED_OPACITY),
      transform: [
        // Flat until the floor has been laid out.
        ...(floor?.height ? floorLean(floor.height) : []),
        // Leaning with the pin, about the point.
        { rotateZ: `${angle?.value ?? 0}rad` },
        // Mine floats above its dot, so its shadow starts the gap's shadow
        // away from it, and slides further off as it's lifted, as a shadow in
        // sunlight.
        {
          translateY: withDot
            ? -height * SHADOW_LENGTH * (lift.value - 1)
            : -height * (PIN_LIFT_AT_REST - 1),
        },
      ],
    };
  });
  return (
    <View
      pointerEvents="none"
      style={[
        styles.anchor,
        { left: `${percentageX}%`, top: `${percentageY}%` },
      ]}
    >
      <Animated.View
        style={[
          {
            position: "absolute",
            left: -shadow.width / 2,
            top: -shadow.height,
            ...shadow,
            transformOrigin: "50% 100%",
          },
          shadowStyle,
        ]}
      >
        <Svg
          {...shadow}
          viewBox={`0 0 ${TEARDROP_BOX.width} ${TEARDROP_BOX.height}`}
          preserveAspectRatio="none"
        >
          {/* Tip at the bottom, on the seat, head away from you. */}
          <Path d={TEARDROP} fill="#000" fillOpacity={theme.pinShadowOpacity} />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.anchor, lean]}>
        <Svg
          style={{ position: "absolute", left: -canvas, top: -canvas }}
          width={2 * canvas}
          height={canvas + 2 * TIP_R * unit}
          viewBox={`${-REACH} ${-REACH} ${2 * REACH} ${REACH + 2 * TIP_R}`}
        >
          <Body outline={outline} color={owner?.color ?? PIN_COLOR} />
        </Svg>
        <Animated.View
          style={[
            {
              position: "absolute",
              left: -headSize / 2,
              top: -headSize / 2,
              width: headSize,
              height: headSize,
            },
            head,
          ]}
        >
          <Svg
            width={headSize}
            height={headSize}
            viewBox={`${-HEAD_R} ${-HEAD_R} ${2 * HEAD_R} ${2 * HEAD_R}`}
          >
            <Head label={label} />
          </Svg>
          {avatarUrl && (
            <Image
              source={webUrl(avatarUrl)}
              style={{
                position: "absolute",
                left: PHOTO_INSET * unit,
                top: PHOTO_INSET * unit,
                width: headSize - 2 * PHOTO_INSET * unit,
                height: headSize - 2 * PHOTO_INSET * unit,
                borderRadius: (headSize - 2 * PHOTO_INSET * unit) / 2,
              }}
            />
          )}
        </Animated.View>
      </Animated.View>
      {withDot && (
        <View
          style={{
            position: "absolute",
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            backgroundColor: "#000",
            opacity: theme.pinShadowOpacity * DOT_SHADOW_OPACITY,
            transform: [
              { translateX: -dot / 2 },
              { translateY: -dot / 2 - dot * DOT_SHADOW_OFFSET },
            ],
          }}
        />
      )}
      {withDot && (
        <View
          style={{
            position: "absolute",
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            backgroundColor: PIN_COLOR,
            transform: [{ translateX: -dot / 2 }, { translateY: -dot / 2 }],
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: "absolute", width: 0, height: 0 },
});
