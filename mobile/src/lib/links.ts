import Constants from "expo-constants";

// Shared links point at the web app, so they open for anyone, with or without
// the app installed.
const webUrl: string = Constants.expoConfig?.extra?.webUrl;

export function locationUrl(arena: string, coordinates: string): string {
  return `${webUrl}/${arena}/${coordinates}`;
}
