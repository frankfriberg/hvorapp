import Constants from "expo-constants";

// Invite links point at the web app, so they open for anyone, with or without
// the app installed.
const webUrl: string = Constants.expoConfig?.extra?.webUrl;

/** My invite link; opening it asks me to be the opener's friend. */
export function inviteUrl(code: string): string {
  return `${webUrl}/invite/${code}`;
}
