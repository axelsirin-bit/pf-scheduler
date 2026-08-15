-- Step 02, migration 5 of 6: audit log and integrations.
--
-- notifications_sent and school_requests are not in the step file's summary
-- list but are in schema.sql; included here since schema.sql is the
-- authoritative source.
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
