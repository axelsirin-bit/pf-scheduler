-- Step 15 — admin console: audit logging, invite rate limiting, and the
-- second-admin approval check. The two-admin roster lock (task 4) was
-- explicitly dropped per the human's instruction — admins can invite
-- freely once the school is approved. See PROGRESS.md.

-- ---------------------------------------------------------------------
-- Audit log — populated entirely by triggers, never by application code,
-- so a code path that forgets to log can't create a silent gap. No
-- insert/update/delete policy exists on audit_log for any role (only
-- audit_log_select_admin from step 03) — this function is the only way
-- a row ever gets written, and nothing can modify one after the fact.
-- ---------------------------------------------------------------------

create or replace function write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
begin
  if tg_op = 'DELETE' then
    v_school_id := old.school_id;
  else
    v_school_id := new.school_id;
  end if;

  -- Skip genuine no-op updates — matters for profiles specifically, where
  -- last_seen_at (step 15 starts writing it on every sign-in) changes far
  -- more often than roles/is_active ever will; the trigger attached to
  -- profiles below only fires this function when one of those two
  -- actually changed, but this check is cheap insurance for any other
  -- table too.
  if tg_op = 'UPDATE' and old is not distinct from new then
    return new;
  end if;

  insert into audit_log (school_id, actor_id, action, entity_type, entity_id, before, after)
  values (
    v_school_id,
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    case when tg_op = 'DELETE' then old.id::text else new.id::text end,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger roster_invites_audit
  after insert or update or delete on roster_invites
  for each row execute function write_audit_log();

create trigger rooms_audit
  after insert or update or delete on rooms
  for each row execute function write_audit_log();

-- profiles gets its own trigger with a WHEN clause rather than reusing
-- the bare AFTER UPDATE above — every profiles update should not become
-- an audit row (last_seen_at bumps on every sign-in would flood it),
-- only ones that actually change roles or is_active, which is what an
-- admin action (deactivate, or a future role change) looks like.
create trigger profiles_audit
  after update on profiles
  for each row
  when (old.roles is distinct from new.roles or old.is_active is distinct from new.is_active)
  execute function write_audit_log();

-- ---------------------------------------------------------------------
-- Invite rate limiting — more than 10 invites from a school in a rolling
-- hour get created as pending (needs_approval = true) rather than
-- rejected outright, per task 3's "pending state, not a hard block."
-- Fixed constant, not a schools column — same treatment as step 11's
-- 150-character RFD minimum, an app policy rather than school-specific
-- configuration.
-- ---------------------------------------------------------------------

create or replace function roster_invites_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_count int;
begin
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

create trigger roster_invites_rate_limit_trigger
  before insert on roster_invites
  for each row
  execute function roster_invites_rate_limit();

-- ---------------------------------------------------------------------
-- Second-admin approval — the actual control described in task 3
-- ("one compromised admin account cannot quietly add users"). Whoever
-- created the pending invite can't be the one who clears it; enforced
-- here rather than only in the app, since this is a real security
-- property, not just a UX guard.
-- ---------------------------------------------------------------------

create or replace function roster_invites_approve_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.approved_by is distinct from old.approved_by and new.approved_by is not null then
    if new.approved_by = new.invited_by then
      raise exception 'A pending invite must be approved by a different admin than the one who created it.';
    end if;
  end if;

  return new;
end;
$$;

create trigger roster_invites_approve_check_trigger
  before update on roster_invites
  for each row
  execute function roster_invites_approve_check();

-- ---------------------------------------------------------------------
-- Roster gating (step 05) — reject sign-up for an invite that's still
-- pending a second admin's approval. CREATE OR REPLACE keeps the
-- existing trigger attached; only the function body changes.
-- ---------------------------------------------------------------------

create or replace function handle_new_user_roster_gate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite       roster_invites%rowtype;
  v_profile_id   uuid;
  v_full_name    text;
  v_display_name text;
  v_name_parts   text[];
begin
  select * into v_invite
  from roster_invites
  where lower(email) = lower(new.email) and claimed_at is null
  order by created_at asc
  limit 1;

  if v_invite.id is null then
    raise exception 'not_on_roster: % is not on any team roster', new.email;
  end if;

  if v_invite.needs_approval and v_invite.approved_by is null then
    raise exception 'pending_approval: the invite for % is awaiting a second admin''s approval', new.email;
  end if;

  v_full_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(new.email, '@', 1)
  );

  v_name_parts := regexp_split_to_array(trim(v_full_name), '\s+');
  if array_length(v_name_parts, 1) > 1 then
    v_display_name := v_name_parts[1] || ' ' || left(v_name_parts[array_length(v_name_parts, 1)], 1) || '.';
  else
    v_display_name := v_name_parts[1];
  end if;

  insert into profiles (id, school_id, email, full_name, display_name, roles)
  values (new.id, v_invite.school_id, new.email, v_full_name, v_display_name, v_invite.roles)
  returning id into v_profile_id;

  update roster_invites
  set claimed_at = now(), claimed_by = v_profile_id
  where id = v_invite.id;

  return new;
end;
$$;
