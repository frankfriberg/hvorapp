import { Image } from "expo-image";
import {
  Platform,
  Pressable,
  Share,
  StyleSheet,
  useWindowDimensions,
} from "react-native";

// Lucide's "share" icon, matching the web app's ShareIcon.
const shareIcon = require("../../assets/share.svg");

type Props = {
  url?: string;
};

export default function ShareButton({ url }: Props) {
  const { width } = useWindowDimensions();

  if (!url) return null;

  const share = async () => {
    // A dismissed share sheet resolves rather than rejects, so there is
    // nothing to handle beyond a platform failure.
    try {
      // iOS shares `url` as a link card; Android only reads `message`. Giving
      // iOS both shares the link twice.
      await Share.share(
        Platform.OS === "ios"
          ? { url, title: "Her sitter jeg!" }
          : { message: url, title: "Her sitter jeg!" },
      );
    } catch {
      // share sheet unavailable — nothing to do
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Del plassering"
      onPress={share}
      style={({ pressed }) => [
        styles.button,
        { right: width * 0.1, bottom: width * 0.1 },
        pressed && styles.pressed,
      ]}
    >
      <Image source={shareIcon} style={styles.icon} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#18181b",
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.8 },
  icon: { width: 28, height: 28 },
});
