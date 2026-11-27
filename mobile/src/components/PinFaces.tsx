import { Image } from "expo-image";
import { type ComponentRef, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { webUrl } from "@/lib/api";
import type { PinFace } from "@/lib/pinScene";
import { HEAD_R, PHOTO_INSET } from "@/lib/pinShape";

// Pictures of what's on the pins' heads, for the 3D map to put there: a
// profile photo, or initials in white on black, which says where white goes.
// Laid out off-screen a point a drawing unit, and captured PIXELS square.
const PIXELS = 256;

/** A face to picture: initials, and a photo where there is one. */
export type FaceRequest = {
  key: string;
  label: string;
  avatarUrl: string | null;
};

/** Pictures each face, then says where the picture is. */
export default function PinFaces({
  faces,
  onFace,
}: {
  faces: FaceRequest[];
  onFace: (key: string, face: PinFace) => void;
}) {
  return (
    <View style={styles.offscreen} pointerEvents="none">
      {faces.map((face) => (
        <Face key={face.key} face={face} onFace={onFace} />
      ))}
    </View>
  );
}

function Face({
  face: { key, label, avatarUrl },
  onFace,
}: {
  face: FaceRequest;
  onFace: (key: string, face: PinFace) => void;
}) {
  const view = useRef<ComponentRef<typeof View>>(null);
  const done = useRef(onFace);
  done.current = onFace;
  // A photo that wouldn't load falls back to initials.
  const [photo, setPhoto] = useState(avatarUrl !== null);
  // Initials are there to picture at once, a photo once it's loaded.
  const [ready, setReady] = useState(avatarUrl === null);

  useEffect(() => {
    if (!ready) return;
    let gone = false;
    // A frame for what's loaded to be drawn.
    const frame = requestAnimationFrame(async () => {
      try {
        const uri = await captureRef(view, {
          format: "png",
          result: "tmpfile",
          width: PIXELS,
          height: PIXELS,
        });
        if (gone) return;
        done.current(key, {
          uri: uri.startsWith("file://") ? uri : `file://${uri}`,
          kind: photo ? "photo" : "initials",
        });
      } catch {
        // No picture: the head stays bare.
      }
    });
    return () => {
      gone = true;
      cancelAnimationFrame(frame);
    };
  }, [ready, photo, key]);

  if (photo && avatarUrl) {
    const size = 2 * (HEAD_R - PHOTO_INSET);
    return (
      <View
        ref={view}
        collapsable={false}
        style={{ width: size, height: size }}
      >
        <Image
          source={webUrl(avatarUrl)}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          onLoad={() => setReady(true)}
          onError={() => {
            setPhoto(false);
            setReady(true);
          }}
        />
      </View>
    );
  }
  return (
    <View ref={view} collapsable={false} style={styles.initials}>
      <Text
        style={[styles.label, { fontSize: label.length > 1 ? 40 : 48 }]}
        allowFontScaling={false}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  offscreen: { position: "absolute", left: -10000, top: 0 },
  initials: {
    width: 2 * HEAD_R,
    height: 2 * HEAD_R,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
  },
  // A little below the middle, as on the flat pin.
  label: { color: "#fff", fontWeight: "700", transform: [{ translateY: 3 }] },
});
