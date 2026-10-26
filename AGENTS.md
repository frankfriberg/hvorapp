# AGENTS.md

Guidance for AI coding agents working in this repo. Keep it current when the
architecture changes.

## What this is for

Hvor is built for **Oslofjord Convention Center** (Stokke, Norway): a conference
venue with several halls and a large hotel complex. People at a conference use it
to tell friends where they are.

- **Hvor sitter du?** ("Where are you sitting?") — your seat in a hall. Built.
- **Friends** — add friends through a link; your shared seat is visible to them
  in the app. Next.
- **Hvor bor du?** ("Where are you staying?") — your hotel room, shared with
  friends for a limited time, on the same friends-and-sharing system. Later.

`salen` is one of the venue's halls; more halls are expected, which is why maps
are keyed by arena.

## What this is

**Hvor** ("Where") is a Next.js web app and an Expo app (`mobile/`) that let
people share where they are sitting in an arena. A user drags a pin onto an arena map, gets a shareable URL
(`/salen/X<col>Y<row>`), and shares it via the Web Share API. Opening that URL
renders the map with the pin placed, and social/link previews show a generated
Open Graph image of the same map + pin. There is also an updates/changelog feed
and a feedback form that emails submissions.

The UI text is in Norwegian. Currently only one arena (`salen`) exists and it is
hardcoded throughout — the `arena` "abstraction" is aspirational, not general.

## Stack

- **Next.js 16** (App Router, React 19, `output: "standalone"`), TypeScript strict.
- **Tailwind CSS 4** + shadcn/ui (new-york style) in `src/components/ui`. Config is
  CSS-first in `src/app/globals.css` (`@theme`, `@custom-variant dark`, `@plugin`) —
  there is **no `tailwind.config.ts`**. PostCSS uses `@tailwindcss/postcss`.
- **Biome 2** for lint + format (2-space, double quotes, trailing commas, semicolons).
- **Resend** for transactional email (feedback form).
- **next/og** (`ImageResponse`) for dynamic OG images.
- Deployed on **Vercel** (`@vercel/analytics`).

## Commands

```bash
npm run dev       # dev server on http://localhost:9100 (Turbopack) — NOT :3000
npm run build     # next build
npm run start     # next start
npm run lint      # biome lint (check only)
npm run lint:fix  # biome lint --write (auto-fix)
npm run format    # biome format --write
npm run typecheck # tsc --noEmit
```

Tests run on **Vitest** (`npm test`); `shared/grid.ts` is covered by
`shared/grid.test.ts`. There is no CI config in the repo. Biome is the only
linter/formatter — there is no ESLint or Prettier.

## Layout

```
src/
  actions/            # "use server" server actions (feedback email, mark-updates-read)
  app/
    layout.tsx        # root layout: header (back button, logo, menu), reads updates cookie
    page.tsx          # home: interactive ShareMap
    salen/[location]/
      page.tsx        # renders map with pin at parsed X../Y.. coords
      opengraph-image.tsx  # dynamic OG image (next/og) — real image pipeline
    updates/page.tsx  # changelog feed
    feedback/page.tsx # feedback form (useActionState -> sendFeedback)
  components/
    map/              # shareMap, touchMap (pointer/touch handling), shareMenu, debugOverlay
    home/menu.tsx     # drawer nav + support links + unread badge
    updates/          # markAsReadOnView
    ui/               # shadcn primitives
  lib/
    updates.ts        # reads updates/*.md via gray-matter (server-only, uses node:fs)
    utils.ts          # cn() classname helper
  types/              # feedback form types
updates/              # changelog markdown, named YYYY-MM-DD-slug.md with title/date frontmatter
public/               # svgs (arena map, logo, pin, payment logos)
shared/               # used by both apps: grid.ts (grid math, "X10Y15" format, GridPosition), pin.ts (pin geometry),
                      #   arena.ts (arena types + colours), arenas/<name>.ts (generated geometry)
scripts/              # arena-geometry.mjs: public/arena/<name>.svg -> shared/arenas/<name>.ts
mobile/               # Expo (React Native) app for iOS + Android — see mobile/AGENTS.md
```

Path aliases: `@/*` → `src/*`, `@public/*` → `public/*`.

## Key conventions

- **Grid coordinates** are the core primitive. Locations serialize as `X<col>Y<row>`
  (e.g. `X16Y30`). Use `parseGridCoordinates` / `formatGridCoordinates` in
  `shared/grid.ts` — never hand-roll the format. Grid is 48×90 (`gridMultiplier * aspectRatio`).
- **Server vs client:** `src/lib/updates.ts` uses `node:fs` and is server-only —
  never import it into a client component. Map components are `"use client"` because
  they need pointer/touch events and `window`.
- **OG images** live in `opengraph-image.tsx` and are rendered with `next/og`.
  SVGs are read from `public/` and inlined as base64 data URIs. The pin position math
  mirrors `touchMap.tsx` (percentage placement + the same translate transforms) — if you
  change pin placement in one, change it in the other or previews will drift.
- **Unread-updates badge:** `layout.tsx` compares the latest update date against the
  `updatesLastVisited` cookie; visiting `/updates` sets the cookie via the
  `markUpdatesAsRead` server action (triggered client-side by `MarkAsReadOnView`).
- **Adding a changelog entry:** drop a `updates/YYYY-MM-DD-slug.md` file with
  `title` and `date` frontmatter. It is picked up automatically and sorted newest-first.
  `date` may include a time (`2024-11-21T15:00:00`) for precise unread-badge timing;
  a bare date is treated as UTC midnight.
- **The arena map is drawn from geometry, not an image.** `shared/arenas/salen.ts` is
  generated from `public/arena/salen.svg` — after re-exporting the SVG, run
  `npm run arena:build -- salen`; a test fails while they disagree. Colours are
  `ARENA_COLORS` in `shared/arena.ts`. The web draws it in `map/arenaMap.tsx`, the
  OG image via `arenaToSvg`, the app in `mobile/src/components/ArenaMap.tsx`.
- Use `cn()` from `@/lib/utils` for conditional classNames.
- **`shared/` is code both apps import** (`@shared/*` in each), along with
  `public/pin.svg`. Keep it free of Next.js, React Native and DOM imports; a push to
  `main` touching it ships the mobile app (`mobile/AGENTS.md`).

## Environment variables

No `.env.example` exists; these are read at runtime:

| Variable | Used by | Notes |
|---|---|---|
| `RESEND_API_KEY` | `actions/feedback.ts` | required to send feedback email |
| `LINEAR_ISSUE_EMAIL` | `actions/feedback.ts` | destination address for feedback |
| `NEXT_PUBLIC_VIPPS_URL` | `home/menu.tsx` | optional support link |
| `NEXT_PUBLIC_MOBILEPAY_URL` | `home/menu.tsx` | optional support link |

## Gotchas

- The OG-image pipeline is `next/og` (`ImageResponse`) in
  `salen/[location]/opengraph-image.tsx` — there is **no** `/api/map-image` route and no
  Puppeteer. (Earlier `docs/API.md`/`docs/MIGRATION.md` described a removed approach and
  have been deleted.)
- Check LSP diagnostics / `npm run typecheck` after edits (project is TS strict, `noEmit`);
  there is no test net to catch regressions.

## Constraints

- Do not access MongoDB or Google Cloud Platform.
