# Step 13 — Leaderboard

## Goal

A participation board showing who has completed how many rounds this term,
designed so that most of the team can be doing fine rather than most of the team
losing.

## The design decision that matters

A single ranked list tells the bottom two thirds of the team that they are
failing at practicing, and those are exactly the people the schedule exists to
reach. So the board has two parts: an on-track line that most people can be
above, and a short top list. Build both. If asked to simplify it to a plain
ranking, push back and point at this paragraph.

## Rules

- Counts reset each term, using `school_terms`.
- A maximum of two rounds per person per calendar week count toward the total,
  so a person with free afternoons cannot farm the metric.
- Judging counts, at the same weight as debating, and is shown as a separate
  column rather than merged into one number.
- Only `completed` rounds count. `expired` rounds count for nobody.
- The expected number for the term comes from a setting on the school, defaulting
  to one round every two weeks.

## Tasks

1. **`v_participation` view** computing per-user, per-term, per-week counts with
   the weekly cap applied. Do the capping in SQL, not in application code, so
   the leaderboard and any future export agree.

2. **`v_leaderboard` view** aggregating that into per-term totals with an
   on-track boolean.

3. **Page** at `/leaderboard` showing:
   - the current term and how many rounds are expected in it
   - an on-track section listing everyone at or above the expectation, in
     alphabetical order, not ranked
   - a top five section, ranked, showing debate and judge counts
   - the current user's own line, always visible, wherever they fall

4. **Names.** First name and last initial. Full names nowhere on this page.

5. **Admin view** of the same data with full names and a per-person breakdown,
   at `/admin/participation`. This is the view a coach uses, and it is the one
   place full names belong.

## Acceptance criteria

- A user with four completed rounds in one week shows two, not four.
- Judging a round credits the judge.
- An expired round credits nobody.
- Term rollover produces a fresh board and the previous term remains viewable.
- A debater sees no full last names.

## Do not

- Do not add win rates, records, or any performance metric to the participation
  board. It measures showing up. Mixing in results turns it into a ranking of
  who is good, which changes who signs up and not in the direction you want.
