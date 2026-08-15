-- Step 03 — RLS verification.
--
-- Seeds two schools (School A, School B), each with one admin and two
-- debaters, plus enough schedule/round fixtures to exercise every table in
-- the step file's test list. Runs the ten required assertions as the real
-- `authenticated` Postgres role with a simulated JWT (SET LOCAL ROLE +
-- request.jwt.claims), not as postgres, so it goes through the actual RLS
-- policies rather than bypassing them. Cleans up its own fixtures on every
-- run, success or failure, and reports a table of pass/fail with details.
--
-- Run with: npm run verify:rls
-- Requires SUPABASE_ACCESS_TOKEN in the environment (same as types:gen).
--
-- Exit code is non-zero if any assertion fails — see the final DO block.

-- ---------------------------------------------------------------------
-- cleanup helper — explicit dependency order, not relying on cascade
-- timing across sibling ON DELETE RESTRICT relationships (calendar_days ->
-- schedule_variants, slots -> template_blocks, rounds -> slots, etc. would
-- risk a restrict-vs-cascade race if left to `delete from schools` alone).
-- ---------------------------------------------------------------------

create or replace function _rls_test_cleanup()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from round_links where school_id in (select id from schools where slug in ('rls-test-school-a','rls-test-school-b'));
  delete from round_results where school_id in (select id from schools where slug in ('rls-test-school-a','rls-test-school-b'));
  delete from availabilities where school_id in (select id from schools where slug in ('rls-test-school-a','rls-test-school-b'));
  delete from rounds where school_id in (select id from schools where slug in ('rls-test-school-a','rls-test-school-b'));
  delete from slots where school_id in (select id from schools where slug in ('rls-test-school-a','rls-test-school-b'));
  delete from calendar_days where school_id in (select id from schools where slug in ('rls-test-school-a','rls-test-school-b'));
  delete from schedule_variants where school_id in (select id from schools where slug in ('rls-test-school-a','rls-test-school-b'));
  delete from template_blocks where school_id in (select id from schools where slug in ('rls-test-school-a','rls-test-school-b'));
  delete from period_templates where school_id in (select id from schools where slug in ('rls-test-school-a','rls-test-school-b'));
  delete from roster_invites where school_id in (select id from schools where slug in ('rls-test-school-a','rls-test-school-b'));
  delete from audit_log where school_id in (select id from schools where slug in ('rls-test-school-a','rls-test-school-b'));
  delete from auth.users where email like '%@rls-test.local'; -- cascades to profiles
  delete from schools where slug in ('rls-test-school-a','rls-test-school-b');
end;
$$;

-- pre-clean, in case a previous run errored before reaching its own cleanup
select _rls_test_cleanup();

create temporary table if not exists rls_test_results (
  seq       serial primary key,
  assertion text not null,
  passed    boolean not null,
  detail    text
);
truncate rls_test_results;

do $$
declare
  v_school_a       uuid;
  v_school_b       uuid;
  v_admin_a        uuid;
  v_debater_a1     uuid;
  v_debater_a2     uuid;
  v_admin_b        uuid;
  v_debater_b1     uuid;
  v_debater_b2     uuid;
  v_template_a     uuid;
  v_template_b     uuid;
  v_block_a        uuid;
  v_block_b        uuid;
  v_variant_a      uuid;
  v_variant_b      uuid;
  v_calday_a       uuid;
  v_calday_b       uuid;
  v_slot_a         uuid;
  v_slot_b         uuid;
  v_round_a        uuid;
  v_round_b        uuid;
  v_round_link_b   uuid;
  v_round_result_a uuid;
  v_count          int;
  v_count2         int;
  v_ok             boolean;
  v_detail         text;
begin
  -- =====================================================================
  -- fixtures (run as postgres, which has BYPASSRLS — this is setup, not
  -- part of the test)
  -- =====================================================================

  insert into schools (name, slug, status) values ('RLS Test School A', 'rls-test-school-a', 'active') returning id into v_school_a;
  insert into schools (name, slug, status) values ('RLS Test School B', 'rls-test-school-b', 'active') returning id into v_school_b;

  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-a@rls-test.local', '', now(), now(), now(), '{}', '{}')
    returning id into v_admin_a;
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'debater-a1@rls-test.local', '', now(), now(), now(), '{}', '{}')
    returning id into v_debater_a1;
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'debater-a2@rls-test.local', '', now(), now(), now(), '{}', '{}')
    returning id into v_debater_a2;
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-b@rls-test.local', '', now(), now(), now(), '{}', '{}')
    returning id into v_admin_b;
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'debater-b1@rls-test.local', '', now(), now(), now(), '{}', '{}')
    returning id into v_debater_b1;
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'debater-b2@rls-test.local', '', now(), now(), now(), '{}', '{}')
    returning id into v_debater_b2;

  insert into profiles (id, school_id, email, full_name, display_name, roles) values
    (v_admin_a,    v_school_a, 'admin-a@rls-test.local',    'Admin A',    'Admin A.',    '{admin}'),
    (v_debater_a1, v_school_a, 'debater-a1@rls-test.local', 'Debater A1', 'Debater A1.', '{debater}'),
    (v_debater_a2, v_school_a, 'debater-a2@rls-test.local', 'Debater A2', 'Debater A2.', '{debater}'),
    (v_admin_b,    v_school_b, 'admin-b@rls-test.local',    'Admin B',    'Admin B.',    '{admin}'),
    (v_debater_b1, v_school_b, 'debater-b1@rls-test.local', 'Debater B1', 'Debater B1.', '{debater}'),
    (v_debater_b2, v_school_b, 'debater-b2@rls-test.local', 'Debater B2', 'Debater B2.', '{debater}');

  -- minimal schedule structure per school, just enough for a real slot and round
  insert into period_templates (school_id, name) values (v_school_a, 'Test') returning id into v_template_a;
  insert into period_templates (school_id, name) values (v_school_b, 'Test') returning id into v_template_b;

  insert into template_blocks (school_id, template_id, label, start_time, end_time, is_bookable, sort_order)
    values (v_school_a, v_template_a, 'Block 1', '08:00', '09:00', true, 1) returning id into v_block_a;
  insert into template_blocks (school_id, template_id, label, start_time, end_time, is_bookable, sort_order)
    values (v_school_b, v_template_b, 'Block 1', '08:00', '09:00', true, 1) returning id into v_block_b;

  insert into schedule_variants (school_id, name, template_id) values (v_school_a, 'Standard', v_template_a) returning id into v_variant_a;
  insert into schedule_variants (school_id, name, template_id) values (v_school_b, 'Standard', v_template_b) returning id into v_variant_b;

  insert into calendar_days (school_id, date, variant_id, is_school_day, source)
    values (v_school_a, current_date, v_variant_a, true, 'manual') returning id into v_calday_a;
  insert into calendar_days (school_id, date, variant_id, is_school_day, source)
    values (v_school_b, current_date, v_variant_b, true, 'manual') returning id into v_calday_b;

  insert into slots (school_id, calendar_day_id, block_id, label, starts_at, ends_at)
    values (v_school_a, v_calday_a, v_block_a, 'Block 1', now(), now() + interval '1 hour') returning id into v_slot_a;
  insert into slots (school_id, calendar_day_id, block_id, label, starts_at, ends_at)
    values (v_school_b, v_calday_b, v_block_b, 'Block 1', now(), now() + interval '1 hour') returning id into v_slot_b;

  insert into rounds (school_id, slot_id, created_by) values (v_school_a, v_slot_a, v_admin_a) returning id into v_round_a;
  insert into rounds (school_id, slot_id, created_by) values (v_school_b, v_slot_b, v_admin_b) returning id into v_round_b;

  insert into round_results (school_id, round_id, submitted_by, winning_team, team1_side, rfd)
    values (v_school_a, v_round_a, v_debater_a1, 1, 'pro', repeat('x', 150))
    returning id into v_round_result_a;

  insert into round_links (school_id, round_id, kind, url, added_by)
    values (v_school_b, v_round_b, 'video', 'https://drive.google.com/rls-test', v_admin_b)
    returning id into v_round_link_b;

  insert into audit_log (school_id, actor_id, action, entity_type, entity_id) values (v_school_a, v_admin_a, 'insert', 'test', 'a');
  insert into audit_log (school_id, actor_id, action, entity_type, entity_id) values (v_school_b, v_admin_b, 'insert', 'test', 'b');

  -- =====================================================================
  -- as a School A debater
  -- =====================================================================

  -- 1. profiles select returns only School A rows
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_debater_a1, 'role', 'authenticated')::text, true);
  select count(*) filter (where school_id = v_school_a), count(*) filter (where school_id <> v_school_a)
    into v_count, v_count2 from profiles;
  reset role;
  insert into rls_test_results (assertion, passed, detail) values (
    'debater: profiles select returns only own-school rows',
    v_count = 3 and v_count2 = 0,
    format('own=%s other=%s (expected 3,0)', v_count, v_count2));

  -- 2. slots select returns only School A rows
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_debater_a1, 'role', 'authenticated')::text, true);
  select count(*) filter (where school_id = v_school_a), count(*) filter (where school_id <> v_school_a)
    into v_count, v_count2 from slots;
  reset role;
  insert into rls_test_results (assertion, passed, detail) values (
    'debater: slots select returns only own-school rows',
    v_count = 1 and v_count2 = 0,
    format('own=%s other=%s (expected 1,0)', v_count, v_count2));

  -- 3. insert availabilities with another user's user_id fails
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_debater_a1, 'role', 'authenticated')::text, true);
  begin
    insert into availabilities (school_id, slot_id, user_id) values (v_school_a, v_slot_a, v_debater_a2);
    v_ok := false;
    v_detail := 'insert unexpectedly succeeded';
  exception when others then
    v_ok := true;
    v_detail := 'insert correctly rejected: ' || sqlerrm;
  end;
  reset role;
  insert into rls_test_results (assertion, passed, detail) values (
    'debater: cannot insert availability for another user', v_ok, v_detail);

  -- 4. insert roster_invites fails, not admin
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_debater_a1, 'role', 'authenticated')::text, true);
  begin
    insert into roster_invites (school_id, email, age_confirmed) values (v_school_a, 'nobody@rls-test.local', true);
    v_ok := false;
    v_detail := 'insert unexpectedly succeeded';
  exception when others then
    v_ok := true;
    v_detail := 'insert correctly rejected: ' || sqlerrm;
  end;
  reset role;
  insert into rls_test_results (assertion, passed, detail) values (
    'debater: cannot insert roster_invites (not admin)', v_ok, v_detail);

  -- 5. update round_results fails (append-only)
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_debater_a1, 'role', 'authenticated')::text, true);
  begin
    update round_results set rfd = repeat('y', 150) where id = v_round_result_a;
    get diagnostics v_count = row_count;
    if v_count = 0 then
      v_ok := true;
      v_detail := 'update affected 0 rows (no update policy exists)';
    else
      v_ok := false;
      v_detail := format('update unexpectedly affected %s row(s)', v_count);
    end if;
  exception when others then
    v_ok := true;
    v_detail := 'update correctly rejected: ' || sqlerrm;
  end;
  reset role;
  insert into rls_test_results (assertion, passed, detail) values (
    'debater: cannot update round_results (append-only)', v_ok, v_detail);

  -- 6. select audit_log returns zero rows
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_debater_a1, 'role', 'authenticated')::text, true);
  select count(*) into v_count from audit_log;
  reset role;
  insert into rls_test_results (assertion, passed, detail) values (
    'debater: audit_log select returns zero rows', v_count = 0, format('got %s rows (expected 0)', v_count));

  -- 7. selecting a School B round_links row by known id returns nothing, not an error
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_debater_a1, 'role', 'authenticated')::text, true);
  begin
    select count(*) into v_count from round_links where id = v_round_link_b;
    v_ok := (v_count = 0);
    v_detail := format('got %s rows (expected 0, no error)', v_count);
  exception when others then
    v_ok := false;
    v_detail := 'unexpectedly raised an error instead of returning zero rows: ' || sqlerrm;
  end;
  reset role;
  insert into rls_test_results (assertion, passed, detail) values (
    'debater: selecting School B round_links by known id returns nothing, not an error', v_ok, v_detail);

  -- =====================================================================
  -- as a School A admin
  -- =====================================================================

  -- 8. can insert a roster invite for School A
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin_a, 'role', 'authenticated')::text, true);
  begin
    insert into roster_invites (school_id, email, age_confirmed) values (v_school_a, 'invitee-a@rls-test.local', true);
    v_ok := true;
    v_detail := 'insert succeeded as expected';
  exception when others then
    v_ok := false;
    v_detail := 'insert unexpectedly failed: ' || sqlerrm;
  end;
  reset role;
  insert into rls_test_results (assertion, passed, detail) values (
    'admin: can insert roster_invites for own school', v_ok, v_detail);

  -- 9. cannot insert a roster invite with School B's school_id
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin_a, 'role', 'authenticated')::text, true);
  begin
    insert into roster_invites (school_id, email, age_confirmed) values (v_school_b, 'invitee-cross@rls-test.local', true);
    v_ok := false;
    v_detail := 'insert unexpectedly succeeded across schools';
  exception when others then
    v_ok := true;
    v_detail := 'insert correctly rejected: ' || sqlerrm;
  end;
  reset role;
  insert into rls_test_results (assertion, passed, detail) values (
    'admin: cannot insert roster_invites for a different school', v_ok, v_detail);

  -- 10. can read audit_log for School A only
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin_a, 'role', 'authenticated')::text, true);
  select count(*) filter (where school_id = v_school_a), count(*) filter (where school_id <> v_school_a)
    into v_count, v_count2 from audit_log;
  reset role;
  insert into rls_test_results (assertion, passed, detail) values (
    'admin: audit_log select returns own school only',
    v_count >= 1 and v_count2 = 0,
    format('own=%s other=%s (expected >=1,0)', v_count, v_count2));

end $$;

-- =====================================================================
-- cleanup and report
-- =====================================================================

select _rls_test_cleanup();
drop function _rls_test_cleanup();

select assertion, passed, detail from rls_test_results order by seq;

do $$
declare
  v_failed_count int;
  v_total_count  int;
  v_summary      text;
begin
  select count(*) filter (where not passed), count(*) into v_failed_count, v_total_count from rls_test_results;

  if v_failed_count > 0 then
    select string_agg(format('  - %s: %s', assertion, detail), E'\n' order by seq)
      into v_summary
      from rls_test_results where not passed;
    raise exception E'% of % RLS assertions FAILED:\n%', v_failed_count, v_total_count, v_summary;
  else
    raise notice 'All % RLS assertions passed.', v_total_count;
  end if;
end $$;
