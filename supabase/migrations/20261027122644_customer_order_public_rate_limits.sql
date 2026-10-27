-- Server-only counters for public order submissions and customer chat.
-- Store keyed hashes rather than customer phone numbers or receipt tokens.
create table public.customer_order_rate_limits (
  key_hash text primary key check (key_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null default now(),
  hits integer not null check (hits > 0)
);
create index customer_order_rate_limits_window_idx
  on public.customer_order_rate_limits (window_started_at);

alter table public.customer_order_rate_limits enable row level security;
revoke all on public.customer_order_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.customer_order_rate_limits to service_role;

create function public.customer_order_consume_rate_limit(
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare
  v_allowed boolean;
begin
  if p_key_hash !~ '^[0-9a-f]{64}$'
    or p_limit not between 1 and 100
    or p_window_seconds not between 30 and 86400 then
    raise exception 'Invalid rate limit parameters';
  end if;

  insert into public.customer_order_rate_limits as counter
    (key_hash, window_started_at, hits)
  values (p_key_hash, clock_timestamp(), 1)
  on conflict (key_hash) do update
    set window_started_at = case
      when counter.window_started_at <= clock_timestamp() - pg_catalog.make_interval(secs => p_window_seconds)
        then clock_timestamp() else counter.window_started_at end,
      hits = case
        when counter.window_started_at <= clock_timestamp() - pg_catalog.make_interval(secs => p_window_seconds)
          then 1 else counter.hits + 1 end
    where counter.window_started_at <= clock_timestamp() - pg_catalog.make_interval(secs => p_window_seconds)
      or counter.hits < p_limit
  returning true into v_allowed;

  -- A small fraction of requests prunes expired counters without a cron job.
  if pg_catalog.random() < 0.01 then
    delete from public.customer_order_rate_limits
    where window_started_at < clock_timestamp() - interval '2 days';
  end if;
  return coalesce(v_allowed, false);
end;
$$;

revoke all on function public.customer_order_consume_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.customer_order_consume_rate_limit(text, integer, integer)
  to service_role;
