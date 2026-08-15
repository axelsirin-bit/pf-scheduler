# Progress tracker

Claude Code updates this file at the end of every step. The human reads it to
know where things stand.

## Current step

**07 — Schedule engine**

## Log

| Step | Status | Date | Notes |
|------|--------|------|-------|
| 00 Accounts and environment | done | 2026-08-13 | Node v24.18.1, npm 11.16.0, git 2.55.0.windows.3 — all above the Node 20+ minimum. `git init` run in this folder. GitHub: private repo `pf-scheduler` created, empty, no README. Vercel: account created, signed in with GitHub, no project imported yet. Supabase project created (region us-east-2, not us-east-1 — fine, just noting it accurately). Google sign-in enabled and working. Supabase URL, anon key, and service role key all received (2026-08-13). Service role key is held for step 01's `.env.local` — not written to this file or any other tracked file. |
| 01 Project init and first deploy | done | 2026-08-13 | Next.js app scaffolded (TypeScript, App Router, Tailwind, ESLint, `src/`) — done via a scratch-directory scaffold merged in by hand, since `create-next-app` refuses a non-empty directory and CLAUDE.md/README-FIRST.md/plan/ had to survive untouched. `.env.local` created with the real Supabase URL, anon key, and service role key; confirmed gitignored via `git check-ignore .env.local`. `.env.example` created with empty values. `@supabase/supabase-js` and `@supabase/ssr` installed. Three clients written: `src/lib/supabase/client.ts`, `server.ts`, `admin.ts` (with the browser-import guard). Supabase CLI installed as a dev dependency; `supabase init` run; `supabase link` completed against project ref `bkenqyuvbqomlenwrbbs` (needed a personal access token from the dashboard in addition to the DB password — not documented in the step file, added as a deviation below). `health_check` migration created and pushed to the remote database. `src/app/page.tsx` fetched it server-side; verified with `npm run build` and a real `npm start` request — page rendered "Database connection is working." live from Supabase. First commit made and pushed to `github.com/axelsirin-bit/pf-scheduler`, branch `main`. Vercel import completed by the human with all three env vars set; deploy verified live. Human confirmed complete 2026-08-15. |
| 02 Database schema | done | 2026-08-15 | Six migrations written and pushed to remote (local `supabase db reset` skipped — see Blockers/Deviations, Docker is unreachable from this tool's environment). All 23 tables/views confirmed queryable via a live script using the service role client; `health_check` confirmed dropped. `types:gen` script added to `package.json` (`supabase gen types typescript --linked --schema public > src/lib/db/types.ts`); run for real, produced a 1410-line `src/lib/db/types.ts` covering all 23 tables/views including the four extras. `npm run build` still passes. Committed (`adc7fb9`) and pushed to `main`. |
| 03 Row level security | done | 2026-08-15 | One migration (`20260815000000_row_level_security.sql`) written and pushed: helper functions `auth_school_id()`/`auth_has_role()`, RLS enabled + policies on all 22 tables. Two pre-existing bugs found and fixed in the same migration — see Deviations. Verified via `supabase db query --linked`: zero tables with RLS disabled, 22 with it enabled (21 from the human's list plus `school_terms`, flagged as a deviation). `supabase db advisors --linked --type security` run as a bonus check: confirms the view fix resolved the security-definer-view warning; surfaced a low-severity item (all three functions callable directly via REST RPC, Supabase's default grant) left as-is per the human's call, except `profiles_restrict_self_update` which is safe to lock down later if wanted. `scripts/verify-rls.sql` written: seeds School A/B (one admin + two debaters each, plus minimal schedule/round fixtures), runs all 10 required assertions as the real `authenticated` role with a simulated JWT (not as postgres), cleans up its own fixtures every run, reports pass/fail per assertion. `verify:rls` npm script added. Ran three times: clean pass (all 10/10), a deliberately-broken copy to confirm the failure path (correct non-zero exit + exact assertion + detail in the error message), and a second clean rerun to confirm idempotency — all three left zero leftover fixtures (schools, `auth.users` rows, and the temporary cleanup helper function all confirmed gone after each run). Not committed yet — human wants to review first. |
| 04 Seed data and a fake school | done | 2026-08-15 | `supabase/seed.sql` written and applied to remote (idempotent — deletes and regenerates its own fixtures by slug/email first). Creates Riverbend Academy (the fictional school — name, terms, Standard/Half-Day templates and blocks, Day 1-4 day types, schedule variants, 4 rooms) and Test Academy (minimal, school row only). `calendar_days` generated for the full Fall 2026 term via `generate_series` + a continuous Day 1-4 rotation, not hand-typed rows — 81 school days, 3 Half-Day, holidays (Labor Day, 3-day Thanksgiving break) correctly consuming zero rotation positions. 8 auth.users + profiles (4 per school: admin/debater/debater-and-judge/judge-only). `scripts/seed-dev-data.ts` written to turn calendar days into slots, parameterized by `--from`/`--to` (defaults to September 2026); found and fixed a real bug in its own timezone-conversion helper during testing — see Deviations. Verified live, not just "no error": Sep 8 = Day 3, Sep 16 = Day 1 + Half-Day (both spot-checks the human asked for, matching hand-computed values from the planning turn); 103 September slots at correct UTC times, checked against both EDT (September) and EST (December, generated then removed since only September was asked for) to confirm the DST math is actually right; Test Academy confirmed to have zero calendar days/slots/rooms; `verify:rls` re-run with the new seed data present, 10/10 still pass; a direct query as the real seeded `debater@riverbend.test` (not the throwaway RLS-test fixtures) confirms zero Test Academy rows visible. `npm run build` passes (needed one project-wide fix — see Deviations). Not committed yet — human wants to review first. |
| 05 Auth and roster gating | done | 2026-08-15 | Trigger migration (`20260816000000_auth_roster_gating.sql`), `security definer` like step 03's helpers: rejects any `auth.users` insert without a matching unclaimed `roster_invites` row, otherwise creates the `profiles` row and claims the invite. Tested directly at the SQL level (not just built): rejection leaves zero trace in `auth.users`/`profiles` (the exact failure mode the step file warns about — confirmed NOT an issue on this Supabase version), success path creates correct `school_id`/`full_name`/`display_name`/`roles`, claimed invites correctly excluded from the trigger's own lookup. `src/proxy.ts`, `src/app/sign-in/`, `src/app/auth/callback/route.ts`, `src/lib/auth.ts` (`getCurrentUser()` + `signOut()`) all written. `supabase/seed.sql` and `scripts/verify-rls.sql` both updated to create `roster_invites` before their `auth.users` inserts and let the trigger create `profiles` itself, since the trigger now fires on every insert there too — re-verified both (8/8 seed profiles created correctly through the real trigger path; `verify:rls` still 10/10). Two real findings beyond what was asked — see Deviations: the email-in-refusal-message requirement turned out not to be achievable as specified, and Next.js 16 has renamed Middleware to Proxy, which the step file predates. `npm run build` passes; `Database` types were wired into all three Supabase client factories for the first time (generated in step 02, never actually applied until this step's code needed real query typing). See PROGRESS.md verification notes below for exactly what was tested directly vs. needs the human's real Google OAuth. Committed (`ef5c41a`) and pushed; human verified. |
| 06 App shell, navigation, roles | done | 2026-08-15 | Shell built as a route group, `src/app/(app)/layout.tsx`, wrapping everything except `/sign-in` and `/auth/callback`; header (school name, `display_name` — not `full_name`, per `ui-conventions.md`, since this renders on peer-facing pages too — and a sign-out button using the existing server action as a plain form) plus `Nav` (six items, role-filtered). `getCurrentUser()` wrapped in React's `cache()` so the layout and a page calling it in the same request only hit the database once. `RequireRole` in `src/lib/components/` wraps `/admin` (admin) and `/judging` (judge) — the acceptance criteria only spells out `/admin` needing a 404, but task 3/4's stated principle isn't admin-specific, so both got it; noted as an interpretation, not something ambiguous enough to stop and ask about. Six placeholder pages, each a heading and one empty-state sentence written per `ui-conventions.md`'s tone rules (an invitation to act, not "no data"). `(app)/not-found.tsx` catches `RequireRole`'s `notFound()` calls *and* renders inside the shell (Next.js resolves nested `not-found.tsx` to the nearest boundary); a separate root `not-found.tsx` catches genuinely unmatched URLs and is deliberately shell-less, since it can't safely assume a session exists. Same reasoning for `error.tsx`. Role-gating verified for real, not just built: generated actual Supabase session cookies for three seeded users (debater, hybrid debater-and-judge, admin) using `@supabase/ssr`'s own cookie-writing code against a temporary password set via the admin API (Google-only sign-in has no password login path in the real app; this was purely a testing device), then hit `/admin` and `/judging` with real HTTP requests. All nine combinations matched expectations exactly: debater 404/404, hybrid 200/404, admin 404/200 (admin has no judge role — confirms this isn't a blanket "any role passes" bug), and nav links present/absent to match every time. Confirmed the 404s render inside the shell (header/nav present in the response body alongside "Page not found"), not a bare Next.js default. One real finding along the way — see Deviations: the seeded test users' `auth.users` rows can't be managed through Supabase's admin API or dashboard as seeded (missing `auth.identities` rows, and several token columns `NULL` instead of `''`, which breaks GoTrue's user-loading code with a generic 500). Fixed on the live database for testing purposes; not yet added to `seed.sql` itself, since that's beyond this step's scope — flagging for the human's call. `npm run build` passes. Committed (`f81c889`) and pushed; human verified. |
| 07 Schedule engine | in progress | 2026-08-15 | `zonedTimeToUtc` extracted from `scripts/seed-dev-data.ts` into `src/lib/schedule/timezone.ts`; the script now imports it, re-run to confirm the extraction didn't break it (still 103 September slots). `src/lib/schedule/generate.ts` — pure function, calendar days + variants + blocks in, slot rows out. Vitest installed (none existed before this step, despite the human's phrasing assuming existing coverage — flagged, not blocking); 10 tests across `generate.test.ts` and a new `timezone.test.ts`, covering all 5 scenarios the step file names plus a non-US-timezone sanity check (India, a non-hour UTC offset). All pass. `src/lib/db/slots.ts`: `upsertSlotsForRange` (service role — the only callers are an unauthenticated cron job and one-off scripts, never a page a user is viewing) and `getSlotsForRange` (regular RLS-respecting client, for step 08). Found and fixed a real structural bug while testing: `getSlotsForRange`'s use of `server.ts` pulls in `next/headers`, which can't resolve outside Next's runtime even at import time, not just call time — broke loading the whole file from a plain script. Fixed with a dynamic `import()` deferring that dependency to when the function actually runs, keeping both functions in the one file as asked. Generated real slots for Riverbend: Fall 2026 dry-run and real matched exactly (81 school days, 399 slots — 78 Standard × 5 bookable + 3 Half-Day × 3 bookable, confirmed by hand). Spring 2027 produced 0/0, correctly — step 04 only ever generated `calendar_days` for Fall, so there's nothing for this step to turn into slots yet; not a bug, flagged for the human's call on whether to backfill Spring's calendar. Idempotency and regeneration safety verified together, not separately: created a real round on a real slot, re-ran generation, confirmed the total slot count was unchanged, the slot's id was unchanged, and the round's foreign key still resolved — then cleaned up the test round. `v_participation` verified against real data, not just read: three completed rounds for the same debater in the same week (real generated Riverbend slots, real profiles), confirmed exactly the two earliest-starting rounds are credited and the third is excluded (`weekly_credit_cap = 2`), confirmed the cap applies per-user independently (a second participant capped separately), confirmed judge role recorded distinctly from debater role. Cleaned up after itself. Not built this pass, and not asked for: the Vercel cron route (`/api/cron/generate-slots`) and a "gap report against expected term dates" the step file's common-failure-modes section mentions — both remain for later. `npm run build` and `npm test` both pass. Not committed yet. |
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

- **2026-08-15 — step 07: no pre-existing Vitest coverage to verify (none
  existed), a real structural bug in `slots.ts`, and Spring 2027 has no
  calendar to generate slots from.**
  - **"Verify existing Vitest coverage still passes" assumed coverage that
    didn't exist.** Vitest wasn't installed anywhere in the project before
    this step — installed it fresh (explicitly named in the step file, so
    no need to ask first per CLAUDE.md) and wrote the 5 scenarios the step
    file itself requires, plus direct coverage of the extracted timezone
    helper. Treating "verify it still passes" as "this is the first time it
    exists, and it passes."
  - **`src/lib/db/slots.ts` couldn't be loaded outside Next's runtime at
    all**, not just at call time. `getSlotsForRange` imports `server.ts`,
    which imports `next/headers` — a module Node's resolver can't find
    outside Next's own bundling, full stop. Since the file's *other*
    function (`upsertSlotsForRange`) has to run from a plain script (and
    eventually a cron route) with no Next request context, a static
    top-level import of `server.ts` broke loading the whole module
    anywhere but inside Next. Fixed with a dynamic `import()` inside
    `getSlotsForRange` itself, deferring that dependency to when the
    function is actually called — keeps both functions in one file as
    asked, without breaking the half that needs to run standalone.
  - **Spring 2027 produced 0 slots — correctly.** `calendar_days` only
    exists for Fall 2026; step 04 deliberately scoped calendar generation
    to Fall only. Running slot generation for Spring found zero school
    days, which is the right behavior given the input, not a bug in this
    step's code. Flagging since "generate for both terms" implied Spring
    had something to generate from. If Spring coverage matters before step
    08, `calendar_days` needs the same `generate_series`-based generation
    step 04 already wrote for Fall, extended to the Spring range.
- **2026-08-15 — step 06: seeded test users can't be managed through
  Supabase's admin API/dashboard as `seed.sql` creates them.** Discovered
  while generating real session cookies to verify role-gating. Two issues,
  both traced to inserting directly into `auth.users`/leaving out
  `auth.identities` rather than going through GoTrue: (1) zero
  `auth.identities` rows for any seeded user — GoTrue's admin API needs at
  least one to load a user at all; (2) `confirmation_token`,
  `recovery_token`, `email_change_token_new` were `NULL` instead of `''`,
  which real GoTrue-created rows never are — its Go user-loading code can't
  scan a `NULL` into those fields and fails with a generic 500 ("Database
  error loading user"), the same genericized-error pattern found in step 05.
  Fixed directly on the database so testing could proceed; **not** added to
  `seed.sql` itself, since nothing in this app's real path (Google OAuth
  only, no password login, no admin dashboard user management) needs it —
  flagging it for the human's call rather than expanding this step's scope
  on my own judgment. If this matters later (e.g. wanting to inspect seeded
  users in the Supabase dashboard), `seed.sql` needs an `auth.identities`
  insert alongside its `auth.users` one, and the three token columns set to
  `''` instead of left to default to `NULL`.
- **2026-08-15 — step 05: the refusal message can't name the attempted
  email, Next.js 16 renamed Middleware to Proxy, and Database types were
  never actually wired into the Supabase clients until now.**
  - **The email genuinely can't be recovered.** Task 4 asks the refusal
    message to name the email address that was tried. Tested this directly
    against the real Supabase auth server — not guessed — using the admin
    API (`supabase.auth.admin.createUser()`) to trigger the same
    trigger-rejection path a real OAuth sign-in would hit. Result: Supabase
    genericizes it to `"Database error creating new user"` with no email
    attached, regardless of what the trigger's own exception message says.
    By the time our own `/auth/callback` route sees anything, Supabase's
    auth server has already decided and stripped the detail — there's no
    session, no code, and nothing in the error redirect to recover the
    email from. `src/app/sign-in/page.tsx` shows a clear refusal message
    without the specific email instead of fabricating one. A fix would mean
    moving off a raw DB trigger onto Supabase's "Before User Created" Auth
    Hook (which supports a custom surfaced error) or handling rejection in
    application code after the fact — the latter reintroduces exactly the
    "authenticated user exists without a profile" window task 3 was
    designed to avoid. Flagging both as open options rather than picking
    one unasked.
  - **`src/middleware.ts` → `src/proxy.ts`.** `next dev` appended a notice
    to `CLAUDE.md` (visible in the working tree, not reverted) pointing at
    `node_modules/next/dist/docs/` because this Next.js version has
    breaking changes from training-data assumptions. Checked it: Next.js 16
    renamed Middleware to Proxy — same functionality, `proxy.ts` exporting
    `proxy` instead of `middleware.ts` exporting `middleware`. The step
    file's "Middleware at `src/middleware.ts`" predates this rename;
    `middleware.ts` still worked but logged a deprecation warning on every
    build. Renamed rather than leaving deprecated code in a fresh project;
    functionality is identical, confirmed via the same redirect tests
    before and after.
  - **Wired the generated `Database` type into all three Supabase client
    factories for the first time.** `src/lib/db/types.ts` was generated in
    step 02 but never actually passed to `createBrowserClient`/
    `createServerClient`/`createClient` — every query since has been
    running without real type information. Surfaced now because
    `getCurrentUser()`'s embedded `schools` join needed accurate typing to
    compile (`npm run build` failed without it: a to-one relationship was
    inferred as an array). Small, mechanical fix, but worth flagging since
    it changes type-checking behavior for every existing query, not just
    the new code.
- **2026-08-15 — step 04: a real timezone bug in `seed-dev-data.ts`, and a
  project-wide `tsconfig.json` change needed to run it.**
  - **Slot times were off by 4 hours on first run.** The
    `zonedTimeToUtc` drift-correction loop compared each iteration's
    result against the *previous guess* instead of the fixed target
    wall-clock time, so instead of converging it overcorrected on the
    second pass — 08:00 America/New_York came out as 16:00 UTC instead of
    the correct 12:00 UTC. Caught by actually checking generated slot
    times against hand-computed values rather than trusting a clean exit
    code. Fixed by comparing against a fixed target each pass; re-verified
    against both EDT (September, UTC-4) and EST (December, UTC-5) to
    confirm the DST math itself is right, not just the one date tested.
  - **`npm run build` failed after adding the script.** Node's ESM
    resolver requires an explicit `.ts` extension on the relative import
    to `admin.ts` to run the script directly with `node
    --env-file=.env.local`, but the project's `tsconfig.json` (via
    Next.js's default `moduleResolution: "bundler"`) rejects `.ts`
    extensions in import paths unless `allowImportingTsExtensions` is
    set. Added that option to `tsconfig.json` — safe here since
    `noEmit: true` was already set, which is what that option requires.
    This is a small project-wide tsconfig change, not scoped to just this
    script; flagging it as such rather than treating it as purely local.
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
