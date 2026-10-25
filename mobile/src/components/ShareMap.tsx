import {
  type Friend,
  type MeResponse,
  SEAT_SHARE_HOURS,
  type Seat,
  type SeatShareHours,
  type ShareSeatRequest,
} from "@shared/api";
import {
  formatGridCoordinates,
  type GridPosition,
  gridToPercentage,
} from "@shared/grid";
import { PIN_COLOR } from "@shared/pin";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, { Easing, Keyframe, ZoomOut } from "react-native-reanimated";
import { api, webUrl } from "@/lib/api";
import { t, time } from "@/lib/i18n";
import { locationUrl } from "@/lib/links";
import { useSession, useToken } from "@/lib/session";
import { shareLocation } from "@/lib/share";
import { SHARING_COLOR } from "@/lib/theme";
import FloorPoint from "./FloorPoint";
import FriendPin from "./FriendPin";
import RoundButton from "./RoundButton";
import ShareCard, { type ShareCardHandle } from "./ShareCard";
import TouchMap from "./TouchMap";

// Grows in over 80 ms, just past full size, and settles back in 100 ms: one
// small bounce, no wobble.
const popIn = (index: number) =>
  new Keyframe({
    0: { transform: [{ scale: 0 }] },
    45: { transform: [{ scale: 1.12 }], easing: Easing.out(Easing.quad) },
    100: { transform: [{ scale: 1 }], easing: Easing.inOut(Easing.quad) },
  })
    .duration(180)
    .delay(index * 30);
const popOut = ZoomOut.duration(90);

/** Asks how long to share my seat for; null when cancelled. */
function askHours(): Promise<SeatShareHours | null> {
  const title = t.shareWithFriendsTitle;
  const message = t.shareForHowLong;
  return new Promise((resolve) => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title,
          message,
          options: [...SEAT_SHARE_HOURS.map(t.hours), t.cancel],
          cancelButtonIndex: SEAT_SHARE_HOURS.length,
        },
        (index) => resolve(SEAT_SHARE_HOURS[index] ?? null),
      );
      return;
    }
    // Android shows three buttons at most; tapping outside cancels.
    Alert.alert(
      title,
      message,
      SEAT_SHARE_HOURS.map((hours) => ({
        text: t.hours(hours),
        onPress: () => resolve(hours),
      })),
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}

/** Asks whether to stop sharing my seat, shared until `until`. */
function askStop(until: Date): Promise<boolean> {
  const title = t.sharedWithFriends;
  const message = t.theySeeYourSeatUntil(time(until.toISOString()));
  return new Promise((resolve) => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title,
          message,
          options: [t.stopSharing, t.cancel],
          destructiveButtonIndex: 0,
          cancelButtonIndex: 1,
        },
        (index) => resolve(index === 0),
      );
      return;
    }
    Alert.alert(
      title,
      message,
      [
        { text: t.cancel, style: "cancel", onPress: () => resolve(false) },
        {
          text: t.stopSharing,
          style: "destructive",
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

type Props = {
  arena: Seat["arena"];
  position?: GridPosition;
  /** Friends whose shared seat is in this arena. */
  friends?: Friend[];
  /** Called after my seat is shared with friends, or stops being. */
  onSharedWithFriends?: () => void;
};

export default function ShareMap({
  arena,
  position,
  friends = [],
  onSharedWithFriends,
}: Props) {
  const router = useRouter();
  const token = useToken();
  const { session } = useSession();
  const { width } = useWindowDimensions();
  const [placed, setPlaced] = useState<GridPosition | undefined>();
  // Where the share card's pin stands: the last place, kept while the pin is
  // dragged, so letting go only moves the pin rather than building the card's
  // map again.
  const [cardAt, setCardAt] = useState<GridPosition | undefined>();
  function place(position: GridPosition | undefined) {
    setPlaced(position);
    if (position) setCardAt(position);
  }
  // The friend whose pin was tapped, labelled with their name.
  const [picked, setPicked] = useState<string | null>(null);
  // When my seat stops being shared with friends, while it is.
  const [sharedUntil, setSharedUntil] = useState<Date | null>(null);
  const card = useRef<ShareCardHandle>(null);

  // Whether my seat is already shared, from an earlier visit.
  useEffect(() => {
    if (!token) return setSharedUntil(null);
    api<MeResponse>("/me", { token })
      .then(({ seat }) => setSharedUntil(seat && new Date(seat.expiresAt)))
      .catch(() => {});
  }, [token]);

  // Back to the plain button when the share runs out.
  useEffect(() => {
    if (!sharedUntil) return;
    const timer = setTimeout(
      () => setSharedUntil(null),
      Math.max(0, sharedUntil.getTime() - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [sharedUntil]);

  const url =
    placed &&
    locationUrl(arena, formatGridCoordinates(placed.gridX, placed.gridY));

  async function stopSharing() {
    if (!sharedUntil || !(await askStop(sharedUntil))) return;
    try {
      await api("/seat", { method: "DELETE", token });
      setSharedUntil(null);
      onSharedWithFriends?.();
    } catch {
      Alert.alert(t.couldNotStopSharing, t.checkNetwork);
    }
  }

  async function shareImage() {
    if (!url) return;
    // My photo on the card's pin, loaded before the card is captured.
    const avatarUrl =
      session.status === "signed-in" ? session.user.avatarUrl : null;
    if (avatarUrl) {
      await Image.prefetch(webUrl(avatarUrl), "memory-disk").catch(() => {});
    }
    await shareLocation(url, (width) => {
      if (!card.current) throw new Error("share card not laid out");
      return card.current.capture(width);
    });
  }

  async function shareWithFriends() {
    if (!placed) return;
    if (!token) return router.push("/logg-inn");
    const hours = await askHours();
    if (!hours) return;
    try {
      const { expiresAt } = await api<{ expiresAt: string }>("/seat", {
        method: "PUT",
        body: {
          arena,
          gridX: placed.gridX,
          gridY: placed.gridY,
          hours,
        } satisfies ShareSeatRequest,
        token,
      });
      setSharedUntil(new Date(expiresAt));
      Alert.alert(t.sharedWithFriends, t.theySeeYourSeatUntil(time(expiresAt)));
      onSharedWithFriends?.();
    } catch {
      Alert.alert(t.couldNotShare, t.checkNetwork);
    }
  }

  const seated = friends.flatMap(({ id, name, avatarUrl, seat }) =>
    seat && seat.arena === arena
      ? [
          {
            id,
            name,
            avatarUrl,
            seat,
            ...gridToPercentage(seat.gridX, seat.gridY),
          },
        ]
      : [],
  );
  // The picked friend last, so their label is over the other pins.
  const overlay = [...seated]
    .sort((a, b) => Number(a.id === picked) - Number(b.id === picked))
    .map(({ id, name, avatarUrl, seat, percentageX, percentageY }) => (
      <FloorPoint key={id} percentageX={percentageX} percentageY={percentageY}>
        <FriendPin
          name={name}
          avatarUrl={avatarUrl}
          percentageX={0}
          percentageY={0}
          until={id === picked ? time(seat.expiresAt) : undefined}
        />
      </FloorPoint>
    ));

  return (
    <View style={styles.container}>
      <TouchMap
        position={position}
        onPlace={place}
        overlay={overlay}
        friendPins={seated}
        onTap={(id) => setPicked(id === picked ? null : id)}
      />
      {cardAt && (
        // Laid out off-screen so it can be captured without being seen.
        <View style={styles.offscreen} pointerEvents="none">
          <ShareCard ref={card} position={cardAt} />
        </View>
      )}
      {url && (
        <View
          style={[styles.actions, { right: width * 0.1, bottom: width * 0.1 }]}
        >
          {/* They pop up one after the other when the pin is set down, and
              shrink away when it's picked up again. */}
          <Animated.View entering={popIn(0)} exiting={popOut}>
            <RoundButton
              icon={{
                ios: "person.2.wave.2.fill",
                android: "connect_without_contact",
              }}
              tint={sharedUntil ? SHARING_COLOR : undefined}
              label={sharedUntil ? t.stopSharing : t.shareSeatWithFriends}
              onPress={sharedUntil ? stopSharing : shareWithFriends}
            />
          </Animated.View>
          <Animated.View entering={popIn(1)} exiting={popOut}>
            <RoundButton
              icon={{ ios: "square.and.arrow.up", android: "ios_share" }}
              tint={PIN_COLOR}
              label={t.shareLocation}
              onPress={shareImage}
            />
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // As narrow as the leaning floor allows: its near edge is ~13% wider than
  // the map, and should stay clear of the screen's edges.
  container: { flex: 1, paddingHorizontal: 28 },
  offscreen: { position: "absolute", left: -10000, top: 0 },
  actions: { position: "absolute", flexDirection: "row", gap: 16 },
});
