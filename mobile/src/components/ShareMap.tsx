import { formatGridCoordinates, type GridPosition } from "@shared/grid";
import { type ComponentRef, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { locationUrl } from "@/lib/links";
import { shareLocation } from "@/lib/share";
import ShareButton from "./ShareButton";
import ShareCard from "./ShareCard";
import TouchMap from "./TouchMap";

type Props = {
  arena: "salen";
  position?: GridPosition;
};

export default function ShareMap({ arena, position }: Props) {
  const [placed, setPlaced] = useState<GridPosition | undefined>();
  const card = useRef<ComponentRef<typeof View>>(null);

  const url =
    placed &&
    locationUrl(arena, formatGridCoordinates(placed.gridX, placed.gridY));

  return (
    <View style={styles.container}>
      <TouchMap position={position} onPlace={setPlaced} />
      {placed && (
        // Laid out off-screen so it can be captured without being seen.
        <View style={styles.offscreen} pointerEvents="none">
          <ShareCard ref={card} position={placed} />
        </View>
      )}
      {url && <ShareButton onPress={() => shareLocation(url, card)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 40 },
  offscreen: { position: "absolute", left: -10000, top: 0 },
});
