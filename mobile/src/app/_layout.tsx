import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
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
      />
    </>
  );
}
