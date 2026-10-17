import { Image, type ImageSource } from "expo-image";
import { Pressable, StyleSheet } from "react-native";

type Props = {
  icon: ImageSource | number;
  label: string;
  onPress: () => void;
};

/** The map's floating action: a dark disc with a white icon. */
export default function RoundButton({ icon, label, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Image source={icon} style={styles.icon} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
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
