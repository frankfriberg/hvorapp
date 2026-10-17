import Constants from "expo-constants";

// Shared links point at the web app, so they open for anyone, with or without
// the app installed.
const webUrl: string = Constants.expoConfig?.extra?.webUrl;

export function locationUrl(arena: string, coordinates: string): string {
  return `${webUrl}/${arena}/${coordinates}`;
}

/** My invite link; opening it asks me to be the opener's friend. */
export function inviteUrl(code: string): string {
  return `${webUrl}/venn/${code}`;
}
