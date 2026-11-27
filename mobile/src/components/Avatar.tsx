import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import { webUrl } from "@/lib/api";
import { colorForInitials, initials } from "@/lib/friends";

type Props = {
  name: string;
  avatarUrl: string | null;
  size: number;
};

/** Someone's profile photo in a circle, or their initials in their colour. */
export default function Avatar({ name, avatarUrl, size }: Props) {
  const label = initials(name);
  const circle = { width: size, height: size, borderRadius: size / 2 };
  if (avatarUrl) {
    return (
      <Image
        source={webUrl(avatarUrl)}
        style={circle}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View
      style={[
        styles.initials,
        circle,
        { backgroundColor: colorForInitials(label) },
      ]}
    >
      <Text style={[styles.label, { fontSize: size * 0.4 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  initials: { alignItems: "center", justifyContent: "center" },
  label: { color: "#fff", fontWeight: "700" },
});
