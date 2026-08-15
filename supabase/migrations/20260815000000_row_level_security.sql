-- Step 03 — row level security.
--
-- Order matters: helper functions first (policies below depend on them),
-- then the two pre-existing-bug fixes (view RLS bypass, profiles
-- self-escalation), then RLS enabled + policies on every table.
--
-- school_terms is enabled here too even though it wasn't named in either the
-- step file's or the human's policy list — it's plainly school-scoped
-- (has school_id) and fits the same "own school select, admin write" shape
-- as period_templates/rooms/etc., so the same pattern is applied rather than
-- leaving it as the one unprotected table. See PROGRESS.md.
--
-- round_notes and school_requests access control is intentionally deferred
-- to step 12 — see decisions.md. round_notes gets a conservative admin-only
-- read and no write policies at all for now. school_requests gets RLS
-- enabled with zero policies (deny-all via PostgREST; only the service role
-- can touch it), since it has no school_id and predates authentication
-- entirely — the step 12 registration flow has to define its own model.

-- ---------------------------------------------------------------------
-- helper functions
-- ---------------------------------------------------------------------

create or replace function auth_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select school_id from profiles where id = auth.uid()
$$;

create or replace function auth_has_role(p_role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_role = any(roles) from profiles where id = auth.uid()
$$;

-- ---------------------------------------------------------------------
-- fix: views bypass RLS by default (Postgres checks view-owner privileges,
-- not the querying user's, unless security_invoker is on). Without this,
-- v_participation/v_leaderboard would leak every school's rows to anyone.
-- ---------------------------------------------------------------------

alter view v_participation set (security_invoker = on);
alter view v_leaderboard set (security_invoker = on);

-- ---------------------------------------------------------------------
-- fix: "profiles update: self or admin" taken literally lets a debater
-- grant themselves admin by updating their own row. The RLS policy below
-- still allows the row-level update; this trigger blocks the specific
-- columns a non-admin must never be able to change on themselves.
-- ---------------------------------------------------------------------

create or replace function profiles_restrict_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth_has_role('admin') then
    return new;
  end if;

  if new.roles is distinct from old.roles
     or new.school_id is distinct from old.school_id
     or new.is_active is distinct from old.is_active then
    raise exception 'Only an admin can change roles, school_id, or is_active.';
  end if;

  return new;
end;
$$;

create trigger profiles_restrict_self_update_trigger
  before update on profiles
  for each row
  execute function profiles_restrict_self_update();

-- ---------------------------------------------------------------------
-- schools
-- ---------------------------------------------------------------------

alter table schools enable row level security;

create policy schools_select on schools
  for select
  using (id = auth_school_id());

create policy schools_update_admin on schools
  for update
  using (id = auth_school_id() and auth_has_role('admin'))
  with check (id = auth_school_id() and auth_has_role('admin'));

-- ---------------------------------------------------------------------
-- school_terms (see header note — not in the step's list, same pattern
-- as the other structural/reference tables)
-- ---------------------------------------------------------------------

alter table school_terms enable row level security;

create policy school_terms_select on school_terms
  for select
  using (school_id = auth_school_id());

create policy school_terms_insert_admin on school_terms
  for insert
  with check (school_id = auth_school_id() and auth_has_role('admin'));

create policy school_terms_update_admin on school_terms
  for update
  using (school_id = auth_school_id() and auth_has_role('admin'))
  with check (school_id = auth_school_id() and auth_has_role('admin'));

create policy school_terms_delete_admin on school_terms
  for delete
  using (school_id = auth_school_id() and auth_has_role('admin'));

-- ---------------------------------------------------------------------
-- profiles, roster_invites
-- ---------------------------------------------------------------------

alter table profiles enable row level security;

create policy profiles_select on profiles
  for select
  using (school_id = auth_school_id());

create policy profiles_update_self_or_admin on profiles
  for update
  using (id = auth.uid() or (school_id = auth_school_id() and auth_has_role('admin')))
  with check (id = auth.uid() or (school_id = auth_school_id() and auth_has_role('admin')));
-- no insert policy: profiles are created by the auth.users trigger in step 05
-- no delete policy

alter table roster_invites enable row level security;

create policy roster_invites_select_admin on roster_invites
  for select
  using (school_id = auth_school_id() and auth_has_role('admin'));

create policy roster_invites_insert_admin on roster_invites
  for insert
  with check (school_id = auth_school_id() and auth_has_role('admin'));

create policy roster_invites_update_admin on roster_invites
  for update
  using (school_id = auth_school_id() and auth_has_role('admin'))
  with check (school_id = auth_school_id() and auth_has_role('admin'));

create policy roster_invites_delete_admin on roster_invites
  for delete
  using (school_id = auth_school_id() and auth_has_role('admin'));

-- ---------------------------------------------------------------------
-- schedule structure: period_templates, template_blocks, day_types,
-- schedule_variants, calendar_days, slots, rooms — all "own school select,
-- admin write"
-- ---------------------------------------------------------------------

alter table period_templates enable row level security;
create policy period_templates_select on period_templates
  for select using (school_id = auth_school_id());
create policy period_templates_insert_admin on period_templates
  for insert with check (school_id = auth_school_id() and auth_has_role('admin'));
create policy period_templates_update_admin on period_templates
  for update using (school_id = auth_school_id() and auth_has_role('admin'))
  with check (school_id = auth_school_id() and auth_has_role('admin'));
create policy period_templates_delete_admin on period_templates
  for delete using (school_id = auth_school_id() and auth_has_role('admin'));

alter table template_blocks enable row level security;
create policy template_blocks_select on template_blocks
  for select using (school_id = auth_school_id());
create policy template_blocks_insert_admin on template_blocks
  for insert with check (school_id = auth_school_id() and auth_has_role('admin'));
create policy template_blocks_update_admin on template_blocks
  for update using (school_id = auth_school_id() and auth_has_role('admin'))
  with check (school_id = auth_school_id() and auth_has_role('admin'));
create policy template_blocks_delete_admin on template_blocks
  for delete using (school_id = auth_school_id() and auth_has_role('admin'));

alter table day_types enable row level security;
create policy day_types_select on day_types
  for select using (school_id = auth_school_id());
create policy day_types_insert_admin on day_types
  for insert with check (school_id = auth_school_id() and auth_has_role('admin'));
create policy day_types_update_admin on day_types
  for update using (school_id = auth_school_id() and auth_has_role('admin'))
  with check (school_id = auth_school_id() and auth_has_role('admin'));
create policy day_types_delete_admin on day_types
  for delete using (school_id = auth_school_id() and auth_has_role('admin'));

alter table schedule_variants enable row level security;
create policy schedule_variants_select on schedule_variants
  for select using (school_id = auth_school_id());
create policy schedule_variants_insert_admin on schedule_variants
  for insert with check (school_id = auth_school_id() and auth_has_role('admin'));
create policy schedule_variants_update_admin on schedule_variants
  for update using (school_id = auth_school_id() and auth_has_role('admin'))
  with check (school_id = auth_school_id() and auth_has_role('admin'));
create policy schedule_variants_delete_admin on schedule_variants
  for delete using (school_id = auth_school_id() and auth_has_role('admin'));

alter table calendar_days enable row level security;
create policy calendar_days_select on calendar_days
  for select using (school_id = auth_school_id());
create policy calendar_days_insert_admin on calendar_days
  for insert with check (school_id = auth_school_id() and auth_has_role('admin'));
create policy calendar_days_update_admin on calendar_days
  for update using (school_id = auth_school_id() and auth_has_role('admin'))
  with check (school_id = auth_school_id() and auth_has_role('admin'));
create policy calendar_days_delete_admin on calendar_days
  for delete using (school_id = auth_school_id() and auth_has_role('admin'));

alter table slots enable row level security;
create policy slots_select on slots
  for select using (school_id = auth_school_id());
create policy slots_insert_admin on slots
  for insert with check (school_id = auth_school_id() and auth_has_role('admin'));
create policy slots_update_admin on slots
  for update using (school_id = auth_school_id() and auth_has_role('admin'))
  with check (school_id = auth_school_id() and auth_has_role('admin'));
create policy slots_delete_admin on slots
  for delete using (school_id = auth_school_id() and auth_has_role('admin'));

alter table rooms enable row level security;
create policy rooms_select on rooms
  for select using (school_id = auth_school_id());
create policy rooms_insert_admin on rooms
  for insert with check (school_id = auth_school_id() and auth_has_role('admin'));
create policy rooms_update_admin on rooms
  for update using (school_id = auth_school_id() and auth_has_role('admin'))
  with check (school_id = auth_school_id() and auth_has_role('admin'));
create policy rooms_delete_admin on rooms
  for delete using (school_id = auth_school_id() and auth_has_role('admin'));

-- ---------------------------------------------------------------------
-- availability and rounds
-- ---------------------------------------------------------------------

alter table availabilities enable row level security;

create policy availabilities_select on availabilities
  for select
  using (school_id = auth_school_id());

create policy availabilities_insert_self on availabilities
  for insert
  with check (school_id = auth_school_id() and user_id = auth.uid());

create policy availabilities_delete_self on availabilities
  for delete
  using (school_id = auth_school_id() and user_id = auth.uid());
-- no update policy

alter table rounds enable row level security;

create policy rounds_select on rounds
  for select
  using (school_id = auth_school_id());

create policy rounds_insert_member on rounds
  for insert
  with check (school_id = auth_school_id() and created_by = auth.uid());

create policy rounds_update_participant_or_admin on rounds
  for update
  using (
    school_id = auth_school_id()
    and (
      auth_has_role('admin')
      or exists (
        select 1 from round_participants rp
        where rp.round_id = rounds.id and rp.user_id = auth.uid()
      )
    )
  )
  with check (
    school_id = auth_school_id()
    and (
      auth_has_role('admin')
      or exists (
        select 1 from round_participants rp
        where rp.round_id = rounds.id and rp.user_id = auth.uid()
      )
    )
  );
-- no delete policy

alter table round_participants enable row level security;

create policy round_participants_select on round_participants
  for select
  using (school_id = auth_school_id());

create policy round_participants_insert_self on round_participants
  for insert
  with check (school_id = auth_school_id() and user_id = auth.uid());

create policy round_participants_delete_self_forming on round_participants
  for delete
  using (
    school_id = auth_school_id()
    and user_id = auth.uid()
    and exists (
      select 1 from rounds r
      where r.id = round_participants.round_id and r.status = 'forming'
    )
  );
-- no update policy

alter table round_results enable row level security;

create policy round_results_select on round_results
  for select
  using (school_id = auth_school_id());

create policy round_results_insert_judge on round_results
  for insert
  with check (
    school_id = auth_school_id()
    and submitted_by = auth.uid()
    and exists (
      select 1 from round_participants rp
      where rp.round_id = round_results.round_id
        and rp.user_id = auth.uid()
        and rp.role = 'judge'
    )
  );
-- no update, no delete — append-only, corrections are new rows via `supersedes`

-- round_notes: deferred to step 12 for the real privacy model (see
-- decisions.md). Conservative default for now: admins can read, nobody
-- writes through the API at all.
alter table round_notes enable row level security;

create policy round_notes_select_admin on round_notes
  for select
  using (school_id = auth_school_id() and auth_has_role('admin'));

alter table round_links enable row level security;

create policy round_links_select on round_links
  for select
  using (school_id = auth_school_id());

create policy round_links_insert_participant_or_admin on round_links
  for insert
  with check (
    school_id = auth_school_id()
    and added_by = auth.uid()
    and (
      auth_has_role('admin')
      or exists (
        select 1 from round_participants rp
        where rp.round_id = round_links.round_id and rp.user_id = auth.uid()
      )
    )
  );

create policy round_links_update_own on round_links
  for update
  using (school_id = auth_school_id() and added_by = auth.uid())
  with check (school_id = auth_school_id() and added_by = auth.uid());

create policy round_links_delete_own on round_links
  for delete
  using (school_id = auth_school_id() and added_by = auth.uid());

-- ---------------------------------------------------------------------
-- admin and integrations
-- ---------------------------------------------------------------------

alter table audit_log enable row level security;

create policy audit_log_select_admin on audit_log
  for select
  using (school_id = auth_school_id() and auth_has_role('admin'));
-- no insert/update/delete policies — written by a trigger in a later step,
-- which runs with elevated privileges independent of these policies

alter table ics_sources enable row level security;
create policy ics_sources_select_admin on ics_sources
  for select using (school_id = auth_school_id() and auth_has_role('admin'));
create policy ics_sources_insert_admin on ics_sources
  for insert with check (school_id = auth_school_id() and auth_has_role('admin'));
create policy ics_sources_update_admin on ics_sources
  for update using (school_id = auth_school_id() and auth_has_role('admin'))
  with check (school_id = auth_school_id() and auth_has_role('admin'));
create policy ics_sources_delete_admin on ics_sources
  for delete using (school_id = auth_school_id() and auth_has_role('admin'));

alter table ics_import_batches enable row level security;
create policy ics_import_batches_select_admin on ics_import_batches
  for select using (school_id = auth_school_id() and auth_has_role('admin'));
create policy ics_import_batches_insert_admin on ics_import_batches
  for insert with check (school_id = auth_school_id() and auth_has_role('admin'));
create policy ics_import_batches_update_admin on ics_import_batches
  for update using (school_id = auth_school_id() and auth_has_role('admin'))
  with check (school_id = auth_school_id() and auth_has_role('admin'));
create policy ics_import_batches_delete_admin on ics_import_batches
  for delete using (school_id = auth_school_id() and auth_has_role('admin'));

alter table notifications_sent enable row level security;

create policy notifications_sent_select_admin on notifications_sent
  for select
  using (school_id = auth_school_id() and auth_has_role('admin'));
-- no insert/update/delete policies — written by the service role from a
-- cron job in step 17

-- school_requests: deferred to step 12 (see decisions.md). No school_id
-- column exists to scope by, and it predates authentication entirely — a
-- visitor with no account submits one. RLS is enabled with zero policies,
-- which denies all access via the anon/authenticated roles; only the
-- service role can read or write it until step 12 defines the real model.
alter table school_requests enable row level security;
