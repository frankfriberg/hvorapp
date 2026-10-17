import type { Friend, Seat } from "@shared/api";
import {
  formatGridCoordinates,
  type GridPosition,
  gridToPercentage,
} from "@shared/grid";
import { useRouter } from "expo-router";
import { type ComponentRef, useRef, useState } from "react";
import { Alert, StyleSheet, useWindowDimensions, View } from "react-native";
import { api } from "@/lib/api";
import { locationUrl } from "@/lib/links";
import { useToken } from "@/lib/session";
import { shareLocation } from "@/lib/share";
import FriendMarker from "./FriendMarker";
import RoundButton from "./RoundButton";
import ShareCard from "./ShareCard";
import TouchMap from "./TouchMap";

const shareIcon = require("../../assets/share.svg");
const friendsIcon = require("../../assets/users.svg");

type Props = {
  arena: Seat["arena"];
  position?: GridPosition;
  /** Friends whose shared seat is in this arena. */
  friends?: Friend[];
  /** Called after my seat is shared with friends. */
  onSharedWithFriends?: () => void;
};

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
  });

export default function ShareMap({
  arena,
  position,
  friends = [],
  onSharedWithFriends,
}: Props) {
  const router = useRouter();
  const token = useToken();
  const { width } = useWindowDimensions();
  const [placed, setPlaced] = useState<GridPosition | undefined>();
  const card = useRef<ComponentRef<typeof View>>(null);

  const url =
    placed &&
    locationUrl(arena, formatGridCoordinates(placed.gridX, placed.gridY));

  async function shareWithFriends() {
    if (!placed) return;
    if (!token) return router.push("/logg-inn");
    try {
      const { expiresAt } = await api<{ expiresAt: string }>("/seat", {
        method: "PUT",
        body: { arena, gridX: placed.gridX, gridY: placed.gridY },
        token,
      });
      Alert.alert(
        "Delt med vennene dine",
        `De ser plassen din til ${time(expiresAt)}.`,
      );
      onSharedWithFriends?.();
    } catch {
      Alert.alert("Kunne ikke dele", "Sjekk nettet og prøv igjen.");
    }
  }

  const overlay = friends.map(({ id, name, seat }) => {
    if (!seat || seat.arena !== arena) return null;
    const { percentageX, percentageY } = gridToPercentage(
      seat.gridX,
      seat.gridY,
    );
    return (
      <FriendMarker
        key={id}
        name={name}
        percentageX={percentageX}
        percentageY={percentageY}
      />
    );
  });

  return (
    <View style={styles.container}>
      <TouchMap position={position} onPlace={setPlaced} overlay={overlay} />
      {placed && (
        // Laid out off-screen so it can be captured without being seen.
        <View style={styles.offscreen} pointerEvents="none">
          <ShareCard ref={card} position={placed} />
        </View>
      )}
      {url && (
        <View
          style={[styles.actions, { right: width * 0.1, bottom: width * 0.1 }]}
        >
          <RoundButton
            icon={friendsIcon}
            label="Del plassen med venner"
            onPress={shareWithFriends}
          />
          <RoundButton
            icon={shareIcon}
            label="Del plassering"
            onPress={() => shareLocation(url, card)}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 40 },
  offscreen: { position: "absolute", left: -10000, top: 0 },
  actions: { position: "absolute", flexDirection: "row", gap: 16 },
});
