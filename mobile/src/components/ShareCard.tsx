import salen from "@shared/arenas/salen";
import type { GridPosition } from "@shared/grid";
import type { ComponentRef, Ref } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SHARE_BANNER } from "@/lib/banner";
import ArenaMap from "./ArenaMap";
import Pin from "./Pin";

// Layout width of the card, in points; the PNG is rendered at a fixed pixel
// width regardless (see lib/share.ts).
export const CARD_WIDTH = 360;
const CARD_PADDING = 24;

type Props = {
  position: GridPosition;
  ref?: Ref<ComponentRef<typeof View>>;
};

/**
 * The image a share sends: the map with the pin, and the banner under it.
 * Rendered off-screen and captured, never shown in the app.
 */
export default function ShareCard({ position, ref }: Props) {
  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <View style={styles.map}>
        <ArenaMap arena={salen} style={StyleSheet.absoluteFill} />
        <Pin
          percentageX={position.percentageX}
          percentageY={position.percentageY}
          // On screen the pin is sized off a window ~1.25× the map's width.
          viewportWidth={(CARD_WIDTH - CARD_PADDING * 2) * 1.25}
        />
      </View>
      <View
        style={[styles.banner, { backgroundColor: SHARE_BANNER.background }]}
      >
        <Text style={[styles.headline, { color: SHARE_BANNER.foreground }]}>
          {SHARE_BANNER.headline}
        </Text>
        {SHARE_BANNER.body && (
          <Text style={[styles.body, { color: SHARE_BANNER.foreground }]}>
            {SHARE_BANNER.body}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: CARD_WIDTH, backgroundColor: "#fff" },
  map: {
    margin: CARD_PADDING,
    aspectRatio: salen.width / salen.height,
  },
  banner: { paddingVertical: 16, paddingHorizontal: CARD_PADDING, gap: 2 },
  headline: { fontSize: 18, fontWeight: "700" },
  body: { fontSize: 14 },
});
