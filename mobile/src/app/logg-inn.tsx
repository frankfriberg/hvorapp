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
import { devSignInEnabled, googleConfigured, useSession } from "@/lib/session";

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
      Alert.alert("Innlogging feilet", "Prøv igjen om litt.");
    } finally {
      setBusy(false);
    }
  }

  if (needsName) {
    return (
      <View style={styles.screen}>
        <Text style={styles.heading}>Hva heter du?</Text>
        <Text style={styles.body}>Vennene dine ser navnet ditt.</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Navn"
          autoFocus
          autoComplete="name"
          maxLength={40}
          returnKeyType="done"
          onSubmitEditing={() => name.trim() && run(() => rename(name))}
        />
        <Button
          label="Fortsett"
          disabled={busy || !name.trim()}
          onPress={() => run(() => rename(name))}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.heading}>Logg inn for å dele med venner</Text>
      <Text style={styles.body}>
        Vennene dine ser hvor du sitter, og du ser hvor de sitter.
      </Text>

      {appleAvailable && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={12}
          style={styles.apple}
          onPress={() => run(signInWithApple)}
        />
      )}
      {googleConfigured && (
        <Button
          label="Logg inn med Google"
          disabled={busy}
          onPress={() => run(signInWithGoogle)}
        />
      )}

      {devSignInEnabled && (
        <View style={styles.dev}>
          <Text style={styles.devLabel}>Utvikling: logg inn med navn</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Navn"
            autoCapitalize="words"
          />
          <Button
            label="Logg inn"
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
  body: { fontSize: 16, color: "#52525b" },
  apple: { height: 50 },
  input: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d4d4d8",
    paddingHorizontal: 16,
    fontSize: 17,
  },
  dev: { gap: 12, marginTop: 24 },
  devLabel: { fontSize: 13, color: "#71717a" },
});
