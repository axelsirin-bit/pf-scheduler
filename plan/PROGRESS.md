# Progress tracker

Claude Code updates this file at the end of every step. The human reads it to
know where things stand.

## Current step

**12 — School onboarding and schedule config**

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
| 07 Schedule engine | done | 2026-08-15 | `zonedTimeToUtc` extracted from `scripts/seed-dev-data.ts` into `src/lib/schedule/timezone.ts`; the script now imports it, re-run to confirm the extraction didn't break it (still 103 September slots). `src/lib/schedule/generate.ts` — pure function, calendar days + variants + blocks in, slot rows out. Vitest installed (none existed before this step, despite the human's phrasing assuming existing coverage — flagged, not blocking); 10 tests across `generate.test.ts` and a new `timezone.test.ts`, covering all 5 scenarios the step file names plus a non-US-timezone sanity check (India, a non-hour UTC offset). All pass. `src/lib/db/slots.ts`: `upsertSlotsForRange` (service role — the only callers are an unauthenticated cron job and one-off scripts, never a page a user is viewing) and `getSlotsForRange` (regular RLS-respecting client, for step 08). Found and fixed a real structural bug while testing: `getSlotsForRange`'s use of `server.ts` pulls in `next/headers`, which can't resolve outside Next's runtime even at import time, not just call time — broke loading the whole file from a plain script. Fixed with a dynamic `import()` deferring that dependency to when the function actually runs, keeping both functions in the one file as asked. Generated real slots for Riverbend: Fall 2026 dry-run and real matched exactly (81 school days, 399 slots — 78 Standard × 5 bookable + 3 Half-Day × 3 bookable, confirmed by hand). Spring 2027 produced 0/0, correctly — step 04 only ever generated `calendar_days` for Fall, so there's nothing for this step to turn into slots yet; not a bug, flagged for the human's call on whether to backfill Spring's calendar. Idempotency and regeneration safety verified together, not separately: created a real round on a real slot, re-ran generation, confirmed the total slot count was unchanged, the slot's id was unchanged, and the round's foreign key still resolved — then cleaned up the test round. `v_participation` verified against real data, not just read: three completed rounds for the same debater in the same week (real generated Riverbend slots, real profiles), confirmed exactly the two earliest-starting rounds are credited and the third is excluded (`weekly_credit_cap = 2`), confirmed the cap applies per-user independently (a second participant capped separately), confirmed judge role recorded distinctly from debater role. Cleaned up after itself. Not built this pass, and not asked for: the Vercel cron route (`/api/cron/generate-slots`) and a "gap report against expected term dates" the step file's common-failure-modes section mentions — both remain for later. `npm run build` and `npm test` both pass. Committed (`1d94b05`) and pushed. |
| 08 Week grid | done | 2026-08-15 | `src/lib/schedule/week-bounds.ts` — pure date-string helpers (`addDays`, `mondayOfWeek`, `todayInTimezone`, the last using the `en-CA` locale formatting trick to get the school's actual local calendar date, not the server's). `src/lib/db/week.ts` — one query per page load (`getWeekGrid`), starting from `calendar_days` rather than `slots` and embedding `slots -> availabilities -> profiles` and `slots -> rounds -> round_participants`/`rooms` in a single `.from().select()` call; a pure `shapeWeekGrid` does all the shaping (sorting, `isPast`, room stripping) with no database access, split out specifically so it's unit-testable and so the file stays loadable outside Next's runtime the same way `slots.ts` already had to be. `src/lib/components/week-grid.tsx` (desktop 5-column grid, mobile single-day view with a day-switcher, both fed by the same data — CSS `hidden md:grid`/`md:hidden` toggles, no client JS) and `src/app/(app)/week/page.tsx` (prev/next navigation, current-week highlight, 4-week-ahead cap with a boundary message instead of an empty grid, malformed `?start=` falls back to the current week instead of crashing). `(app)/page.tsx` now redirects to `/week`; `Nav`'s "This week" link updated to point there instead of `/`. 17 new Vitest tests (10 for `shapeWeekGrid`, 4 for the date helpers) — all pass, 27/27 project-wide. Room stripping verified against real data, not just the unit tests: created a real confirmed round with a room on a real Fall 2026 Riverbend slot (service-role script, cleaned up after), generated real session cookies for a non-participant, a participant, and an admin (same technique as step 06), hit `/week` over real HTTP as each — the non-participant's response contains zero occurrences of the room name or the word "room" anywhere in the payload, both the participant and the admin (not a participant) see "Confirmed · Room 101". Also verified live: `/` redirects to `/week`; the default (no `?start=`) doesn't crash even when today's real date is before the seeded term starts, showing "No schedule generated for this date yet." per day instead; the 4-week-ahead boundary shows the clear message. The "one query" claim is verified structurally (exactly one `.from('calendar_days').select(...)` call in the code, PostgREST resolves the embeds server-side) rather than via the Supabase dashboard's own query logs — `supabase db query --linked` needs a personal access token this session doesn't have; the human can spot-check the dashboard directly if they want that specific confirmation. `npm run build` and `npm test` both pass. One finding, not fixed — see Deviations: the current seed data can't actually exercise the holiday-with-a-name display path. Also fixed on the way in: `plan/PROGRESS.md` still said step 07 was "in progress"/"not committed yet" even though it had already been committed and pushed (`1d94b05`) in the prior session — corrected before starting this step. Not committed yet — human wants to review first. |
| 09 Availability signup | done | 2026-08-15 | `src/lib/db/week.ts` extended: `availabilities` now selects `user_id` (not just the joined profile), `slots` now selects `is_open`; `GridSlot` gained `isAvailable` (does the current viewer have a row on this slot) and `isOpen`. `src/app/(app)/week/actions.ts` — `toggleAvailability(slotId)`, the only parameter, per the step file: re-fetches the slot fresh (never trusts client timing), guards past/closed/confirmed-participant-removal, inserts or deletes based on what it actually finds in `availabilities` rather than any client-supplied desired state, catches Postgres 23505 (unique violation on `(slot_id, user_id)`) as a no-op success rather than an error, calls `revalidatePath` on both `/week` and `/my-rounds`. `src/lib/components/slot-checkbox.tsx` — the one Client Component this step needed, `useOptimistic` + `useTransition`, disabled while its own toggle is pending; the "revert on failure" behavior is inherent to how `useOptimistic` re-derives from the prop after `revalidatePath` brings fresh server state back down, not hand-coded. Wired into `week-grid.tsx`'s `SlotCard` (checkbox disabled when `isPast || !isOpen`) alongside a "One more and this is a full round" nudge shown exactly when a slot has no round yet and `availableCount === 3`. `/my-rounds` rewritten from its placeholder to show a compact this-week-only availability list (reuses `getWeekGrid` rather than a second query/shaping path — it already computes everything the list needs), each row with its own unmark control. 2 new Vitest tests for `isAvailable`/`isOpen` in `shapeWeekGrid`, 29/29 passing project-wide. All four scenarios the human asked for verified live against the real dev server and real seeded users, not simulated: (1) fired 6 truly concurrent `toggleAvailability` HTTP calls at a slot with zero rows — 4 came back `isAvailable:true` and 2 `isAvailable:false`, a distribution that is only possible if a genuine insert/insert race occurred (strict sequential toggling from empty can only ever produce an even 3/3 split), every call still returned `ok:true` with no error surfaced, and the slot had at most one row at every point checked, confirmed by querying `availabilities` directly afterward; (2) toggled as one seeded user, fetched `/week` as a second real signed-in session, confirmed the first user's `display_name` ("Casey N.") appears in the second user's response; (3) toggled then re-fetched `/week` in the same session and confirmed the server-rendered checkbox's `checked` attribute and the real `availabilities` row agree (a first attempt at this looked like a bug — grepping for the literal text "You're available" found zero matches — turned out to be a testing artifact: React HTML-escapes the apostrophe as `&#x27;` in real SSR output, not a real state mismatch); (4) created a real confirmed round with a seeded user as a participant, confirmed attempting to unmark that slot returns `ok:false` with "You're confirmed for a round in this slot — leave the round first." and the `availabilities` row is still there afterward, deletion genuinely blocked, not merely hidden in the UI. Reached the actual server actions over raw HTTP (no browser automation tool available in this environment) by reverse-engineering Next's real wire protocol from the compiled `server-reference-manifest.json` (POST to the page URL with a `Next-Action: <hash>` header, JSON array body, `Origin` header required or Next rejects it) — same category of workaround as the session-cookie technique from steps 06/08, not guessed. All test rounds and availability rows cleaned up afterward; confirmed zero remaining via a direct query. Not independently tested (structural/code-review only, not called out in the human's test list): the past-slot and closed-slot guards, and the "eight clicks, no reloads" / slow-3G-revert criteria from the step file's own acceptance list, since neither is checkable without a real browser — flagging this limitation plainly rather than claiming a verification that didn't happen. `npm run build` and `npm test` both pass. Not committed yet — human asked to report back first. |
| 10 Round formation and judge signup | done | 2026-08-16 | Two new migrations. `20260817000000_round_formation.sql`: `round_participants_before_insert` (security definer, `BEFORE INSERT`) locks the parent `rounds` row with `select ... for update` before checking status is `forming`, the debater's team has fewer than 2 already, and the user isn't already in another *live* (not cancelled/expired) round on the same `slot_id` — the lock is what actually closes the last-open-spot race, not the checks themselves. `round_participants_maybe_confirm` (security definer, `AFTER INSERT`, same transaction, same lock) flips the round to `confirmed` the moment the count hits 2+2+1. The one-row-per-user-per-round and one-judge-per-round constraints needed no new code — existing unique indexes already cover them. `src/lib/db/rounds.ts`: `getSlotDetail` and `getJudgingQueue`, each one query plus a pure shaping function (mirroring `week.ts`'s split), `getActiveRooms` for the room picker. `src/app/(app)/slot/[id]/actions.ts`: `joinRound` (find-or-create — joins the slot's existing `forming` round or starts a fresh one; task 2 "start" and task 3 "join" turned out to be the same database operation), `leaveRound`, `cancelRound` (creator or admin only, per the human's explicit instruction — narrower than the step file's literal "any participant," flagged as a deviation below), `setRoundRoom`. `src/lib/components/round-actions.tsx` (`JoinRoundForm`, `ClaimJudgeButton`, `LeaveRoundButton`, `CancelRoundForm`, `SetRoomForm`) using React 19's `useActionState` — a different pattern from step 09's `useOptimistic` checkbox, chosen because these are multi-field commit actions needing error display, not a binary toggle. `/slot/[id]` and a real `/judging` (forming rounds missing a judge, soonest first, filtered to exclude rounds already past and rounds the viewer is already in). Week grid slot labels now link to `/slot/[id]` — the step file never says to wire this, but the page would otherwise be unreachable. 13 new Vitest tests for the two pure shaping functions, 40/40 passing project-wide. A real bug found and fixed during live testing, not just a flagged limitation — see Deviations: the orphaned-round cleanup path silently failed because `rounds` has no delete policy at all, fixed with a second migration adding one narrowly scoped to a round's own creator, only while forming, only when it has zero participants. Verified live end to end with 6 temporary debater accounts (created and torn down through the real roster-invite + auth trigger path, not raw SQL) plus the existing seeded judge/debater/admin: a real 5-person round confirmed exactly once with the correct roster; a direct attempt to insert a 6th participant into that confirmed round was rejected by the trigger itself ("This round is not accepting new participants"); two genuinely concurrent join requests for the last open team spot on a different round resolved to exactly one success and one clean rejection, final participant count still exactly 5; a participant already confirmed on one slot was rejected joining a fresh round on that same slot, and — after fixing the delete-policy bug above — confirmed to leave zero orphaned round behind on retry; the room set on a confirmed round showed up for a participant and for a non-participant admin and was completely absent (zero occurrences, not just hidden) from a non-participant's `/slot/[id]` payload; a participant leaving a forming round left the other participant's row untouched; `/judging` correctly listed a round missing a judge, claiming it added the judge and removed it from the queue. All test rounds, participants, and temporary accounts confirmed deleted afterward. `npm run build` and `npm test` both pass. Not committed yet — human asked to report back first. |
| 11 Post-round form and completion | done | 2026-08-16 | Three migrations. `20260818000000`: `alter type round_status add value 'awaiting_result' before 'expired'` — a real status, not a display concept like step 10's "needsRoom," since the step file names it exactly like the other values and expects it surfaced on real pages. `20260818000001`: resolves the round_notes write-path decision `decisions.md` explicitly deferred to this step — insert restricted to whoever submitted the result (and only for debaters actually in that round), select extended (on top of the existing admin-only policy from step 03, which stays as-is; RLS policies for the same command OR together) to the debater the note is about *or* whoever wrote it, per the human's explicit call — not the narrower "not even the judge" reading floated during planning. `20260818000002`: `round_results` `BEFORE INSERT` trigger, `security definer`, same row-locking pattern as step 10 — validates an original submission (round must be confirmed/awaiting_result, and this must genuinely be the first result — nothing in the schema stopped two supersedes-null rows for one round otherwise) or a correction (round must be completed, supersedes must reference the current undisputed head of that exact round's chain), then sets `rounds.status = 'completed'` inline, `completed_at` set once via `coalesce` so a later correction never moves it. `src/lib/db/results.ts` — `getPostRoundForm`/`getResultsNeeded` plus pure shaping functions (room-stripping-style logic applied to notes: only the debater a note is about, whoever wrote it, or an admin ever sees it). `src/lib/components/result-form.tsx` and `/round/[id]/result` — submission form for the round's judge once the slot has started, read-only display for anyone who can already see the round (matching the existing broad `round_results_select` policy), correction form for judge/admin once a result exists. `src/lib/db/round-lifecycle.ts` + `scripts/sweep-stale-rounds.ts` — the awaiting_result/expired sweep logic, not wired to a cron route yet, same deliberate scoping as step 07's slot-generation cron. Surfaced on `/judging` ("Results needed," computed from real slot end times rather than solely trusting the status value, so it stays useful even before the sweep has ever run) and linked from `/slot/[id]`. 15 new Vitest tests, 53/53 passing project-wide. One real mid-build finding, not just a style choice — see Deviations: Next.js rejects inline (function-level) `'use server'` exports in any file a Client Component also imports for other reasons, so `submitResult`/`submitCorrection` had to move out of `results.ts` into a dedicated `src/app/(app)/round/[id]/result/actions.ts`, matching every other action file in this codebase, despite being asked to place them in `results.ts`. Verified live end to end with 4 temporary debater accounts plus the seeded judge/debater/admin: a real confirmed round's result submission flipped it to `completed` and `v_participation` went from 0 rows (confirmed) to exactly 5 (completed) for that round, confirming credit timing directly rather than trusting the view's definition still matched what step 07 saw; a debater's fetched `/round/[id]/result` page contained zero `<textarea>` elements and no submit button, confirmed the one stray form match was the layout's own sign-out form; a raw REST `PATCH` against `round_results` — first as the submitting judge, then again as an admin — returned `200` with zero rows affected both times (RLS with no update policy at all silently excludes the row rather than erroring), and the RFD in the database was confirmed byte-for-byte unchanged after each attempt; a submitted correction produced a genuinely new `round_results` row linked via `supersedes`, with the original still present, still readable, and rendered on the page under "Superseded results"; per-debater note privacy confirmed live too, not just in the unit tests — the debater a note was about saw it, a different debater in the same round did not, admin did. One practical wrinkle worth recording: the whole Fall term is still in the future relative to today's real date, so no real slot has actually started yet — the one confirmed round used for testing had its slot's `starts_at`/`ends_at` temporarily backdated via the service-role client to exercise the "slot must have started" guard, then restored to its real generated values immediately after; confirmed restored correctly. All test data and accounts confirmed deleted afterward. `npm run build` and `npm test` both pass. Not committed yet — human asked to report back first. |
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

- **2026-08-16 — step 11: `submitResult`/`submitCorrection` couldn't stay in
  `src/lib/db/results.ts` as asked — a real Next.js compiler restriction,
  found by building it, not a style call.** The instruction was to put
  `getPostRoundForm` and the two submit actions together in `results.ts`.
  Built that way first, using per-function inline `'use server'` directives
  on the two actions so `getPostRoundForm` (which takes trusted
  server-derived params and must never be client-callable) stayed a plain
  function in the same file. `npm run build` rejected it outright: "It is
  not allowed to define inline 'use server' annotated Server Actions in
  Client Components" — because `result-form.tsx` (a Client Component)
  imports types from `results.ts`, Next treats the whole file as reachable
  from client code, and inline per-function directives aren't allowed
  there, only a dedicated file with a file-level `'use server'` at the top
  is. Moved `submitResult`/`submitCorrection` to
  `src/app/(app)/round/[id]/result/actions.ts` — exactly the shape every
  other action in this codebase already uses (`week/actions.ts`,
  `slot/[id]/actions.ts`), so this ends up matching established convention
  rather than deviating from it, just not the literal file the instruction
  named. `results.ts` itself couldn't take the file-level directive instead
  — everything in a `'use server'` file must be an async function, and
  `shapePostRoundForm` is a deliberately synchronous pure function (so it's
  cheaply unit-testable without a database), so that option was never
  actually available.
- **2026-08-16 — step 10: a real RLS bug found and fixed live, a step-file
  vs. human-instruction conflict on who can cancel a round, and a design
  consequence worth flagging (rounds "fork" instead of blocking once one
  fills up).**
  - **`rounds` had no delete policy at all, so `joinRound`'s orphan cleanup
    was silently doing nothing.** Design was: if starting a brand-new round
    and the first participant insert then fails, delete the round rather
    than leave an empty one behind. Live testing caught this not working —
    a real orphaned `forming` round with zero participants was left behind
    after a deliberately-triggered failure. Root cause: `rounds` has never
    had a delete policy (deliberate since step 03, "rounds are meant to be
    an audit trail"), so the cleanup's `.delete()` call matched zero rows
    under RLS with no error raised, not a caught exception — it just
    silently no-opped. Fixed with a second migration
    (`20260817000001_rounds_delete_own_empty.sql`) adding one delete
    policy, scoped as narrowly as the cleanup case needs: the round's own
    creator, only while still `forming`, only when it has zero
    `round_participants` rows. A round with even one real participant can
    never be deleted through this policy. Re-verified after the fix: the
    exact same failure sequence that left an orphan before now cleans up
    correctly, confirmed by checking `rounds` before and after.
  - **`cancelRound` restricted to creator-or-admin, not "any participant."**
    The step file's task 4 says cancelling "any participant can do." The
    human's build instructions for this step explicitly said "admin/creator
    only" instead. Built to the human's explicit instruction (narrower),
    not the step file's literal text — flagging the conflict rather than
    silently picking one. The RLS policy itself (`rounds_update_participant_
    or_admin`) still permits any participant to update a round; the
    narrower creator-or-admin check is an app-level restriction layered on
    top in `cancelRound` specifically, so revisiting this later just means
    changing that one guard, not touching RLS.
  - **A slot can end up with more than one round once the first one fills
    up, by design — worth knowing, not a bug.** `joinRound`'s find-or-create
    only ever looks for a `forming` round on a slot. Once a round is
    `confirmed`, a 6th person joining that slot via the normal UI path
    doesn't get rejected — they start a brand-new independent round on the
    same slot (schema already allows this, no unique constraint on
    `rounds.slot_id`). Confirmed live: after a round confirmed with 5 real
    participants, a 6th person joining the same slot got `ok:true` with a
    *new* round id, not a rejection. This matches "multiple independent
    rounds can share a slot" reasoning discussed before building this step,
    but it means the acceptance criterion's "attempting to join a full
    round shows a clear message" only actually shows up at the trigger
    level (a direct attempt to add a participant to a specific
    already-confirmed round id, which is what the last-open-spot race
    exercises) — verified separately and directly, not assumed.
- **2026-08-15 — step 08: the current seed can't exercise a named-holiday
  week, so that part of the acceptance criteria only has unit coverage, not
  live-data coverage.** `getWeekGrid`/`shapeWeekGrid` distinguish a real
  school day marked as a holiday (`is_school_day = false`, with a `note`
  like "Labor Day") from a date with no `calendar_days` row at all (nothing
  generated yet) — the former renders "No school — Labor Day", the latter
  "No schedule generated for this date yet." Both paths are covered by a
  `shapeWeekGrid` unit test. But `supabase/seed.sql` (step 04) doesn't
  actually create the first kind: its `holidays` CTE excludes Labor Day and
  Thanksgiving break from `generate_series` entirely rather than inserting
  an `is_school_day = false` row for them, so with the real seeded data a
  holiday looks identical to a weekend or any other never-generated date —
  confirmed live by requesting the Sept 7 week and seeing the generic "no
  schedule" message, not a named one. Not fixed: the fix is a small,
  contained change to `seed.sql` itself, but applying it means re-running
  the whole idempotent script, which deletes and recreates
  `riverbend-academy`'s `auth.users` rows — and step 06 found that a fresh
  seed run recreates those rows *without* the `auth.identities` row /
  non-null token columns that its manual database fix added afterward
  (deliberately not folded into `seed.sql`, since nothing in the app's real
  path needs it). Re-running seed.sql now would silently undo that fix and
  break admin-API login for the seeded test users again. Flagging for the
  human's call rather than either editing an already-done step's fixture
  data unasked or actually re-running it.
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
