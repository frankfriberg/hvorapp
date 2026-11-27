import { GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { type ColorValue, Pressable, StyleSheet } from "react-native";
import { useTheme } from "@/lib/theme";

const glass = isGlassEffectAPIAvailable();

type Props = {
  icon: SymbolViewProps["name"];
  label: string;
  onPress: () => void;
  /** Tints the glass, for the main action. */
  tint?: ColorValue;
};

/** The map's floating action: a disc of Liquid Glass with a symbol. */
export default function RoundButton({ icon, label, onPress, tint }: Props) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => !glass && pressed && styles.pressed}
    >
      <GlassView
        isInteractive
        tintColor={tint}
        style={[
          styles.button,
          !glass && [
            styles.fallback,
            { backgroundColor: tint ?? theme.roundButtonFill },
          ],
        ]}
      >
        <SymbolView
          name={icon}
          size={26}
          weight="semibold"
          tintColor={tint ? "#fff" : theme.text}
        />
      </GlassView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  // Without Liquid Glass (Android, older iOS): a raised, frosted-looking disc.
  fallback: {
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  pressed: { opacity: 0.8 },
});
