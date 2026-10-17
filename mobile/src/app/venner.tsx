import type { Friend, Person } from "@shared/api";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Alert, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import Button from "@/components/Button";
import { api } from "@/lib/api";
import { useFriends } from "@/lib/friends";
import { inviteUrl } from "@/lib/links";
import { useSession } from "@/lib/session";

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
  });

const seatStatus = (friend: Friend) =>
  friend.seat
    ? `Sitter i Salen · deler til ${time(friend.seat.expiresAt)}`
    : "Deler ikke plassen sin nå";

export default function FriendsScreen() {
  const router = useRouter();
  const { session, signOut, deleteAccount } = useSession();
  const { friends, refresh } = useFriends();

  if (session.status !== "signed-in") {
    return (
      <View style={styles.screen}>
        <Text style={styles.body}>
          Logg inn for å legge til venner og se hvor de sitter.
        </Text>
        <Button label="Logg inn" onPress={() => router.push("/logg-inn")} />
      </View>
    );
  }

  const { token, user } = session;
  const call = (path: string, method: "POST" | "DELETE") =>
    api(path, { method, token }).then(refresh, () =>
      Alert.alert("Noe gikk galt", "Sjekk nettet og prøv igjen."),
    );

  const invite = () =>
    Share.share({
      message: `Bli venn med meg på Hvor, så ser vi hvor hverandre sitter: ${inviteUrl(user.inviteCode)}`,
    });

  const confirmUnfriend = (friend: Person) =>
    Alert.alert(
      `Fjerne ${friend.name}?`,
      "Dere slutter å se hverandres plass.",
      [
        { text: "Avbryt", style: "cancel" },
        {
          text: "Fjern",
          style: "destructive",
          onPress: () => call(`/friends/${friend.id}`, "DELETE"),
        },
      ],
    );

  const confirmDelete = () =>
    Alert.alert(
      "Slette kontoen?",
      "Vennene og plassene du har delt slettes. Dette kan ikke angres.",
      [
        { text: "Avbryt", style: "cancel" },
        {
          text: "Slett",
          style: "destructive",
          onPress: () =>
            deleteAccount().catch(() =>
              Alert.alert("Kunne ikke slette", "Prøv igjen om litt."),
            ),
        },
      ],
    );

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Button label="Inviter en venn" onPress={invite} />

      {friends && friends.incoming.length > 0 && (
        <Section title="Vil bli venn med deg">
          {friends.incoming.map((person) => (
            <Row key={person.id} name={person.name}>
              <Button
                size="small"
                label="Godta"
                onPress={() => call(`/friends/requests/${person.id}`, "POST")}
              />
              <Button
                size="small"
                variant="secondary"
                label="Avslå"
                onPress={() => call(`/friends/requests/${person.id}`, "DELETE")}
              />
            </Row>
          ))}
        </Section>
      )}

      <Section title="Venner">
        {friends?.friends.length === 0 && (
          <Text style={styles.body}>
            Ingen venner ennå. Send invitasjonslenken din til noen.
          </Text>
        )}
        {friends?.friends.map((friend) => (
          <Row key={friend.id} name={friend.name} detail={seatStatus(friend)}>
            <Button
              size="small"
              variant="secondary"
              label="Fjern"
              onPress={() => confirmUnfriend(friend)}
            />
          </Row>
        ))}
      </Section>

      {friends && friends.outgoing.length > 0 && (
        <Section title="Venter på svar">
          {friends.outgoing.map((person) => (
            <Row key={person.id} name={person.name}>
              <Button
                size="small"
                variant="secondary"
                label="Trekk tilbake"
                onPress={() => call(`/friends/requests/${person.id}`, "DELETE")}
              />
            </Row>
          ))}
        </Section>
      )}

      <Section title={`Logget inn som ${user.name}`}>
        <Button variant="secondary" label="Logg ut" onPress={signOut} />
        <Button variant="danger" label="Slett konto" onPress={confirmDelete} />
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({
  name,
  detail,
  children,
}: {
  name: string;
  detail?: string;
  children?: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.name}>{name}</Text>
        {detail && <Text style={styles.detail}>{detail}</Text>}
      </View>
      {children && <View style={styles.rowActions}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 24, gap: 28 },
  body: { fontSize: 16, color: "#52525b" },
  section: { gap: 12 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#71717a",
    textTransform: "uppercase",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowText: { flex: 1, gap: 2 },
  name: { fontSize: 17, fontWeight: "600" },
  detail: { fontSize: 14, color: "#71717a" },
  rowActions: { flexDirection: "row", gap: 8 },
});
