import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * app.json plus what comes from the environment. Google Sign-In is built in
 * only when its OAuth clients are configured: its plugin refuses to build
 * without `GOOGLE_IOS_URL_SCHEME`, and the sign-in screen hides the button
 * without client ids.
 *
 * - GOOGLE_IOS_URL_SCHEME — reversed iOS client id, `com.googleusercontent.apps.…`
 * - GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID — the OAuth client ids
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const iosUrlScheme = process.env.GOOGLE_IOS_URL_SCHEME;

  return {
    ...(config as ExpoConfig),
    plugins: [
      ...(config.plugins ?? []),
      ...(iosUrlScheme
        ? [
            ["@react-native-google-signin/google-signin", { iosUrlScheme }] as [
              string,
              unknown,
            ],
          ]
        : []),
    ],
    extra: {
      ...config.extra,
      googleIosClientId: process.env.GOOGLE_IOS_CLIENT_ID,
      googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID,
    },
  };
};
