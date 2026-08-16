-- Step 10 finding: rounds has never had a delete policy (see
-- 20260815000000_row_level_security.sql, "no delete policy" — deliberate,
-- rounds are meant to be an audit trail, not freely deletable).
--
-- joinRound's own cleanup path needs one narrow exception: when it creates
-- a brand-new round and the very first participant insert then fails (the
-- "you're already in another round for this time slot" trigger rejection
-- is the real-world case — see round_participants_before_insert in
-- 20260817000000_round_formation.sql), it tries to delete the round it
-- just created rather than leave an empty orphan behind. Caught live: that
-- delete was silently affecting zero rows under the existing RLS (no
-- policy = deny, not an error), so the orphan was never actually removed.
--
-- Scoped as narrowly as the cleanup case requires: the creator, only while
-- still forming, and only when it has zero participants. A round with even
-- one real participant can never be deleted through this policy, forming
-- or not — only a round that never actually got off the ground.
create policy rounds_delete_own_empty_forming on rounds
  for delete
  using (
    school_id = auth_school_id()
    and created_by = auth.uid()
    and status = 'forming'
    and not exists (select 1 from round_participants where round_id = rounds.id)
  );
