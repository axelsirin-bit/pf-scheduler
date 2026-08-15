-- Step 02, migration 1 of 6: enums, extension, schools, school_terms.
-- Drops the health_check table from step 01 — its job was only to prove the
-- connection worked, and the real schema starts here.
drop table if exists health_check;

create extension if not exists "pgcrypto";

create type app_role as enum ('admin', 'judge', 'debater');
create type school_status as enum ('pending', 'active', 'suspended');
create type round_status as enum ('forming', 'confirmed', 'completed', 'cancelled', 'expired');
create type participant_role as enum ('debater', 'judge');
create type debate_side as enum ('pro', 'con');
create type link_kind as enum ('video', 'speech_doc', 'flow', 'other');
create type day_source as enum ('manual', 'feed');
create type import_status as enum ('pending', 'approved', 'rejected', 'failed');

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
