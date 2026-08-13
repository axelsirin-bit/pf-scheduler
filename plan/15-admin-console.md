# Step 15 — Admin console

## Goal

Coaches and captains can manage the roster, roles, rooms, and see what is
happening, with every action recorded in the audit log.

## Tasks

1. **`/admin` overview** showing, for the current term:
   - rounds completed this week and this term
   - rounds awaiting a result, with how overdue each is
   - rounds that expired without a result
   - roster size by role
   - anyone with zero rounds this term

   That last item is the one a coach will actually use, so make it prominent.

2. **Roster management** at `/admin/roster`. Step 12's setup wizard already
   built the minimal version of this — paste emails, assign roles, the
   13-or-older checkbox, writing `roster_invites` rows. Reuse that rather than
   duplicating it, and build out the rest here:
   - list of current members with roles and last sign-in
   - the existing bulk-add-by-email from step 12, now reachable outside the
     wizard too
   - deactivate a member, which prevents sign-in and hides them from signup
     lists but preserves their history. Never delete a profile, because deleting
     it orphans completed rounds.
   - revoke an unclaimed invite

3. **Rate limiting on invites.** More than a set number of invites in an hour
   requires a second admin to approve, and emails all admins at the school. This
   is the control that means one compromised admin account cannot quietly add
   users. Implement it as a pending state on the invite rather than a hard block.

4. **Two-admin requirement.** A school's roster stays locked until it has two
   admins on the same email domain, each confirmed by the other. Show the
   locked state clearly with what is needed to unlock it.

5. **Rooms** at `/admin/rooms`: edit and deactivate, on top of the add-a-room
   capability step 12's wizard already built. Each room has a name and a note
   about when it is usually free.

6. **Audit log** at `/admin/audit`, readable by all admins at that school,
   showing actor, action, entity, and a before and after diff. Populated by
   database triggers on every admin-scoped table, not by application code, so it
   cannot be bypassed by a code path that forgets to log.

7. **Participation view** from step 13 lives here.

## Acceptance criteria

- Adding an invite writes an audit row with the actor.
- Deactivating a member prevents their sign-in and leaves their completed rounds
  intact and visible.
- Pasting thirty emails creates thirty invites in one action, and triggers the
  second-admin approval path.
- An admin cannot create an invite for a different school. Test by crafting the
  request directly, not through the form.
- The audit log cannot be edited or deleted by anyone, including admins.

## Do not

- Do not let admins edit or delete round results.
- Do not build a message-all-members feature. It becomes a mailing list and
  brings a different set of problems.
