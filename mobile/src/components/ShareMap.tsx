import {
  ARENAS,
  type Friend,
  type MeResponse,
  type MoveSeatRequest,
  SEAT_SHARE_HOURS,
  type Seat,
  type SeatShareHours,
  type ShareSeatRequest,
} from "@shared/api";
import { type GridPosition, gridToPercentage } from "@shared/grid";
import { PIN_COLOR } from "@shared/pin";
import type { Venue } from "@shared/venue";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useRef, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, { Easing, Keyframe, ZoomOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import type { Floor } from "@/lib/floor";
import { seatStatus } from "@/lib/friends";
import { t, time } from "@/lib/i18n";
import { locateOn, useLiveLocation } from "@/lib/live";
import { useToken } from "@/lib/session";
import { shareImage } from "@/lib/share";
import { SHARING_COLOR, useTheme } from "@/lib/theme";
import FloorPoint from "./FloorPoint";
import FriendLabel from "./FriendLabel";
import RoundButton from "./RoundButton";
import ShareCard, { type MapPicture, type ShareCardHandle } from "./ShareCard";
import TouchMap from "./TouchMap";

// Where whether the buildings' numbers show is kept.
const NUMBERS_KEY = "venueNumbers";

// The header's bar, under the status bar, in points.
const HEADER_BAR = Platform.OS === "ios" ? 44 : 56;

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
  /** Where the map is: an arena, or a venue's outside. */
  arena: Seat["arena"];
  floor: Floor;
  /** The venue, outside: then my location can be shared live. */
  venue?: Venue;
  position?: GridPosition;
  /** Friends whose shared seat is on this map. */
  friends?: Friend[];
  /** Called after my seat is shared with friends, or stops being. */
  onSharedWithFriends?: () => void;
  /** A building with an arena in it was tapped. */
  onOpen?: (arena: (typeof ARENAS)[number]) => void;
};

export default function ShareMap({
  arena,
  floor,
  venue,
  position,
  friends = [],
  onSharedWithFriends,
  onOpen,
}: Props) {
  // Inside, a seat links and pictures; outside, it's for friends alone.
  const inside = ARENAS.includes(arena as (typeof ARENAS)[number]);
  const router = useRouter();
  const token = useToken();
  const { width } = useWindowDimensions();
  const theme = useTheme();
  // The map is drawn under the header; its box starts below it.
  // From the safe area, known from the first frame, not the header's own
  // height, which a pushed screen learns a moment later, moving the map.
  const headerHeight = useSafeAreaInsets().top + HEADER_BAR;
  const [placed, setPlaced] = useState<GridPosition | undefined>();
  function place(position: GridPosition | undefined) {
    setPlaced(position);
  }
  // The friend whose pin was tapped, labelled with their name.
  const [picked, setPicked] = useState<string | null>(null);
  // When my seat stops being shared with friends, while it is.
  const [sharedUntil, setSharedUntil] = useState<Date | null>(null);
  // A picture of the map as it's first seen, once it's drawn, and the card
  // it's sent on, with the banner.
  const snapshot = useRef<(() => Promise<MapPicture>) | null>(null);
  const card = useRef<ShareCardHandle>(null);
  // Whether the buildings' numbers show, as last left: shown at first.
  const [numbers, setNumbers] = useState(true);
  useEffect(() => {
    SecureStore.getItemAsync(NUMBERS_KEY)
      .then((saved) => saved === "hidden" && setNumbers(false))
      .catch(() => {});
  }, []);
  function toggleNumbers() {
    setNumbers(!numbers);
    SecureStore.setItemAsync(NUMBERS_KEY, numbers ? "hidden" : "shown").catch(
      () => {},
    );
  }
  // Following my location, and where it last was on the map.
  const [live, setLive] = useState(false);
  const [livePosition, setLivePosition] = useState<GridPosition>();

  // Whether my seat is already shared, from an earlier visit; live, here, it
  // goes on following me.
  useEffect(() => {
    if (!token) return setSharedUntil(null);
    api<MeResponse>("/me", { token })
      .then(({ seat }) => {
        setSharedUntil(seat && new Date(seat.expiresAt));
        if (venue && seat?.live && seat.arena === arena) setLive(true);
      })
      .catch(() => {});
  }, [token, venue, arena]);

  /** Moves my shared seat, if I share one, keeping when it ends. */
  async function move(to: GridPosition, following: boolean) {
    if (!sharedUntil || !token) return;
    await api("/seat", {
      method: "PATCH",
      body: {
        arena,
        gridX: to.gridX,
        gridY: to.gridY,
        live: following,
      } satisfies MoveSeatRequest,
      token,
    }).catch(() => {});
  }

  // Live, my pin goes where I do, and my friends see it there.
  useLiveLocation(venue, live, (at) => {
    if (!at) {
      setLive(false);
      Alert.alert(t.notAtVenue, t.notAtVenueBody);
      return;
    }
    setLivePosition(at);
    place(at);
    move(at, true);
  });

  async function toggleLive() {
    if (!venue) return;
    if (live) return setLive(false);
    if (!token) return router.push("/sign-in");
    const at = await locateOn(venue).catch(() => "away" as const);
    if (at === "denied") {
      return Alert.alert(t.locationDenied, t.locationDeniedBody);
    }
    if (at === "away") return Alert.alert(t.notAtVenue, t.notAtVenueBody);
    setLivePosition(at);
    place(at);
    if (sharedUntil) {
      await move(at, true);
      setLive(true);
    } else if (await shareWithFriends(at, true)) setLive(true);
  }

  // Back to the plain button when the share runs out.
  useEffect(() => {
    if (!sharedUntil) return;
    const timer = setTimeout(
      () => setSharedUntil(null),
      Math.max(0, sharedUntil.getTime() - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [sharedUntil]);

  async function stopSharing() {
    if (!sharedUntil || !(await askStop(sharedUntil))) return;
    try {
      await api("/seat", { method: "DELETE", token });
      setSharedUntil(null);
      setLive(false);
      onSharedWithFriends?.();
    } catch {
      Alert.alert(t.couldNotStopSharing, t.checkNetwork);
    }
  }

  /**
   * Shares a picture of where I am: the map as it's first seen, whatever
   * it's turned to now, pins and all, over the banner.
   */
  async function sharePicture() {
    if (!placed) return;
    try {
      await shareImage(async (width) => {
        const picture = await snapshot.current?.();
        if (!picture || !card.current) throw new Error("map not drawn");
        return card.current.capture(picture, width);
      });
    } catch {
      Alert.alert(t.couldNotShare, t.tryAgainLater);
    }
  }

  /** Shares my seat, `at` where I placed it, for as long as I pick. */
  async function shareWithFriends(at = placed, following = false) {
    if (!at) return false;
    if (!token) {
      router.push("/sign-in");
      return false;
    }
    const hours = await askHours();
    if (!hours) return false;
    try {
      const { expiresAt } = await api<{ expiresAt: string }>("/seat", {
        method: "PUT",
        body: {
          arena,
          gridX: at.gridX,
          gridY: at.gridY,
          live: following,
          hours,
        } satisfies ShareSeatRequest,
        token,
      });
      setSharedUntil(new Date(expiresAt));
      Alert.alert(t.sharedWithFriends, t.theySeeYourSeatUntil(time(expiresAt)));
      onSharedWithFriends?.();
      return true;
    } catch {
      Alert.alert(t.couldNotShare, t.checkNetwork);
      return false;
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
  // The picked friend's name over their pin.
  const overlay = seated
    .filter(({ id }) => id === picked)
    .map(({ id, name, seat, percentageX, percentageY }) => (
      <FloorPoint key={id} percentageX={percentageX} percentageY={percentageY}>
        <FriendLabel name={name} status={seatStatus(seat)} />
      </FloorPoint>
    ));

  return (
    <View style={styles.container}>
      <TouchMap
        floor={floor}
        position={livePosition ?? position}
        onPlace={(at) => {
          place(at);
          // Put down by hand: it stops following me, and stays put there.
          if (!at) return;
          if (live) setLive(false);
          move(at, false);
        }}
        overlay={overlay}
        labels={numbers}
        friendPins={seated}
        onTap={(id) => setPicked(id === picked ? null : id)}
        onOpen={onOpen}
        snapshot={snapshot}
        top={headerHeight}
      />
      {/* Laid out off-screen so it can be captured without being seen. */}
      <View style={styles.offscreen} pointerEvents="none">
        <ShareCard ref={card} />
      </View>
      {inside && placed && (
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
              onPress={sharedUntil ? stopSharing : () => shareWithFriends()}
            />
          </Animated.View>
          <Animated.View entering={popIn(1)} exiting={popOut}>
            <RoundButton
              icon={{ ios: "square.and.arrow.up", android: "ios_share" }}
              tint={PIN_COLOR}
              label={t.shareLocation}
              onPress={sharePicture}
            />
          </Animated.View>
        </View>
      )}
      {venue && (
        // Whose map it is, as their licences ask.
        <Text
          pointerEvents="none"
          style={[styles.credit, { color: theme.tertiaryText }]}
        >
          {venue.credit}
        </Text>
      )}
      {venue && (
        <View
          style={[styles.actions, { right: width * 0.1, bottom: width * 0.1 }]}
        >
          {/* Outside: my place for friends once it's put down, and live. */}
          {placed && (
            <Animated.View entering={popIn(0)} exiting={popOut}>
              <RoundButton
                icon={{
                  ios: "person.2.wave.2.fill",
                  android: "connect_without_contact",
                }}
                tint={sharedUntil ? SHARING_COLOR : undefined}
                label={sharedUntil ? t.stopSharing : t.shareSeatWithFriends}
                onPress={sharedUntil ? stopSharing : () => shareWithFriends()}
              />
            </Animated.View>
          )}
          {placed && (
            <Animated.View entering={popIn(1)} exiting={popOut}>
              <RoundButton
                icon={{ ios: "square.and.arrow.up", android: "ios_share" }}
                tint={PIN_COLOR}
                label={t.shareLocation}
                onPress={sharePicture}
              />
            </Animated.View>
          )}
          {venue.buildings.some(({ label }) => label) && (
            <RoundButton
              icon={{ ios: "number", android: "numbers" }}
              label={numbers ? t.hideNumbers : t.showNumbers}
              onPress={toggleNumbers}
            />
          )}
          <RoundButton
            icon={{ ios: "location.fill", android: "my_location" }}
            tint={live ? SHARING_COLOR : undefined}
            label={live ? t.stopLiveLocation : t.liveLocation}
            onPress={toggleLive}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  offscreen: { position: "absolute", left: -10000, top: 0 },
  actions: { position: "absolute", flexDirection: "row", gap: 16 },
  // Along the bottom, under the buttons.
  credit: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 12,
    fontSize: 10,
    textAlign: "center",
  },
});
