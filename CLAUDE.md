# CLAUDE.md

You are building a Public Forum practice debate scheduling app. This file is the
standing instruction set. Read it at the start of every session.

## How this project works

The full build is broken into numbered step files in `plan/`. Work through them
**one at a time, in order**. Do not skip ahead. Do not start step N+1 until step
N's acceptance criteria all pass.

At the start of a session:
1. Read `plan/PROGRESS.md` to find the current step.
2. Read that step file completely.
3. Read `plan/reference/decisions.md` before writing any code.
4. Do the work.
5. Run the verification steps in the step file and report the result honestly.
6. Update `plan/PROGRESS.md` with the outcome.

If a step's acceptance criteria cannot be met, stop and say so. Do not move on
and do not silently substitute a different approach.

## Who you are working with

The person building this is a high school student who is new to web development.
This changes how you work:

- Explain what you are doing in plain language before you do it, briefly.
- When a step requires them to do something outside the editor (create an
  account, copy an API key, click something in a dashboard), stop and give them
  numbered instructions, then wait. Do not guess at values they must supply.
- Never leave placeholder values in code that will silently fail later. If you
  need a real value, ask for it.
- When something breaks, explain what broke and why in one or two sentences
  before fixing it.
- Prefer boring, well-documented approaches over clever ones. This code has to
  be maintainable by someone who did not write it.

## What the app is

Students see a week grid of school periods, check every slot they are available
for, and get matched with others who checked the same slot. Four debaters plus
one judge makes a confirmed round. After the round the judge submits a result
and a reason for decision. That submission is what marks the round complete and
credits everyone's participation count. Completed rounds feed a leaderboard and
a searchable archive with links to video and speech documents.

The app is multi-tenant from the first commit: every row belongs to a school and
no query ever crosses schools.

## Non-negotiable rules

1. **Tenancy is enforced in the database, not in application code.** Every table
   with school-scoped data has a `school_id` and a row level security policy.
   Application code may also filter, but the database must be the thing that
   makes cross-school access impossible.

2. **Never use the Supabase service role key in code that runs in the browser.**
   It bypasses row level security entirely. It belongs only in server-side route
   handlers, and only where a step file explicitly calls for it.

3. **No file uploads, ever.** Video and speech documents are stored as URLs to
   files that live in the school's own Google Drive. The app never receives,
   stores, or serves a media file.

4. **No automatic room assignment.** Rooms come from a maintained list plus a
   free text field. See `plan/reference/decisions.md` for why.

5. **Completed rounds are append-only.** A submitted result cannot be edited or
   deleted, only superseded by an appended correction. Every admin action writes
   to the audit log.

6. **Check `plan/reference/decisions.md` before adding any feature.** It lists
   things that were deliberately excluded. If a feature is on that list, do not
   build it, even if it seems obviously useful, and even if asked in passing.

7. **v1 is school-agnostic from step 04 onward.** No school-specific
   configuration — bell schedule, rotation, room list, term dates, school
   name — gets hardcoded into a migration, a seed script, or application code.
   Steps 04 through 11 and 13 through 15 build and test against a fictional
   fake school invented for the purpose (see step 04). The setup wizard (step
   12) is the only path any school's real data, including the real school
   this project is ultimately for, ever enters the system — by an admin
   clicking through it, the same as any other school. If you find yourself
   about to ask the human for a real bell schedule, rotation, or room list
   before step 12, stop; that value belongs in the wizard conversation, not
   in code. See `plan/reference/decisions.md`, "v1 is school-agnostic
   starting at step 04."

## Tech stack

- Next.js (App Router) with TypeScript
- Supabase for Postgres, auth, and row level security
- Tailwind CSS
- Deployed on Vercel
- Supabase CLI for migrations, checked into the repo under `supabase/migrations`

Do not add dependencies that are not named in a step file without asking first.

## Code conventions

- All database access goes through helpers in `lib/db/`. No raw Supabase client
  calls scattered through components.
- Server Components by default. Client Components only where interactivity
  requires it, marked with `'use client'`.
- Times are stored in UTC and rendered in the school's timezone. The school's
  timezone is a column on `schools`, never hardcoded.
- Every new table gets a migration file. Never edit the database through the
  Supabase dashboard SQL editor except to inspect data.

## Definition of done for any step

- The feature works when clicked through in the browser.
- It works when logged in as each role the step affects.
- `npm run build` passes with no type errors.
- The row level security check in `plan/reference/verification-checklist.md`
  still passes.
- `plan/PROGRESS.md` is updated.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
