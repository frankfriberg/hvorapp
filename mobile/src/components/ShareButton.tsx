import { Image } from "expo-image";
import { Pressable, StyleSheet, useWindowDimensions } from "react-native";

// Lucide's "share" icon, matching the web app's ShareIcon.
const shareIcon = require("../../assets/share.svg");

type Props = {
  onPress: () => void;
};

export default function ShareButton({ onPress }: Props) {
  const { width } = useWindowDimensions();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Del plassering"
      onPress={onPress}
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
