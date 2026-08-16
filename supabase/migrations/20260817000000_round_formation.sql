-- Step 10 — round formation triggers.
--
-- Two triggers on round_participants, both security definer like the
-- existing roster-gating and profile-restriction triggers (see
-- 20260816000000_auth_roster_gating.sql and 20260815000000's
-- profiles_restrict_self_update) — that's what makes "cannot be reached in
-- an inconsistent state" actually true, independent of whatever RLS would
-- otherwise allow the calling user to do.
--
-- The one-row-per-user-per-round constraint and the at-most-one-judge rule
-- are already enforced by existing unique indexes (round_participants
-- (round_id, user_id), and the partial unique index on role = 'judge') —
-- Postgres raises a duplicate-key error for those on its own. Nothing new
-- needed here for either.

create or replace function round_participants_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round rounds%rowtype;
  v_team_count int;
  v_other_round_id uuid;
begin
  -- Locking the parent round row here is what actually closes the race on
  -- the last open spot: two concurrent inserts targeting the same round now
  -- serialize on this lock instead of both reading "4 participants" under
  -- read-committed and both proceeding to insert a 5th and 6th.
  select * into v_round from rounds where id = new.round_id for update;

  if not found then
    raise exception 'Round % does not exist.', new.round_id;
  end if;

  if new.school_id <> v_round.school_id then
    raise exception 'School mismatch between round and participant.';
  end if;

  if v_round.status <> 'forming' then
    raise exception 'This round is not accepting new participants.';
  end if;

  if new.role = 'debater' then
    select count(*) into v_team_count
    from round_participants
    where round_id = new.round_id and role = 'debater' and team = new.team;

    if v_team_count >= 2 then
      raise exception 'Team % already has two debaters.', new.team;
    end if;
  end if;

  -- A user cannot be in two rounds for the same time slot at once — but a
  -- cancelled or expired round on that slot shouldn't keep blocking a
  -- fresh one from forming there later.
  select rp.round_id into v_other_round_id
  from round_participants rp
  join rounds r on r.id = rp.round_id
  where r.slot_id = v_round.slot_id
    and rp.user_id = new.user_id
    and rp.round_id <> new.round_id
    and r.status not in ('cancelled', 'expired')
  limit 1;

  if v_other_round_id is not null then
    raise exception 'You are already in another round for this time slot.';
  end if;

  return new;
end;
$$;

create trigger round_participants_before_insert_trigger
  before insert on round_participants
  for each row
  execute function round_participants_before_insert();

-- AFTER INSERT, still inside the same transaction as the BEFORE trigger
-- above — the row lock it took on the parent round is still held, so no new
-- race window opens between the two triggers for the same insert statement.
create or replace function round_participants_maybe_confirm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_debater_team1 int;
  v_debater_team2 int;
  v_judge_count int;
begin
  select
    count(*) filter (where role = 'debater' and team = 1),
    count(*) filter (where role = 'debater' and team = 2),
    count(*) filter (where role = 'judge')
    into v_debater_team1, v_debater_team2, v_judge_count
  from round_participants
  where round_id = new.round_id;

  if v_debater_team1 = 2 and v_debater_team2 = 2 and v_judge_count = 1 then
    update rounds
    set status = 'confirmed', confirmed_at = now()
    where id = new.round_id and status = 'forming';
  end if;

  return new;
end;
$$;

create trigger round_participants_maybe_confirm_trigger
  after insert on round_participants
  for each row
  execute function round_participants_maybe_confirm();
