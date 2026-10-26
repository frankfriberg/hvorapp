import { gridToPercentage, parseGridCoordinates } from "@shared/grid";
import { Stack, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import ShareMap from "@/components/ShareMap";

export default function LocationScreen() {
  const { location } = useLocalSearchParams<{ location: string }>();
  const points = parseGridCoordinates(location ?? "");

  if (!points) {
    return (
      <View style={styles.invalid}>
        <Stack.Screen options={{ title: "Hvor" }} />
        <Text style={styles.heading}>Ugyldig plassering</Text>
        <Text>Denne lenken peker ikke til en gyldig plassering.</Text>
      </View>
    );
  }

  const { percentageX, percentageY } = gridToPercentage(points.x, points.y);

  return (
    <>
      <Stack.Screen options={{ title: "Jeg sitter her" }} />
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
