import type { Friend, Person } from "@shared/api";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Alert, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import Button from "@/components/Button";
import { api } from "@/lib/api";
import { useFriends } from "@/lib/friends";
import { t, time } from "@/lib/i18n";
import { inviteUrl } from "@/lib/links";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";

const seatStatus = (friend: Friend) =>
  friend.seat ? t.sitsInSalenUntil(time(friend.seat.expiresAt)) : t.notSharing;

export default function FriendsScreen() {
  const router = useRouter();
  const { session, signOut, deleteAccount } = useSession();
  const { friends, refresh } = useFriends();
  const theme = useTheme();
  const body = [styles.body, { color: theme.secondaryText }];

  if (session.status !== "signed-in") {
    return (
      <View style={styles.screen}>
        <Text style={body}>{t.signInForFriends}</Text>
        <Button label={t.signIn} onPress={() => router.push("/logg-inn")} />
      </View>
    );
  }

  const { token, user } = session;
  const call = (path: string, method: "POST" | "DELETE") =>
    api(path, { method, token }).then(refresh, () =>
      Alert.alert(t.somethingWentWrong, t.checkNetwork),
    );

  const invite = () =>
    Share.share({
      message: t.inviteMessage(inviteUrl(user.inviteCode)),
    });

  const confirmUnfriend = (friend: Person) =>
    Alert.alert(t.removeFriend(friend.name), t.removeFriendBody, [
      { text: t.cancel, style: "cancel" },
      {
        text: t.remove,
        style: "destructive",
        onPress: () => call(`/friends/${friend.id}`, "DELETE"),
      },
    ]);

  const confirmDelete = () =>
    Alert.alert(t.deleteAccountTitle, t.deleteAccountBody, [
      { text: t.cancel, style: "cancel" },
      {
        text: t.delete,
        style: "destructive",
        onPress: () =>
          deleteAccount().catch(() =>
            Alert.alert(t.couldNotDelete, t.tryAgainLater),
          ),
      },
    ]);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.screen}
    >
      <Button label={t.inviteFriend} onPress={invite} />

      {friends && friends.incoming.length > 0 && (
        <Section title={t.wantsToBeFriends}>
          {friends.incoming.map((person) => (
            <Row key={person.id} name={person.name}>
              <Button
                size="small"
                label={t.accept}
                onPress={() => call(`/friends/requests/${person.id}`, "POST")}
              />
              <Button
                size="small"
                variant="secondary"
                label={t.decline}
                onPress={() => call(`/friends/requests/${person.id}`, "DELETE")}
              />
            </Row>
          ))}
        </Section>
      )}

      <Section title={t.friends}>
        {friends?.friends.length === 0 && (
          <View style={[styles.row, { borderBottomColor: theme.separator }]}>
            <Text style={body}>{t.noFriendsYet}</Text>
          </View>
        )}
        {friends?.friends.map((friend) => (
          <Row key={friend.id} name={friend.name} detail={seatStatus(friend)}>
            <Button
              size="small"
              variant="secondary"
              label={t.remove}
              onPress={() => confirmUnfriend(friend)}
            />
          </Row>
        ))}
      </Section>

      {friends && friends.outgoing.length > 0 && (
        <Section title={t.awaitingReply}>
          {friends.outgoing.map((person) => (
            <Row key={person.id} name={person.name}>
              <Button
                size="small"
                variant="secondary"
                label={t.withdraw}
                onPress={() => call(`/friends/requests/${person.id}`, "DELETE")}
              />
            </Row>
          ))}
        </Section>
      )}

      <View style={styles.account}>
        <Text style={[styles.sectionTitle, { color: theme.tertiaryText }]}>
          {t.signedInAs(user.name)}
        </Text>
        <Button variant="secondary" label={t.signOut} onPress={signOut} />
        <Button
          variant="danger"
          label={t.deleteAccount}
          onPress={confirmDelete}
        />
      </View>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.tertiaryText }]}>
        {title}
      </Text>
      {/* An inset grouped list: rows on a rounded card, hairlines between. */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        {children}
      </View>
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
  const theme = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: theme.separator }]}>
      <View style={styles.rowText}>
        <Text style={[styles.name, { color: theme.text }]}>{name}</Text>
        {detail && (
          <Text style={[styles.detail, { color: theme.tertiaryText }]}>
            {detail}
          </Text>
        )}
      </View>
      {children && <View style={styles.rowActions}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 16, gap: 28 },
  body: { fontSize: 17 },
  section: { gap: 6 },
  sectionTitle: {
    fontSize: 13,
    textTransform: "uppercase",
    marginHorizontal: 16,
  },
  card: {
    borderRadius: 26,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1, gap: 2 },
  name: { fontSize: 17 },
  detail: { fontSize: 15 },
  rowActions: { flexDirection: "row", gap: 8 },
  account: { gap: 10 },
});
