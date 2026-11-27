import { gridToPercentage, parseGridCoordinates } from "@shared/grid";
import { Stack, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import ShareMap from "@/components/ShareMap";
import { t } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

export default function LocationScreen() {
  const { location } = useLocalSearchParams<{ location: string }>();
  const points = parseGridCoordinates(location ?? "");
  const theme = useTheme();

  if (!points) {
    return (
      <View style={styles.invalid}>
        <Stack.Screen options={{ title: "Hvor" }} />
        <Text style={[styles.heading, { color: theme.text }]}>
          {t.invalidLocation}
        </Text>
        <Text style={{ color: theme.text }}>{t.invalidLocationBody}</Text>
      </View>
    );
  }

  const { percentageX, percentageY } = gridToPercentage(points.x, points.y);

  return (
    <>
      <Stack.Screen options={{ title: t.iSitHere }} />
      <ShareMap
        arena="salen"
        position={{
          gridX: points.x,
          gridY: points.y,
          percentageX,
          percentageY,
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  invalid: { gap: 12, paddingHorizontal: 24, paddingVertical: 12 },
  heading: { fontSize: 24, fontWeight: "bold" },
});
