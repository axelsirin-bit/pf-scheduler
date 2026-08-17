-- Fixes a real gap found while verifying step 15: inviteRosterMembers
-- (onboarding.ts, step 12) never sets invited_by on insert, so it's
-- always null. roster_invites_approve_check_trigger's "a different admin
-- than the one who created it" rule compares new.approved_by =
-- new.invited_by — against null, that comparison is never true in SQL,
-- so the check would silently never block anyone, defeating the whole
-- point of the rate limit's second-admin control. Pushed into the same
-- before-insert trigger that already runs on every roster_invites
-- insert (roster_invites_rate_limit) rather than adding a second
-- trigger just for this — one function, two related concerns on the
-- same row.
create or replace function roster_invites_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_count int;
begin
  new.invited_by := coalesce(new.invited_by, auth.uid());

  select count(*) into v_recent_count
  from roster_invites
  where school_id = new.school_id
    and created_at >= now() - interval '1 hour';

  if v_recent_count >= 10 then
    new.needs_approval := true;
  end if;

  return new;
end;
$$;
