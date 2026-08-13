# Step 06 — App shell, navigation, and role gating

## Goal

A consistent layout with navigation that shows only what the signed-in person's
roles allow, and route protection that enforces the same thing on the server.

## Read first

`plan/reference/ui-conventions.md`. It defines the visual direction, the
component patterns, and the writing rules for labels and empty states. Follow it
rather than reaching for defaults.

## Tasks

1. **Root layout** with a header containing the school name, the current user's
   name, and a sign out control. Mobile first: this will be opened on a phone
   between classes more than on a laptop.

2. **Navigation** with these destinations, each shown only for the roles listed:
   - This week (everyone)
   - My rounds (everyone)
   - Judging (judge role)
   - Leaderboard (everyone)
   - Archive (everyone)
   - Admin (admin role)

3. **Server-side route protection.** Navigation hiding is not protection. Every
   admin route checks `auth_has_role('admin')` server-side and returns a 404
   rather than a 403 for unauthorized users, so the existence of admin routes is
   not advertised.

4. **A `<RequireRole>` server component** that wraps protected pages, so the
   check is one line per page rather than copy-pasted logic.

5. **Empty states** for every list view, written per the conventions file. An
   empty week says what to do, not "no data."

6. **Error boundary and not-found pages** that match the shell rather than
   showing the Next.js defaults.

## Acceptance criteria

- Signed in as a debater, the Admin and Judging links are absent, and typing
  `/admin` in the address bar returns a 404.
- Signed in as a judge-and-debater, both Judging and This week appear.
- Signed in as an admin, everything appears.
- The layout is usable at 375px wide without horizontal scrolling.
- Keyboard tab order reaches every interactive element with a visible focus
  ring.

## Do not

- Do not build any of the actual features yet. Every page in this step is a
  heading and an empty state.
- Do not add a settings page, a profile editor, or a notifications center. None
  are in scope.
