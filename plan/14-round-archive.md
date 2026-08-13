# Step 14 — Round archive

## Goal

Completed rounds are searchable, and each one can carry links to the video and
the speech documents, so the practice schedule produces a prep library as a side
effect.

## The hard rule

**The app never receives, stores, or serves a media file.** Links only, to files
that live in the school's own Google Drive, where the school's own permissions
govern access. This is not a performance decision. Hosting video of minors
across institutions is a liability the project should not take on, and Drive
already solves permissions correctly.

If asked to add uploads, refuse and point here.

## Tasks

1. **Archive page** at `/archive` listing completed rounds, newest first, with:
   - date, period label, and term
   - the four debaters and the judge, first name and last initial
   - sides and winner
   - whether a video link and speech docs are attached
   - the reason for decision, expandable

2. **Filters:** by person, by term, by whether a video exists, by free text
   search across the RFD. Keep it to those four. Search across RFD text is the
   one people will actually use.

3. **Round detail page** at `/round/[id]` showing everything, plus the links.

4. **Adding links.** Any participant or an admin can add a link to a completed
   round. Fields: kind (video, speech doc, flow, other), URL, optional label.

5. **URL validation.** Accept only `https://` URLs on Google Drive or Google
   Docs domains. Reject everything else with a message explaining why. This
   prevents the archive from becoming a place people paste arbitrary links, and
   keeps the access control story simple.

6. **A note on the add-link form**, shown inline: remind the person to check
   that the Drive sharing setting on the file allows their team to open it, and
   that links are visible to everyone at their school. Write it as one plain
   sentence, not a warning box.

7. **Access.** The archive is readable by everyone at that school and by nobody
   else, which the existing row level security already handles. Confirm rather
   than assume.

## Acceptance criteria

- A round with a Drive link shows it, and it opens.
- A non-Drive URL is rejected with a clear message.
- Searching the RFD text finds the expected round.
- A user from the test school sees zero rounds from the real school, verified by
  querying with their session directly rather than through the UI.
- No upload control exists anywhere in the app.

## Do not

- Do not add file upload, even "just for speech docs."
- Do not add commenting or discussion threads on rounds.
