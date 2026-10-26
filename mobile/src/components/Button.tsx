import { Pressable, StyleSheet, Text } from "react-native";

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** `secondary` is outlined, for the lesser of two choices. */
  variant?: "primary" | "secondary" | "danger";
  size?: "large" | "small";
};

export default function Button({
  label,
  onPress,
  disabled,
  variant = "primary",
  size = "large",
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        styles[size],
        styles[variant],
        (pressed || disabled) && styles.dimmed,
      ]}
    >
      <Text
        style={[
          styles.label,
          styles[`${size}Label`],
          styles[`${variant}Label`],
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  large: { height: 50, paddingHorizontal: 20 },
  small: { height: 34, paddingHorizontal: 14, borderRadius: 17 },
  primary: { backgroundColor: "#18181b" },
  secondary: { borderWidth: 1, borderColor: "#d4d4d8" },
  danger: { borderWidth: 1, borderColor: "#fca5a5" },
  dimmed: { opacity: 0.5 },
  label: { fontWeight: "600" },
  largeLabel: { fontSize: 17 },
  smallLabel: { fontSize: 15 },
  primaryLabel: { color: "#fff" },
  secondaryLabel: { color: "#18181b" },
  dangerLabel: { color: "#dc2626" },
});
