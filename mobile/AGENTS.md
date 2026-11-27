# Hvor — mobile

The iOS + Android app: the same drag-a-pin-onto-the-arena flow as the web app,
built with Expo (React Native) and Expo Router. Shared links still point at the
web app (`extra.webUrl` in `app.json`), so they open for anyone and keep their
Open Graph preview; the app also opens `hvor://salen/X<col>Y<row>`.

## Shared with the web app

`metro.config.js` lets Metro read the repo root, so both apps import one copy:

- `@shared/*` → `../shared/` — grid math, `GridPosition`, pin geometry, and the
  arena geometry the 3D map is built from.
- `@public/*` → `../public/` — the pin SVG.

`shared/` must stay free of Next.js, React Native and DOM imports. Pin placement mirrors
`src/components/map/touchMap.tsx` (60 px fingertip lift, the -115% / -150% pin
lifts); change one and change the other.

## Sharing

The share button sends a picture and nothing else: no link, the web app
lags behind the app. It's the 3D map as it's first seen (the floor's `start`),
pins and all, whatever it's turned to on screen, from `GLView.takeSnapshotAsync`
(`snapshot` in `ArenaScene`), on `ShareCard` over the banner, the ad space
(`SHARE_BANNER` in `src/lib/banner.ts`), captured with `react-native-view-shot`
and sent with `react-native-share`, which Expo Go lacks; test sharing in a
development build.

## Maps

`TouchMap` (pin, gestures) and `ArenaScene` (three.js) draw any `Floor`
(`src/lib/floor.ts`): `salenFloor`, with its stands and seats, or
`venueFloor(venue)`, the outside, whose arena buildings open the arena. The
home screen is the venue; `/salen` is inside.

Outside, my location can be shared live (`src/lib/live.ts`, `expo-location`):
only while the app is open, never in the background, and only on the venue's
map. `expo-location` is native: a dev build made before it was added has to be
rebuilt.

## Friends

Sign-in, the friends list and invite links talk to the web app's API
(`src/lib/api.ts`, `src/lib/session.tsx`); the session token is kept in the
keychain with `expo-secure-store`. Screens: `sign-in` (Apple, Google, then a
name if the provider gave none), `friends` (requests, friends, invite link,
sign out, delete account) and `invite/[code]` (an opened invite). Friends'
shared seats are drawn on the map and refreshed every 30 s while it's open.

- **Local development:** run the web app with `HVOR_DEV_AUTH=1 npm run dev`,
  then build with `EXPO_PUBLIC_API_URL=http://localhost:9100
  EXPO_PUBLIC_DEV_AUTH=1 npx expo run:ios`. The sign-in screen then also takes
  a bare name, no Apple or Google needed.
- **On a phone (rc or any dev build):** `scripts/remote-dev.sh start|stop|status|logs`
  runs both over Tailscale HTTPS with dev sign-in; in the dev launcher, enter
  the `metro:` URL it prints (the launcher can't discover it off the LAN).
- **Google Sign-In** is compiled in only when `GOOGLE_IOS_URL_SCHEME`,
  `GOOGLE_IOS_CLIENT_ID` and `GOOGLE_WEB_CLIENT_ID` are set at build time
  (`app.config.ts`); without them the button is hidden.

## Releasing

EAS builds, signs and submits; nothing is built locally.

- `.eas/workflows/deploy-to-production.yml` runs on every push to `main` that
  touches the app or the shared files. If the native fingerprint matches an
  existing store build it publishes an over-the-air update; otherwise it builds
  both platforms and submits them to the App Store and Google Play.
- `.eas/workflows/preview.yml` is manual: an internal build of both platforms
  for real-device testing.
- Profiles are in `eas.json`; build numbers are managed remotely and
  auto-incremented.

One-time setup, run from `mobile/` (needs the Expo, Apple and Google accounts):

1. `npx eas-cli@latest init` — links the project and writes `extra.eas.projectId`.
2. `npx eas-cli@latest update:configure` — writes the `updates.url`.
3. In the Expo dashboard, connect the GitHub repo and set the base directory to
   `mobile`, so workflows run on push.
4. `npx eas-cli@latest credentials` — iOS distribution cert and profile.
5. App Store Connect: create the app (`app.hvor`), then add an App Store Connect
   API key to EAS for submissions.
6. Google Play: create the app (`app.hvor`), upload the first AAB by hand (Play
   requires it), then add a service-account key to EAS for submissions.

## Generic Expo guidance

This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
