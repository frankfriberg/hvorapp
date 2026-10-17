import type { RequestResult } from "@shared/api";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Button from "@/components/Button";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";

function message(result: RequestResult): string {
  switch (result.status) {
    case "requested":
      return `Forespørsel sendt til ${result.to.name}. Du ser plassen deres når de godtar.`;
    case "friends":
      return `Du og ${result.with.name} er nå venner.`;
    case "already-friends":
      return `Du og ${result.with.name} er allerede venner.`;
    case "own-link":
      return "Dette er din egen invitasjonslenke. Send den til vennene dine.";
    case "unknown-link":
      return "Denne invitasjonen finnes ikke.";
  }
}

/** Opens an invite link (hvor://venn/<code>): asks its owner to be friends. */
export default function OpenInvite() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { session } = useSession();
  const [text, setText] = useState<string | null>(null);

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
      () =>
        setText("Kunne ikke åpne invitasjonen. Sjekk nettet og prøv igjen."),
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
      {text ? <Text style={styles.body}>{text}</Text> : <ActivityIndicator />}
      {text && (
        <Button
          label="Til vennene dine"
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
