-- Step 11 resolves the write path decisions.md flagged as deferred here:
-- round_notes had a read policy (admin only) since step 03 but zero write
-- policies at all — nobody could insert one through the API. See
-- decisions.md, "Deferred to step 12: round_notes and school_requests
-- access control."
--
-- Insert: only the person who submitted the round_results row this note is
-- attached to, and only about a debater actually in that same round — a
-- single EXISTS covers both (submitted_by = auth.uid() on the result, and a
-- round_participants row for the same round matching about_user as a
-- debater).
create policy round_notes_insert_judge on round_notes
  for insert
  with check (
    school_id = auth_school_id()
    and exists (
      select 1
      from round_results rr
      join round_participants rp on rp.round_id = rr.round_id
      where rr.id = round_notes.result_id
        and rr.submitted_by = auth.uid()
        and rp.user_id = round_notes.about_user
        and rp.role = 'debater'
    )
  );

-- Select: adds "about_user themselves, or whoever wrote it" on top of the
-- existing admin-only policy from step 03 (round_notes_select_admin) —
-- Postgres ORs same-command RLS policies together, so this extends rather
-- than replaces it. Nobody else (not other debaters in the round, not
-- other judges) can read a note about someone else.
create policy round_notes_select_self_or_author on round_notes
  for select
  using (
    school_id = auth_school_id()
    and (
      about_user = auth.uid()
      or exists (
        select 1 from round_results rr
        where rr.id = round_notes.result_id and rr.submitted_by = auth.uid()
      )
    )
  );
