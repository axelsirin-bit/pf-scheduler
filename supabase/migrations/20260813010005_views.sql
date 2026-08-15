-- Step 02, migration 6 of 6: leaderboard views.
--
-- The weekly credit cap is applied here, in SQL, so that the leaderboard
-- and any future export cannot disagree about the number.
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
