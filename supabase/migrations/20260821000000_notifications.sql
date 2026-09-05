-- Step 17 — notifications and reminders.
--
-- notifications_sent already existed (step 02) with a unique index on
-- (kind, round_id, user_id) meant for idempotency, but that index does
-- nothing for the two admin-only notifications this step adds (invite
-- rate-limit approval, pending calendar import) — neither is round-scoped,
-- so round_id is null for both, and Postgres unique indexes never treat
-- two nulls as equal, meaning that column contributes no uniqueness at all
-- when it's null. A plain composite index can't fix this: adding a second
-- nullable column to the same index just moves the same hole around,
-- since a matching round_id + a null entity_id (or vice versa) still
-- never conflicts. Two partial unique indexes — one scoped to real round
-- notifications, one to real entity notifications — is the standard fix.
alter table notifications_sent add column entity_id uuid;

-- Finds and drops the original unique index by its actual definition
-- rather than a guessed name — it was created as an anonymous
-- `create unique index on ... (...)`, and Postgres's auto-naming for that
-- form isn't worth hardcoding a guess for when pg_indexes can just be
-- asked directly.
do $$
declare
  v_index_name text;
begin
  select indexname into v_index_name
  from pg_indexes
  where tablename = 'notifications_sent'
    and indexdef ilike '%unique index%(kind, round_id, user_id)%';

  if v_index_name is not null then
    execute format('drop index %I', v_index_name);
  end if;
end $$;

create unique index notifications_sent_round_unique
  on notifications_sent (kind, round_id, user_id)
  where round_id is not null;

create unique index notifications_sent_entity_unique
  on notifications_sent (kind, entity_id, user_id)
  where entity_id is not null;

-- ---------------------------------------------------------------------
-- Per-user email preference (task 5). 'all' = every round email across
-- the whole school, not just rounds this person is actually in — the
-- meaningful half of the toggle, since every round email already goes to
-- that round's real participants regardless of preference. 'my_rounds'
-- (the default for everyone but admins) never adds anyone beyond the
-- round's actual roster. Admins default to 'all' so the two
-- admin-specific emails aren't the only team-wide visibility they have.
-- ---------------------------------------------------------------------

alter table profiles add column email_preference text not null default 'my_rounds'
  check (email_preference in ('all', 'my_rounds'));

-- create or replace: same trigger from step 05, extended again (step 15
-- added the pending-approval rejection) — this adds the role-based
-- default for the one new column a brand-new profile needs opinions
-- about. Admins get 'all' since decisions.md's two-admin-rule school will
-- have very few of them and they're the ones actually coordinating
-- across every round, not just their own.
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
  v_email_pref   text;
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

  v_email_pref := case when 'admin' = any(v_invite.roles) then 'all' else 'my_rounds' end;

  insert into profiles (id, school_id, email, full_name, display_name, roles, email_preference)
  values (new.id, v_invite.school_id, new.email, v_full_name, v_display_name, v_invite.roles, v_email_pref)
  returning id into v_profile_id;

  update roster_invites
  set claimed_at = now(), claimed_by = v_profile_id
  where id = v_invite.id;

  return new;
end;
$$;
