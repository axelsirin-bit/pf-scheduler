# Step 08 — Week grid

## Goal

A read-only view of the current week showing every bookable slot, with the names
of everyone who has marked themselves available, and the status of any round
forming in that slot.

## What it replaces

The Google Doc the team currently uses. It has to be faster than that doc or
people will go back to the doc. Concretely: it must load in under two seconds on
a school laptop, and reading who is free at a given time must take one glance
rather than scanning a wall of colored text.

## Tasks

1. **Route** `/week` and make it the default landing page after sign-in.

2. **Week navigation** with previous and next, defaulting to the current week.
   Do not allow navigating more than four weeks ahead, since slots do not exist
   beyond the generation window, and show a clear message at the boundary rather
   than an empty grid.

3. **Layout.** Days as columns on desktop. On mobile, one day at a time with a
   day switcher, because a five-column grid at 375px is unreadable. Slots as
   rows within a day, in time order, labeled with the period label from the
   template plus the time range.

4. **Per-slot display:**
   - the period label and time
   - the count and names of people marked available, first name and last initial
   - the round status: open, forming with a count out of five, or confirmed
   - for a confirmed round, the room, **visible only to participants and
     admins**. Everyone else sees that it is confirmed but not where.

5. **A single query.** The whole week is one query joining slots,
   availabilities, profiles, and rounds. Do not fetch per slot. Put it in
   `src/lib/db/week.ts`.

6. **Today marker** and dimming of slots whose start time has passed.

## Acceptance criteria

- The week renders correctly for a week with a holiday in it.
- The page issues one database query for the grid, verifiable in the Supabase
  logs.
- A debater who is not in a confirmed round cannot see that round's room,
  confirmed both in the UI and by inspecting the network response payload. If
  the room is in the payload and merely hidden in the UI, that is a failure.
- The page is readable and usable at 375px wide.

## Verification the human should do

Open it next to the current Google Doc for the same week. Every slot on the doc
should exist in the app with the same time and label. Then time yourself
answering the question "who is free during P3 on Wednesday" in each. If the app
is not clearly faster, say so, because that is the whole value proposition.

## Do not

- Do not add signup interaction yet. This step is read-only.
- Do not show full last names anywhere on this screen.
