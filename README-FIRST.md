# Read this first

This folder is a build plan, not the app. You drop it into an empty folder,
open that folder in VS Code, start Claude Code, and tell it:

    Read CLAUDE.md, then read plan/PROGRESS.md and start the current step.

## What is in here

    CLAUDE.md              Standing rules Claude Code reads every session
    README-FIRST.md        This file
    plan/PROGRESS.md       The tracker. Claude Code updates it as it goes
    plan/00 .. 18          The build steps, in order
    plan/reference/        Schema, decisions, config, conventions

## Before you start

Nothing is required up front. Steps 04 through 11 and 13 through 15 build and
test against a fictional made-up school, not your real one — Claude Code
invents it. Your school's real bell schedule, rotation, term dates, and rooms
only get typed in later, by clicking through the setup wizard (step 12) like
any other admin would. `plan/reference/school-config.md` is a place to jot
down real facts as you learn them, useful for that later conversation, but
nothing reads it automatically and no step is blocked on it.

## A realistic expectation

Steps 00 through 12 produce a working app your team can actually use, onboarded
through the wizard rather than hand-edited into existence. Steps 13 through 18
round it out — leaderboard, archive, admin console, calendar sync, reminders,
and a security pass. If you get through step 12 by the end of a semester you
are doing well, and stopping there is a legitimate outcome rather than a
failure. The build order is deliberately arranged so the app never depends on
your school's specific facts being hardcoded anywhere.

## When something goes wrong

Claude Code will sometimes claim a step works when it does not. The verification
sections in each step file exist for that reason. Actually click through them
yourself. If a step says "log in as a debater and confirm you cannot see the
admin console," go do that, do not take the summary at face value.
