import { useContext } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { friendPinSize, pinGrowth } from "@/lib/pinShape";
import { SHARING_COLOR, useTheme } from "@/lib/theme";
import { FloorContext } from "./FloorPoint";

// The widest the label over a pin grows.
const LABEL_WIDTH = 260;

type Props = {
  name: string;
  /** Where they are and until when they share it, shown with a live dot. */
  status: string;
};

/**
 * The label over a friend's pin, its point on their shared seat: their name
 * and when they stop sharing.
 */
export default function FriendLabel({ name, status }: Props) {
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const floor = useContext(FloorContext);
  // As big as the pins on this floor.
  const scale = floor?.floor?.pinScale ?? 1;
  const height = friendPinSize(width).height * scale;
  const float = friendPinSize(width).float * scale;
  const zoom = floor?.zoom;
  // Centred over the pin's head, a little above it, as big as it's grown.
  const above = useAnimatedStyle(() => ({
    transform: [
      { translateY: -((height + float) * pinGrowth(zoom?.value ?? 1) + 8) },
    ],
  }));
  return (
    <Animated.View style={[styles.label, above]}>
      <View style={styles.above}>
        <View
          accessible
          accessibilityLabel={`${name}, ${status}`}
          style={[styles.bubble, { backgroundColor: theme.card }]}
        >
          <Text style={[styles.name, { color: theme.text }]}>{name}</Text>
          <View style={styles.status}>
            <View style={styles.live} />
            <Text style={[styles.until, { color: theme.tertiaryText }]}>
              {status}
            </Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // A wide, flat strip centred on the point; the bubble stands on it, as wide
  // as its text.
  label: {
    position: "absolute",
    width: LABEL_WIDTH,
    height: 0,
    marginLeft: -LABEL_WIDTH / 2,
  },
  above: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  bubble: {
    alignItems: "center",
    gap: 2,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  name: { fontSize: 15, fontWeight: "600" },
  status: { flexDirection: "row", alignItems: "center", gap: 6 },
  live: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: SHARING_COLOR,
  },
  until: { fontSize: 13, fontVariant: ["tabular-nums"] },
});
