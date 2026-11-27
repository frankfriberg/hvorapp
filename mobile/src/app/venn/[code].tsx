import type { RequestResult } from "@shared/api";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Button from "@/components/Button";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";

function message(result: RequestResult): string {
  switch (result.status) {
    case "requested":
      return t.requestSent(result.to.name);
    case "friends":
      return t.nowFriends(result.with.name);
    case "already-friends":
      return t.alreadyFriends(result.with.name);
    case "own-link":
      return t.ownInvite;
    case "unknown-link":
      return t.unknownInvite;
  }
}

/** Opens an invite link (hvor://venn/<code>): asks its owner to be friends. */
export default function OpenInvite() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { session } = useSession();
  const [text, setText] = useState<string | null>(null);
  const theme = useTheme();

  const token = session.status === "signed-in" ? session.token : null;
  const named = session.status === "signed-in" && Boolean(session.user.name);

  useEffect(() => {
    if (!token || !named) return;
    api<RequestResult>("/friends/requests", {
      method: "POST",
      body: { code },
      token,
    }).then(
      (result) => setText(message(result)),
      () => setText(t.couldNotOpenInvite),
    );
  }, [token, named, code]);

  if (session.status === "loading")
    return <ActivityIndicator style={styles.spinner} />;
  if (!token || !named) {
    return (
      <Redirect
        href={{ pathname: "/logg-inn", params: { next: `/venn/${code}` } }}
      />
    );
  }

  return (
    <View style={styles.screen}>
      {text ? (
        <Text style={[styles.body, { color: theme.text }]}>{text}</Text>
      ) : (
        <ActivityIndicator />
      )}
      {text && (
        <Button
          label={t.toYourFriends}
          onPress={() => router.replace("/venner")}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 24, gap: 20 },
  body: { fontSize: 18 },
  spinner: { marginTop: 40 },
});
