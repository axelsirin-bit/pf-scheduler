-- Proves the app can reach the database. Dropped in step 02 once the real
-- schema exists.
create table health_check (
  id      uuid primary key default gen_random_uuid(),
  message text not null
);

insert into health_check (message) values ('Database connection is working.');
