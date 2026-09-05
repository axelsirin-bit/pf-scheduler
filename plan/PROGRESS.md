# Progress tracker

Claude Code updates this file at the end of every step. The human reads it to
know where things stand.

## Current step

**18 — Security review, privacy, launch — done, not yet committed. This is
the last planned step; the build is ready for final human review before the
first commit and push.**

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
| 12 School onboarding and schedule config | done | 2026-08-16 | `/register` (public, outside the shell) submits via a service-role server action into `school_requests` — no new RLS policy needed there, matching decisions.md's own suggested design. `scripts/approve-school-request.ts` creates the school (`status = 'pending'`) and the first admin's `roster_invites` row by hand — no "platform operator" role exists to gate a real approval UI behind (decisions.md flags this as genuinely undecided), so this stays a script, same shape as `generate-slots.ts`. Emails deferred to step 17, same as every prior step's notifications. `src/lib/schedule/rotation.ts` — `rotationToCalendarDays`, pure, computing school days/rotation codes/holidays from either a continuous or weekly-resetting sequence; a "fixed weekly pattern" turned out not to need its own code path — it's the same function with `resetsWeekly: true`, since a fixed weekly pattern is just a sequence that never accumulates position across weeks. 17 new tests. `src/lib/db/onboarding.ts` — every wizard read/write, all through the admin's own RLS-respecting session (no new migration needed — period_templates/template_blocks/day_types/schedule_variants/calendar_days/rooms/roster_invites/school_terms/ics_sources all already had working "admin, own school" policies from step 03). Seven wizard pages under `/admin/setup/*` (basics, calendar-source, templates, rotation, rooms, roster, preview), a shared layout with step navigation, and an onboarding checklist wired into `/admin`. Two real structural findings from building this step, not just style calls — see Deviations: `upsertSlotsForRange` (step 07) had to be refactored to accept an injectable client and to unconditionally skip any slot with a live round attached, and the wizard's "nothing written to slots until confirm" turned out to compose more simply than planned by letting the rotation step write real `calendar_days` immediately (freely re-editable) while only the confirm step ever touches `slots` — meaning the preview is a literal dry run of the exact function confirm calls for real, not a second implementation that could drift. **A significant testing-methodology finding, not a build gap**: every wizard action takes a `FormData` argument (matching the `SetupForm` pattern used throughout this step), and Next's wire protocol for invoking a FormData-argument server action directly over HTTP turned out to be substantially more involved than the JSON-array protocol used for object-argument actions in steps 09-11 — it requires a `next-router-state-tree` header describing the client's current route-segment tree, which isn't practical to hand-construct accurately outside a real browser. Spent real effort on this (reverse-engineered the exact multipart field-naming scheme — `_<partId>_<fieldName>` plus a root reference field — directly from Next's compiled client source, confirmed it was necessary but not sufficient), then made the call to stop rather than keep guessing. Verified the entire step instead via direct, real execution of the underlying logic: created a real school request, ran the real approval script against it, created the new admin's real auth account through the actual front-door path (triggering the real roster-gating trigger from step 05, not simulated), then replicated every wizard step's database operations using that admin's own real access token (genuinely RLS-respecting, not the service role) — real `rotationToCalendarDays` output written as real `calendar_days`, the real (refactored) `upsertSlotsForRange` called with her injected session producing 8 real slots at correct UTC times matching the entered schedule exactly, `schools.status` flipped to `active` via her own RLS grant. Confirmed live on the real `/week` page (a GET, unaffected by the FormData issue) that those slots render correctly for the new school. Separately confirmed: dry-run preview output byte-for-byte equal to what actually committed; linking a feed touches only `ics_sources` (template/block/calendar_days counts identical before and after, confirmed by count, not assumption); a slot with a live round survived a real edit-triggered regeneration completely untouched, confirmed both with the default admin client (against real Riverbend data) and with the admin's own injected RLS client (against the test school), with the round removed and the label correctly restored afterward each time. All test data — the test school, its calendar/templates/slots, the admin's auth account, the school request — confirmed fully deleted afterward; the real Riverbend data used for the protection tests confirmed to have zero lingering test artifacts. What genuinely was not verified: an actual browser click submitting one of these forms — the acceptance criteria are verified at the database/RLS/logic level with the same rigor as every prior step, but not via the literal HTTP form-submission path this one time. `npm run build` and `npm test` (62/62) both pass. Moved up from its old position after admin console — see Deviations below, "v1 is school-agnostic starting at step 04." Not committed yet — human asked to report back first. |
| 13 Leaderboard | done | 2026-08-16 | `src/lib/db/leaderboard.ts` — `shapeLeaderboard(entries, userId, expectedRoundsPerTerm)`, a pure function over already-named `NamedEntry[]` rows, computing `onTrack` from `totalRounds >= expectedRoundsPerTerm` rather than trusting a passed flag, and producing three views of the same data: `onTrack` (alphabetical, unranked), `topFive` (ranked by `totalRounds` desc, alphabetical tiebreak, sliced to 5), and `currentUser` (found by id regardless of rank, `null` if the viewer has zero rows anywhere). `getLeaderboard`/`getParticipationBreakdown` fetch `profiles` (active, own school) and `v_leaderboard` (left join semantics done in JS via a `Map` keyed by `user_id`, since `v_leaderboard` has no foreign key back to `profiles` and PostgREST can't embed it) plus `schools.expected_rounds_per_term`, defaulting anyone missing from `v_leaderboard` to zero rather than excluding them — a student with zero completed rounds still needs to appear on the board. `getParticipationBreakdown` is the same shape with `full_name` instead of `display_name` and no on-track/top-five split, just one sorted table. One design correction made mid-build, not asked for: the first draft passed a `displayNameOf` callback into the shaping function and re-applied it in a second pass; recognized this as needlessly indirect and rewrote to attach `displayName`/`fullName` before shaping, so `shapeLeaderboard` takes fully-named rows and nothing else. `/leaderboard` — term selector via plain `Link` navigation (`?term=<id>`, matching `/admin/participation`'s existing `TermPicker` pattern from step 12 rather than inventing a second one), defaults to whichever term's date range contains today via `todayInTimezone`, three sections built from one `getLeaderboard` call ("Your progress" highlighted, "Top five" table, "On track" list) — `display_name` only, `full_name` never fetched for this page at all, not just hidden in the UI. `/admin/participation` — `RequireRole role="admin"`, reuses `getSchoolTerms`/`TermPicker`, `Breakdown` shows `full_name` + all four columns for every active member. Query-fetching kept inside a nested async component (`ParticipationContent`) rather than the top-level page function, same reasoning as `/judging` in step 10: `RequireRole`'s `notFound()` has to actually happen before any of this step's queries run, not just before the result is displayed. Linked from `/admin`. 9 new Vitest tests for `shapeLeaderboard` (on-track sourced from computed totals not a passed flag, alphabetical on-track ordering, ranked top-five with alphabetical tiebreak, exactly-5 cap, `currentUser` found at any rank, `currentUser` null when absent, `expectedRoundsPerTerm` passthrough, debate/judge counts kept separate), 70/70 passing project-wide. All 5 scenarios verified live against the real dev server, real seeded accounts, and real Fall 2026 slots — no FormData issue here since both pages are read-only GETs, unlike step 12: (1) four completed rounds in one week for one debater, judged by the seeded judge — `/leaderboard?term=<Fall 2026>` for that debater showed "2 of 8 · 2 debate, 0 judge," confirming the weekly cap (step 07's `v_participation`) flows through correctly, not just that four rounds existed; (2) the judge's own row in the top-five table showed debate=0, judge=2, total=2 for the same four rounds, confirming debate and judge credit are tracked as genuinely separate counters, not one shared tally; (3) a second temp debater whose only round that week was `expired` (not completed) showed 0/0/0 despite appearing in the top-five table, confirming an expired round credits nobody, matching `v_participation`'s own definition rather than a page-level filter papering over a view that might still count it; (4) switching from the real Fall 2026 term to a newly-created, deliberately non-overlapping "LB Test Term 3 (Winter)" (Dec 19-31, 2026, in the real gap between Fall 2026 and Spring 2027) showed distinct data for the same user — "2 of 8" under Fall, "1 of 8" under Winter — confirming term filtering genuinely scopes the query rather than showing the same totals regardless of which term is selected; (5) grepped the debater's fetched `/leaderboard` HTML for the real seeded users' actual surnames ("Chen," "Nguyen," "Patel") and found zero matches, confirming `full_name` never reaches a debater's payload at all. Also verified, not explicitly asked for but a natural counterpart to (5): `/admin/participation` as the seeded admin does show "Casey Nguyen" and "Riley Chen" in full, and the same page as a debater session returns a real 404, confirming `RequireRole` gates it correctly. All test fixtures — two temp debater accounts, the four week rounds plus one expired round plus one term-2 round on real Fall 2026 slots, the Winter test term and its manually-created `calendar_days`/`slots` row — confirmed fully deleted afterward via a follow-up query showing zero remaining rows in every category. `npm run build` and `npm test` (70/70) both pass. Not committed yet — human asked to report back first. |
| 14 Round archive | done | 2026-08-16 | One migration (`20260819000000_round_links_completed_only.sql`): `alter policy round_links_insert_participant_or_admin ... with check (...)` adds one more clause — the parent round must be `status = 'completed'` — matching how every other invariant in this codebase (round capacity in step 10, result validation in step 11) is pushed into the database rather than left as an app-only check; select/update/delete on `round_links` are unaffected. `round_links` itself, its full RLS policy set (select/insert/update/delete), and its own `check (url ~* '^https://(drive|docs)\.google\.com/')` constraint all already existed from steps 02-03 — this step only needed the one status clause added, not new infrastructure. `src/lib/db/archive.ts` — `shapeArchiveRound`/`shapeRoundDetail` (pure, no DB access) each map one raw completed round into display shape, matching its slot to a term by date range in the school's own timezone (there's no stored `term_id` anywhere in the schema — same approach step 13's leaderboard/participation pages use), picking the current non-superseded result via a small duplicated `pickCurrentResult` helper (same logic as `results.ts`'s chain-walking, small enough not to share). `shapeArchive` (pure) is the actual filter function named in the human's instructions — takes the already-shaped list and the four filters (person/term/video/q), combines them with AND, sorts newest first. `getArchive`/`getRoundDetail` (impure) do the actual queries; the archive list query only selects `round_links.kind` (enough for the `hasVideo`/`hasSpeechDoc` flags), while `getRoundDetail` selects the full link rows (url, label, who added it) since that's the one page that needs to render them. `round_notes` is never selected by either — a deliberate scope boundary, not an oversight: this is the public archive/round-detail view every school member can reach, not the judge-facing post-round form from step 11, and step 11's per-debater note-privacy rules have no bearing here. 17 new Vitest tests covering term-matching, video/speech-doc flag computation, supersession handling, all four filters individually and combined, sort order, and link mapping — 87/87 passing project-wide. `/archive` — one plain `<form method="get">` for all four filters (person/term dropdowns, video checkbox, RFD text input), so every filter combination is a real GET request with no JS required and no FormData wire-protocol issue to work around; stacked card list, RFD collapsed behind a native `<details>/<summary>` rather than any client-side toggle. `/round/[id]` (new route, distinct from the existing `/round/[id]/result`) — full detail plus the add-link form, gated to completed rounds only in the UI (backed by the migration's real enforcement, not just hidden). `src/app/(app)/round/[id]/actions.ts` — `addRoundLink`, an object-argument action (not the `FormData` `SetupForm` pattern from step 12) specifically so it stayed testable over raw HTTP the same way steps 09-11's actions were; validates the Google-domain restriction with a friendly message before ever reaching the database, which enforces the same rule twice over (the `check` constraint, now also the completed-only policy clause). `src/lib/components/add-link-form.tsx` — Client Component, `useActionState`, same shape as step 11's `result-form.tsx`; the Drive-sharing/visibility reminder is one plain sentence per task 6, not a bordered warning box. All 5 acceptance criteria verified live against the real dev server, two real completed rounds (created via the same forming→participants→result flow as every prior step's fixtures — confirmed the wrong order first, matching step 13's finding: a round can't be marked `completed` directly, only the real `round_results` insert trigger does that, once the round is `confirmed`/`awaiting_result`), and a genuine Test Academy account: (1) a real Google Drive link added through the actual `addRoundLink` server action (reached over raw HTTP by extracting the *dev-mode* action hash from `.next/dev/server/app/(app)/round/[id]/page/server-reference-manifest.json` rather than the production build's manifest — the two are genuinely different files with different hashes, a new wrinkle this step surfaced, not seen in steps 09-11's HTTP testing since those were all tested against a production build) rendered in the re-rendered page's RSC payload as a real `<a href="https://drive.google.com/...">`; (2) the same action called with a non-Google URL returned `ok:false` with the exact clear message, and a direct query confirmed zero rows were ever written for that URL; (3) searching `/archive?q=zzzznimbus` returned only the one round whose real RFD contained that phrase — confirmed by grepping the response for both rounds' distinguishing dates, the target round's present, the other round's date and its own distinct RFD phrase both absent; (4) a genuine Test Academy debater account, queried directly with its own real access token (not the service role, not through the app's UI, matching the human's explicit "verified by querying with their session directly" instruction) against `rounds`/`round_results`/`round_links`, saw zero rows across all three despite Riverbend's real fixture data existing at the time of the query; (5) grepped every new/modified file for `type="file"` — zero matches. All test fixtures — 4 temp Riverbend debater accounts, 1 temp Test Academy account, both completed rounds and their participants/results/links (cascade) — confirmed fully deleted afterward via a follow-up query showing zero remaining rows in every category. `npm run build` and `npm test` (87/87) both pass. Not committed yet — human asked to report back first. |
| 15 Admin console | done | 2026-08-16 | **Task 4 (the two-admin roster lock) was dropped entirely per the human's explicit instruction** — asked directly before building, given no schema anywhere already supported "confirmed by another admin," and the human answered plainly: no lock, admins invite freely once the school is approved. Not in this step's acceptance criteria either, so nothing here is a gap against what's actually being graded — see Deviations. Two migrations. `20260820000000_admin_console.sql`: a single reusable `write_audit_log()` function (`security definer`, reads `TG_OP`/`TG_TABLE_NAME`/`OLD`/`NEW`) attached to `roster_invites` and `rooms` (insert/update/delete) and to `profiles` with a `when` clause limiting it to `roles`/`is_active` changes only — deliberately excludes routine updates so a future `last_seen_at` bump (this step starts writing it) never floods the log; `audit_log` still has zero insert/update/delete policies for any role from step 03, so this trigger is the *only* way a row is ever written or could ever be, which is what actually backs "cannot be edited or deleted by anyone" rather than just a UI omission. `roster_invites_rate_limit()` (`before insert`): a fixed 10/hour school-wide constant, same treatment as step 11's hardcoded 150-character RFD minimum rather than a new `schools` column, marks the row `needs_approval = true` once the rolling-hour count is exceeded — the human confirmed this design directly (see Deviations). `roster_invites_approve_check_trigger`: rejects setting `approved_by` to the same person as `invited_by`, the actual "one compromised admin account cannot quietly add users" control task 3 names. `handle_new_user_roster_gate()` (step 05's trigger, `create or replace`, same trigger still attached) now also rejects sign-up for an invite that's still `needs_approval` and unapproved. `20260820000001_roster_invites_invited_by_default.sql`: a same-day follow-up fixing a real gap found during this step's own live verification, not a separate later bug — see Deviations. `src/lib/schedule/week-bounds.ts` gained `dateInTimezone`, extracted from an identical block that had been inlined twice in `archive.ts`'s two shaping functions (step 14) and was about to become a third copy in `admin.ts`; both existing call sites refactored to use it, re-verified against the full test suite. `src/lib/db/onboarding.ts`: `getRosterInvites` extended to select `id`/`needs_approval`/`approved_by`/`invited_by` (previously only `email`/`roles`/`claimed_at` — needed for this step's UI, harmless additions for the wizard's own minimal roster step which only reads the fields it already used); `inviteRosterMembers`'s `RosterInviteOutcome` gained `needsApproval`, read back via `.select('needs_approval')` rather than recomputed, since the rate-limit trigger is the actual source of truth. `src/lib/db/admin.ts` (new): `getAdminOverview` + pure `shapeRoundsSummary` (completed this week/term, awaiting-result list with computed `hoursOverdue` sorted worst-first, expired this term — task 1's opening line, "showing, for the current term," read as scoping the whole list including the week figure and the expired count, not just the two items that say "term" explicitly), `getRosterMembers` (admin-only, `full_name` + every member regardless of `is_active`), `getAllRooms` (unlike `rounds.ts`'s `getActiveRooms`, includes inactive ones — the console needs to show and reactivate them), `getAuditLog`. 8 new Vitest tests for `shapeRoundsSummary`, 95/95 passing project-wide. `/admin/roster`: reuses `RosterForm`/`inviteRoster` from step 12's wizard directly (imported, not duplicated, per the literal task 2 instruction) — the one piece of this step that inherited step 12's known FormData-over-raw-HTTP testing gap, verified instead the same way step 12 was, via a real RLS session; member list with deactivate/reactivate, pending-invite list with approve/revoke, all four of those as object-argument actions and fully HTTP-testable. `/admin/rooms`: reuses `createRoom` (the underlying function, not the wizard's FormData form) for add, new object-argument `updateRoom`/`setRoomActive` for edit/deactivate — a deliberate asymmetry from the roster page's exact-form reuse, flagged in Deviations rather than silently inconsistent. `/admin/audit`: read-only table, before/after diff behind a native `<details>`. `/admin` overview rewritten: nav links to the three new pages, the "zero rounds this term" list surfaced first and visually distinct (amber box) per the step file's own "the one item a coach will actually use, so make it prominent," then the four stat tiles and the awaiting-result list linking to each round's result page. **A real, load-bearing gap found and fixed, not just a nice-to-have — see Deviations**: nothing anywhere previously checked `profiles.is_active` on sign-in or on an existing session, so "deactivating prevents sign-in" (task 2, and an explicit acceptance criterion) would have been false the moment it was tested. Fixed in two places: `getCurrentUser()` (catches an already-live session immediately — the more consequential of the two, since Supabase sessions auto-refresh and outlive the moment of deactivation) and `/auth/callback` (blocks a fresh sign-in attempt with a real error message rather than silently succeeding into a broken app). `last_seen_at` — a column that has existed since step 02 but was never once written anywhere — now gets set once per real sign-in in the callback route, not per page view, matching task 2's "last sign-in" wording and keeping the profiles audit trigger's `when` clause meaningful (it would otherwise fire on every visit). All 5 acceptance criteria verified live against the real dev server and real seeded/temporary accounts, not simulated: (1) a real invite inserted through `admin@riverbend.test`'s own real RLS session produced exactly one matching `audit_log` row with `actor_id` equal to that admin's real id; (2) `deactivateMember` called for real over HTTP (object-argument, no FormData issue) against a temp debater with one real completed 5-person round — the debater's own still-live session hitting `/week` immediately 307-redirected to `/sign-in?error=deactivated`, and the completed round's full detail (name, winner, RFD text) was still fully rendered on `/round/[id]` fetched by an unrelated admin session afterward, confirmed byte-for-byte still there, not hidden; (3) 30 real invites inserted in one loop through the admin's real session created all 30, with 26 landing as `needs_approval = true` once the rolling-hour count passed 10 — the exact split isn't the criterion, "some got flagged" is, and it held; (4) `admin@riverbend.test`'s real session, crafting a raw insert with Test Academy's `school_id` instead of their own, was rejected outright by RLS ("new row violates row-level security policy"), zero rows created; (5) both an `UPDATE` and a `DELETE` against a real `audit_log` row, attempted with the same admin's real session, affected zero rows each (no policy exists for either, so RLS silently excludes rather than errors — same "no-op, not an error" behavior step 09/10 already found elsewhere), row confirmed byte-for-byte unchanged afterward. All test fixtures — 5 temp accounts, the fixture round and its participants/result, every test `roster_invites` row (including all 30 bulk ones), and the 173 audit-log rows that testing itself generated (deleted via the service role specifically, since nothing else can touch `audit_log` — legitimate cleanup, not the tamper case criterion 5 already ruled out) — confirmed fully deleted afterward via follow-up queries showing zero remaining in every category. `npm run build` and `npm test` (95/95) both pass. Not committed yet — human asked to report back first. |
| 16 ICS import | done | 2026-08-17 | No migration needed — `ics_sources`/`ics_import_batches` already existed with full admin-only RLS from step 03, `summary_mapping`/`diff` jsonb columns already anticipated this step exactly. New dependency `node-ical` (asked first, per CLAUDE.md), confirmed with the human before installing. `src/lib/schedule/ics.ts`: `parseIcsFeed` (pure — all-day event dates read literally since they carry no timezone, `ical.expandRecurringEvent` handles RRULE expansion) and `fetchIcsFeed` (the actual network call, wrapped so failure is a typed result, never a thrown error a caller could forget to catch). `src/lib/db/ics-import.ts`: `resolveCalendarDays` (pure — applies the saved `summary_mapping` to raw events, last-mapped-event-wins on a same-date collision, unmapped summaries surfaced separately rather than guessed) and `computeDiff` (pure — added/changed/removed, each carrying `openSlotsAffected`/`protectedRounds` computed against the exact same "not cancelled or expired" definition `upsertSlotsForRange` (step 07/12) already uses to decide what it will never touch, so the diff's language and the regeneration's actual behavior can never disagree). `syncIcsSource`/`approveBatch`/`rejectBatch`/`overrideConflictEntry` (impure, injectable client matching `upsertSlotsForRange`'s own pattern) — approving writes non-conflicting entries to `calendar_days` (`source: 'feed'`), closes (never deletes — schema.sql's own "nothing is ever hard deleted" rule) any now-orphaned open slot with no protected round, then calls the existing `upsertSlotsForRange` to regenerate. A conflicting (manually-set) entry is excluded from the bundled approval entirely and needs its own explicit per-date override, the real mechanism behind "lets the admin choose" (task 5). `getSchoolTerms` (onboarding.ts) gained an optional injectable `client` param — the cron route and scripts have no session for its old hardcoded dynamic-import client to resolve. `/admin/schedule/feed`: URL config, an ephemeral "test fetch" (task 1, no batch created, nothing written) showing distinct summaries with an inline per-summary mapping form (day type via a `<datalist>` of existing codes, so new ones can still be typed in — find-or-create at write time, same pattern `saveRotation`'s manual path already uses), "Sync now," and a list of recent batches. `/admin/schedule/feed/batches/[id]`: the diff in plain language ("{date} changes from {before} to {after}. This closes N open slot(s) and leaves M round(s) in progress untouched."), conflicts shown in their own section with a per-date override button, approve/reject for the bundle. `src/app/api/cron/sync-ics/route.ts` + `vercel.json` (daily, 11:00 UTC): the first real Vercel cron route this project has ever wired, rather than the standalone-script pattern steps 07/11 used — the human confirmed this explicitly before it was built (see step 15's precedent and this step's own kickoff). Protected by a generated `CRON_SECRET` compared against the request's `Authorization` header; **the human needs to add this same value to Vercel's project environment variables when deploying** — it's already in `.env.local` (gitignored) for local testing, but nothing propagates it to Vercel automatically. Reused `RosterForm`-style FormData avoidance throughout: every action here takes typed arguments, not FormData, so this step's whole surface stayed fully HTTP-testable the way steps 09-11/13-15 were, unlike step 12's wizard forms. 19 new Vitest tests (6 for `parseIcsFeed`, 13 for `resolveCalendarDays`/`computeDiff`), 117/117 passing project-wide. All 6 acceptance criteria verified live against a real locally-served ICS file (a generated fixture, not a real school's feed, per the human's explicit choice — fully controlled, guaranteed to exercise recurrence/all-day/multiple-summaries on purpose) and the real Riverbend school: (1) a real `testFeedAction` call against the served feed returned all 5 distinct summaries; (2) approving a real batch actually wrote `calendar_days` (a brand-new Saturday got 5 real generated slots; an existing weekday's day type changed and its slots regenerated) and closed 4 of a date's 5 slots while leaving the 5th — the one with a real confirmed round on it — untouched, `is_open` still true, the round still `confirmed`; (3) a second real batch, rejected, left both of its target dates byte-for-byte unchanged, confirmed by snapshotting before and after; (4) a manually-set date was excluded from the first batch's bundled approval entirely (confirmed unchanged), then applied for real via the dedicated override action, confirmed changed only at that point; (5) pointing the source at an unreachable URL produced a real fetch failure, `ics_sources.last_status`/`last_error` recorded, zero batch created, and the two most recently-touched calendar days confirmed still byte-for-byte identical to their pre-failure state; (6) the pending batch's own page, fetched before any approval action, already read "closes 4 open slot(s) and leaves 1 round(s) in progress untouched" — the exact acceptance criterion, not a paraphrase. All test data (calendar day edits reverted to their exact original values, the fixture round and its participants, temp accounts, the `ics_sources` row and its batches) confirmed cleaned up via follow-up queries. `npm run build` and `npm test` (117/117) both pass. Two real bugs found and fixed during this step's own live verification, not shipped broken — see Deviations. Not committed yet — human asked to report back first. |
| 17 Notifications and reminders | done | 2026-09-05 | Resend chosen (human's call, API key to be added at deploy time — see Deviations for the local-testing gap this leaves). One migration (`20260821000000_notifications.sql`): `notifications_sent` gained an `entity_id` column and its original single unique index was replaced with two **partial** unique indexes — one scoped to `round_id is not null`, one to `entity_id is not null` — because Postgres never treats two `NULL`s as equal in a unique index, so the original `(kind, round_id, user_id)` index gave zero real deduplication for the two admin-only notifications (rate-limit approval, calendar import), whose `round_id` is always null; found and fixed before ever writing the notification code that would have silently relied on it. `profiles.email_preference` (`'all' | 'my_rounds'`, default `'my_rounds'`) plus a third `create or replace` of `handle_new_user_roster_gate()` (step 05, already touched by steps 15/16) setting the role-based default — admins get `'all'`, everyone else `'my_rounds'` — confirmed live against real new signups, not just read from the migration. `src/lib/email/templates.ts` — six templates (four round emails, two admin emails), plain text first, minimal inline-styled HTML second, no images or external CSS; subject lines match the step file's own example format exactly ("PF round confirmed: Wed P3, Room 214"). `src/lib/email/send.ts` — the only function anything may call to actually deliver mail; dev mode is the default (`RESEND_DEV_MODE !== 'false'`, not `=== 'true'`) so a fresh clone or misconfigured environment logs instead of emailing real people, and production has to opt in explicitly, which doubles as task 6's "verified by a deliberate test send." `src/lib/email/notify.ts` — one function per email kind, all reading through the admin client regardless of caller (a real user session can't see a peer's actual email address at all, only `display_name`, so this is the one legitimate place that needs to). Idempotency (`claimAndSend`): the `notifications_sent` row is inserted *before* the send, not after — a genuine double-run fails the second insert on the unique index and never attempts a second send; if the send itself fails after a successful claim, the claim is rolled back so a later run retries instead of silently never emailing that person again. **A real design interpretation, not a literal reading**: "all emails" (task 5) was read as "every round email across the whole school," not merely "every kind of email about my own rounds" — the latter reading gives the toggle nothing to actually do, since every round email already goes to that round's real participants regardless of preference; the former is also the only reading that explains why admins specifically default differently (oversight into the whole team, not just their own rounds). `getSchoolTerms`-style role-based defaults aside, this was flagged to the human as the step's one genuinely debatable call. Round-confirmed hooks into `joinRound` (`slot/[id]/actions.ts`): re-fetches the round's status fresh after the insert, since the trigger's confirm-or-not decision isn't visible from the insert's own result, and fires the email only when it just became `confirmed`. Round-cancelled hooks into the existing `cancelRound`, excluding whoever took the cancelling action. Both admin emails hook into their step 15/16 origin points exactly where those steps' own PROGRESS entries said they would (`inviteRosterMembers`'s `needs_approval` branch, `syncIcsSource`'s non-empty-diff branch) — step 16's cron route literally had a comment marking the spot. `src/lib/db/reminders.ts` + `src/app/api/cron/round-reminders/route.ts` (hourly, `vercel.json`) — one route covering both "round tomorrow" (confirmed, slot is tomorrow in the school's own timezone, confirmed more than 24h before its own start) and "result needed" (3h/48h after slot end, keyed by real end time rather than round status, same reasoning `results.ts`'s `shapeResultsNeeded` already established in step 11), same "one cron, multiple passes" shape as `round-lifecycle.ts`'s sweep. `/settings` (new, not admin-gated — every signed-in user gets one) — the two-option radio toggle, self-updates via the existing `profiles_update_self_or_admin` RLS policy (`email_preference` was never on the self-update trigger's blocked-columns list, so no policy change was needed). 27 new Vitest tests (11 for the six templates, 10 for `selectReminderCandidates`'s tomorrow/result-needed eligibility, plus the pre-existing suites) — 138/138 passing project-wide; caught and fixed a real bug while writing them, not after: `selectReminderCandidates` called `todayInTimezone()` internally, which always reads the live system clock regardless of the `now` parameter passed in, making the function secretly impure and the very first test fail nondeterministically depending on when it ran — fixed by deriving "today" from the `now` parameter via the already-existing `dateInTimezone` helper instead. All 4 of the human's named test scenarios verified live end to end with real temporary accounts, a real confirmed round, and a real cron invocation, dev mode on throughout (no `RESEND_API_KEY` configured at all this session, so every send this step ever attempted went through the console-logging path — see below): (1) a real 5-person join sequence produced exactly 7 `notifications_sent` rows for `round_confirmed` — the 5 real participants once each, plus the 2 accounts with `'all'` preference, zero duplicates, confirmed by exact set comparison against expected recipient IDs, not just a row count; (2) a real confirmed round (a manually-created calendar day + slot for the real "tomorrow" date, since the actual server clock's tomorrow is a non-school Sunday, backdated `confirmed_at` to 48h prior — same "reuse Riverbend's real Standard variant/template" fixture technique steps 13/16 established) hit by the real cron endpoint twice: first run created exactly the expected 6 `notifications_sent` rows and logged 6 real send attempts; second run reported the identical eligibility count but created zero new rows and the console log shows zero additional send attempts — not just no duplicate rows, no duplicate *attempt*; (3) flipping a test admin's preference from the default `'all'` to `'my_rounds'` mid-test correctly excluded them from the very next broadened round-tomorrow send, while a non-admin left on `'all'` kept receiving it, confirming the toggle is genuinely per-user rather than admin-specific; (4) grepped the entire dev server console log for any mention of "resend" or a real API failure — zero matches across all 20 dev-mode log entries this session, confirming every single send stayed local. **A real inconsistency found and fixed during this same verification pass, not shipped broken**: `notifyRoundCancelled` was written without the `'all'`-preference broadening that `notifyRoundConfirmed`/`notifyRoundTomorrow` both have — caught by noticing the cancelled-round test only logged 4 recipients when a 5th (the `'all'`-preference observer) should have been included per the toggle's own stated meaning; fixed and re-verified live, now 5 recipients including the broadened one. Not independently re-verified this session, per reasoned scope decisions rather than oversight — see Deviations: the `inviteRosterMembers` → rate-limit-approval-email wiring (inherits step 15's already-documented FormData untestability for that exact function) and the `syncIcsSource` → calendar-import-pending-email wiring (would have required rebuilding step 16's whole local-ICS-server test harness for one conditional call); both rely on code review of a simple, direct call plus the same `claimAndSend`/idempotency mechanism already proven live three other ways this step. All test fixtures (6 temp accounts, 2 test rounds and their participants, the manually-created "tomorrow" calendar day and slot) confirmed deleted afterward via follow-up queries showing zero remaining in every category. `npm run build` and `npm test` (138/138) both pass. **The literal "all emails render legibly in a phone mail client, checked on a real phone" acceptance criterion could not be attempted at all this session** — it requires a real `RESEND_API_KEY`, which was not actually present in `.env.local` despite being expected to be there, and a real device on the human's end regardless; flagged plainly rather than claimed. Not committed yet — human asked to report back first. |
| 18 Security review, privacy, launch | done | 2026-09-05 | **Go/no-go modified by the human before this step started**: "credentials held by at least two people including an adult" removed — proceeding with credentials held by the human only. All 26 verification-checklist items re-run fresh against the live system and recorded below. **Tenancy** (4/4): as a real Test Academy session, `profiles`/`slots`/`rounds`/`round_results`/`round_links`/`availabilities` all returned zero rows for real-school ids (PASS); a real Riverbend admin session inserting a `roster_invites` row with Test Academy's `school_id` was rejected outright by RLS, zero rows created (PASS); `npm run verify:rls` (needed a fresh personal access token from the human, same recurring requirement as steps 03/08/12) ran 10/10 assertions passing after fixing two real regressions in the script itself — see Deviations; a direct query of `pg_class.relrowsecurity` joined against `pg_namespace` for the `public` schema returned zero rows, confirming no table anywhere has RLS disabled (the step file's own literal second RLS acceptance criterion, distinct from `verify:rls`'s assertions). **Room exposure** (2/2, all live over real HTTP against a real dev server, not code review alone): a real confirmed round's room appeared as "Confirmed · Room 101" to a participant and just "Confirmed" (room absent from the payload, not hidden by CSS) to a non-participant on both `/week` and `/slot/[id]`; `/round/[id]` (the archive detail page) never fetches room fields for anyone, participant or not, confirmed both by code review (`getRoundDetail`'s select never touches `room_id`/`room_freetext`/`rooms`) and by live HTML inspection finding zero occurrences either way. **Result immutability** (4/4): a real `round_results` row directly `PATCH`ed via the REST API by the submitting judge, a different judge, and an admin all returned `200` with zero rows affected (RLS silently excludes rather than errors, same behavior step 11 already found) and the RFD was confirmed byte-for-byte unchanged after all three; a real correction inserted with `supersedes` set produced a genuinely new row, with the original still present and readable. **Secrets** (4/4): the real service role key value has zero matches anywhere in the repo outside `.env.local` and zero matches in a freshly-rebuilt `.next/` output; the 6 files importing `lib/supabase/admin.ts` (2 cron routes, `register/actions.ts`, `round-lifecycle.ts`, `slots.ts`, `email/notify.ts`) confirmed to have no `'use client'` and to be unreachable from any of the repo's 17 real Client Components, on top of the pre-existing runtime `throw` guard in `admin.ts` itself; both cron routes returned real `401`s for a missing or wrong `Authorization` header. **Access control** (4/4): a real `createUser` call for an email with no roster invite failed at the database level (the step 05 trigger) and left zero trace in `auth.users` afterward; a real deactivated member's Supabase session (deactivation is an app-level `is_active` flag, not a Supabase-level ban — confirmed live that Supabase auth itself still issues them a session) hit a real `307` redirect to `/sign-in?error=deactivated` on the very next protected page load, while their completed round stayed fully visible in `/archive` to an admin; a real debater session hitting `/admin` got a real `404`; a real debater session hitting `/round/[id]/result` for a round they're in got the read-only result view, not the submission form (no `rfd` field in the payload). **Data correctness** (5/5): October 2026's real generated `calendar_days` show a correct unbroken Day 1→2→3→4 cycle skipping only weekends, matching the rotation config Riverbend was seeded with in step 04 — the only "published calendar" that exists in this school-agnostic build (see decisions.md); a real slot on Oct 30 (EDT) and one on Nov 3 (EST, after the real Nov 1 2026 US fall-back) both rendered as the identical correct local wall-clock time despite a different underlying UTC offset, confirming the DST math survives the transition; querying `v_participation` directly for a real debater with 4 real completed rounds in one week showed exactly 2 rows for that week (the weekly cap, applied in SQL, not a page-level filter) and the real expired round in the same fixture set produced zero rows anywhere; a real `upsertSlotsForRange` re-run across the whole school year left the total slot count and round count byte-identical (392 updated in place, 0 created, 7 skipped because they had live rounds attached) and a real round's `slot_id` was confirmed unchanged. **Notifications** (3/3): a real `notifyRoundConfirmed` call against a real 5-person confirmed round produced exactly 5 `notifications_sent` rows, one per participant, with a second call producing zero new rows and zero new console log entries; the real `round-reminders` cron hit twice against a real round manufactured to be "result needed" (a genuine slot that ended ~23 hours earlier, no result yet) created exactly one new row on the first run and zero on the second, while `sync-ics` run twice both times did nothing (no feed configured) — a true idempotency test, not a trivial zero-vs-zero one; `RESEND_DEV_MODE=true` in `.env.local` confirmed live, and `send.ts`'s dev-mode branch never reaches the Resend client at all (no `RESEND_API_KEY` present this session, same as step 17 — never touched, because dev mode short-circuits before that code path). `/privacy` (what's collected/never collected/who sees what/retention/deactivation request) and `/terms` (13+ age requirement, no self-serve sign-up, no warranty) written as new public pages, generic — no Riverbend-specific facts, since the school is still fictional per CLAUDE.md rule 7 — and linked from `/sign-in`; both had to be added to `PUBLIC_PATHS` in `src/proxy.ts`; without that they real-307-redirected to `/sign-in` for a signed-out visitor, the exact failure mode this step's own room/access checks were watching for elsewhere, caught live before shipping rather than assumed. `docs/for-coaches.md` written — one page covering what the app does and doesn't do, the `/register` → wizard → roster flow, what to expect day to day. `README.md` written from scratch (none existed before this step, `README-FIRST.md` is meta-documentation about the plan scaffold, not this) — every env var actually referenced in the codebase (grepped, not recalled) with required/optional and what each does, the Supabase project setup and CLI linking steps, migration/seed/slot-generation order, every npm script, every one-off `scripts/*.ts` file's real purpose, and a deploy section covering `vercel.json`'s two cron jobs and why `/api/cron/*` is excluded from the session gate. `docs/RUNBOOK.md` written on the human's explicit follow-up instruction (originally flagged as a step-file deliverable outside the 6-item build list, not built until asked): broken/stuck calendar feed (check `ics_sources`/pending batches, manual re-sync, reject, per-date override), a stuck round (cancel vs. correction vs. the real "only the actual judge can submit an original result, no admin override" constraint), deactivating a user (exactly what changes vs. what's preserved, sourced from the real `deactivateMember`/`reactivateMember` code and the `profiles_restrict_self_update` trigger finding below), rotating each of the app's real secrets (service role key, anon key, `CRON_SECRET` — including the Vercel-auto-sends-the-bearer-header-from-this-exact-env-var-name behavior, `RESEND_API_KEY`, the Google OAuth client secret held entirely in Supabase's own config, a developer's personal CLI token) with where each lives and how to rotate it, and database backup/restore kept deliberately generic about exact dashboard UI (plan-tier-dependent, not worth hardcoding wording that could go stale) but concrete about the procedure and the point that an untested backup is a hypothesis. **A real, load-bearing gap surfaced while writing the "stuck round" section, not invented for the runbook**: `sweepStaleRounds()` (the confirmed→awaiting_result→expired transition logic, built in step 11) has never been wired to any scheduled cron — only the reminders cron runs on a schedule; the sweep only ever runs when someone invokes `scripts/sweep-stale-rounds.ts` by hand. Documented plainly in the runbook rather than silently building the cron wiring as an unrequested fix; flagging it to the human in this step's report as something worth closing before it causes a real "why hasn't this round expired" question in production. **Go/no-go, final check**: all 26 checklist items now have a recorded pass with notes (none failed); `/privacy` and `/terms` exist and are linked from `/sign-in`; `README.md` takes a second developer from clone to running locally (every env var, Supabase setup, migrations, seed data, every npm script); the only modified go/no-go criterion (credential custody) was the human's own explicit call, not a workaround — nothing is blocking launch. `npm run build` (all 30 routes, including the two new static `/privacy`/`/terms` pages, zero type errors) and `npm test` (138/138, unchanged — this step added no unit-testable pure functions) both pass, re-confirmed after the `verify-rls.sql` fixes and the new docs. The step file's "get an underclassman into the codebase" and the credential-custody checklist item (explicitly removed by the human) remain pure human/organizational actions with no code deliverable. All fixture data from this step's live verification — 6 temp Riverbend accounts (`sr-d1`–`sr-d4`, `sr-deactivate`, plus one email that was only ever rejected at the trigger and never actually created), 9 rounds and their participants/results/links, 1 availability row, all associated `notifications_sent` rows, and the `rls-test-school-a`/`rls-test-school-b` fixtures created and torn down by each `verify:rls` run itself — confirmed fully deleted afterward via follow-up queries showing zero remaining in every category. A real slot regeneration run performed as part of the data-correctness check was not reverted, since it's idempotent by design and changed nothing (0 created, `Round A`'s slot id unchanged). Not committed yet — human asked to report back first. |

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

- **2026-09-05 — step 18, second pass: `scripts/verify-rls.sql` (written in
  step 03) had been silently broken by two later steps' own migrations and
  had apparently not been re-run live since — this step's "re-verify for
  regression" instruction caught exactly what it was meant to catch.**
  - **Its own round-A fixture could no longer reach a `round_results`
    insert.** Step 11's `round_results_before_insert` trigger (added
    months after this script was written) rejects an original submission
    unless the round is already `confirmed`/`awaiting_result`; the
    script's fixture round was left at its `insert` default (`forming`)
    with no participants ever added to earn confirmation the normal way.
    First live re-run since step 11 shipped failed with "This round is not
    ready for a result." Fixed with a direct `update rounds set status =
    'confirmed' ...` before the `round_results` insert — a plain `UPDATE`
    fires no trigger, and this script's round A never needed a real
    5-person roster for what it actually tests (append-only immutability,
    cross-school link visibility), so seeding one just to satisfy the
    trigger would have been unnecessary complexity for no added coverage.
  - **Its cleanup step then failed on a foreign key violation** once the
    first bug was fixed and the script ran further than it ever had
    before: `set_config('request.jwt.claims', ..., true)` is
    transaction-local, not statement-local, and `supabase db query -f`
    runs an entire script as one transaction — so `request.jwt.claims`
    (and therefore `auth.uid()`) was still resolving to the last test
    subject (`admin_a`) during the cleanup `delete from auth.users`
    afterward. That delete cascades into a `roster_invites.claimed_by`
    update, which fires step 15's `roster_invites_audit` trigger, which
    calls `write_audit_log()`, which inserts `audit_log.actor_id =
    auth.uid()` — referencing `admin_a`'s own `profiles` row, which by
    then had already cascade-deleted in the same statement. Fixed by
    explicitly resetting role and `request.jwt.claims` at the end of the
    assertions block, before cleanup runs. Neither bug is a production
    security issue — both are test-fixture staleness in a script that
    predates the triggers it tripped over — but both are recorded here
    because "the script exits 0" had apparently been standing in for "RLS
    is verified" for at least two steps' worth of migrations without
    anyone noticing the script itself no longer completed. Re-run clean
    after both fixes: 10/10 assertions pass, zero fixture rows of any kind
    left behind afterward.
- **2026-09-05 — step 18, first pass: a real defense-in-depth property found
  (not a bug) while building live fixtures, and two routing gaps in
  `proxy.ts` found and fixed for the new public pages.**
  - **The service-role client cannot flip `profiles.is_active`, even
    though it bypasses RLS entirely.** Discovered while building a
    deactivated-member fixture: `admin.from('profiles').update({
    is_active: false })` using the service role key failed with `Only an
    admin can change roles, school_id, or is_active` — the
    `profiles_restrict_self_update` trigger from step 03 checks
    `auth_has_role('admin')`, which resolves against the calling session's
    JWT, not against whether the caller holds the service-role key. A
    service-role call has no session at all, so the check fails the same
    way a plain debater's would. This is a genuinely good property, not a
    bug to route around with a service-role trick: it means `is_active`
    can only ever be changed by an authenticated admin's own session (the
    real `/admin/roster` deactivate action already works this way), never
    by a raw script or a leaked service-role key alone. Fixed the fixture
    by performing the update through a real admin session's access token
    over the REST API instead of the service-role client, matching the
    production path exactly rather than working around the trigger.
  - **`/privacy` and `/terms` real-307-redirected to `/sign-in` for a
    signed-out visitor** until added to `PUBLIC_PATHS` in `src/proxy.ts`.
    `proxy.ts`'s session gate defaults to blocking anything not
    explicitly listed, and these two new pages are supposed to be
    reachable without an account (linked from `/sign-in` itself) — caught
    live via a real unauthenticated `curl` before reporting this step
    done, not assumed from the page code alone.
- **2026-09-05 — step 17: a schema design gap found and fixed before it
  could matter, one interpretation call on the preference toggle's actual
  meaning, an inconsistency between the four round emails found during
  live verification, and a testing-methodology limit inherited from two
  earlier steps rather than a new one.**
  - **The pre-existing `notifications_sent` unique index gave zero real
    protection for the two admin-only notification kinds this step
    adds.** `(kind, round_id, user_id)` was written back in step 02 with
    round-scoped notifications specifically in mind; rate-limit-approval
    and calendar-import-pending have no round at all, so their
    `round_id` is always null. Postgres never treats two `NULL`s as
    equal for uniqueness — a composite unique index simply allows
    unlimited duplicate rows whenever any indexed column is null,
    regardless of whether the other columns match exactly. Caught by
    reasoning through the index's actual semantics before writing the
    notification code that would have quietly relied on it, not by a
    failed test after the fact. Fixed with a new `entity_id` column and
    two **partial** unique indexes (`where round_id is not null` /
    `where entity_id is not null`) — the standard fix for exactly this
    "nullable foreign key, real uniqueness needed" shape. Verified
    directly against the live database right after migrating, before
    writing any application code against it: two rows with the same
    `kind`/`user_id` but different `entity_id` both insert successfully
    (real per-entity uniqueness), a genuine duplicate is rejected with
    `23505`.
  - **"All emails" (task 5) was read as team-wide visibility, not merely
    "every kind of round email about my own rounds."** The literal
    four-email descriptions ("to all five participants") already
    guarantee a participant always gets their own round's emails
    regardless of any preference — if the toggle only chose which of the
    four *kinds* a participant sees for rounds they're already in, it
    would have nothing left to actually do. Read instead as: `'all'`
    means every round confirmation/reminder/cancellation for the whole
    school, not just rounds this person is personally in; `'my_rounds'`
    never adds anyone beyond a round's real roster. This is also the
    only reading that explains why the step asks admins to default
    differently from everyone else — an admin's own participation
    wouldn't need a different default under the narrower reading, but
    school-wide oversight would. Flagged to the human as the step's one
    genuinely debatable interpretation rather than picked silently.
  - **`notifyRoundCancelled` didn't broaden to `'all'`-preference
    recipients, unlike the other three round emails — an inconsistency,
    not a deliberate narrower design, caught during this step's own live
    verification.** Round-confirmed and round-tomorrow both correctly
    included the broadened `'all'`-preference test account; the
    cancelled-round test's first pass only logged 4 recipients (the real
    remaining participants) with no mention of the 5th. Traced to a
    simple omission — `notifyRoundCancelled` was written without the
    same `getAllPreferenceRecipients` call the other two round
    functions have. Fixed and re-verified live in the same session:
    cancelling a second test round produced exactly 5 recipients,
    including the broadened one, with the correctly-excluded
    `'my_rounds'` admin still absent.
  - **Two of this step's six email triggers were verified by code review
    plus a proven-elsewhere send mechanism, not a fresh live end-to-end
    test, for reasons already established in the two steps that built
    their call sites.** `inviteRosterMembers`'s rate-limit-approval email
    fires from the same function step 15 already documented as
    untestable over raw HTTP (`RosterForm`'s FormData action has no
    reliable wire-protocol simulation, per step 12's original finding);
    `syncIcsSource`'s calendar-import-pending email fires from the same
    function step 16 tested against a purpose-built local ICS server and
    test file, rebuilding which for one conditional call wasn't a
    proportionate use of this step's testing effort. Both wiring points
    are a simple, directly-reviewable `if (condition) { try {
    notify...() } catch {} }`, and the underlying send-plus-idempotency
    mechanism (`claimAndSend`, keyed on `entity_id` for exactly these two
    kinds) was independently proven correct via the partial-unique-index
    test above and the three other live-verified email kinds this step.
    Flagging the gap plainly rather than claiming a test that didn't
    happen.
  - **`RESEND_API_KEY` was not actually present in `.env.local`** despite
    being expected to be there per the human's kickoff message — checked
    directly, confirmed absent, flagged before building rather than
    discovered mid-verification. Dev mode being the *default* (not
    something that had to be explicitly enabled) meant this didn't block
    building or testing anything else — every email this step ever sent
    went through the console-logging path regardless — but it does mean
    the step file's "all emails render legibly in a phone mail client,
    checked on a real phone" criterion could not be attempted at all
    this session; it needs a real key and a real device on the human's
    end, neither of which exists yet in this environment.
- **2026-08-17 — step 16: two real bugs found during this step's own live
  verification, both caught before ever being reported as done, not
  shipped broken.**
  - **`computeDiff` treated any real school day the feed didn't
    explicitly mention as "removed," with no bound on how far that
    check reached — and a real ICS subscription is typically a rolling
    window, not the whole school year.** Caught immediately: the very
    first real sync (5 events, but scoped against the school's entire
    ~4-month upcoming-term range) came back with 82 diff entries, not
    the 4 the test was designed around — 77 of them were real Riverbend
    school days the test feed simply didn't happen to mention, all
    flagged for reversion to no-school. Approving that batch as
    constructed would have wiped out most of a real term's calendar.
    The batch was rejected immediately, before any approval was
    attempted, and the design itself was fixed: `computeDiff` now takes
    the feed's own observed date span (the min/max date across every
    event it actually returned this sync, mapped or not) and only
    treats a missing date as "removed" when it falls *inside* that span
    — a date outside it was never something the feed had an opinion
    about, and a date with only an unmapped/ignored event isn't
    "removed" either, just unmapped. Re-verified after the fix: the same
    5-event feed against the same term range came back with exactly 4
    entries. 3 new unit tests added specifically for this boundary
    (outside the span, no span at all, covered-but-unmapped), on top of
    re-verifying the original 13 still pass against the new signature.
  - **`/api/cron/sync-ics` was unreachable by the one caller it exists
    for.** `proxy.ts`'s session gate covers every route except a short
    public-paths list, and the cron route wasn't on it — Vercel's own
    scheduler has no session cookie, only a bearer token, so every real
    call would have been 307-redirected to `/sign-in` before the
    route's own `CRON_SECRET` check ever ran. Caught by testing the
    route directly rather than assuming a passing build meant it
    worked. Fixed by adding `/api/cron` to `PUBLIC_PATHS`, same
    reasoning as `/register` being public while staying independently
    authenticated — session presence was never the right gate for a
    route no session can ever accompany; the route's own bearer-token
    check is the real access control. Re-verified: 401 with no header,
    401 with the wrong secret, a real successful sync with the correct
    one.
  - **The generated `CRON_SECRET` needs a human step to actually take
    effect.** It's in `.env.local` (confirmed gitignored) for local
    testing, but Vercel won't know about it until the human adds the
    same value to the project's environment variables in the Vercel
    dashboard — flagging this plainly rather than assuming deployment
    config propagates on its own.
- **2026-08-16 — step 15: task 4 dropped entirely per explicit instruction,
  three design calls confirmed directly before building, a same-day bug
  found and fixed during this step's own verification (not a later
  patch), and a genuine pre-existing gap (deactivation didn't actually
  block sign-in) closed as part of this step.**
  - **The two-admin roster lock (task 4) was not built, full stop.** The
    step file describes a school's roster staying "locked until it has
    two admins on the same email domain, each confirmed by the other."
    Nothing in the schema anywhere tracks "confirmed by another admin" —
    this would have been new columns and a new confirmation UI built from
    scratch, a real design surface with several non-obvious calls (does
    "locked" block admin invites too, creating a bootstrap deadlock? does
    it apply to the wizard's very first admin?). Asked directly before
    writing any code; the human's answer: "Two-admin roster lock is
    removed. Admin can invite freely once the school is approved... no
    roster gate." Built to that instruction exactly — no lock exists
    anywhere in this step's migration or code. Confirmed this doesn't
    conflict with anything actually graded: none of the step file's 5
    acceptance criteria mention the lock, only task 4's prose does.
  - **Three other design calls confirmed directly, not assumed, before
    writing the migration**: the rate limit is a fixed 10/hour constant
    in a database trigger rather than a new `schools` column (matching
    how step 11 hardcoded its RFD-length minimum); it applies school-wide
    (all admins' invites count together) rather than per-admin, the
    stronger reading of "one compromised admin account can't quietly add
    users"; and `inviteRosterMembers` — shared by this step's
    `/admin/roster` and step 12's wizard roster step — was left as the
    single source of truth for both callers rather than exempting the
    wizard, meaning a brand-new school's very first bulk roster paste can
    also land as pending if it's large enough. The human confirmed all
    three directly rather than having them picked silently.
  - **A same-day fix, found by this step's own live verification, not a
    bug that shipped and was caught later.** `inviteRosterMembers`
    (written in step 12, before `invited_by` had any real consequence)
    never set that column, so it was always `null`. The new
    `roster_invites_approve_check_trigger`'s "must be approved by a
    different admin than whoever created it" check compares
    `new.approved_by = new.invited_by` — against `null`, that comparison
    is never true in SQL, so the check would have silently never blocked
    anyone, quietly defeating the exact security property task 3 exists
    for. Caught while verifying criterion 3 (deliberately went one step
    further than "does it create 30 invites and flag some as pending" to
    also test "can the *same* admin approve their own pending invite," and
    it succeeded when it should have failed). Fixed with a second same-day
    migration (`20260820000001_roster_invites_invited_by_default.sql`)
    that has the existing rate-limit trigger also set
    `invited_by := coalesce(invited_by, auth.uid())` — one function, two
    related concerns on the same row, rather than a second trigger.
    Re-verified after the fix: self-approval now correctly rejected with
    a clear message, a genuinely different admin's approval correctly
    succeeds.
  - **`profiles.is_active` was checked by nothing, anywhere, before this
    step — deactivation would not have actually prevented sign-in.** Not
    a bug introduced by this step; a gap that existed since `is_active`
    was added to the schema in step 02, surfaced now because this is the
    first step that ever needed it to do anything. Fixed in two places:
    `getCurrentUser()` (`src/lib/auth.ts`) now signs out and redirects to
    `/sign-in?error=deactivated` if the profile is inactive — the more
    important of the two fixes, since it catches a session that was
    already live and auto-refreshing when the admin deactivated someone,
    not just a future sign-in attempt; and `/auth/callback` has the
    matching check for a genuinely fresh sign-in. Verified directly: a
    deactivated temp debater's pre-existing, still-valid session cookie
    hit `/week` and got a real 307 redirect to the error page, not a
    cached 200.
  - **Roster and room reuse ended up asymmetric on purpose, not by
    accident.** Task 2 says to reuse the wizard's bulk-invite form
    "rather than duplicating it" — read literally and followed exactly:
    `/admin/roster` imports `RosterForm` from
    `admin/setup/roster/roster-form.tsx` directly, unmodified, meaning it
    inherits that exact FormData-argument action and step 12's
    already-documented raw-HTTP testing gap along with it (verified via a
    real RLS session instead, same compensating technique as step 12).
    Task 5's wording is looser ("on top of the add-a-room capability")
    and doesn't ask for the exact form to be reused, only the underlying
    capability — so `/admin/rooms` reuses `createRoom` (the function) for
    add, but its edit/deactivate actions are new, built as
    object-argument actions specifically so that surface stays fully
    HTTP-testable rather than inheriting the same gap a second time.
- **2026-08-16 — step 14: dev-mode server actions use a different action
  hash than a production build, a real testing-methodology finding, not a
  build issue.** Steps 09-11 extracted each object-argument server
  action's hash from `.next/server/server-reference-manifest.json` (the
  file `npm run build` produces) and that worked because the dev server
  happened to already have a stale copy of that same file lying around
  from an earlier build. This step's first attempt at calling
  `addRoundLink` over raw HTTP against the live `npm run dev` server got
  a clean `404 Server action not found` using that same file's hash, even
  after the route had been requested once (ruling out "just not compiled
  yet"). Root cause: Turbopack dev mode writes its own, separately-hashed
  manifests under `.next/dev/server/app/.../page/server-reference-
  manifest.json`, one per route, generated fresh per dev session — not
  the same file or hash space as a production build's single top-level
  manifest. Once found, extracting the hash from the correct per-route
  dev manifest worked immediately (confirmed by the actual RSC payload
  coming back with the newly-added link rendered in it). Flagging this
  for any future step's live HTTP verification against `npm run dev`: use
  `.next/dev/server/app/<route>/page/server-reference-manifest.json`, not
  the top-level one, and expect it to only exist once that route has been
  requested at least once in the current dev session.
- **2026-08-16 — step 13: two bugs found while building the test fixtures
  themselves, not in application code — both fixed before the actual
  acceptance criteria were evaluated.**
  - **Rounds can't be inserted directly as `status: 'completed'`.** The
    first version of the verification script created each test round with
    `status: 'completed'` in the initial insert, alongside its
    `round_participants` rows. Step 10's `round_participants_before_insert`
    trigger requires the parent round to be `forming` at insert time and
    rejected every participant insert ("This round is not accepting new
    participants"), which the script wasn't checking the return value for —
    so it silently produced rounds with zero participants, and the first
    verification pass showed nobody credited at all. This is the trigger
    working correctly against a fixture that skipped a real state
    transition, not a gap in the trigger. Fixed by creating each round as
    `forming`, inserting participants for real (passing the same validation
    a real join flow would), then `UPDATE`ing the round to `completed`
    directly — no trigger fires on a plain `rounds` update, so that step is
    safe and mirrors what a real confirm-then-submit-result flow would leave
    behind.
  - **The first two synthetic test terms overlapped the real seeded Fall
    2026 term.** Created "LB Test Term 1" (Sept 1-15, 2026) and "LB Test
    Term 2" (Sept 16-30, 2026) to test term-switching, not realizing both
    ranges sit entirely inside Riverbend's real Fall 2026 term (Aug 24 - Dec
    18, 2026). `v_participation`'s join matches a round against every
    `school_terms` row whose date range contains the round's date, so each
    test round matched two terms at once, and `v_leaderboard` returned three
    rows for the same debater instead of two clean ones — confirmed this was
    the fixture's fault, not the view's, by checking `school_terms` date
    ranges directly. Fixed by deleting both synthetic terms and using the
    real Fall 2026 term directly for the weekly-cap/judge/expired scenarios
    (the already-created rounds needed no changes — term matching is by date
    range, not a stored term id), then creating one genuinely non-overlapping
    term ("LB Test Term 3 (Winter)," Dec 19-31, 2026, in the real gap before
    Spring 2027 starts) specifically for the term-switching scenario.
- **2026-08-16 — step 12: a real testing-methodology limit hit and clearly
  bounded (FormData server actions can't be hand-simulated over raw HTTP
  the way object-argument actions could in steps 09-11), a real bug fixed
  in step 07's `upsertSlotsForRange`, and two scope calls flagged during
  planning and held to.**
  - **FormData-argument server actions need a `next-router-state-tree`
    header carrying the client's current route-segment tree; hand-crafting
    one that Next accepts wasn't achieved.** Every action from steps 09-11
    took plain typed arguments (strings, numbers, small objects) and
    called correctly over raw HTTP with a `Next-Action` header and a
    JSON-array body — that technique is what made this project's live
    verification real rather than assumed for three steps running. Step
    12's actions all take `(formData: FormData)` instead, matching the
    `SetupForm` pattern used across all seven wizard pages. That turned
    out to need a materially different wire protocol: read directly out
    of Next's compiled client bundle (`processReply` in
    `react-server-dom-turbopack`) to confirm the real multipart field
    scheme — a root field (`"0"` → `["$K1"]`) referencing a FormData part
    whose own fields are prefixed `_1_<name>` — and got that half working
    (no more raw errors), but every attempt still came back as an
    unlogged, silent no-op (`{}`, no database change) once the missing
    `next-router-state-tree` header was added, because that header has to
    describe the real client-side route tree and a hand-built
    approximation doesn't satisfy Turbopack dev's handling of it. This is
    a genuine, narrow gap: object-argument actions (the majority of this
    codebase, including everything judge/admin/debater-facing outside
    this one step) remain fully testable this way; FormData-bound actions
    do not, at least not without a real browser. Compensated with the
    strongest available alternative — see the step 12 log row above for
    exactly what was run instead (a real approval script, a real new
    admin account through the real roster-gating trigger, every wizard
    write replicated through that admin's own real RLS session, the real
    `rotationToCalendarDays` and refactored `upsertSlotsForRange` called
    directly) — but the literal click-a-button-in-a-form path is the one
    thing about this step that wasn't exercised end to end, and that gap
    is being stated plainly rather than papered over.
  - **`upsertSlotsForRange` (step 07) had a real design gap for this
    step's needs, not just a missing feature.** It was written service-role-
    only, on the explicit assumption that its only callers would be a cron
    job and one-off scripts — "never a page a signed-in user is viewing."
    Step 12's wizard confirm/regenerate actions are exactly that, a real
    signed-in admin's own action, and `slots`/`calendar_days` already had
    working "admin, own school" insert policies from step 03, so routing
    through the service role for this specific caller would have been an
    unnecessary RLS bypass. Refactored to accept an injectable client
    (defaulting to admin, so the cron/script callers are unaffected) and
    to unconditionally skip any slot with a live (not cancelled/expired)
    round attached — needed for task 4's "never touched" guarantee, and
    made the standing behavior rather than an edit-only mode since it
    costs nothing on first-time generation. Verified directly against
    real Riverbend data (not just the test school): deliberately corrupted
    a slot's label, attached a live round to it, called the real function
    with both the default admin client and an injected real RLS session,
    confirmed the corrupted label survived regeneration untouched in both
    cases while every other slot in range updated correctly, then removed
    the round and confirmed the label restored on the next call.
  - **`/admin/setup/*` was not added to `proxy.ts`'s public paths**,
    despite being asked to — flagged before building rather than after.
    `proxy.ts` only gates on session presence, not school status, so the
    wizard already works correctly for a signed-in admin without being
    listed there; adding it would only ever have let an unauthenticated
    visitor reach it and hit an unhandled exception in `getCurrentUser()`
    instead of being redirected to sign in, with no corresponding benefit.
    `/register` was added, since that route genuinely has no session at
    all by design.
  - **Rooms and a second admin are not hard requirements to finish the
    wizard** — both show as explicitly "(optional)" nudges on the
    checklist rather than blockers. `school-config.md`'s "two-admin rule"
    is informal guidance for the real school, not a stated task
    requirement, and a round can already be confirmed with no room set
    (step 10). Confirmed live: the test school's checklist correctly
    showed both required items checked off and both optional ones still
    open after a full manual setup.
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
