# Step 12 — School onboarding and schedule configuration

## Goal

A new school can be set up without a developer: an admin defines their bell
schedule, rotation, terms, and rooms through the interface rather than through
a seed script.

## Read this before starting

This is the only path any school's real data ever enters the system —
including the real school this app is ultimately for. Steps 04 through 11
were built and verified against a fictional fake school seeded directly by
`supabase/seed.sql` (step 04), on purpose: that fake school is dev/test
fixture data, never a stand-in for a real onboarding path. This step is where
a real school, starting with whichever one signs up first, gets its actual
bell schedule, rotation, terms, and rooms into the app — by clicking through
this wizard as an ordinary admin, the same way every school after it will.
See `plan/reference/decisions.md`, "School-agnostic v1," for why this moved
ahead of the leaderboard, archive, and admin console instead of sitting at
the end of the build.

`plan/reference/school-config.md` has real facts already gathered for the
school this project is ultimately for (bell schedule, the 2026-27 calendar
CSV, an unconfirmed guess at Half-Day/Special/Community block cutoffs). None
of it gets hardcoded anywhere. When that school is actually onboarded, an
admin — the human building this, most likely — types those facts into this
wizard by hand, the same as any other school would. `school-config.md` is
reference material for that conversation, not an input to any migration.

### Two things this step depends on that come later in the numbering

Steps 13-15 (leaderboard, round archive, admin console) come after this step
now, which inverts two small dependencies from the original plan:

- **Step F, roster**, below, used to hand off to a roster screen built in the
  admin console. Since the admin console doesn't exist yet at this point,
  build the minimal version here instead: paste emails, assign roles, the
  13-or-older confirmation checkbox, creating `roster_invites` rows. Step 15
  (admin console) extends this with listing, deactivation, revoke, and the
  invite rate limit — it should reuse whatever this step builds rather than
  duplicating it.
- **Step E, rooms**, below, only needs add-a-room here. Step 15 adds edit and
  deactivate on top of the same table.

## Tasks

1. **School registration is not self-serve.** There is no public sign-up form.
   A request form collects school name, admin name, institutional email, and
   their Tabroom coach profile URL. The request lands in a table and an email
   goes to the operator. Approval creates the school and the first admin invite,
   by hand.

   The Tabroom URL is the verification. A coach listed on Tabroom for that
   school is a real check that costs five minutes and is hard to fake. Record
   who approved each school and when.

2. **Setup wizard** at `/admin/setup`, shown until the school is configured:
   - **Step A: basics.** Name, timezone, term dates.
   - **Step B: schedule source.** Two options presented equally: link a calendar
     feed, or set it up manually. Choosing manual must not feel like the lesser
     path, and the interface must make clear that a feed can be linked later at
     any time without redoing the manual work. Both write to the same tables.
   - **Step C: period templates.** Name a template, add blocks with label,
     start, end, and a bookable toggle. Duplicate an existing template as a
     starting point, since most day types differ by a few labels.
   - **Step D: rotation.** Either a repeating sequence with an anchor date, or a
     fixed weekly pattern. Ask which the school uses, because both exist and
     assuming one breaks the other.
   - **Step E: rooms.**
   - **Step F: roster.** Paste emails, assign roles, confirm each invitee is
     13 or older. See the dependency note above — this is the minimal version;
     step 15 builds it out.

3. **Preview before commit.** At the end of the wizard, generate and display two
   weeks of slots and ask the admin to confirm they match reality. Nothing is
   written to `slots` until they confirm. This catches a wrong rotation anchor
   before it produces a month of wrong slots.

4. **Editing later.** Changing a template or the rotation regenerates future
   slots only. Past slots, and any future slot with a round attached, are never
   touched. Show the admin exactly what will change before applying it.

5. **Onboarding checklist** on the admin overview showing what is still missing,
   so a half-configured school is visible rather than mysteriously broken.

## Acceptance criteria

- A fresh school can go from nothing to a correct generated week without anyone
  touching the database.
- Switching a manually configured school to a linked feed preserves the existing
  templates and does not duplicate calendar days.
- Editing a template does not alter a past slot or a future slot with a round.
- The preview shows slots that match the school's real calendar for two weeks.

## Do not

- Do not add self-serve school registration.
- Do not add billing, plans, or a marketing site.
