import salen from "@shared/arenas/salen";
import type { GridPosition } from "@shared/grid";
import {
  type ComponentRef,
  type Ref,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import { captureRef } from "react-native-view-shot";
import { SHARE_BANNER } from "@/lib/banner";
import { LightTheme } from "@/lib/theme";
import { floorTransform } from "@/lib/tilt";
import ArenaMap from "./ArenaMap";
import FloorPoint, { FloorContext } from "./FloorPoint";
import Pin from "./Pin";

// Layout width of the card, in points; the PNG is rendered at a fixed pixel
// width regardless (see lib/share.ts).
export const CARD_WIDTH = 360;
const CARD_PADDING = 24;
// The map as the app shows it: a floor in perspective, seen from the south.
const MAP_WIDTH = CARD_WIDTH - CARD_PADDING * 2;
const MAP_HEIGHT = MAP_WIDTH / (salen.width / salen.height);

export type ShareCardHandle = {
  /** The card as a PNG file `width` px wide; resolves to its URI. */
  capture(width: number): Promise<string>;
};

type Props = {
  position: GridPosition;
  ref?: Ref<ShareCardHandle>;
};

/**
 * The image a share sends: the map with the pin, as the app shows them, and
 * the banner under it. Rendered off-screen and captured, never shown in the
 * app.
 */
export default function ShareCard({ position, ref }: Props) {
  // Facing south, the way the map starts.
  const turn = useSharedValue(0);
  const card = useRef<ComponentRef<typeof View>>(null);
  const floor = useRef<ComponentRef<typeof View>>(null);
  // A picture of the leaning floor, shown in its place while the card is
  // captured, and what to call once it's on screen.
  const [picture, setPicture] = useState<string | null>(null);
  const shown = useRef<() => void>(undefined);

  useImperativeHandle(ref, () => ({
    async capture(width) {
      // A capture sorts the leaning floor's layers by depth, and its near half
      // stands in front of the pin whatever the order. A picture of it is
      // flat, so the pin can go over it.
      const scale = width / CARD_WIDTH;
      const floorPicture = await captureRef(floor, {
        format: "png",
        result: "tmpfile",
        width: (MAP_WIDTH + 2 * CARD_PADDING) * scale,
      });
      await new Promise<void>((resolve) => {
        shown.current = resolve;
        setPicture(floorPicture);
        // Never stuck on a picture that doesn't say it loaded.
        setTimeout(resolve, 1000);
      });
      try {
        // A file with a .png name, so share sheets treat it as an image
        // rather than a document.
        return await captureRef(card, {
          format: "png",
          result: "tmpfile",
          fileName: "hvor",
          width,
        });
      } finally {
        setPicture(null);
      }
    },
  }));

  // Light whatever the phone's set to: everyone sees the same image.
  return (
    <LightTheme>
      <View ref={card} collapsable={false} style={styles.card}>
        <View style={styles.map}>
          {picture ? (
            <Image
              source={{ uri: picture }}
              style={styles.floor}
              onLoad={() => shown.current?.()}
            />
          ) : (
            // Room round the floor for what stands over its edges. Flat around
            // the leaning floor, so its near half isn't drawn over the pin on
            // screen.
            <View ref={floor} collapsable={false} style={styles.floor}>
              <View
                style={[
                  styles.lean,
                  { transform: floorTransform(MAP_HEIGHT, 0) },
                ]}
              >
                <ArenaMap
                  arena={salen}
                  style={StyleSheet.absoluteFill}
                  raised="south"
                />
              </View>
            </View>
          )}
          <FloorContext.Provider
            value={{ width: MAP_WIDTH, height: MAP_HEIGHT, turn }}
          >
            <FloorPoint
              percentageX={position.percentageX}
              percentageY={position.percentageY}
            >
              <Pin
                percentageX={0}
                percentageY={0}
                // On screen the pin is sized off a window ~1.25× the map's
                // width.
                viewportWidth={MAP_WIDTH * 1.25}
              />
            </FloorPoint>
          </FloorContext.Provider>
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
    </LightTheme>
  );
}

const styles = StyleSheet.create({
  card: { width: CARD_WIDTH, backgroundColor: "#fff" },
  map: { margin: CARD_PADDING, width: MAP_WIDTH, height: MAP_HEIGHT },
  floor: {
    position: "absolute",
    left: -CARD_PADDING,
    top: -CARD_PADDING,
    width: MAP_WIDTH + 2 * CARD_PADDING,
    height: MAP_HEIGHT + 2 * CARD_PADDING,
  },
  lean: {
    position: "absolute",
    left: CARD_PADDING,
    top: CARD_PADDING,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
  },
  banner: { paddingVertical: 16, paddingHorizontal: CARD_PADDING, gap: 2 },
  headline: { fontSize: 18, fontWeight: "700" },
  body: { fontSize: 14 },
});
