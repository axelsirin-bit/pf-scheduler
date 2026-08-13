# Step 10 — Round formation and judge signup

## Goal

Four debaters and one judge can attach themselves to a slot, forming a round
that becomes confirmed when full.

## The rule that shapes everything here

People choose who they debate. The app does not assign partners or opponents.
Its job is to show who is available and make it one click to join them.

## Tasks

1. **Slot detail view** at `/slot/[id]`. Shows everyone available for that slot,
   any round already forming, and the actions available to the current user.

2. **Start a round.** Any member can start a round in a slot, which creates a
   `rounds` row with status `forming` and adds them as the first participant.

3. **Join a round.** A member joins as a debater, choosing team 1 or team 2, or
   as a judge if they hold the judge role. Constraints enforced in the server
   action and by database constraint:
   - maximum four debaters, two per team
   - maximum one judge
   - a user cannot hold two participant slots in one round
   - a user cannot be in two rounds in the same time slot

4. **Leave a round.** Allowed while status is `forming`. Once confirmed,
   leaving requires cancelling the round, which any participant can do, and
   which notifies the others in step 17.

5. **Confirmation.** When four debaters and one judge are attached, status
   becomes `confirmed` and `confirmed_at` is set. Do this in a database trigger
   rather than in application code, so it cannot be reached in an inconsistent
   state.

6. **Room.** On confirmation, prompt whoever confirms it to pick a room from the
   maintained list or type one. The room field is required before the round
   shows as ready. Display the room only to participants and admins.

7. **Side assignment.** Optional. Teams may set pro and con at formation or
   leave it for a coin flip in the room. Do not require it.

8. **Judging view** at `/judging`, visible to the judge role. Lists slots where
   a round is forming and needs a judge, sorted by soonest. One click to claim.
   This is the same underlying action as joining a round, presented as its own
   screen because judges think in terms of "what needs covering" rather than
   "which slot am I free for."

## Acceptance criteria

- Five people across five browsers can form a round and it confirms exactly once.
- Attempting to join a full round shows a clear message rather than silently
  failing or creating a sixth participant. Verify by having two people click
  join simultaneously on the last open place.
- A user cannot join two rounds at the same time.
- After confirmation, the room is visible to the five participants and to
  admins, and absent from the payload for everyone else.
- Leaving a forming round removes only that participant.

## Common failure modes

- The race on the last open place. Two simultaneous joins both read "four
  participants" and both insert. Prevent it with a database-level constraint or
  a transaction with row locking, not with a check in application code.
- Confirming in application code and then failing to write the room, leaving a
  confirmed round with no location.

## Do not

- Do not build automatic matching, suggested partners, or skill-based pairing.
- Do not allow admins to force people into rounds.
