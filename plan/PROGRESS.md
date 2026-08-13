# Progress tracker

Claude Code updates this file at the end of every step. The human reads it to
know where things stand.

## Current step

**01 — Project init and first deploy**

## Log

| Step | Status | Date | Notes |
|------|--------|------|-------|
| 00 Accounts and environment | done | 2026-08-13 | Node v24.18.1, npm 11.16.0, git 2.55.0.windows.3 — all above the Node 20+ minimum. `git init` run in this folder. GitHub: private repo `pf-scheduler` created, empty, no README. Vercel: account created, signed in with GitHub, no project imported yet. Supabase project created (region us-east-2, not us-east-1 — fine, just noting it accurately). Google sign-in enabled and working. Supabase URL, anon key, and service role key all received (2026-08-13). Service role key is held for step 01's `.env.local` — not written to this file or any other tracked file. |
| 01 Project init and first deploy | in progress | 2026-08-13 | Next.js app scaffolded (TypeScript, App Router, Tailwind, ESLint, `src/`) — done via a scratch-directory scaffold merged in by hand, since `create-next-app` refuses a non-empty directory and CLAUDE.md/README-FIRST.md/plan/ had to survive untouched. `.env.local` created with the real Supabase URL, anon key, and service role key; confirmed gitignored via `git check-ignore .env.local`. `.env.example` created with empty values. `@supabase/supabase-js` and `@supabase/ssr` installed. Three clients written: `src/lib/supabase/client.ts`, `server.ts`, `admin.ts` (with the browser-import guard). Supabase CLI installed as a dev dependency; `supabase init` run; `supabase link` completed against project ref `bkenqyuvbqomlenwrbbs` (needed a personal access token from the dashboard in addition to the DB password — not documented in the step file, added as a deviation below). `health_check` migration created and pushed to the remote database. `src/app/page.tsx` fetches it server-side; verified locally with `npm run build` and a real `npm start` request — page rendered "Database connection is working." live from Supabase. DB password, access token, and service role key confirmed absent from every non-gitignored file by search. Paused here per the human's instruction, before the first commit/push and before the Vercel import walkthrough. |
| 02 Database schema | not started | | |
| 03 Row level security | not started | | |
| 04 Seed data and a fake school | not started | | Builds a fictional school, not the real one. See Deviations. |
| 05 Auth and roster gating | not started | | |
| 06 App shell, navigation, roles | not started | | |
| 07 Schedule engine | not started | | |
| 08 Week grid | not started | | |
| 09 Availability signup | not started | | |
| 10 Round formation and judge signup | not started | | |
| 11 Post-round form and completion | not started | | |
| 12 School onboarding and schedule config | not started | | Moved up from its old position after admin console. See Deviations. |
| 13 Leaderboard | not started | | |
| 14 Round archive | not started | | |
| 15 Admin console | not started | | |
| 16 ICS import | not started | | |
| 17 Notifications and reminders | not started | | |
| 18 Security review, privacy, launch | not started | | |

Status values: not started, in progress, blocked, done.

## Blockers

None currently. Step 00 is done. Step 01 needs two more things from the human
once it starts: the Supabase database password and project ref, to run
`supabase link` — neither has been collected yet, ask when that task comes up.

`.env.local` doesn't exist yet — step 01 creates it. The Supabase URL, anon
key, and service role key are all in hand for that (service role key received
2026-08-13, held in conversation only, not written to any tracked file —
see the step 00 log row).
      NEXT_PUBLIC_SUPABASE_URL=https://bkenqyuvbqomlenwrbbs.supabase.co
      NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrZW5xeXV2YnFvbWxlbndyYmJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0OTQ1MjcsImV4cCI6MjEwMjA3MDUyN30.DGLWdfJaDU4hq6Ouw6Z2hC-InM5gaNNwztKhtMkQm8M

## Not blocking anything right now, needed later for real onboarding (step 12)

As of 2026-08-12, v1 is school-agnostic starting at step 04 (see
`plan/reference/decisions.md`). None of the items below block any step
through 15 — steps 04 through 11 and 13 through 15 build and test against a
fictional fake school, not the real one. They matter again once the human
runs the setup wizard (step 12) to onboard the real school for real:

- `plan/reference/school-config.md` still has `TODO`s: school name, slug,
  term dates, room list, admin emails, the Friday before-school-block
  question, and the Wednesday squad-practice decision.
- **Half-Day/Special/Community dismissal times are still unconfirmed.** What's
  in `school-config.md`, "Schedule variants" (Half-Day cuts Block 5 onward,
  Special/Community run full length) is Claude Code's working assumption, not
  something the human confirmed — flagged unconfirmed there as of 2026-08-12.
  Get the real dismissal times / block cutoffs from the human before typing
  them into the wizard for the real school.
- Rotation continuity (continuous, with the one Dec 9 → Jan 4 reset) is
  correctly resolved and doesn't need re-confirming — it came directly from
  the CSV data. See `plan/reference/decisions.md`.

## Deviations

- **2026-08-13 — `create-next-app` can't run directly in this folder, and
  `supabase link` needs a personal access token step 01 doesn't mention.**
  `create-next-app` refuses any non-empty directory regardless of what's in
  it, so the scaffold was generated in a scratch directory and merged in by
  hand instead — see the step 01 log row for what was skipped (a generated
  `CLAUDE.md`/`AGENTS.md`/`README.md` that would have collided or confused).
  Separately, `supabase link` failed with `LegacyPlatformAuthRequiredError`
  until a personal access token (from the Supabase dashboard, Account →
  Access Tokens) was supplied via `SUPABASE_ACCESS_TOKEN` — the database
  password alone wasn't enough. Both are one-time setup quirks, not design
  changes; noting them so a future step 01 run isn't surprised by either.
- **2026-08-13 — v1 is school-agnostic starting at step 04; the onboarding
  wizard moved from step 15 to step 12.** Originally, steps 04 through 14
  were going to be seeded and tested directly against the real school's real
  facts, and the setup wizard was late-build multi-tenancy machinery gated on
  a second school actually asking. Reversed: steps 04-11 and 13-15 now build
  and test against a fictional fake school (step 04). The wizard (renumbered
  12, was 15) is the only path any school's real data — including the real
  one — ever enters the system, so it moved to right after the core round
  flow works (step 11) instead of sitting at the end. Old steps 12-14
  (leaderboard, round archive, admin console) shifted to 13-15. Steps 00-03
  and 16-18 are unchanged. `plan/reference/school-config.md` is no longer a
  prerequisite for step 04; it's now reference notes for whenever the wizard
  is run for the real school. See `plan/reference/decisions.md`, "v1 is
  school-agnostic starting at step 04," and `plan/CLAUDE.md` rule 7.
- **2026-08-12 — period templates keyed by schedule variant, not rotation day
  type.** The original schema and steps 04/07 assumed each rotation code
  (O1..E4) needed its own period template. Corrected: the PF blocks are fixed
  windows unrelated to which class period is running, so there is one
  template per schedule variant (Standard, Half-Day, Special, Community)
  instead, applied regardless of the Day 1-4 rotation label. Added a
  `schedule_variants` table; `day_types` is now informational only. See
  `plan/reference/decisions.md`.
- **2026-08-12 — dropped the anchor-plus-sequence rotation calculation.**
  Original step 07 planned to compute each date's day type from an anchor
  date and a rotation sequence. Replaced with importing day codes and
  schedule variants directly from an authoritative per-date calendar,
  regardless of which school or which path (fake seed, wizard, or live feed)
  populated it. See `plan/reference/decisions.md`.
