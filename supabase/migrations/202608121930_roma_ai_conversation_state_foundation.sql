-- Roma AI conversation state foundation
-- Adds persistent per-thread entity/topic/period memory without changing operational records.

create table if not exists public.roma_ai_conversation_state (
  thread_id uuid primary key references public.roma_ai_threads(id) on delete cascade,
  user_id uuid not null,
  active_intent text,
  active_entities jsonb not null default '{}'::jsonb,
  active_period jsonb not null default '{}'::jsonb,
  last_user_message text,
  last_reply text,
  last_evidence jsonb not null default '{}'::jsonb,
  last_resolution text,
  correction_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.roma_ai_conversation_state enable row level security;
revoke all on public.roma_ai_conversation_state from anon;
grant select on public.roma_ai_conversation_state to authenticated;

drop policy if exists roma_ai_conversation_state_read on public.roma_ai_conversation_state;
create policy roma_ai_conversation_state_read
on public.roma_ai_conversation_state for select to authenticated
using (user_id = auth.uid() or public.business_control_has_role(array['owner']));

create index if not exists idx_roma_ai_conversation_state_user_updated
on public.roma_ai_conversation_state(user_id, updated_at desc);

create or replace function public.roma_ai_intent_canonical_v1(p_intent text)
returns text
language sql
immutable
set search_path=public,pg_temp
as $$
  select case lower(coalesce(p_intent,''))
    when 'sales' then 'sales'
    when 'expenses' then 'expenses'
    when 'employee_attendance' then 'attendance DTR'
    when 'employee_profile' then 'employee details'
    when 'payroll' then 'payroll'
    when 'cash_advance' then 'cash advance'
    when 'final_pay' then 'final pay'
    when 'inventory' then 'inventory stock'
    when 'supplier' then 'supplier'
    when 'purchase_orders' then 'purchase order'
    when 'wastage' then 'wastage'
    when 'production' then 'production'
    when 'costing' then 'costing'
    when 'receivables' then 'receivables reseller balance'
    when 'reseller' then 'reseller'
    when 'returns' then 'reseller returns'
    when 'crates' then 'crates covers'
    when 'payables' then 'company payables'
    when 'leave' then 'employee leave'
    when 'schedule' then 'employee schedule'
    when 'pos' then 'POS sales'
    when 'integrity' then 'business integrity'
    when 'business_summary' then 'business summary'
    when 'sop' then 'SOP'
    when 'bank_deposit' then 'bank deposit'
    when 'cash_reconciliation' then 'cash reconciliation'
    when 'remittance' then 'remittance'
    when 'documents' then 'company documents'
    when 'weather' then 'PAGASA weather'
    else null end
$$;

create or replace function public.roma_ai_resolve_supplier_v1(p_message text)
returns jsonb
language plpgsql
stable security definer
set search_path=public,extensions,pg_temp
as $$
declare q text:=public.roma_ai_norm(p_message); out jsonb;
begin
  select to_jsonb(x) into out from (
    select s.id,s.name,s.contact_person,s.payment_terms,s.address,
      coalesce((select count(*) from regexp_split_to_table(public.roma_ai_norm(s.name),'\s+') tok where length(tok)>=3 and position(tok in q)>0),0) token_hits,
      word_similarity(public.roma_ai_norm(s.name),q)::numeric similarity_score
    from public.inventory_suppliers s
    where exists(select 1 from regexp_split_to_table(public.roma_ai_norm(s.name),'\s+') tok where length(tok)>=3 and position(tok in q)>0)
       or word_similarity(public.roma_ai_norm(s.name),q)>=0.58
    order by token_hits desc, similarity_score desc, length(public.roma_ai_norm(s.name)) desc
    limit 1
  ) x;
  return coalesce(out,'{}'::jsonb);
end $$;

revoke all on function public.roma_ai_intent_canonical_v1(text) from public,anon;
revoke all on function public.roma_ai_resolve_supplier_v1(text) from public,anon;
grant execute on function public.roma_ai_intent_canonical_v1(text) to authenticated;
grant execute on function public.roma_ai_resolve_supplier_v1(text) to authenticated;
