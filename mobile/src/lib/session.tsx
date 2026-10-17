import type { MeResponse, SessionResponse, User } from "@shared/api";
import * as AppleAuthentication from "expo-apple-authentication";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform } from "react-native";
import { ApiError, api } from "./api";

const TOKEN_KEY = "hvor.session";

const extra = Constants.expoConfig?.extra ?? {};

/** Google Sign-In is offered only when its OAuth clients are configured. */
export const googleConfigured = Boolean(
  extra.googleWebClientId && (Platform.OS !== "ios" || extra.googleIosClientId),
);

/** Name-only sign-in against a server with HVOR_DEV_AUTH=1. */
export const devSignInEnabled = process.env.EXPO_PUBLIC_DEV_AUTH === "1";

type Session =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; token: string; user: User };

type SessionContext = {
  session: Session;
  signInWithApple(): Promise<boolean>;
  signInWithGoogle(): Promise<boolean>;
  signInDev(name: string): Promise<boolean>;
  rename(name: string): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
};

const Context = createContext<SessionContext | null>(null);

export function useSession(): SessionContext {
  const context = useContext(Context);
  if (!context) throw new Error("useSession outside SessionProvider");
  return context;
}

/** The signed-in user's token, or null. */
export function useToken(): string | null {
  const { session } = useSession();
  return session.status === "signed-in" ? session.token : null;
}

const isCancel = (error: unknown) =>
  (error as { code?: string })?.code === "ERR_REQUEST_CANCELED";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ status: "loading" });

  const keep = useCallback(async (token: string, user: User) => {
    await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify({ token, user }));
    setSession({ status: "signed-in", token, user });
  }, []);

  const forget = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setSession({ status: "signed-out" });
  }, []);

  // Restore the stored session and refresh its user. A token the server no
  // longer knows signs out; being offline keeps the stored user.
  useEffect(() => {
    (async () => {
      const stored = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!stored) return setSession({ status: "signed-out" });
      const { token, user } = JSON.parse(stored) as {
        token: string;
        user: User;
      };
      setSession({ status: "signed-in", token, user });
      try {
        const me = await api<MeResponse>("/me", { token });
        await keep(token, me.user);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) await forget();
      }
    })();
  }, [keep, forget]);

  const start = useCallback(
    async (path: string, body: unknown) => {
      const { token, user } = await api<SessionResponse>(path, {
        method: "POST",
        body,
      });
      await keep(token, user);
      return true;
    },
    [keep],
  );

  const signInWithApple = useCallback(async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        ],
      });
      // Apple sends the name on the first sign-in only, beside the token.
      const name = [
        credential.fullName?.givenName,
        credential.fullName?.familyName,
      ]
        .filter(Boolean)
        .join(" ");
      return start("/auth/apple", {
        identityToken: credential.identityToken,
        name: name || undefined,
      });
    } catch (error) {
      if (isCancel(error)) return false;
      throw error;
    }
  }, [start]);

  const signInWithGoogle = useCallback(async () => {
    // Required lazily: the module is only linked when Google is configured.
    const {
      GoogleSignin,
    } = require("@react-native-google-signin/google-signin");
    GoogleSignin.configure({
      webClientId: extra.googleWebClientId,
      iosClientId: extra.googleIosClientId,
    });
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();
    if (response.type !== "success") return false;
    return start("/auth/google", { idToken: response.data.idToken });
  }, [start]);

  const signInDev = useCallback(
    (name: string) => start("/auth/dev", { name }),
    [start],
  );

  const value = useMemo<SessionContext>(() => {
    const token = session.status === "signed-in" ? session.token : null;
    return {
      session,
      signInWithApple,
      signInWithGoogle,
      signInDev,
      rename: async (name) => {
        const { user } = await api<{ user: User }>("/me", {
          method: "PATCH",
          body: { name },
          token,
        });
        if (token) await keep(token, user);
      },
      signOut: async () => {
        await api("/session", { method: "DELETE", token }).catch(() => {});
        await forget();
      },
      deleteAccount: async () => {
        await api("/me", { method: "DELETE", token });
        await forget();
      },
    };
  }, [session, signInWithApple, signInWithGoogle, signInDev, keep, forget]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}
