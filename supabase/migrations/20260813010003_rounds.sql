-- Step 02, migration 4 of 6: rooms, availabilities, rounds, and everything
-- attached to a completed round.
--
-- rooms is created first, ahead of where the step file lists it, because
-- rounds.room_id references rooms(id) — the foreign key requires it to
-- exist first.
--
-- round_notes is not in the step file's summary list but is in schema.sql;
-- included here since schema.sql is the authoritative source.
create table rooms (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references schools(id) on delete cascade,
  name        text not null,
  note        text,                    -- 'usually free during P5 and P7'
  is_active   boolean not null default true
);
create index on rooms (school_id) where is_active;

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
