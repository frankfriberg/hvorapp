import { createRemoteJWKSet, jwtVerify } from "jose";

// Apple and Google sign the ID tokens their sign-in returns; these are their
// published signing keys. https://developer.apple.com/documentation/sign_in_with_apple/fetch_apple_s_public_key_for_verifying_token_signature
// https://developers.google.com/identity/sign-in/ios/backend-auth
const APPLE_KEYS = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys"),
);
const GOOGLE_KEYS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

export type Identity = { sub: string; name?: string };

const list = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

/**
 * The Apple identity in a native Sign in with Apple token. Its audience is the
 * app's bundle id. Apple sends the name beside the token, never inside it.
 */
export async function verifyAppleToken(token: string): Promise<Identity> {
  const { payload } = await jwtVerify(token, APPLE_KEYS, {
    issuer: "https://appleid.apple.com",
    audience: list(process.env.APPLE_AUDIENCES ?? "app.hvor"),
  });
  if (!payload.sub) throw new Error("Apple token has no subject");
  return { sub: payload.sub };
}

/** The Google identity in a Google Sign-In ID token for one of our client ids. */
export async function verifyGoogleToken(token: string): Promise<Identity> {
  const audience = list(process.env.GOOGLE_CLIENT_IDS);
  if (audience.length === 0) throw new Error("GOOGLE_CLIENT_IDS is not set");

  const { payload } = await jwtVerify(token, GOOGLE_KEYS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience,
  });
  if (!payload.sub) throw new Error("Google token has no subject");
  return {
    sub: payload.sub,
    name: typeof payload.name === "string" ? payload.name : undefined,
  };
}
