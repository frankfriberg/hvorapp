# Hvor

**Hvor** ("Where") lets people share where they are sitting in an arena. Drag a
pin onto the arena map, get a shareable link (`/salen/X<col>Y<row>`), and share
it. Opening the link renders the map with the pin placed, and link previews show
a generated Open Graph image of the same map + pin.

Built with Next.js (App Router, React 19), Tailwind CSS, and shadcn/ui. UI text
is in Norwegian.

## Mobile app

`mobile/` is the iOS + Android app (Expo). `cd mobile && npm install && npx expo start`.
Releases go through EAS — see [`mobile/AGENTS.md`](./mobile/AGENTS.md).

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:9100](http://localhost:9100).

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Dev server on port 9100 (Turbopack) |
| `npm run build` | Production build (`output: "standalone"`) |
| `npm run start` | Start the production server |
| `npm run lint` | Lint with Biome (check only) |
| `npm run lint:fix` | Lint and auto-fix with Biome |
| `npm run format` | Format with Biome |
| `npm run typecheck` | Type-check with `tsc --noEmit` |
| `npm test` | Run the Vitest test suite |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run db:migrate` | Apply `db/migrations` to `DATABASE_URL` |
| `npm run arena:build -- salen` | Regenerate `shared/arenas/salen.ts` from `public/arena/salen.svg` |

Biome handles both linting and formatting — there is no ESLint or Prettier.

## Environment variables

| Variable | Used by | Notes |
|---|---|---|
| `RESEND_API_KEY` | feedback form | required to send feedback email |
| `LINEAR_ISSUE_EMAIL` | feedback form | destination address for feedback |
| `NEXT_PUBLIC_VIPPS_URL` | nav menu | optional support link |
| `NEXT_PUBLIC_MOBILEPAY_URL` | nav menu | optional support link |
| `DATABASE_URL` | friends API | Postgres (Vercel Postgres). Unset in development: a local PGlite in `.pglite/` is used |
| `APPLE_AUDIENCES` | sign-in | accepted Sign in with Apple audiences; default `app.hvor` |
| `GOOGLE_CLIENT_IDS` | sign-in | comma-separated Google OAuth client ids (iOS, Android, web) |
| `HVOR_DEV_AUTH` | sign-in | `1` enables name-only sign-in for development; never in production |

## Updates / Changelog

The app includes a continuous feed of updates at `/updates`. To add a new update:

1. Create a markdown file in the `updates/` directory.
2. Follow the naming convention `YYYY-MM-DD-slug.md`.
3. Include frontmatter with `title` and `date`:

```markdown
---
title: "Your Update Title"
date: "2024-11-21"
---

Your update content goes here in markdown format...
```

Updates are sorted by date (newest first) and rendered as a continuous feed. A
badge appears in the nav when the latest update is newer than the visitor's last
visit to `/updates`.

## Architecture

See [`AGENTS.md`](./AGENTS.md) for a map of the codebase, conventions, and gotchas.

## Deploy

Deployed on [Vercel](https://vercel.com).
