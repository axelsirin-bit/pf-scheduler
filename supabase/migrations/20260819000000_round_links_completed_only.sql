-- Step 14: links only belong on rounds that have actually finished. The
-- archive only ever lists completed rounds, and task 4's wording ("add a
-- link to a completed round") reads as a real restriction, not loose
-- phrasing — every other invariant in this codebase (round capacity in
-- step 10, result validation in step 11) is pushed into the database
-- rather than left as an app-only check, so this follows the same
-- pattern. ALTER POLICY replaces just the WITH CHECK expression; select,
-- update, and delete on round_links are unaffected — a link doesn't need
-- to vanish if a round were somehow un-completed later, only new inserts
-- are gated.
alter policy round_links_insert_participant_or_admin on round_links
  with check (
    school_id = auth_school_id()
    and added_by = auth.uid()
    and exists (
      select 1 from rounds r
      where r.id = round_links.round_id and r.status = 'completed'
    )
    and (
      auth_has_role('admin')
      or exists (
        select 1 from round_participants rp
        where rp.round_id = round_links.round_id and rp.user_id = auth.uid()
      )
    )
  );
