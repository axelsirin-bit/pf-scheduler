# Glossary

Debate vocabulary that appears in this codebase and in conversation with the
person building it. Use these terms in the interface rather than inventing
generic equivalents, because the users already speak this language and generic
labels make the app feel like it was built by someone outside the activity.

**PF, Public Forum** — a two-on-two debate format. Two teams of two, plus one
judge. This is why a round needs exactly five people.

**Round** — one complete debate. Roughly 45 minutes including prep and crossfire.

**Team** — a partnership of two debaters. In this app, `team` is 1 or 2 within a
round, not a persistent entity, because partnerships change and modeling them as
durable objects creates more problems than it solves.

**Pro and Con** — the two sides. Sometimes called Aff and Neg in other formats.
Often decided by coin flip in the room, which is why side is optional at round
formation.

**Judge** — decides the round and explains why. In this app the judge is also
the verification mechanism, since they submit the result.

**RFD, reason for decision** — the judge's written explanation of why they voted
the way they did. The most valuable artifact a practice round produces. This is
why the form requires real length rather than a single word.

**Flow** — the notes a debater takes tracking arguments through a round.
Sometimes a verb. `flow` is one of the link kinds in the archive.

**Speech doc** — the document containing the case and evidence read in a round,
shared with the opponent. Another link kind.

**Card** — a piece of quoted evidence with its citation. Not modeled in this
app.

**Topic, resolution** — the statement being debated, released by the NSDA on a
roughly monthly cycle. Stored as optional free text on a round.

**Lay judge** — a judge without competitive debate background, usually a parent
or community member. Very common in Public Forum. Relevant here because the app
should not assume every judge is a team member, even though v1 only supports
roster members as judges.

**Circuit** — the set of tournaments a team competes on. Local circuit and
national circuit are different competitive environments.

**Tabroom** — tabroom.com, the tournament management system nearly every US
tournament runs on. Used in this project only as a verification source for
whether someone requesting a school account is actually a coach there.

**NSDA** — National Speech and Debate Association. Sets the topics and the rules.

**Novice and varsity** — experience tiers. Not modeled as a field in v1, but
`grad_year` is on the profile if it becomes useful.

**Prelims and break** — preliminary rounds and elimination rounds at a
tournament. Not relevant to practice rounds, but it will come up in conversation.
