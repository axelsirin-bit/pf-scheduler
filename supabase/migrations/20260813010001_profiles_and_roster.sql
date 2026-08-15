-- Step 02, migration 2 of 6: profiles and roster invites.
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
