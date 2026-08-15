-- Step 05 — roster gating trigger.
--
-- Fires after every insert into auth.users, regardless of which auth method
-- created it (OAuth, admin API, etc. — they all end in an insert here).
-- Looks up an unclaimed roster_invites row by email; if found, creates the
-- matching profiles row and marks the invite claimed; if not, rejects the
-- whole signup by raising, which rolls back the auth.users insert too (see
-- PROGRESS.md for the empirical check that this actually leaves no trace).
--
-- security definer + pinned search_path, same reasoning as auth_school_id()
-- and auth_has_role() in step 03: this needs to read/write profiles and
-- roster_invites for a user who has no profile and no session yet, so it
-- must run with privileges that bypass RLS rather than as the caller.
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
  -- oldest unclaimed invite for this email, across any school — email isn't
  -- scoped to one school ahead of time, and the unique index only prevents
  -- duplicate invites *within* a school, not across schools
  select * into v_invite
  from roster_invites
  where lower(email) = lower(new.email) and claimed_at is null
  order by created_at asc
  limit 1;

  if v_invite.id is null then
    raise exception 'not_on_roster: % is not on any team roster', new.email;
  end if;

  -- Google OAuth populates raw_user_meta_data with 'full_name' and/or
  -- 'name'; falling back to the email's local part covers any other
  -- provider that doesn't set either.
  v_full_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(new.email, '@', 1)
  );

  -- display_name is first name + last initial, per decisions.md's privacy
  -- rules — peer-facing screens never show a full last name.
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

create trigger on_auth_user_created_roster_gate
  after insert on auth.users
  for each row
  execute function handle_new_user_roster_gate();
