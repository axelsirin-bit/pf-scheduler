-- Step 11 — a confirmed round whose slot ended a while ago with no result
-- gets a real status, not just a computed display flag (unlike "needsRoom"
-- in step 10, the step file names this one exactly like the other status
-- values and expects it to be surfaced on the judge's own page and the
-- admin console — that only works cleanly as a real column value).
alter type round_status add value 'awaiting_result' before 'expired';
