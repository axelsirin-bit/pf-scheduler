# UI conventions

## Who is using this and where

A high school student, on a phone, in a hallway, deciding in fifteen seconds
whether they are free on Wednesday. Or on a school laptop during a free period.
Mobile first is not a nice-to-have here, it is the primary case.

The thing being replaced is a Google Doc with colored text. The bar is not
"looks like a real app." The bar is "faster than the doc." If a screen takes
more taps than typing your name into a cell, that screen has failed regardless
of how it looks.

## Visual direction

The subject is a weekly grid of school periods, which is genuinely a timetable,
so build a timetable rather than a dashboard. Dense, legible, information-first.
The most common actions are reading a grid and toggling checkboxes, so the grid
deserves the visual weight and everything else should get out of its way.

Pin the direction before writing components:

- **Palette:** four to six named values, defined once as CSS variables. One
  accent used only for the current user's own state, so scanning for yourself in
  a full grid is instant. Avoid warm cream backgrounds with terracotta accents
  and avoid near-black with a single acid accent, since both are current
  defaults and read as generic.
- **Type:** two faces. A body face optimized for small dense text, and a
  utility face for times, period labels, and counts, ideally with tabular
  figures so columns of times line up. Times misaligning across rows is the kind
  of small failure that makes a schedule feel untrustworthy.
- **Density:** tight. A week of five days by eight blocks should fit without
  feeling cramped. Generous whitespace is the wrong instinct for a timetable.
- **Signature:** the one memorable element is how availability reads at a
  glance. Solve that well and keep everything else quiet.

## Component rules

- Server Components by default. `'use client'` only where interactivity requires
  it, which is the availability checkboxes, the round join controls, and the
  forms.
- No component library beyond what Tailwind gives you unless a step names one.
- Loading states for anything that can take more than a moment. Skeletons that
  match the shape of the real content, not spinners.
- Optimistic updates on every toggle. A checkbox that waits for the server feels
  broken even when it is working.

## Writing rules for the interface

- Sentence case everywhere. No title case buttons.
- A button says what happens: "Join as judge," not "Submit."
- The same action keeps the same name through the whole flow. The button that
  says "Confirm round" produces a message that says "Round confirmed."
- Errors say what happened and what to do. Not "An error occurred."
- Empty states are an invitation to act, not a report of absence. An empty week
  says "No one has marked availability yet. Check the slots you are free for and
  your name will show here." Not "No data."
- Never use the word "user" in the interface.
- Do not apologize in system messages.

## Accessibility floor

- Every interactive element reachable by keyboard with a visible focus ring.
- Availability state is not conveyed by color alone, since the grid will be read
  quickly and some of the team will not distinguish the colors.
- Respect `prefers-reduced-motion`.
- Usable at 375px wide with no horizontal scrolling.

## Privacy in the interface

- Peer-facing screens show first name and last initial. Full names appear only
  in the admin console.
- A confirmed round's room is rendered only for participants and admins, and it
  must be absent from the server response for everyone else, not merely hidden.
