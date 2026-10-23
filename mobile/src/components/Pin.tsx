import { PIN_COLOR, PIN_DOT_VW, PIN_WIDTH_VW } from "@shared/pin";
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
// friend pin's teardrop. It pivots about the small ball's centre, which is
// TIP_R above the drawing's lowest point.
const HEAD_R = 48;
const TIP_R = 6;
const AXIS = TEARDROP_BOX.height - TIP_R - TEARDROP_HEAD.y;
// How far away the eye is, in drawing units: a head tipped towards you grows.
const EYE = 400;
// Half the canvas the pin is drawn on around its pivot, room for any lean.
const REACH = 160;
// The shadow: the pin laid flat on the floor, falling away from you, in the
// floor's perspective; from the seat under my pin, from the tip of a friend's,
// which has no dot to mark its seat. Its length against the pin's, and how
// dark (`pinShadowOpacity` in the theme); lifted, it fades.
const SHADOW_LENGTH = 0.7;
const SHADOW_LIFTED_OPACITY = 0.5;

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Where the pin's head falls on screen, how big it looks, and the outline
 * of the whole pin, tipped `angle` sideways and `pitch` towards (−) or away
 * from (+) you. Coordinates are drawing units from the pivot.
 */
function tippedPin(angle: number, pitch: number) {
  "worklet";
  const toward = -Math.sin(pitch);
  const scale = EYE / (EYE - AXIS * toward);
  const x = AXIS * scale * Math.sin(angle) * Math.cos(pitch);
  const y = -AXIS * scale * Math.cos(angle) * Math.cos(pitch);
  const r = HEAD_R * scale;
  const apart = Math.hypot(x, y);
  const n = (value: number) => value.toFixed(2);
  if (apart <= r - TIP_R) {
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
  const ux = -x / apart;
  const uy = -y / apart;
  const cos = (r - TIP_R) / apart;
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
      `L${n(TIP_R * right.x)} ${n(TIP_R * right.y)}`,
      `A${TIP_R} ${TIP_R} 0 0 1 ${n(TIP_R * left.x)} ${n(TIP_R * left.y)}`,
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
  owner?: { name: string; color: string };
  /** The dot on the floor under the pin; mine only. */
  dot?: boolean;
  /** How big against my pin. */
  scale?: number;
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
}: Props) {
  const { session } = useSession();
  const label = owner
    ? initials(owner.name)
    : session.status === "signed-in"
      ? initials(session.user.name)
      : null;
  const height =
    ((viewportWidth * PIN_WIDTH_VW) / 100) * WEB_PIN_ASPECT * scale;
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

  const shape = useDerivedValue(() =>
    tippedPin(angle?.value ?? 0, pitch?.value ?? 0),
  );
  const outline = useAnimatedProps(() => ({ d: shape.value.d }));
  // The pivot: the old box's bottom, less the tip ball's radius.
  const raise = useAnimatedStyle(() => ({
    transform: [{ translateY: -height * (lift.value - 1) - TIP_R * unit }],
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
        // Leaning with the pin.
        { rotateZ: `${angle?.value ?? 0}rad` },
        ...(withDot ? [] : [{ translateY: -height * (PIN_LIFT_AT_REST - 1) }]),
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
      <Animated.View style={[styles.anchor, raise]}>
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
        </Animated.View>
      </Animated.View>
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
