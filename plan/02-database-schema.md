# Step 02 — Database schema

## Goal

The full database schema exists as migration files, applied to both the local
and remote Supabase projects. No application code changes.

## Source of truth

`plan/reference/schema.sql` contains the complete schema with comments. Split it
into logical migration files rather than one giant one, in this order:

1. `enums_and_schools` — enum types, `schools`, `school_terms`
2. `profiles_and_roster` — `profiles`, `roster_invites`
3. `schedule` — `period_templates`, `template_blocks`, `day_types`,
   `calendar_days`, `slots`
4. `rounds` — `availabilities`, `rounds`, `round_participants`,
   `round_results`, `round_links`, `rooms`
5. `admin` — `audit_log`, `ics_sources`, `ics_import_batches`
6. `views` — `v_participation`, `v_leaderboard`

Drop the `health_check` table from step 01 in the first migration.

## Things that matter and are easy to get wrong

**Every school-scoped table has a `school_id` with a foreign key to
`schools(id)` and `on delete cascade`.** No exceptions. If a table seems like it
does not need one, it does, because row level security in step 03 keys off it.

**`profiles.id` references `auth.users(id)`.** Supabase manages the `auth.users`
table. Never write to it directly. The profile row is created by a trigger on
user creation, which step 05 adds.

**Roles are an array, not a single value.** A varsity debater is both a debater
and a judge. Use `roles app_role[] not null default '{debater}'`.

**Times.** `slots.starts_at` and `ends_at` are `timestamptz`, stored in UTC.
`template_blocks.start_time` and `end_time` are plain `time` values, because a
period template is a pattern rather than a moment. The conversion happens at
slot generation using the school's timezone.

**Uniqueness constraints that prevent real bugs:**
- `availabilities` unique on `(slot_id, user_id)` so double-clicking cannot
  create two rows.
- `round_participants` unique on `(round_id, user_id)` so nobody joins twice.
- `calendar_days` unique on `(school_id, date)`.
- `slots` unique on `(calendar_day_id, block_id)`.
- `roster_invites` unique on `(school_id, lower(email))`.

**Indexes.** Add indexes on every `school_id` column and on
`slots(school_id, starts_at)`, since the week grid query hits that constantly.

## Tasks

1. Write the migration files.
2. Apply them locally with `supabase db reset` and confirm no errors.
3. Push to the remote project with `supabase db push`.
4. Open the Supabase table editor and confirm every table appears.
5. Write `src/lib/db/types.ts` by running the Supabase type generator, so
   TypeScript knows the schema. Add the generation command to `package.json`
   as a script named `types:gen`.

## Acceptance criteria

- `supabase db reset` runs clean from an empty database.
- Every table in `plan/reference/schema.sql` exists remotely.
- `npm run types:gen` produces a types file with no errors.
- `npm run build` still passes.

## Do not

- Do not add row level security policies yet. That is step 03 and doing it here
  makes debugging the schema harder.
- Do not add any table that is not in `schema.sql`. If something seems missing,
  say so and ask rather than inventing it.
- Do not edit the schema through the dashboard SQL editor. Every change is a
  migration file or it does not exist.
