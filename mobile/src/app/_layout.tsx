import { Image } from "expo-image";
import {
  DarkTheme,
  DefaultTheme,
  Link,
  Stack,
  ThemeProvider,
  useRouter,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, Pressable, StyleSheet } from "react-native";
import { t } from "@/lib/i18n";
import { SessionProvider } from "@/lib/session";
import { useTheme } from "@/lib/theme";

const friendsIcon = require("../../assets/users-dark.svg");

// Android's header: a plain icon. iOS gets a native bar button (glass on 26+).
function FriendsLink() {
  const theme = useTheme();
  return (
    <Link href="/venner" asChild>
      <Pressable accessibilityLabel={t.friends} hitSlop={12}>
        <Image
          source={friendsIcon}
          tintColor={theme.text}
          style={styles.headerIcon}
        />
      </Pressable>
    </Link>
  );
}

export default function RootLayout() {
  const router = useRouter();
  const theme = useTheme();
  return (
    <SessionProvider>
      <ThemeProvider value={theme.dark ? DarkTheme : DefaultTheme}>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            title: "Hvor",
            headerShadowVisible: false,
            headerTransparent: false,
            headerStyle: { backgroundColor: theme.background },
            contentStyle: { backgroundColor: theme.background },
          }}
        >
          <Stack.Screen
            name="index"
            options={{
              // The map is drawn under the header, its box starting below it.
              headerTransparent: true,
              headerStyle: { backgroundColor: "transparent" },
              ...(Platform.OS === "android" && {
                headerRight: () => <FriendsLink />,
              }),
            }}
          >
            {Platform.OS === "ios" && (
              <Stack.Toolbar placement="right">
                <Stack.Toolbar.Button
                  icon="person.2.fill"
                  accessibilityLabel={t.friends}
                  onPress={() => router.push("/venner")}
                />
              </Stack.Toolbar>
            )}
          </Stack.Screen>
          <Stack.Screen
            name="venner"
            options={{
              title: t.friends,
              headerLargeTitle: true,
              headerStyle: { backgroundColor: theme.groupedBackground },
              contentStyle: { backgroundColor: theme.groupedBackground },
            }}
          />
          <Stack.Screen
            name="logg-inn"
            options={{ title: t.signIn, presentation: "modal" }}
          />
          <Stack.Screen name="venn/[code]" options={{ title: t.invitation }} />
        </Stack>
      </ThemeProvider>
    </SessionProvider>
  );
}

const styles = StyleSheet.create({
  headerIcon: { width: 24, height: 24 },
});
