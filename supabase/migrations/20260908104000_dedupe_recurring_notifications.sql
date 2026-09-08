-- Prevent recurring reminders from being inserted more than once per
-- business event/date, even when the app is reopened in multiple tabs/devices.

alter table public.notifications
  add column if not exists dedupe_key text;

-- Keep the earliest Tuesday deposit reminder for each Manila business date.
-- Redundant copies are marked read so the existing cleanup flow removes them.
with ranked as (
  select
    id,
    row_number() over (
      partition by (created_at at time zone 'Asia/Manila')::date
      order by created_at, id
    ) as copy_number
  from public.notifications
  where type = 'deposit'
    and trim(title) = 'Tuesday Deposit Reminder'
)
update public.notifications n
set is_read = true
from ranked r
where n.id = r.id
  and r.copy_number > 1;

with first_reminders as (
  select distinct on ((created_at at time zone 'Asia/Manila')::date)
    id,
    (created_at at time zone 'Asia/Manila')::date as reminder_date
  from public.notifications
  where type = 'deposit'
    and trim(title) = 'Tuesday Deposit Reminder'
  order by (created_at at time zone 'Asia/Manila')::date, created_at, id
)
update public.notifications n
set dedupe_key = 'tuesday-deposit:' || f.reminder_date::text
from first_reminders f
where n.id = f.id
  and nullif(n.dedupe_key, '') is null;

create unique index if not exists notifications_dedupe_key_uidx
  on public.notifications (dedupe_key)
  where dedupe_key is not null;

notify pgrst, 'reload schema';
