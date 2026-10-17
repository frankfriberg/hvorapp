import { Image } from "expo-image";
import { Link, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, StyleSheet } from "react-native";
import { SessionProvider } from "@/lib/session";

const friendsIcon = require("../../assets/users-dark.svg");

function FriendsLink() {
  return (
    <Link href="/venner" asChild>
      <Pressable accessibilityLabel="Venner" hitSlop={12}>
        <Image source={friendsIcon} style={styles.headerIcon} />
      </Pressable>
    </Link>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          title: "Hvor",
          headerShadowVisible: false,
          // The map is a drag surface, so it must start below the header
          // rather than scroll under it.
          headerTransparent: false,
          headerStyle: { backgroundColor: "#fff" },
          contentStyle: { backgroundColor: "#fff" },
        }}
      >
        <Stack.Screen
          name="index"
          options={{ headerRight: () => <FriendsLink /> }}
        />
        <Stack.Screen name="venner" options={{ title: "Venner" }} />
        <Stack.Screen
          name="logg-inn"
          options={{ title: "Logg inn", presentation: "modal" }}
        />
        <Stack.Screen name="venn/[code]" options={{ title: "Invitasjon" }} />
      </Stack>
    </SessionProvider>
  );
}

const styles = StyleSheet.create({
  headerIcon: { width: 24, height: 24 },
});
