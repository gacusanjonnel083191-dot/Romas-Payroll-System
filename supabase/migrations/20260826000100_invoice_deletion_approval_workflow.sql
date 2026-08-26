begin;

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated;

alter table public.delivery_invoices
  add column if not exists pre_void_status text,
  add column if not exists pre_void_delivery_status text,
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by_admin_user_id uuid,
  add column if not exists voided_by_name text,
  add column if not exists void_reason text,
  add column if not exists invoice_deletion_request_id uuid;

alter table public.notifications
  add column if not exists admin_user_id uuid,
  add column if not exists reference_type text,
  add column if not exists reference_id uuid;

create table if not exists public.invoice_deletion_requesters (
  admin_user_id uuid primary key references public.admin_users(id) on delete cascade,
  granted_by_admin_user_id uuid references public.admin_users(id) on delete set null,
  is_active boolean not null default true,
  granted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoice_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null,
  invoice_number text not null,
  reseller_name text,
  total_amount numeric not null default 0,
  invoice_status_at_request text not null,
  reason_category text not null,
  reason_detail text not null,
  status text not null default 'pending',
  requested_by_admin_user_id uuid not null references public.admin_users(id) on delete restrict,
  requested_by_name text not null,
  requested_at timestamptz not null default now(),
  reviewed_by_admin_user_id uuid references public.admin_users(id) on delete restrict,
  reviewed_by_name text,
  reviewed_at timestamptz,
  review_note text,
  result_action text,
  result_summary text,
  invoice_snapshot jsonb not null default '{}'::jsonb,
  decision_snapshot jsonb,
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'invoice_deletion_requests_reason_category_check'
      and conrelid = 'public.invoice_deletion_requests'::regclass
  ) then
    alter table public.invoice_deletion_requests
      add constraint invoice_deletion_requests_reason_category_check
      check (reason_category in (
        'duplicate_invoice',
        'incorrect_customer',
        'incorrect_delivery_details',
        'test_or_accidental_invoice',
        'other'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'invoice_deletion_requests_reason_detail_check'
      and conrelid = 'public.invoice_deletion_requests'::regclass
  ) then
    alter table public.invoice_deletion_requests
      add constraint invoice_deletion_requests_reason_detail_check
      check (char_length(btrim(reason_detail)) >= 10);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'invoice_deletion_requests_status_check'
      and conrelid = 'public.invoice_deletion_requests'::regclass
  ) then
    alter table public.invoice_deletion_requests
      add constraint invoice_deletion_requests_status_check
      check (status in ('pending', 'approved', 'rejected'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'invoice_deletion_requests_result_action_check'
      and conrelid = 'public.invoice_deletion_requests'::regclass
  ) then
    alter table public.invoice_deletion_requests
      add constraint invoice_deletion_requests_result_action_check
      check (result_action is null or result_action in ('deleted', 'voided', 'rejected'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'delivery_invoices_voided_by_admin_user_id_fkey'
      and conrelid = 'public.delivery_invoices'::regclass
  ) then
    alter table public.delivery_invoices
      add constraint delivery_invoices_voided_by_admin_user_id_fkey
      foreign key (voided_by_admin_user_id) references public.admin_users(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'delivery_invoices_invoice_deletion_request_id_fkey'
      and conrelid = 'public.delivery_invoices'::regclass
  ) then
    alter table public.delivery_invoices
      add constraint delivery_invoices_invoice_deletion_request_id_fkey
      foreign key (invoice_deletion_request_id) references public.invoice_deletion_requests(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'notifications_admin_user_id_fkey'
      and conrelid = 'public.notifications'::regclass
  ) then
    alter table public.notifications
      add constraint notifications_admin_user_id_fkey
      foreign key (admin_user_id) references public.admin_users(id) on delete cascade;
  end if;
end $$;

create unique index if not exists invoice_deletion_requests_one_pending_per_invoice_idx
  on public.invoice_deletion_requests(invoice_id)
  where status = 'pending';

create index if not exists invoice_deletion_requests_status_requested_at_idx
  on public.invoice_deletion_requests(status, requested_at desc);

create index if not exists invoice_deletion_requests_requester_idx
  on public.invoice_deletion_requests(requested_by_admin_user_id, requested_at desc);

create index if not exists notifications_admin_user_unread_idx
  on public.notifications(admin_user_id, created_at desc)
  where is_read is not true;

create index if not exists delivery_invoice_items_invoice_id_idx
  on public.delivery_invoice_items(invoice_id);

create index if not exists reseller_orders_invoice_id_idx
  on public.reseller_orders(invoice_id);

create index if not exists reseller_payments_invoice_id_idx
  on public.reseller_payments(invoice_id);

create index if not exists reseller_returns_invoice_id_idx
  on public.reseller_returns(invoice_id);

create index if not exists reseller_disputes_invoice_id_idx
  on public.reseller_disputes(invoice_id);

create or replace function private.current_active_admin_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select au.id
  from public.admin_users au
  where au.auth_user_id = (select auth.uid())
    and au.is_active = true
  limit 1
$$;

create or replace function private.is_current_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.auth_user_id = (select auth.uid())
      and au.is_active = true
      and (
        lower(btrim(au.role)) = 'owner'
        or 'owner' = any(regexp_split_to_array(lower(coalesce(au.extra_roles, '')), '\s*,\s*'))
      )
  )
$$;

revoke execute on function private.current_active_admin_id() from public;
revoke execute on function private.current_active_admin_id() from anon;
grant execute on function private.current_active_admin_id() to authenticated;

revoke execute on function private.is_current_owner() from public;
revoke execute on function private.is_current_owner() from anon;
grant execute on function private.is_current_owner() to authenticated;

alter table public.invoice_deletion_requesters enable row level security;
alter table public.invoice_deletion_requests enable row level security;
alter table public.delivery_invoices enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists invoice_deletion_requesters_select_authorized on public.invoice_deletion_requesters;
create policy invoice_deletion_requesters_select_authorized
on public.invoice_deletion_requesters
for select
to authenticated
using (
  admin_user_id = (select private.current_active_admin_id())
  or (select private.is_current_owner())
);

drop policy if exists invoice_deletion_requests_select_authorized on public.invoice_deletion_requests;
create policy invoice_deletion_requests_select_authorized
on public.invoice_deletion_requests
for select
to authenticated
using (
  requested_by_admin_user_id = (select private.current_active_admin_id())
  or (select private.is_current_owner())
);

drop policy if exists delivery_invoices_legacy_read on public.delivery_invoices;
create policy delivery_invoices_legacy_read
on public.delivery_invoices
for select
to anon, authenticated
using (true);

drop policy if exists delivery_invoices_legacy_insert on public.delivery_invoices;
create policy delivery_invoices_legacy_insert
on public.delivery_invoices
for insert
to anon, authenticated
with check (lower(coalesce(status, 'unpaid')) <> 'voided');

drop policy if exists delivery_invoices_legacy_update on public.delivery_invoices;
create policy delivery_invoices_legacy_update
on public.delivery_invoices
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists notifications_legacy_global_select on public.notifications;
create policy notifications_legacy_global_select
on public.notifications
for select
to anon
using (admin_user_id is null);

drop policy if exists notifications_admin_visible_select on public.notifications;
create policy notifications_admin_visible_select
on public.notifications
for select
to authenticated
using (
  admin_user_id is null
  or admin_user_id = (select private.current_active_admin_id())
);

drop policy if exists notifications_legacy_global_insert on public.notifications;
create policy notifications_legacy_global_insert
on public.notifications
for insert
to anon, authenticated
with check (admin_user_id is null);

drop policy if exists notifications_admin_visible_update on public.notifications;
create policy notifications_admin_visible_update
on public.notifications
for update
to authenticated
using (
  admin_user_id is null
  or admin_user_id = (select private.current_active_admin_id())
)
with check (
  admin_user_id is null
  or admin_user_id = (select private.current_active_admin_id())
);

drop policy if exists notifications_admin_visible_delete on public.notifications;
create policy notifications_admin_visible_delete
on public.notifications
for delete
to authenticated
using (
  admin_user_id is null
  or admin_user_id = (select private.current_active_admin_id())
);

drop policy if exists audit_logs_authenticated_select on public.audit_logs;
create policy audit_logs_authenticated_select
on public.audit_logs
for select
to authenticated
using (true);

drop policy if exists audit_logs_append_only_insert on public.audit_logs;
create policy audit_logs_append_only_insert
on public.audit_logs
for insert
to anon, authenticated
with check (true);

revoke all on public.invoice_deletion_requesters from anon;
revoke all on public.invoice_deletion_requesters from authenticated;
grant select on public.invoice_deletion_requesters to authenticated;

revoke all on public.invoice_deletion_requests from anon;
revoke all on public.invoice_deletion_requests from authenticated;
grant select on public.invoice_deletion_requests to authenticated;

revoke delete on public.delivery_invoices from anon, authenticated;
revoke update, delete on public.audit_logs from anon, authenticated;
revoke update, delete on public.notifications from anon;
revoke delete on public.delivery_invoice_items from anon;
revoke delete on public.reseller_orders from anon;
revoke delete on public.reseller_payments from anon;
revoke delete on public.reseller_returns from anon;
revoke delete on public.reseller_return_items from anon;
revoke delete on public.reseller_disputes from anon;

create or replace function private.guard_delivery_invoice_void_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_id uuid;
  v_request_text text;
begin
  if lower(coalesce(old.status, '')) <> 'voided'
     and lower(coalesce(new.status, '')) <> 'voided'
     and new.pre_void_status is not distinct from old.pre_void_status
     and new.pre_void_delivery_status is not distinct from old.pre_void_delivery_status
     and new.voided_at is not distinct from old.voided_at
     and new.voided_by_admin_user_id is not distinct from old.voided_by_admin_user_id
     and new.voided_by_name is not distinct from old.voided_by_name
     and new.void_reason is not distinct from old.void_reason
     and new.invoice_deletion_request_id is not distinct from old.invoice_deletion_request_id then
    return new;
  end if;

  v_request_text := current_setting('app.invoice_deletion_request_id', true);
  if nullif(v_request_text, '') is null then
    raise exception 'Voided invoices can only be changed through an owner-approved deletion request.';
  end if;

  begin
    v_request_id := v_request_text::uuid;
  exception when invalid_text_representation then
    raise exception 'Invalid invoice deletion approval context.';
  end;

  if not (select private.is_current_owner()) then
    raise exception 'Only the authenticated owner can approve or change a voided invoice.';
  end if;

  if not exists (
    select 1
    from public.invoice_deletion_requests r
    where r.id = v_request_id
      and r.invoice_id = old.id
      and r.status = 'pending'
  ) then
    raise exception 'A matching pending invoice deletion request is required.';
  end if;

  return new;
end;
$$;

revoke execute on function private.guard_delivery_invoice_void_state() from public;
revoke execute on function private.guard_delivery_invoice_void_state() from anon;
revoke execute on function private.guard_delivery_invoice_void_state() from authenticated;

drop trigger if exists guard_delivery_invoice_void_state on public.delivery_invoices;
create trigger guard_delivery_invoice_void_state
before update on public.delivery_invoices
for each row
execute function private.guard_delivery_invoice_void_state();

create or replace function private.get_invoice_deletion_access_impl()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'admin_user_id', au.id,
    'admin_name', au.full_name,
    'can_request', coalesce(p.is_active, false),
    'can_review', (
      lower(btrim(au.role)) = 'owner'
      or 'owner' = any(regexp_split_to_array(lower(coalesce(au.extra_roles, '')), '\s*,\s*'))
    )
  )
  from public.admin_users au
  left join public.invoice_deletion_requesters p on p.admin_user_id = au.id
  where au.auth_user_id = (select auth.uid())
    and au.is_active = true
  limit 1
$$;

create or replace function public.get_invoice_deletion_access()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.get_invoice_deletion_access_impl()
$$;

create or replace function private.request_invoice_deletion_impl(
  p_invoice_id uuid,
  p_reason_category text,
  p_reason_detail text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requester public.admin_users%rowtype;
  v_invoice public.delivery_invoices%rowtype;
  v_request public.invoice_deletion_requests%rowtype;
  v_reason_category text := lower(btrim(coalesce(p_reason_category, '')));
  v_reason_detail text := btrim(coalesce(p_reason_detail, ''));
  v_items jsonb;
  v_orders jsonb;
  v_movement jsonb;
begin
  select au.* into v_requester
  from public.admin_users au
  where au.auth_user_id = (select auth.uid())
    and au.is_active = true
  limit 1;

  if v_requester.id is null then
    raise exception 'An active authenticated admin account is required.';
  end if;

  if not exists (
    select 1
    from public.invoice_deletion_requesters p
    where p.admin_user_id = v_requester.id
      and p.is_active = true
  ) then
    raise exception 'This account is not authorized to request invoice deletion.';
  end if;

  if v_reason_category not in (
    'duplicate_invoice',
    'incorrect_customer',
    'incorrect_delivery_details',
    'test_or_accidental_invoice',
    'other'
  ) then
    raise exception 'Select a valid deletion reason category.';
  end if;

  if char_length(v_reason_detail) < 10 then
    raise exception 'The deletion explanation must contain at least 10 characters.';
  end if;

  select i.* into v_invoice
  from public.delivery_invoices i
  where i.id = p_invoice_id
  for update;

  if v_invoice.id is null then
    raise exception 'Invoice not found.';
  end if;

  if lower(coalesce(v_invoice.status, '')) in ('voided', 'deleted') then
    raise exception 'This invoice is already voided or deleted.';
  end if;

  if exists (
    select 1 from public.invoice_deletion_requests r
    where r.invoice_id = p_invoice_id and r.status = 'pending'
  ) then
    raise exception 'A deletion request for this invoice is already pending owner review.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.id), '[]'::jsonb)
  into v_items
  from public.delivery_invoice_items x
  where x.invoice_id = p_invoice_id;

  select coalesce(
    jsonb_agg(jsonb_build_object('id', o.id, 'status', o.status) order by o.id),
    '[]'::jsonb
  )
  into v_orders
  from public.reseller_orders o
  where o.invoice_id = p_invoice_id;

  select jsonb_build_object(
    'payment_count', (select count(*) from public.reseller_payments p where p.invoice_id = p_invoice_id),
    'payment_total', coalesce((select sum(p.amount) from public.reseller_payments p where p.invoice_id = p_invoice_id), 0),
    'return_count', (select count(*) from public.reseller_returns r where r.invoice_id = p_invoice_id),
    'return_total', coalesce((select sum(r.total_returned_amount) from public.reseller_returns r where r.invoice_id = p_invoice_id), 0),
    'dispute_count', (select count(*) from public.reseller_disputes d where d.invoice_id = p_invoice_id),
    'linked_order_count', (select count(*) from public.reseller_orders o where o.invoice_id = p_invoice_id)
  ) into v_movement;

  insert into public.invoice_deletion_requests (
    invoice_id,
    invoice_number,
    reseller_name,
    total_amount,
    invoice_status_at_request,
    reason_category,
    reason_detail,
    requested_by_admin_user_id,
    requested_by_name,
    invoice_snapshot
  ) values (
    v_invoice.id,
    v_invoice.invoice_number,
    coalesce(v_invoice.reseller_name, v_invoice.customer_name),
    coalesce(v_invoice.total_amount, 0),
    coalesce(v_invoice.status, 'unpaid'),
    v_reason_category,
    v_reason_detail,
    v_requester.id,
    v_requester.full_name,
    jsonb_build_object(
      'invoice', to_jsonb(v_invoice),
      'items', v_items,
      'linked_orders', v_orders,
      'movement', v_movement
    )
  ) returning * into v_request;

  insert into public.notifications (
    admin_user_id,
    employee_id,
    employee_name,
    type,
    title,
    message,
    reference_type,
    reference_id
  )
  select
    owner_profile.id,
    null,
    owner_profile.full_name,
    'invoice_deletion_request',
    'Invoice deletion approval required',
    format('%s requested deletion of invoice %s for %s.', v_requester.full_name, v_invoice.invoice_number, coalesce(v_invoice.reseller_name, v_invoice.customer_name, 'customer')),
    'invoice_deletion_request',
    v_request.id
  from public.admin_users owner_profile
  where owner_profile.is_active = true
    and (
      lower(btrim(owner_profile.role)) = 'owner'
      or 'owner' = any(regexp_split_to_array(lower(coalesce(owner_profile.extra_roles, '')), '\s*,\s*'))
    );

  insert into public.audit_logs(action, performed_by, target_employee, details)
  values (
    'INVOICE DELETION REQUESTED',
    v_requester.full_name,
    coalesce(v_invoice.reseller_name, v_invoice.customer_name),
    format('Request %s | Invoice %s | %s | Reason: %s | %s', v_request.id, v_invoice.invoice_number, v_reason_category, v_reason_detail, v_movement::text)
  );

  return jsonb_build_object(
    'request_id', v_request.id,
    'status', v_request.status,
    'invoice_id', v_invoice.id,
    'invoice_number', v_invoice.invoice_number,
    'message', 'Deletion request sent to the owner for approval.'
  );
end;
$$;

create or replace function public.request_invoice_deletion(
  p_invoice_id uuid,
  p_reason_category text,
  p_reason_detail text
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.request_invoice_deletion_impl(p_invoice_id, p_reason_category, p_reason_detail)
$$;

create or replace function private.review_invoice_deletion_request_impl(
  p_request_id uuid,
  p_decision text,
  p_review_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner public.admin_users%rowtype;
  v_request public.invoice_deletion_requests%rowtype;
  v_invoice public.delivery_invoices%rowtype;
  v_decision text := lower(btrim(coalesce(p_decision, '')));
  v_review_note text := btrim(coalesce(p_review_note, ''));
  v_clean boolean := false;
  v_action text;
  v_summary text;
  v_payment_count integer;
  v_return_count integer;
  v_dispute_count integer;
  v_linked_order_count integer;
  v_decision_snapshot jsonb;
begin
  select au.* into v_owner
  from public.admin_users au
  where au.auth_user_id = (select auth.uid())
    and au.is_active = true
    and (
      lower(btrim(au.role)) = 'owner'
      or 'owner' = any(regexp_split_to_array(lower(coalesce(au.extra_roles, '')), '\s*,\s*'))
    )
  limit 1;

  if v_owner.id is null then
    raise exception 'Only the authenticated owner can review invoice deletion requests.';
  end if;

  if v_decision not in ('approve', 'reject') then
    raise exception 'Decision must be approve or reject.';
  end if;

  if v_decision = 'reject' and char_length(v_review_note) < 3 then
    raise exception 'Enter a rejection note with at least 3 characters.';
  end if;

  select r.* into v_request
  from public.invoice_deletion_requests r
  where r.id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'Invoice deletion request not found.';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'This invoice deletion request has already been reviewed.';
  end if;

  if v_request.requested_by_admin_user_id = v_owner.id then
    raise exception 'The requester cannot approve their own invoice deletion request.';
  end if;

  if v_decision = 'reject' then
    update public.invoice_deletion_requests
    set status = 'rejected',
        reviewed_by_admin_user_id = v_owner.id,
        reviewed_by_name = v_owner.full_name,
        reviewed_at = now(),
        review_note = v_review_note,
        result_action = 'rejected',
        result_summary = 'Owner rejected the request. The invoice was not changed.',
        updated_at = now()
    where id = v_request.id;

    insert into public.notifications (
      admin_user_id, employee_id, employee_name, type, title, message, reference_type, reference_id
    ) values (
      v_request.requested_by_admin_user_id,
      null,
      v_request.requested_by_name,
      'invoice_deletion_review',
      'Invoice deletion request rejected',
      format('The owner rejected deletion of invoice %s. %s', v_request.invoice_number, v_review_note),
      'invoice_deletion_request',
      v_request.id
    );

    insert into public.audit_logs(action, performed_by, target_employee, details)
    values (
      'INVOICE DELETION REJECTED',
      v_owner.full_name,
      v_request.reseller_name,
      format('Request %s | Invoice %s | Review note: %s', v_request.id, v_request.invoice_number, v_review_note)
    );

    return jsonb_build_object(
      'request_id', v_request.id,
      'status', 'rejected',
      'result_action', 'rejected',
      'message', 'Request rejected. The invoice was not changed.'
    );
  end if;

  select i.* into v_invoice
  from public.delivery_invoices i
  where i.id = v_request.invoice_id
  for update;

  if v_invoice.id is null then
    raise exception 'The invoice no longer exists. Approval was not processed.';
  end if;

  select count(*)::integer into v_payment_count
  from public.reseller_payments p where p.invoice_id = v_invoice.id;

  select count(*)::integer into v_return_count
  from public.reseller_returns r where r.invoice_id = v_invoice.id;

  select count(*)::integer into v_dispute_count
  from public.reseller_disputes d where d.invoice_id = v_invoice.id;

  select count(*)::integer into v_linked_order_count
  from public.reseller_orders o where o.invoice_id = v_invoice.id;

  v_clean :=
    lower(coalesce(v_invoice.status, 'unpaid')) = 'unpaid'
    and coalesce(v_invoice.paid_amount, 0) = 0
    and v_invoice.paid_date is null
    and v_invoice.delivered_at is null
    and v_invoice.delivered_by is null
    and coalesce(v_invoice.receipt_confirmed, false) = false
    and v_invoice.confirmed_at is null
    and v_invoice.confirmed_by is null
    and coalesce(v_invoice.returns_amount, 0) = 0
    and coalesce(v_invoice.returns_qty, 0) = 0
    and lower(coalesce(v_invoice.delivery_status, 'pending')) in ('pending', 'unpaid', 'draft')
    and v_payment_count = 0
    and v_return_count = 0
    and v_dispute_count = 0;

  v_decision_snapshot := jsonb_build_object(
    'invoice_status', v_invoice.status,
    'delivery_status', v_invoice.delivery_status,
    'paid_amount', coalesce(v_invoice.paid_amount, 0),
    'payment_count', v_payment_count,
    'return_count', v_return_count,
    'dispute_count', v_dispute_count,
    'linked_order_count', v_linked_order_count,
    'clean_unpaid_invoice', v_clean,
    'reviewed_at', now()
  );

  if v_clean then
    update public.reseller_orders
    set invoice_id = null,
        status = 'pending'
    where invoice_id = v_invoice.id;

    delete from public.delivery_invoice_items where invoice_id = v_invoice.id;
    delete from public.delivery_invoices where id = v_invoice.id;

    v_action := 'deleted';
    v_summary := format(
      'Clean unpaid invoice permanently deleted after owner approval. %s linked order(s) reset to pending. No payments, returns, or disputes were removed.',
      v_linked_order_count
    );
  else
    perform set_config('app.invoice_deletion_request_id', v_request.id::text, true);

    update public.delivery_invoices
    set pre_void_status = coalesce(pre_void_status, status),
        pre_void_delivery_status = coalesce(pre_void_delivery_status, delivery_status),
        status = 'voided',
        delivery_status = 'voided',
        voided_at = now(),
        voided_by_admin_user_id = v_owner.id,
        voided_by_name = v_owner.full_name,
        void_reason = format('%s: %s', v_request.reason_category, v_request.reason_detail),
        invoice_deletion_request_id = v_request.id
    where id = v_invoice.id;

    v_action := 'voided';
    v_summary := format(
      'Invoice voided after owner approval. Financial history retained: %s payment(s), %s return record(s), %s dispute(s), %s linked order(s).',
      v_payment_count,
      v_return_count,
      v_dispute_count,
      v_linked_order_count
    );
  end if;

  update public.invoice_deletion_requests
  set status = 'approved',
      reviewed_by_admin_user_id = v_owner.id,
      reviewed_by_name = v_owner.full_name,
      reviewed_at = now(),
      review_note = nullif(v_review_note, ''),
      result_action = v_action,
      result_summary = v_summary,
      decision_snapshot = v_decision_snapshot,
      updated_at = now()
  where id = v_request.id;

  insert into public.notifications (
    admin_user_id, employee_id, employee_name, type, title, message, reference_type, reference_id
  ) values (
    v_request.requested_by_admin_user_id,
    null,
    v_request.requested_by_name,
    'invoice_deletion_review',
    format('Invoice %s %s', v_request.invoice_number, v_action),
    format('The owner approved your request. %s', v_summary),
    'invoice_deletion_request',
    v_request.id
  );

  insert into public.audit_logs(action, performed_by, target_employee, details)
  values (
    case when v_action = 'deleted' then 'INVOICE DELETION APPROVED - PERMANENTLY DELETED' else 'INVOICE DELETION APPROVED - VOIDED' end,
    v_owner.full_name,
    v_request.reseller_name,
    format('Request %s | Invoice %s | %s | Review note: %s | Decision: %s', v_request.id, v_request.invoice_number, v_summary, nullif(v_review_note, ''), v_decision_snapshot::text)
  );

  return jsonb_build_object(
    'request_id', v_request.id,
    'status', 'approved',
    'result_action', v_action,
    'message', v_summary
  );
end;
$$;

create or replace function public.review_invoice_deletion_request(
  p_request_id uuid,
  p_decision text,
  p_review_note text default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.review_invoice_deletion_request_impl(p_request_id, p_decision, p_review_note)
$$;

revoke execute on function private.get_invoice_deletion_access_impl() from public;
revoke execute on function private.get_invoice_deletion_access_impl() from anon;
revoke execute on function private.get_invoice_deletion_access_impl() from authenticated;

revoke execute on function private.request_invoice_deletion_impl(uuid, text, text) from public;
revoke execute on function private.request_invoice_deletion_impl(uuid, text, text) from anon;
revoke execute on function private.request_invoice_deletion_impl(uuid, text, text) from authenticated;

revoke execute on function private.review_invoice_deletion_request_impl(uuid, text, text) from public;
revoke execute on function private.review_invoice_deletion_request_impl(uuid, text, text) from anon;
revoke execute on function private.review_invoice_deletion_request_impl(uuid, text, text) from authenticated;

revoke execute on function public.get_invoice_deletion_access() from public;
revoke execute on function public.get_invoice_deletion_access() from anon;
grant execute on function public.get_invoice_deletion_access() to authenticated;

revoke execute on function public.request_invoice_deletion(uuid, text, text) from public;
revoke execute on function public.request_invoice_deletion(uuid, text, text) from anon;
grant execute on function public.request_invoice_deletion(uuid, text, text) to authenticated;

revoke execute on function public.review_invoice_deletion_request(uuid, text, text) from public;
revoke execute on function public.review_invoice_deletion_request(uuid, text, text) from anon;
grant execute on function public.review_invoice_deletion_request(uuid, text, text) to authenticated;

do $$
declare
  v_sheryl_id uuid;
  v_owner_id uuid;
  v_sheryl_count integer;
  v_owner_count integer;
begin
  select count(*)::integer, (array_agg(id order by id))[1]
  into v_sheryl_count, v_sheryl_id
  from public.admin_users
  where is_active = true
    and lower(btrim(full_name)) = 'sheryl rosal';

  select count(*)::integer, (array_agg(id order by id))[1]
  into v_owner_count, v_owner_id
  from public.admin_users
  where is_active = true
    and (
      lower(btrim(role)) = 'owner'
      or 'owner' = any(regexp_split_to_array(lower(coalesce(extra_roles, '')), '\s*,\s*'))
    );

  if v_sheryl_count <> 1 then
    raise exception 'Expected exactly one active Sheryl Rosal admin profile; found %.', v_sheryl_count;
  end if;

  if v_owner_count <> 1 then
    raise exception 'Expected exactly one active owner admin profile; found %.', v_owner_count;
  end if;

  insert into public.invoice_deletion_requesters (
    admin_user_id,
    granted_by_admin_user_id,
    is_active,
    granted_at,
    updated_at
  ) values (
    v_sheryl_id,
    v_owner_id,
    true,
    now(),
    now()
  )
  on conflict (admin_user_id) do update
  set granted_by_admin_user_id = excluded.granted_by_admin_user_id,
      is_active = true,
      updated_at = now();
end $$;

notify pgrst, 'reload schema';

commit;
