import { PIN_COLOR, PIN_DOT_VW, PIN_WIDTH_VW } from "@shared/pin";
import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

const pinIcon = require("@public/pin.svg");

// Intrinsic size of public/pin.svg.
const PIN_ASPECT = 316 / 250;

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
};

/** The pin and its dot, placed at a point on the map that contains it. */
export default function Pin({
  percentageX,
  percentageY,
  viewportWidth,
  lifted = false,
}: Props) {
  const width = (viewportWidth * PIN_WIDTH_VW) / 100;
  const height = width * PIN_ASPECT;
  const dot = (viewportWidth * PIN_DOT_VW) / 100;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.anchor,
        { left: `${percentageX}%`, top: `${percentageY}%` },
      ]}
    >
      <Image
        source={pinIcon}
        style={{
          position: "absolute",
          width,
          height,
          transform: [
            { translateX: -width / 2 },
            {
              translateY:
                -height * (lifted ? PIN_LIFT_MOVING : PIN_LIFT_AT_REST),
            },
          ],
        }}
      />
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
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: "absolute", width: 0, height: 0 },
});
