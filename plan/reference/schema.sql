-- =====================================================================
-- PF Practice Debate Scheduler — complete schema
--
-- This file is the source of truth for step 02. Split it into the
-- migration files named in that step rather than applying it as one blob.
-- Row level security policies are NOT in this file; they are step 03.
--
-- Conventions:
--   - every school-scoped table carries school_id with on delete cascade
--   - timestamps are timestamptz, stored UTC, rendered in schools.timezone
--   - template_blocks use plain `time` because a template is a pattern,
--     not a moment
--   - a period template is selected by schedule_variant (Standard, Half-Day,
--     Special, Community), never by the day_type rotation label — the PF
--     blocks are fixed windows, not class periods, see decisions.md
--   - nothing is ever hard deleted except unclaimed invites
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- enums
-- ---------------------------------------------------------------------

create type app_role as enum ('admin', 'judge', 'debater');
create type school_status as enum ('pending', 'active', 'suspended');
create type round_status as enum ('forming', 'confirmed', 'completed', 'cancelled', 'expired');
create type participant_role as enum ('debater', 'judge');
create type debate_side as enum ('pro', 'con');
create type link_kind as enum ('video', 'speech_doc', 'flow', 'other');
create type day_source as enum ('manual', 'feed');
create type import_status as enum ('pending', 'approved', 'rejected', 'failed');

-- ---------------------------------------------------------------------
-- schools and terms
-- ---------------------------------------------------------------------

create table schools (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  timezone      text not null default 'America/New_York',
  status        school_status not null default 'pending',
  -- expected completed rounds per member per term, drives the on-track line
  expected_rounds_per_term int not null default 8,
  -- max rounds per person per calendar week that count toward participation
  weekly_credit_cap int not null default 2,
  -- true if the rotation restarts each week rather than running continuously
  rotation_resets_weekly boolean not null default false,
  approved_by   text,
  approved_at   timestamptz,
  created_at    timestamptz not null default now()
);

create table school_terms (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references schools(id) on delete cascade,
  name       text not null,
  starts_on  date not null,
  ends_on    date not null,
  created_at timestamptz not null default now(),
  check (ends_on > starts_on)
);
create index on school_terms (school_id, starts_on);

-- ---------------------------------------------------------------------
-- people
-- ---------------------------------------------------------------------

create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  school_id     uuid not null references schools(id) on delete cascade,
  email         text not null,
  full_name     text not null,
  -- what is shown to peers: first name plus last initial
  display_name  text not null,
  roles         app_role[] not null default '{debater}',
  grad_year     int,
  is_active     boolean not null default true,
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index on profiles (school_id);
create unique index on profiles (school_id, lower(email));

create table roster_invites (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references schools(id) on delete cascade,
  email         text not null,
  roles         app_role[] not null default '{debater}',
  -- admin must affirm the invitee is 13 or older; enforced by check below
  age_confirmed boolean not null default false,
  invited_by    uuid references profiles(id) on delete set null,
  -- invites created past the rate limit wait for a second admin
  approved_by   uuid references profiles(id) on delete set null,
  needs_approval boolean not null default false,
  claimed_at    timestamptz,
  claimed_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  check (age_confirmed = true)
);
create unique index on roster_invites (school_id, lower(email));
create index on roster_invites (lower(email)) where claimed_at is null;

-- ---------------------------------------------------------------------
-- schedule structure
-- ---------------------------------------------------------------------

create table period_templates (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references schools(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);
create index on period_templates (school_id);

create table template_blocks (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references schools(id) on delete cascade,
  template_id  uuid not null references period_templates(id) on delete cascade,
  label        text not null,          -- 'P3', 'Lunch', 'Before school'
  start_time   time not null,
  end_time     time not null,
  -- advisory, AAA and similar are false and never generate slots
  is_bookable  boolean not null default true,
  sort_order   int not null,
  check (end_time > start_time)
);
create index on template_blocks (template_id, sort_order);

-- rotation label only ('Day 1'..'Day 4'). Informational and never joined into
-- slot generation — see schedule_variants for what actually picks a template.
create table day_types (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references schools(id) on delete cascade,
  code         text not null           -- 'Day 1' .. 'Day 4'
);
create unique index on day_types (school_id, code);

-- what actually selects a period template for a given calendar day.
-- 'Standard', 'Half-Day', 'Special', 'Community', per the school's calendar.
create table schedule_variants (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references schools(id) on delete cascade,
  name         text not null,
  template_id  uuid not null references period_templates(id) on delete restrict
);
create unique index on schedule_variants (school_id, name);

create table calendar_days (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid not null references schools(id) on delete cascade,
  date           date not null,
  -- informational rotation label, never drives slot generation
  day_type_id    uuid references day_types(id) on delete restrict,
  -- determines which template's blocks generate slots for this date
  variant_id     uuid references schedule_variants(id) on delete restrict,
  is_school_day  boolean not null default true,
  note           text,
  source         day_source not null default 'manual',
  -- a manual edit survives the next feed sync
  manually_set   boolean not null default false,
  created_at     timestamptz not null default now()
);
create unique index on calendar_days (school_id, date);
create index on calendar_days (school_id, date) where is_school_day;
-- a school day with no variant has nothing to generate slots from; the
-- calendar import must always set both, never one without the other.
alter table calendar_days add constraint calendar_days_variant_when_school_day
  check (not is_school_day or variant_id is not null);

create table rooms (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references schools(id) on delete cascade,
  name        text not null,
  note        text,                    -- 'usually free during P5 and P7'
  is_active   boolean not null default true
);
create index on rooms (school_id) where is_active;

create table slots (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references schools(id) on delete cascade,
  calendar_day_id  uuid not null references calendar_days(id) on delete cascade,
  block_id         uuid not null references template_blocks(id) on delete restrict,
  label            text not null,      -- denormalized from the block at generation
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  is_open          boolean not null default true,
  created_at       timestamptz not null default now(),
  check (ends_at > starts_at)
);
create unique index on slots (calendar_day_id, block_id);
create index on slots (school_id, starts_at);

-- ---------------------------------------------------------------------
-- availability and rounds
-- ---------------------------------------------------------------------

create table availabilities (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references schools(id) on delete cascade,
  slot_id    uuid not null references slots(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index on availabilities (slot_id, user_id);
create index on availabilities (user_id, created_at desc);

create table rounds (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references schools(id) on delete cascade,
  slot_id      uuid not null references slots(id) on delete restrict,
  status       round_status not null default 'forming',
  room_id      uuid references rooms(id) on delete set null,
  room_freetext text,
  topic        text,                   -- resolution being debated, optional
  created_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  confirmed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text
);
create index on rounds (school_id, slot_id);
create index on rounds (school_id, status);

create table round_participants (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references schools(id) on delete cascade,
  round_id   uuid not null references rounds(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  role       participant_role not null,
  team       smallint,                 -- 1 or 2 for debaters, null for judge
  side       debate_side,              -- optional, may be decided in the room
  joined_at  timestamptz not null default now(),
  check (
    (role = 'debater' and team in (1,2)) or
    (role = 'judge'   and team is null)
  )
);
create unique index on round_participants (round_id, user_id);
-- at most one judge per round
create unique index on round_participants (round_id) where role = 'judge';
create index on round_participants (user_id);

create table round_results (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references schools(id) on delete cascade,
  round_id      uuid not null references rounds(id) on delete cascade,
  submitted_by  uuid not null references profiles(id) on delete restrict,
  winning_team  smallint not null check (winning_team in (1,2)),
  team1_side    debate_side not null,
  rfd           text not null check (char_length(rfd) >= 150),
  -- corrections append a new row pointing at the one they replace
  supersedes    uuid references round_results(id) on delete restrict,
  submitted_at  timestamptz not null default now()
);
create index on round_results (round_id, submitted_at desc);

create table round_notes (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references schools(id) on delete cascade,
  result_id    uuid not null references round_results(id) on delete cascade,
  about_user   uuid not null references profiles(id) on delete cascade,
  note         text not null
);
create index on round_notes (about_user);

create table round_links (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references schools(id) on delete cascade,
  round_id   uuid not null references rounds(id) on delete cascade,
  kind       link_kind not null,
  url        text not null,
  label      text,
  added_by   uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  -- links only; the app never stores files. Google domains only.
  check (url ~* '^https://(drive|docs)\.google\.com/')
);
create index on round_links (round_id);

-- ---------------------------------------------------------------------
-- admin and integrations
-- ---------------------------------------------------------------------

create table audit_log (
  id          bigserial primary key,
  school_id   uuid not null references schools(id) on delete cascade,
  actor_id    uuid references profiles(id) on delete set null,
  action      text not null,           -- 'insert' | 'update' | 'delete'
  entity_type text not null,
  entity_id   text,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz not null default now()
);
create index on audit_log (school_id, created_at desc);

create table notifications_sent (
  id         bigserial primary key,
  school_id  uuid not null references schools(id) on delete cascade,
  kind       text not null,            -- 'round_confirmed' | 'round_tomorrow' | ...
  round_id   uuid references rounds(id) on delete cascade,
  user_id    uuid references profiles(id) on delete cascade,
  sent_at    timestamptz not null default now()
);
create unique index on notifications_sent (kind, round_id, user_id);

create table ics_sources (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references schools(id) on delete cascade,
  url               text not null,
  -- maps feed event summary text to a day type or to 'no_school' / 'ignore'
  summary_mapping   jsonb not null default '{}'::jsonb,
  last_synced_at    timestamptz,
  last_status       text,
  last_error        text,
  is_active         boolean not null default true
);
create index on ics_sources (school_id);

create table ics_import_batches (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references schools(id) on delete cascade,
  source_id   uuid not null references ics_sources(id) on delete cascade,
  status      import_status not null default 'pending',
  diff        jsonb not null,
  approved_by uuid references profiles(id) on delete set null,
  approved_at timestamptz,
  created_at  timestamptz not null default now()
);
create index on ics_import_batches (school_id, created_at desc);

create table school_requests (
  id             uuid primary key default gen_random_uuid(),
  school_name    text not null,
  admin_name     text not null,
  admin_email    text not null,
  tabroom_url    text not null,
  note           text,
  status         text not null default 'pending',
  reviewed_by    text,
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- views
--
-- The weekly credit cap is applied here, in SQL, so that the leaderboard
-- and any future export cannot disagree about the number.
-- ---------------------------------------------------------------------

create view v_participation as
with completed as (
  select
    rp.school_id,
    rp.user_id,
    rp.role,
    r.id as round_id,
    s.starts_at,
    date_trunc('week', s.starts_at) as week_start,
    t.id as term_id
  from round_participants rp
  join rounds r on r.id = rp.round_id and r.status = 'completed'
  join slots  s on s.id = r.slot_id
  left join school_terms t
    on t.school_id = rp.school_id
   and s.starts_at::date between t.starts_on and t.ends_on
),
ranked as (
  select
    c.*,
    sc.weekly_credit_cap,
    row_number() over (
      partition by c.user_id, c.week_start
      order by c.starts_at
    ) as rn
  from completed c
  join schools sc on sc.id = c.school_id
)
-- one row per credited round; rounds beyond the weekly cap are dropped here
select school_id, user_id, term_id, week_start, role, round_id
from ranked
where rn <= weekly_credit_cap;

create view v_leaderboard as
select
  p.school_id,
  p.id as user_id,
  p.display_name,
  v.term_id,
  count(*) filter (where v.role = 'debater') as debate_rounds,
  count(*) filter (where v.role = 'judge')   as judge_rounds,
  count(v.round_id)                          as total_rounds,
  count(v.round_id) >= s.expected_rounds_per_term as on_track
from profiles p
join schools s on s.id = p.school_id
left join v_participation v on v.user_id = p.id
where p.is_active
group by p.school_id, p.id, p.display_name, v.term_id, s.expected_rounds_per_term;
