import {
  type ComponentRef,
  type Ref,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { SHARE_BANNER } from "@/lib/banner";

// Layout width of the card, in points; the PNG is rendered at a fixed pixel
// width regardless (see lib/share.ts).
const CARD_WIDTH = 360;

/** A picture of the map: its file, and its width against its height. */
export type MapPicture = { uri: string; aspect: number };

export type ShareCardHandle = {
  /** The card with `picture` in it, as a PNG `width` px wide; its URI. */
  capture(picture: MapPicture, width: number): Promise<string>;
};

/**
 * The picture a share sends: the map as it's first seen, with the pins, and
 * the banner under it, the ad space. Laid out off-screen and captured, never
 * shown in the app.
 */
export default function ShareCard({ ref }: { ref?: Ref<ShareCardHandle> }) {
  const card = useRef<ComponentRef<typeof View>>(null);
  const [picture, setPicture] = useState<MapPicture | null>(null);
  // What to call once the picture is on the card.
  const shown = useRef<() => void>(undefined);

  useImperativeHandle(ref, () => ({
    async capture(next, width) {
      await new Promise<void>((resolve) => {
        shown.current = resolve;
        setPicture(next);
      });
      // A frame for it to be drawn.
      await new Promise((resolve) => requestAnimationFrame(resolve));
      return captureRef(card, { format: "png", result: "tmpfile", width });
    },
  }));

  return (
    <View ref={card} collapsable={false} style={styles.card}>
      {picture && (
        <Image
          source={{ uri: picture.uri }}
          style={{ width: CARD_WIDTH, height: CARD_WIDTH / picture.aspect }}
          onLoad={() => shown.current?.()}
          // Captured anyway, without it, rather than never.
          onError={() => shown.current?.()}
        />
      )}
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
  banner: { paddingVertical: 16, paddingHorizontal: 24, gap: 2 },
  headline: { fontSize: 18, fontWeight: "700" },
  body: { fontSize: 14 },
});
