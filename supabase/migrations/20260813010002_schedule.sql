-- Step 02, migration 3 of 6: period templates, rotation labels, schedule
-- variants, calendar days, slots.
--
-- schedule_variants is not in the step file's summary list — it was added to
-- schema.sql after that list was written, in the schedule-variant correction
-- (see decisions.md, "PF blocks are not tied to the day-type rotation").
-- Included here since schema.sql is the authoritative source.
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
