import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { colorForInitials, initials } from "@/lib/friends";
import { t } from "@/lib/i18n";
import { SHARING_COLOR, useTheme } from "@/lib/theme";
import Pin, { pinSize } from "./Pin";

// A friend pin's size against mine, so mine stands out.
const FRIEND_PIN_SCALE = 0.7;
// The widest the label over a pin grows.
const LABEL_WIDTH = 260;

/** How big a friend pin is on screen, as `pinSize`. */
export const friendPinSize = (windowWidth: number) =>
  pinSize(windowWidth, FRIEND_PIN_SCALE);

type Props = {
  name: string;
  avatarUrl: string | null;
  percentageX: number;
  percentageY: number;
  /**
   * When they stop sharing, shown with their name and a live dot in a label
   * over the pin; no label without it.
   */
  until?: string;
};

/**
 * A friend pin: my pin in the friend's colour with their initials, without
 * the dot, its tip on their shared seat.
 */
export default function FriendPin({
  name,
  avatarUrl,
  percentageX,
  percentageY,
  until,
}: Props) {
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const { height, float } = friendPinSize(width);
  return (
    <View accessible accessibilityLabel={t.sitsHere(name)}>
      <Pin
        percentageX={percentageX}
        percentageY={percentageY}
        viewportWidth={width}
        owner={{ name, color: colorForInitials(initials(name)), avatarUrl }}
        dot={false}
        scale={FRIEND_PIN_SCALE}
      />
      {until && (
        // Centred over the pin's head, a little above it.
        <View
          style={[
            styles.label,
            {
              left: `${percentageX}%`,
              top: `${percentageY}%`,
              transform: [{ translateY: -(height + float + 8) }],
            },
          ]}
        >
          <View style={styles.above}>
            <View
              accessible
              accessibilityLabel={`${name}, ${t.sitsInSalenUntil(until)}`}
              style={[styles.bubble, { backgroundColor: theme.card }]}
            >
              <Text style={[styles.name, { color: theme.text }]}>{name}</Text>
              <View style={styles.status}>
                <View style={styles.live} />
                <Text style={[styles.until, { color: theme.tertiaryText }]}>
                  {until}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
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
