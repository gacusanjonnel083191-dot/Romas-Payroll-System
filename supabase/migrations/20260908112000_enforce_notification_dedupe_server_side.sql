-- Protect recurring reminders from stale cached PWA clients that do not yet
-- send dedupe_key. The database assigns the same Manila-date key before insert.

create or replace function private.assign_notification_dedupe_key()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if nullif(trim(coalesce(new.dedupe_key, '')), '') is null
     and new.type = 'deposit'
     and trim(coalesce(new.title, '')) = 'Tuesday Deposit Reminder' then
    new.dedupe_key := 'tuesday-deposit:' ||
      ((coalesce(new.created_at, now()) at time zone 'Asia/Manila')::date)::text;
  end if;

  return new;
end;
$function$;

revoke all on function private.assign_notification_dedupe_key() from public, anon, authenticated;

drop trigger if exists trg_assign_notification_dedupe_key on public.notifications;
create trigger trg_assign_notification_dedupe_key
before insert on public.notifications
for each row
execute function private.assign_notification_dedupe_key();

notify pgrst, 'reload schema';
