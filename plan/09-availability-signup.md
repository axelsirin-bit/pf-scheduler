# Step 09 — Availability signup

## Goal

A signed-in member can check every slot they are free for during a week, in one
pass, and see the effect immediately.

## The interaction that matters

The current doc requires typing your name into a cell. The app should let you
check eight boxes in ten seconds and be done. Optimize for that. A flow that
requires opening each slot, clicking a button, and returning to the grid is
slower than the doc and will lose.

## Tasks

1. **Checkbox per slot** on the week grid, reflecting whether the current user
   is already marked available.

2. **Optimistic updates.** The checkbox flips instantly and the write happens in
   the background. On failure, revert and show what happened. Use a server
   action with `useOptimistic`.

3. **Server action** `toggleAvailability(slotId)` in
   `src/app/week/actions.ts`. It derives the user from the session and never
   accepts a user id from the client. Row level security also prevents that, but
   the action should not offer the parameter in the first place.

4. **Guards:**
   - Cannot mark availability on a slot in the past.
   - Cannot mark availability on a slot that is closed.
   - Cannot remove availability if you are already a confirmed participant in a
     round for that slot. Tell them to leave the round first.

5. **My availability summary** on `/my-rounds`: a compact list of the slots the
   user has marked this week, so they can un-mark quickly without hunting
   through the grid.

6. **Nudge copy.** When a slot has three people available and needs one more,
   show that plainly on the slot. This is the cheapest possible matching
   mechanism and it works better than an algorithm.

## Acceptance criteria

- Checking eight slots takes eight clicks and no page reloads.
- Refreshing the page shows the same state.
- Double-clicking a checkbox does not create duplicate rows. Verify in the
  database.
- With the network throttled to slow 3G, the checkbox still feels instant and a
  failed write visibly reverts.
- A second user in another browser sees the first user's name after a refresh.

## Do not

- Do not add live realtime updates. Refresh is sufficient at this scale and
  Supabase realtime adds a category of bug that is not worth it here.
- Do not auto-create rounds when four people happen to be available. Round
  formation is deliberate and is step 10.
