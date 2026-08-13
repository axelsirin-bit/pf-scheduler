# Step 03 — Row level security

## Goal

Every table has row level security enabled with policies that make cross-school
access impossible at the database level, and a test proves it.

## Why this step is not optional and not later

This is the single most important step in the build. The database will hold, for
named minors, the time and room where they will be on a specific date. If
tenancy is enforced only in application code, one forgotten `.eq('school_id', x)`
leaks another school's roster. Postgres row level security means the leak cannot
happen even when the query is wrong.

Do this before any feature code exists, because retrofitting policies onto
working features means every bug looks like a policy bug.

## Helper functions

Create two `security definer` functions in the `public` schema:

    auth_school_id() returns uuid
      -- the school_id of the currently authenticated user, from profiles

    auth_has_role(role app_role) returns boolean
      -- whether the current user's roles array contains the given role

Both must be marked `stable` and have `set search_path = public` to avoid the
search path attack that `security definer` functions are prone to.

## Policy pattern

For every school-scoped table, the read policy is:

    using (school_id = auth_school_id())

Write policies vary by table and role. The specifics:

| Table | Select | Insert | Update | Delete |
|---|---|---|---|---|
| schools | own school only | none | admin | none |
| profiles | own school | trigger only | self, or admin | none |
| roster_invites | admin only | admin | admin | admin |
| period_templates, template_blocks, day_types | own school | admin | admin | admin |
| calendar_days, slots | own school | admin | admin | admin |
| rooms | own school | admin | admin | admin |
| availabilities | own school | self only | none | self only |
| rounds | own school | any member | participants or admin | none |
| round_participants | own school | self only | none | self only, and only while round status is `forming` |
| round_results | own school | judge on that round | **none** | **none** |
| round_links | own school | participants or admin | own rows | own rows |
| audit_log | admin only | trigger only | none | none |
| ics_sources, ics_import_batches | admin only | admin | admin | admin |

Note the two `none` entries on `round_results`. That is the append-only rule from
`CLAUDE.md` enforced in the database rather than trusted to the UI. Corrections
are new rows with a `supersedes` reference, not edits.

## Tasks

1. Write one migration that enables RLS on every table and creates all policies.
2. Write the helper functions in the same migration, before the policies.
3. Create `supabase/tests/rls.test.sql` using pgTAP, or if that is too much
   setup, a plain SQL script at `scripts/verify-rls.sql` that does the checks
   below. Either is acceptable, the script matters more than the framework.
4. Add an npm script `npm run verify:rls` that runs it.

## The test that must pass

Seed two schools, School A and School B, each with one admin and two debaters.
Then, authenticated as a School A debater, confirm every one of these:

- Selecting from `profiles` returns only School A rows.
- Selecting from `slots` returns only School A rows.
- Attempting to insert an `availabilities` row with another user's `user_id`
  fails.
- Attempting to insert a `roster_invites` row fails, because they are not admin.
- Attempting to update a `round_results` row fails.
- Attempting to select from `audit_log` returns zero rows.
- Attempting to select a School B `round_links` row by its known id returns
  nothing rather than erroring, which is the correct RLS behavior.

Authenticated as a School A admin, confirm:

- They can insert a roster invite for School A.
- They cannot insert a roster invite with School B's `school_id`.
- They can read `audit_log` for School A only.

## Acceptance criteria

- `npm run verify:rls` passes every assertion.
- No table anywhere has RLS disabled. Verify with a query against
  `pg_tables` joined to `pg_class.relrowsecurity` and confirm zero results
  where security is off.

## Common failure modes

- Forgetting that RLS does not apply to the service role key. Any code path
  using `admin.ts` bypasses all of this. That is why its use is restricted to
  the specific places later steps name.
- Policies that reference `profiles` without a `security definer` helper cause
  infinite recursion, because reading `profiles` triggers the policy on
  `profiles`. This is the most common Supabase RLS mistake. The helper functions
  exist specifically to avoid it.
- `insert` policies use `with check`, not `using`. Getting this wrong produces
  a policy that silently allows everything.

## Do not

- Do not disable RLS temporarily to make a later step easier. If a step seems to
  require it, stop and ask.
