-- =====================================================================
-- Development seed data — fictional schools only.
--
-- v1 is school-agnostic starting at step 04 (see CLAUDE.md rule 7 and
-- decisions.md, "v1 is school-agnostic starting at step 04"). Nothing here
-- represents the real school this project is ultimately for. The setup
-- wizard (step 12) is the only path any school's real data ever enters
-- the system.
--
-- Runs automatically as part of `supabase db reset`. Idempotent: deletes
-- and regenerates its own fixtures (by school slug / test email domain,
-- in dependency order) before inserting, so it's safe to run more than
-- once against the same database.
--
-- Structural data only (school, terms, templates, calendar days, rooms,
-- users). Slots are NOT generated here — that's
-- `scripts/seed-dev-data.ts`, kept separate on purpose so structural seed
-- data and generated/derived data don't get conflated.
-- =====================================================================

-- ---------------------------------------------------------------------
-- clean slate, dependency order (mirrors scripts/verify-rls.sql's
-- cleanup, extended for schedule structure — see that file for why this
-- can't just be `delete from schools` and rely on cascade)
-- ---------------------------------------------------------------------

delete from round_links        where school_id in (select id from schools where slug in ('riverbend-academy', 'test-academy'));
delete from round_results      where school_id in (select id from schools where slug in ('riverbend-academy', 'test-academy'));
delete from round_participants where school_id in (select id from schools where slug in ('riverbend-academy', 'test-academy'));
delete from availabilities     where school_id in (select id from schools where slug in ('riverbend-academy', 'test-academy'));
delete from rounds             where school_id in (select id from schools where slug in ('riverbend-academy', 'test-academy'));
delete from slots              where school_id in (select id from schools where slug in ('riverbend-academy', 'test-academy'));
delete from calendar_days      where school_id in (select id from schools where slug in ('riverbend-academy', 'test-academy'));
delete from schedule_variants  where school_id in (select id from schools where slug in ('riverbend-academy', 'test-academy'));
delete from template_blocks    where school_id in (select id from schools where slug in ('riverbend-academy', 'test-academy'));
delete from period_templates   where school_id in (select id from schools where slug in ('riverbend-academy', 'test-academy'));
delete from day_types          where school_id in (select id from schools where slug in ('riverbend-academy', 'test-academy'));
delete from rooms              where school_id in (select id from schools where slug in ('riverbend-academy', 'test-academy'));
delete from roster_invites     where school_id in (select id from schools where slug in ('riverbend-academy', 'test-academy'));
delete from school_terms       where school_id in (select id from schools where slug in ('riverbend-academy', 'test-academy'));
delete from auth.users where email like '%@riverbend.test' or email like '%@test-academy.test';
delete from schools where slug in ('riverbend-academy', 'test-academy');

-- ---------------------------------------------------------------------
-- schools
-- ---------------------------------------------------------------------

insert into schools (name, slug, timezone, status, expected_rounds_per_term, weekly_credit_cap, rotation_resets_weekly)
values ('Riverbend Academy', 'riverbend-academy', 'America/New_York', 'active', 8, 2, false);

-- minimal on purpose — exists for cross-tenant comparison, no schedule structure
insert into schools (name, slug, timezone, status)
values ('Test Academy', 'test-academy', 'America/New_York', 'active');

-- ---------------------------------------------------------------------
-- terms
-- ---------------------------------------------------------------------

insert into school_terms (school_id, name, starts_on, ends_on)
select id, 'Fall 2026', date '2026-08-24', date '2026-12-18' from schools where slug = 'riverbend-academy'
union all
select id, 'Spring 2027', date '2027-01-11', date '2027-05-21' from schools where slug = 'riverbend-academy';

-- ---------------------------------------------------------------------
-- period templates + blocks
-- ---------------------------------------------------------------------

insert into period_templates (school_id, name)
select id, 'Standard' from schools where slug = 'riverbend-academy'
union all
select id, 'Half-Day' from schools where slug = 'riverbend-academy';

insert into template_blocks (school_id, template_id, label, start_time, end_time, is_bookable, sort_order)
select s.id, pt.id, b.label, b.start_time, b.end_time, b.is_bookable, b.sort_order
from schools s
join period_templates pt on pt.school_id = s.id and pt.name = 'Standard'
cross join lateral (values
  ('Morning Block',   time '08:00', time '09:00', true,  1),
  ('Advisory',        time '09:10', time '09:25', false, 2),
  ('Midday Block',    time '09:35', time '10:35', true,  3),
  ('Lunch',           time '11:20', time '12:00', true,  4),
  ('Afternoon Block', time '12:10', time '13:10', true,  5),
  ('After School',    time '15:00', time '16:00', true,  6)
) as b(label, start_time, end_time, is_bookable, sort_order)
where s.slug = 'riverbend-academy'
union all
select s.id, pt.id, b.label, b.start_time, b.end_time, b.is_bookable, b.sort_order
from schools s
join period_templates pt on pt.school_id = s.id and pt.name = 'Half-Day'
cross join lateral (values
  ('Morning Block', time '08:00', time '09:00', true,  1),
  ('Advisory',       time '09:10', time '09:25', false, 2),
  ('Midday Block',  time '09:35', time '10:35', true,  3),
  ('Lunch',         time '11:20', time '12:00', true,  4)
) as b(label, start_time, end_time, is_bookable, sort_order)
where s.slug = 'riverbend-academy';

-- ---------------------------------------------------------------------
-- day types — informational rotation label only, no template link.
-- See decisions.md, "PF blocks are not tied to the day-type rotation."
-- ---------------------------------------------------------------------

insert into day_types (school_id, code)
select s.id, c.code
from schools s
cross join lateral (values ('Day 1'), ('Day 2'), ('Day 3'), ('Day 4')) as c(code)
where s.slug = 'riverbend-academy';

-- ---------------------------------------------------------------------
-- schedule variants — this is what actually selects a template
-- ---------------------------------------------------------------------

insert into schedule_variants (school_id, name, template_id)
select s.id, 'Standard', pt.id
from schools s
join period_templates pt on pt.school_id = s.id and pt.name = 'Standard'
where s.slug = 'riverbend-academy'
union all
select s.id, 'Half-Day', pt.id
from schools s
join period_templates pt on pt.school_id = s.id and pt.name = 'Half-Day'
where s.slug = 'riverbend-academy';

-- ---------------------------------------------------------------------
-- rooms
-- ---------------------------------------------------------------------

insert into rooms (school_id, name, note)
select s.id, r.name, r.note
from schools s
cross join lateral (values
  ('Room 101',      'usually free during Morning Block and Midday Block'),
  ('Room 118',      'usually free most of the day'),
  ('Room 204',      'usually free during Lunch and Afternoon Block'),
  ('Library Annex', 'usually free after school')
) as r(name, note)
where s.slug = 'riverbend-academy';

-- ---------------------------------------------------------------------
-- calendar_days for Fall 2026 — continuous Day 1-4 rotation over school
-- days only. Weekends skipped. Labor Day (one Monday) and Thanksgiving
-- break (three consecutive days) are non-school days that do NOT consume
-- a rotation position, same continuity model as the real school (see
-- decisions.md, "Resolved: rotation continuity") applied to made-up
-- dates. Three scattered Wednesdays are Half-Day.
-- ---------------------------------------------------------------------

with school as (
  select id as school_id from schools where slug = 'riverbend-academy'
),
rotation as (
  select * from (values (1, 'Day 1'), (2, 'Day 2'), (3, 'Day 3'), (4, 'Day 4')) as v(ord, code)
),
holidays as (
  select unnest(array['2026-09-07', '2026-11-25', '2026-11-26', '2026-11-27']::date[]) as date
),
half_days as (
  select unnest(array['2026-09-16', '2026-10-21', '2026-11-18']::date[]) as date
),
school_days as (
  select
    d::date as date,
    row_number() over (order by d::date) as rn
  from generate_series('2026-08-24'::date, '2026-12-18'::date, interval '1 day') as d
  where extract(dow from d::date) not in (0, 6)
    and d::date not in (select date from holidays)
)
insert into calendar_days (school_id, date, day_type_id, variant_id, is_school_day, source)
select
  school.school_id,
  sd.date,
  dt.id,
  sv.id,
  true,
  'manual'
from school_days sd
cross join school
join rotation r on r.ord = ((sd.rn - 1) % 4) + 1
join day_types dt on dt.school_id = school.school_id and dt.code = r.code
join schedule_variants sv on sv.school_id = school.school_id
  and sv.name = case when sd.date in (select date from half_days) then 'Half-Day' else 'Standard' end;

-- ---------------------------------------------------------------------
-- test users — four per school: admin, debater, debater-and-judge,
-- judge-only. Since step 05, every auth.users insert fires the
-- roster-gating trigger, so each user needs a matching roster_invites row
-- first; the trigger creates the profiles row itself from there, the same
-- path a real invited sign-in goes through. grad_year isn't set here
-- (roster_invites has no such column, matching real life — a school
-- wouldn't know a debater's grad year from a Google sign-in either).
-- ---------------------------------------------------------------------

insert into roster_invites (school_id, email, roles, age_confirmed)
select s.id, u.email, u.roles, true
from schools s
join (values
  ('riverbend-academy', 'admin@riverbend.test',      array['admin']::app_role[]),
  ('riverbend-academy', 'debater@riverbend.test',    array['debater']::app_role[]),
  ('riverbend-academy', 'hybrid@riverbend.test',     array['debater','judge']::app_role[]),
  ('riverbend-academy', 'judge@riverbend.test',      array['judge']::app_role[]),
  ('test-academy',      'admin@test-academy.test',   array['admin']::app_role[]),
  ('test-academy',      'debater@test-academy.test', array['debater']::app_role[]),
  ('test-academy',      'hybrid@test-academy.test',  array['debater','judge']::app_role[]),
  ('test-academy',      'judge@test-academy.test',   array['judge']::app_role[])
) as u(slug, email, roles) on u.slug = s.slug;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, '', now(), now(), now(), '{}', jsonb_build_object('full_name', u.full_name)
from (values
  ('admin@riverbend.test',      'Jordan Vance'),
  ('debater@riverbend.test',    'Casey Nguyen'),
  ('hybrid@riverbend.test',     'Morgan Patel'),
  ('judge@riverbend.test',      'Riley Chen'),
  ('admin@test-academy.test',   'Sam Whitfield'),
  ('debater@test-academy.test', 'Drew Kowalski'),
  ('hybrid@test-academy.test',  'Avery Lindqvist'),
  ('judge@test-academy.test',   'Quinn Okafor')
) as u(email, full_name);
