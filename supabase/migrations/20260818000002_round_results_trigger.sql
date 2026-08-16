-- Step 11 — validates a round_results insert and marks the round completed,
-- both in one place, same security definer + row-locking pattern as step
-- 10's round_participants triggers (20260817000000_round_formation.sql).
--
-- round_results has no unique constraint tying it to "at most one original
-- per round" — nothing in the schema stops two supersedes-null rows for the
-- same round on its own, so that's enforced here, not assumed.
create or replace function round_results_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round rounds%rowtype;
  v_supersedes_round_id uuid;
begin
  -- Locked for the duration of this transaction — closes the same class of
  -- race step 10 closed for joining: two near-simultaneous original
  -- submissions (a double-click, or a genuine race) now serialize instead
  -- of both reading "no result yet" and both inserting.
  select * into v_round from rounds where id = new.round_id for update;

  if not found then
    raise exception 'Round % does not exist.', new.round_id;
  end if;

  if new.school_id <> v_round.school_id then
    raise exception 'School mismatch between round and result.';
  end if;

  if new.supersedes is null then
    -- Original submission.
    if v_round.status not in ('confirmed', 'awaiting_result') then
      raise exception 'This round is not ready for a result.';
    end if;

    if exists (select 1 from round_results where round_id = new.round_id) then
      raise exception 'This round already has a result. Submit a correction instead.';
    end if;
  else
    -- Correction: only once the round is already completed, and only
    -- superseding the current head of that round's chain — never a result
    -- from a different round, and never one that's already been corrected
    -- itself (corrections chain linearly, they don't branch).
    if v_round.status <> 'completed' then
      raise exception 'Only a completed round can receive a correction.';
    end if;

    select round_id into v_supersedes_round_id
    from round_results
    where id = new.supersedes;

    if v_supersedes_round_id is null or v_supersedes_round_id <> new.round_id then
      raise exception 'A correction must supersede a result from the same round.';
    end if;

    if exists (select 1 from round_results where supersedes = new.supersedes) then
      raise exception 'That result has already been superseded.';
    end if;
  end if;

  -- completed_at is set once, on the original submission, and never moved
  -- by a later correction.
  update rounds
  set status = 'completed', completed_at = coalesce(completed_at, now())
  where id = new.round_id;

  return new;
end;
$$;

create trigger round_results_before_insert_trigger
  before insert on round_results
  for each row
  execute function round_results_before_insert();
