import { StyleSheet, useWindowDimensions, View } from "react-native";
import Svg, { Path, Text as SvgText } from "react-native-svg";
import { colorForInitials, initials } from "@/lib/friends";

// A teardrop in a 100 × 128 box: a circle of radius 48 centred on HEAD, its
// bottom drawn out along the circles' outer tangents to a tip rounded with
// radius 6, whose lowest point is TIP.
const TEARDROP =
  "M11.01 78A48 48 0 1 1 88.99 78L54.87 125.5A6 6 0 0 1 45.13 125.5Z";
const BOX = { width: 100, height: 128 };
const HEAD = { x: 50, y: 50 };
const TIP = { x: 50, y: 128 };

/** Width of a friend pin, as a percentage of the window's width. */
const FRIEND_PIN_WIDTH_VW = 10;

type Props = {
  name: string;
  percentageX: number;
  percentageY: number;
};

/**
 * A friend pin: a teardrop with the friend's initials, coloured by them, whose
 * tip is on their shared seat.
 */
export default function FriendPin({ name, percentageX, percentageY }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const label = initials(name);
  const width = (windowWidth * FRIEND_PIN_WIDTH_VW) / 100;
  const scale = width / BOX.width;

  return (
    <View
      pointerEvents="none"
      accessibilityLabel={`${name} sitter her`}
      style={[
        styles.anchor,
        { left: `${percentageX}%`, top: `${percentageY}%` },
      ]}
    >
      <Svg
        viewBox={`0 0 ${BOX.width} ${BOX.height}`}
        style={{
          position: "absolute",
          width,
          height: BOX.height * scale,
          left: -TIP.x * scale,
          top: -TIP.y * scale,
        }}
      >
        <Path d={TEARDROP} fill={colorForInitials(label)} />
        <SvgText
          x={HEAD.x}
          y={HEAD.y}
          fill="#fff"
          fontSize={label.length > 1 ? 40 : 48}
          fontWeight="700"
          textAnchor="middle"
          alignmentBaseline="central"
        >
          {label}
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: "absolute", width: 0, height: 0 },
});
