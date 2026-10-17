import { PIN_COLOR, PIN_DOT_VW, PIN_WIDTH_VW } from "@shared/pin";
import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import Svg, { Path, Text as SvgText } from "react-native-svg";

const pinIcon = require("@public/pin.svg");

// Intrinsic size of public/pin.svg.
const PIN_ASPECT = 316 / 250;

// public/pin.svg's outline without the hole in its head, in its 250 × 316
// space, for pins that carry a label instead; the head is centred on HEAD.
const PIN_OUTLINE =
  "M125 315.199C175.118 315.199 249.117 194.527 249.117 125.462C249.117 56.3969 193.548 0.408691 125 0.408691C56.4519 0.408691 0.882812 56.3969 0.882812 125.462C0.882812 194.527 80.1204 315.199 125 315.199Z";
const HEAD = { x: 125, y: 126 };

// The web's pin transforms, translate(-50%, -115%) at rest and -150% while
// dragging, expressed as fractions of the pin's height.
const PIN_LIFT_AT_REST = 1.15;
const PIN_LIFT_MOVING = 1.5;

type Props = {
  percentageX: number;
  percentageY: number;
  /**
   * The width `vw` units resolve against: the window on screen, the card in
   * the shared image.
   */
  viewportWidth: number;
  lifted?: boolean;
  /** Text in the pin's head (a friend's initials) in place of the hole. */
  label?: string;
  /** Defaults to PIN_COLOR, my own pin's red. */
  color?: string;
  accessibilityLabel?: string;
};

/** The pin and its dot, placed at a point on the map that contains it. */
export default function Pin({
  percentageX,
  percentageY,
  viewportWidth,
  lifted = false,
  label,
  color = PIN_COLOR,
  accessibilityLabel,
}: Props) {
  const width = (viewportWidth * PIN_WIDTH_VW) / 100;
  const height = width * PIN_ASPECT;
  const dot = (viewportWidth * PIN_DOT_VW) / 100;
  const placement = {
    position: "absolute" as const,
    width,
    height,
    transform: [
      { translateX: -width / 2 },
      { translateY: -height * (lifted ? PIN_LIFT_MOVING : PIN_LIFT_AT_REST) },
    ],
  };

  return (
    <View
      pointerEvents="none"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.anchor,
        { left: `${percentageX}%`, top: `${percentageY}%` },
      ]}
    >
      {label === undefined ? (
        <Image source={pinIcon} style={placement} />
      ) : (
        <Svg viewBox="0 0 250 316" style={placement}>
          <Path d={PIN_OUTLINE} fill={color} />
          <SvgText
            x={HEAD.x}
            y={HEAD.y}
            fill="#fff"
            fontSize={label.length > 1 ? 100 : 120}
            fontWeight="700"
            textAnchor="middle"
            alignmentBaseline="central"
          >
            {label}
          </SvgText>
        </Svg>
      )}
      <View
        style={{
          position: "absolute",
          width: dot,
          height: dot,
          borderRadius: dot / 2,
          backgroundColor: color,
          transform: [{ translateX: -dot / 2 }, { translateY: -dot / 2 }],
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: "absolute", width: 0, height: 0 },
});
