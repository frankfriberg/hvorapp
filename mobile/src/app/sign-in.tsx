import * as AppleAuthentication from "expo-apple-authentication";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Button from "@/components/Button";
import { t } from "@/lib/i18n";
import { devSignInEnabled, googleConfigured, useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";

/**
 * Signs in, then asks for a name if the provider gave none, then continues to
 * `next` (an invite being opened) or back to where sign-in was asked for.
 */
export default function SignIn() {
  const router = useRouter();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const { session, signInWithApple, signInWithGoogle, signInDev, rename } =
    useSession();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const theme = useTheme();
  const heading = [styles.heading, { color: theme.text }];
  const body = [styles.body, { color: theme.secondaryText }];
  const input = [
    styles.input,
    { borderColor: theme.border, color: theme.text },
  ];

  useEffect(() => {
    if (Platform.OS === "ios") {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
    }
  }, []);

  const signedIn = session.status === "signed-in";
  const needsName = signedIn && !session.user.name;

  // Done once signed in with a name.
  useEffect(() => {
    if (!signedIn || needsName) return;
    if (next) router.replace(next as Href);
    else if (router.canGoBack()) router.back();
    else router.replace("/");
  }, [signedIn, needsName, next, router]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
    } catch {
      Alert.alert(t.signInFailed, t.tryAgainLater);
    } finally {
      setBusy(false);
    }
  }

  if (needsName) {
    return (
      <View style={styles.screen}>
        <Text style={heading}>{t.whatsYourName}</Text>
        <Text style={body}>{t.friendsSeeYourName}</Text>
        <TextInput
          style={input}
          placeholderTextColor={theme.tertiaryText}
          value={name}
          onChangeText={setName}
          placeholder={t.name}
          autoFocus
          autoComplete="name"
          maxLength={40}
          returnKeyType="done"
          onSubmitEditing={() => name.trim() && run(() => rename(name))}
        />
        <Button
          label={t.continue}
          disabled={busy || !name.trim()}
          onPress={() => run(() => rename(name))}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={heading}>{t.signInToShare}</Text>
      <Text style={body}>{t.signInWhy}</Text>

      {appleAvailable && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          // Apple's rule: black on light, white on dark.
          buttonStyle={
            theme.dark
              ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
          }
          cornerRadius={12}
          style={styles.apple}
          onPress={() => run(signInWithApple)}
        />
      )}
      {googleConfigured && (
        <Button
          label={t.signInWithGoogle}
          disabled={busy}
          onPress={() => run(signInWithGoogle)}
        />
      )}

      {devSignInEnabled && (
        <View style={styles.dev}>
          <Text style={[styles.devLabel, { color: theme.tertiaryText }]}>
            {t.devSignIn}
          </Text>
          <TextInput
            style={input}
            placeholderTextColor={theme.tertiaryText}
            value={name}
            onChangeText={setName}
            placeholder={t.name}
            autoCapitalize="words"
          />
          <Button
            label={t.signIn}
            disabled={busy || !name.trim()}
            onPress={() => run(() => signInDev(name))}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, gap: 16 },
  heading: { fontSize: 24, fontWeight: "700" },
  body: { fontSize: 16 },
  apple: { height: 50 },
  input: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 17,
  },
  dev: { gap: 12, marginTop: 24 },
  devLabel: { fontSize: 13 },
});
