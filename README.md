# PF Scheduler

A Public Forum practice debate scheduling app. Students check the periods
they're free for on a week grid, get matched into rounds automatically, and
judges submit results that build a leaderboard and searchable archive.

Next.js (App Router) + TypeScript, Supabase (Postgres, auth, row level
security), Tailwind CSS, deployed on Vercel.

This README gets a fresh clone running locally. For what the app is and why
it's built the way it is, see `plan/reference/decisions.md`. For the full,
numbered build history, see `plan/PROGRESS.md`.

## Prerequisites

- Node.js 20 or later (built and tested against Node 24).
- A [Supabase](https://supabase.com) account — the free tier is enough for
  development.
- The [Supabase CLI](https://supabase.com/docs/guides/cli), installed
  globally or run via `npx supabase`.
- A [Resend](https://resend.com) account, only if you want to send real
  email locally. Not required — see "Email" below.

## 1. Clone and install

```
git clone <this repo>
cd pf-scheduler-plan
npm install
```

## 2. Create a Supabase project

1. Create a new project at [supabase.com](https://supabase.com/dashboard).
2. In the project's dashboard, go to **Project Settings → API** and copy:
   - **Project URL**
   - **anon public** key
   - **service_role** key (under "Project API keys" — click "Reveal")
3. In **Project Settings → General**, copy the **Reference ID** (you'll need
   it to link the CLI in the next step).

## 3. Set environment variables

Create `.env.local` in the repo root:

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=<any random string>
RESEND_DEV_MODE=true
```

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | From step 2. Public — safe in browser code. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | From step 2. Public — RLS is what actually protects data, not secrecy of this key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | From step 2. **Never** expose this to the browser — it bypasses row level security entirely. Used only in `lib/supabase/admin.ts` and the handful of server-only call sites that import it. |
| `NEXT_PUBLIC_APP_URL` | Yes | Used to build links inside emails (e.g. "review this" links). Set to `http://localhost:3000` locally, your real domain in production. |
| `CRON_SECRET` | Yes | Any random string. The two cron routes (`/api/cron/sync-ics`, `/api/cron/round-reminders`) require `Authorization: Bearer <CRON_SECRET>` and reject everything else with 401. Generate one with `openssl rand -hex 32` or similar. |
| `RESEND_DEV_MODE` | No (defaults to dev mode) | Anything other than the literal string `false` keeps the app in dev mode: emails are logged to the console instead of sent. Set explicitly to `true` locally so this is never ambiguous. Production must set this to `false` deliberately. |
| `RESEND_API_KEY` | Only if `RESEND_DEV_MODE=false` | From [resend.com](https://resend.com). Not read at all in dev mode. |
| `EMAIL_FROM_ADDRESS` | No | Defaults to `PF Scheduler <onboarding@resend.dev>` (Resend's shared sending domain, fine for development). Set to a verified sending address in production. |

`.env.local` is gitignored. Never commit real values.

## 4. Link the Supabase CLI and run migrations

```
npx supabase login
npx supabase link --project-ref <your-project-ref>
```

`supabase login` opens a browser to generate a personal access token. Linking
is a one-time step per machine per project.

Push every migration in `supabase/migrations/` (applied in filename order —
they're timestamp-prefixed, so this is safe to run on an empty database):

```
npx supabase db push
```

This also runs `supabase/seed.sql`, which creates two **fictional**
development schools (Riverbend Academy and Test Academy) with terms, rooms,
day types, period templates, and test user accounts — no real school's data
ever comes from this file. See `plan/reference/decisions.md`,
"v1 is school-agnostic starting at step 04," for why. Re-running
`db push` (or `supabase db reset` for a full wipe-and-reseed) is safe — the
seed script deletes and regenerates its own fixtures by school slug before
inserting.

## 5. Generate slots for the seeded dev school

`seed.sql` creates the school's calendar structure (terms, day types, period
templates, calendar days) but doesn't turn that into actual bookable slots —
that's a separate step, the same conversion a real school's setup wizard
(`/admin/setup`) does automatically. For the seeded dev school, run:

```
node --env-file=.env.local scripts/seed-dev-data.ts
```

Defaults to generating slots for September 2026 for Riverbend Academy. Pass
`--from=YYYY-MM-DD --to=YYYY-MM-DD` to generate a different range.

## 6. Generate TypeScript types (only after changing the schema)

```
npm run types:gen
```

Regenerates `src/lib/db/types.ts` from the live linked database. Run this
after adding or editing a migration; not needed for a first-time setup since
the checked-in copy already matches the migrations in this repo.

## 7. Run the app

```
npm run dev
```

Visit `http://localhost:3000/sign-in`. Sign-in is Google OAuth — you'll need
a Google OAuth client configured in your Supabase project's
**Authentication → Providers → Google** settings, with `<your-project-ref>
.supabase.co/auth/v1/callback` as an authorized redirect URI. Only an email
address already on a school's roster (via `roster_invites`, created by
`seed.sql` for the dev schools, or by an admin invite in the app) can
successfully create an account — everyone else is rejected at the database
level and left with no trace in `auth.users` (see
`supabase/migrations/20260816000000_auth_roster_gating.sql`).

## npm scripts

| Script | What it does |
|---|---|
| `npm run dev` | Starts the Next.js dev server. |
| `npm run build` | Production build. Also the type-checking gate — run this before considering any change done. |
| `npm start` | Runs a production build (`npm run build` first). |
| `npm run lint` | ESLint. |
| `npm test` | Runs the Vitest suite (`vitest run`) — pure-function unit tests, no live database needed. |
| `npm run types:gen` | Regenerates `src/lib/db/types.ts` from the linked Supabase project's live schema. |
| `npm run verify:rls` | Runs `scripts/verify-rls.sql` against the linked project — confirms row level security is enabled on every table and spot-checks cross-tenant access is actually blocked. Requires the CLI to be linked and logged in (step 4 above). |

## Other scripts (`scripts/`, run with `node --env-file=.env.local`)

These aren't npm scripts because they take arguments or are one-off/manual
by design, not part of the everyday dev loop:

- **`seed-dev-data.ts`** — turns the dev school's seeded calendar structure
  into real slot rows. See step 5 above.
- **`generate-slots.ts`** — one-off runner that calls the same slot
  generation function directly against Riverbend Academy's real school id,
  for a full school year. Mainly useful for checking the generation engine
  against a large, realistic date range.
- **`sweep-stale-rounds.ts`** — runs the round lifecycle sweep (marks
  overdue confirmed rounds `awaiting_result`, then `expired`) once, by hand.
  In production this logic runs from the `round-reminders` cron route
  instead.
- **`approve-school-request.ts`** — approves a pending row in
  `school_requests` (the `/register` form's target table), creating the
  school and its first admin invite. Usage:
  `node --env-file=.env.local scripts/approve-school-request.ts <requestId> <slug> <reviewedBy>`.
  There's no admin UI for this yet — see `plan/reference/decisions.md` for
  why it's a script rather than a page.

## Database migrations

Every schema change lives in `supabase/migrations/`, applied in filename
order via `supabase db push`. Never edit the schema through the Supabase
dashboard's SQL editor except to inspect data — every real change gets a
migration file, checked into this repo, so the schema is fully reproducible
from a clean database.

## Deploying

The app deploys to Vercel. `vercel.json` configures the two production cron
jobs (`sync-ics` daily, `round-reminders` hourly) — Vercel calls these with
no session cookie, only the `CRON_SECRET` header, so `/api/cron/*` is
deliberately excluded from the session gate in `src/proxy.ts`.

Set the same environment variables from step 3 in the Vercel project's
settings, with production values: `NEXT_PUBLIC_APP_URL` set to the real
deployed domain, `RESEND_DEV_MODE=false`, and a real `RESEND_API_KEY`. Run
migrations against the production Supabase project the same way as step 4
(`supabase link` to the production project, then `supabase db push`) — this
repo has no automatic migration-on-deploy step.

## Testing

`npm test` runs the full unit test suite — pure functions only (schedule
generation, timezone conversion, result shaping, notification eligibility,
etc.), no live database or network calls. Anything that needs a real
database (row level security behavior, live email sends, cron idempotency)
is verified by hand against a real linked Supabase project — see
`plan/reference/verification-checklist.md` for the full list and
`plan/PROGRESS.md` for the results of the most recent pass.
