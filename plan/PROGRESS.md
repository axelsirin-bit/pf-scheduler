# Progress tracker

Claude Code updates this file at the end of every step. The human reads it to
know where things stand.

## Current step

**03 — Row level security**

## Log

| Step | Status | Date | Notes |
|------|--------|------|-------|
| 00 Accounts and environment | done | 2026-08-13 | Node v24.18.1, npm 11.16.0, git 2.55.0.windows.3 — all above the Node 20+ minimum. `git init` run in this folder. GitHub: private repo `pf-scheduler` created, empty, no README. Vercel: account created, signed in with GitHub, no project imported yet. Supabase project created (region us-east-2, not us-east-1 — fine, just noting it accurately). Google sign-in enabled and working. Supabase URL, anon key, and service role key all received (2026-08-13). Service role key is held for step 01's `.env.local` — not written to this file or any other tracked file. |
| 01 Project init and first deploy | done | 2026-08-13 | Next.js app scaffolded (TypeScript, App Router, Tailwind, ESLint, `src/`) — done via a scratch-directory scaffold merged in by hand, since `create-next-app` refuses a non-empty directory and CLAUDE.md/README-FIRST.md/plan/ had to survive untouched. `.env.local` created with the real Supabase URL, anon key, and service role key; confirmed gitignored via `git check-ignore .env.local`. `.env.example` created with empty values. `@supabase/supabase-js` and `@supabase/ssr` installed. Three clients written: `src/lib/supabase/client.ts`, `server.ts`, `admin.ts` (with the browser-import guard). Supabase CLI installed as a dev dependency; `supabase init` run; `supabase link` completed against project ref `bkenqyuvbqomlenwrbbs` (needed a personal access token from the dashboard in addition to the DB password — not documented in the step file, added as a deviation below). `health_check` migration created and pushed to the remote database. `src/app/page.tsx` fetched it server-side; verified with `npm run build` and a real `npm start` request — page rendered "Database connection is working." live from Supabase. First commit made and pushed to `github.com/axelsirin-bit/pf-scheduler`, branch `main`. Vercel import completed by the human with all three env vars set; deploy verified live. Human confirmed complete 2026-08-15. |
| 02 Database schema | done | 2026-08-15 | Six migrations written and pushed to remote (local `supabase db reset` skipped — see Blockers/Deviations, Docker is unreachable from this tool's environment). All 23 tables/views confirmed queryable via a live script using the service role client; `health_check` confirmed dropped. `types:gen` script added to `package.json` (`supabase gen types typescript --linked --schema public > src/lib/db/types.ts`); run for real, produced a 1410-line `src/lib/db/types.ts` covering all 23 tables/views including the four extras. `npm run build` still passes. Committed (`adc7fb9`) and pushed to `main`. |
| 03 Row level security | done | 2026-08-15 | One migration (`20260815000000_row_level_security.sql`) written and pushed: helper functions `auth_school_id()`/`auth_has_role()`, RLS enabled + policies on all 22 tables. Two pre-existing bugs found and fixed in the same migration — see Deviations. Verified via `supabase db query --linked`: zero tables with RLS disabled, 22 with it enabled (21 from the human's list plus `school_terms`, flagged as a deviation). `supabase db advisors --linked --type security` run as a bonus check: confirms the view fix resolved the security-definer-view warning; surfaced a low-severity item (all three functions callable directly via REST RPC, Supabase's default grant) left as-is per the human's call, except `profiles_restrict_self_update` which is safe to lock down later if wanted. `scripts/verify-rls.sql` written: seeds School A/B (one admin + two debaters each, plus minimal schedule/round fixtures), runs all 10 required assertions as the real `authenticated` role with a simulated JWT (not as postgres), cleans up its own fixtures every run, reports pass/fail per assertion. `verify:rls` npm script added. Ran three times: clean pass (all 10/10), a deliberately-broken copy to confirm the failure path (correct non-zero exit + exact assertion + detail in the error message), and a second clean rerun to confirm idempotency — all three left zero leftover fixtures (schools, `auth.users` rows, and the temporary cleanup helper function all confirmed gone after each run). Not committed yet — human wants to review first. |
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

**Local `supabase db reset` cannot be run by Claude Code in this
environment, for any future step.** Docker Desktop and WSL2 are genuinely
installed and running on the human's machine, but the tools this session
uses to run shell commands are isolated from that session somehow — `docker
ps` and even `wsl --status` report nothing installed/running from inside
these tools, with or without sandbox restrictions lifted, even right after
the human confirmed Docker was up. This isn't a one-time setup problem to
retry; treat it as a standing limitation. Established 2026-08-15 in step 02.
Fallback used and expected to keep being used: dry-run `supabase db push`,
review it, then apply directly to the remote project. The human can still
run `supabase db reset` themselves in their own VS Code terminal (it works
fine there) and paste results back if a real local check is ever needed.

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

- **2026-08-15 — step 03: two pre-existing bugs found and fixed, one more
  missing table found, four extra tables from step 02 given policies.**
  - **Views bypassed RLS entirely.** `v_participation`/`v_leaderboard`
    (created in step 02) had no `security_invoker` setting, so Postgres
    checked permissions as the view owner rather than the querying user —
    meaning every school's leaderboard data was readable by anyone once RLS
    went live, completely undetected by this step's own acceptance check
    (views aren't in `pg_tables`). Fixed with `alter view ... set
    (security_invoker = on)` on both, in the new migration. Confirmed fixed
    via `supabase db advisors --linked --type security` — no
    security-definer-view warning.
  - **`profiles` update policy as literally specified allowed
    self-promotion to admin.** "self, or admin" with no column restriction
    means a debater could `update profiles set roles = '{admin}'` on their
    own row. Fixed with a `before update` trigger
    (`profiles_restrict_self_update`) that blocks non-admins from changing
    `roles`, `school_id`, or `is_active` on any row, admin or not; the RLS
    policy itself is still the literal "self or admin" row-level rule.
  - **`school_terms` was missing from the RLS policy list too** — not just
    the four tables flagged in step 02. Neither the step file's table nor
    the human's instructions for this step named it, but it's plainly
    school-scoped (`school_id` column) and got the same "own school select,
    admin write" pattern as `rooms`/`period_templates`/etc.
  - **The four tables flagged as extras in step 02** now have policies:
    `schedule_variants` — own school select, admin write (same group as
    `period_templates`). `notifications_sent` — own school + admin select,
    no write policies (service role only, step 17). `round_notes` and
    `school_requests` — deliberately left without a real policy, deferred to
    step 12; see `plan/reference/decisions.md`, "Deferred to step 12."
- **2026-08-15 — step 02's per-migration table lists don't match
  `schema.sql`; treated `schema.sql` as authoritative.** Four tables exist in
  `schema.sql` but weren't named in the step file's summary: `schedule_variants`
  (added after the step file was written, in the schedule-variant correction)
  went into migration 3 (`schedule`); `round_notes`, `notifications_sent`, and
  `school_requests` (present in `schema.sql` from the start, just omitted from
  the step's list) went into migrations 4 (`rounds`) and 5 (`admin`)
  respectively. Also reordered migration 4 to create `rooms` before `rounds`,
  since `rounds.room_id` is a foreign key to `rooms` and the step's listed
  order would have failed. Confirmed with the human before writing any files.
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
