# Verification checklist

Run this at step 18 and again before any second school is onboarded. Record the
result of every item in `plan/PROGRESS.md`. An item is not passed because the
code looks right. It is passed because it was performed.

Several of these must be done with raw API calls rather than through the
interface, because the failure mode being tested is data reaching the browser
and being hidden there rather than never being sent.

## Tenancy

- [ ] As a Test Academy user, query `profiles` and confirm zero real-school rows
- [ ] As a Test Academy user, query `slots`, `rounds`, `round_results`,
      `round_links`, `availabilities` by known real-school ids and confirm each
      returns nothing
- [ ] As a real-school admin, attempt to insert a `roster_invites` row with Test
      Academy's `school_id` and confirm it fails
- [ ] Confirm no table has row level security disabled, by querying
      `pg_class.relrowsecurity` across the public schema

## Room exposure

- [ ] Confirm a round, then as a non-participant load `/week` and inspect the
      network response. The room must not appear in the payload.
- [ ] Repeat for `/slot/[id]` and the archive detail page

## Result immutability

- [ ] As the submitting judge, attempt to update a `round_results` row directly
      via the API. Confirm it fails.
- [ ] Repeat as a different judge. Confirm it fails.
- [ ] Repeat as an admin. Confirm it fails.
- [ ] Confirm a correction creates a new row and the original is still readable

## Secrets

- [ ] Search the repo for the service role key value. Zero results outside
      `.env.local`.
- [ ] Search the built output in `.next/` for the same value. Zero results.
- [ ] Confirm no file that imports `lib/supabase/admin.ts` is reachable from a
      Client Component
- [ ] Confirm every cron route rejects a request without the secret header

## Access control

- [ ] An email not on any roster cannot sign in, and no row remains in
      `auth.users` afterward
- [ ] A deactivated member cannot sign in and their completed rounds still show
- [ ] A debater loading `/admin` gets a 404, not a 403
- [ ] A debater cannot open the result form for a round they are in

## Data correctness

- [ ] Generated slots for one real month match the school's published calendar
      on every date, including the day type letter
- [ ] A daylight saving transition week renders correct local times
- [ ] Four completed rounds in one week credit two
- [ ] An expired round credits nobody
- [ ] Regenerating slots does not duplicate rows or delete rounds

## Notifications

- [ ] Confirming a round sends exactly one email per participant
- [ ] Running each cron twice sends nothing the second time
- [ ] Development mode sends nothing externally

## Documents

- [ ] `/privacy` and `/terms` exist and are linked from the sign-in page
- [ ] The coach-facing one page document exists
- [ ] The README takes a second person from clone to running locally
- [ ] The RUNBOOK covers a broken feed, a stuck round, deactivating a person,
      rotating a key, and restoring a backup
- [ ] Credentials for Supabase, Vercel, and GitHub are held by at least two
      people, one of them an adult at the school
