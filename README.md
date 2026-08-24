# Flex Daddies — Shared Workout Log

A shared workout log for Diego and Kevin: log lifts, track history, weigh-ins,
and personal records together.

**Live at:** https://flexdaddies.com (once DNS is bound) / https://flexdaddies-log.unfoldeffect.workers.dev

## Stack

- **React 19 + TanStack Start** — SSR app framework
- **Cloudflare Workers** — hosting/runtime
- **Cloudflare D1** (SQLite) — shared database

## Project layout

The actual app lives in [`app/`](./app) — that's the working directory for
all installs, builds, and deploys.

```
app/
  src/
    routes/index.tsx        — the whole app (profile picker, log, history,
                               weight, stats views)
    lib/api/*.functions.ts  — server functions (workouts, weigh-ins,
                               custom exercises, templates)
    lib/workout-data.ts     — exercise categories/colors, shared constants
  migrations/                — D1 schema migrations, applied in order
  wrangler.jsonc             — production Cloudflare config (Worker name,
                               D1 binding, assets)
```

## Local development

```
cd app
bun install
bun run dev
```

## Deploying

Deploys run automatically via Cloudflare's Git integration on every push to
`main` (Workers & Pages → flexdaddies-log → Settings → Build). No manual
`wrangler deploy` needed for normal changes.

Database migrations are not automatic — after adding a new file under
`app/migrations/`, apply it to the live database with:

```
cd app
bunx wrangler d1 migrations apply flexdaddies-log-db --remote
```
