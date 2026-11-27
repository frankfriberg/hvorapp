import { PIN_COLOR } from "@shared/pin";
import { GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect";
import { Pressable, StyleSheet, Text } from "react-native";
import { useTheme } from "@/lib/theme";

const glass = isGlassEffectAPIAvailable();

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** `primary` is tinted glass; the others are clear glass. */
  variant?: "primary" | "secondary" | "danger";
  size?: "large" | "small";
};

/** A capsule of Liquid Glass, as iOS draws its buttons. */
export default function Button({
  label,
  onPress,
  disabled,
  variant = "primary",
  size = "large",
}: Props) {
  const theme = useTheme();
  const tint = variant === "primary" ? PIN_COLOR : undefined;
  const labelColor = {
    primary: "#fff",
    secondary: theme.text,
    danger: theme.danger,
  };
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        disabled && styles.dimmed,
        !glass && pressed && styles.dimmed,
      ]}
    >
      <GlassView
        isInteractive={!disabled}
        tintColor={tint}
        style={[
          styles.button,
          styles[size],
          !glass && { backgroundColor: tint ?? theme.buttonFill },
        ]}
      >
        <Text
          style={[
            styles.label,
            styles[`${size}Label`],
            { color: labelColor[variant] },
          ]}
        >
          {label}
        </Text>
      </GlassView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: "center", justifyContent: "center" },
  large: { height: 52, paddingHorizontal: 22, borderRadius: 26 },
  small: { height: 34, paddingHorizontal: 14, borderRadius: 17 },
  dimmed: { opacity: 0.5 },
  label: { fontWeight: "600" },
  largeLabel: { fontSize: 17 },
  smallLabel: { fontSize: 15 },
});
