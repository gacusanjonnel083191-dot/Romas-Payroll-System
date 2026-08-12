-- Roma AI full agent foundation: persistent context, skill registry, developer execution broker.
-- Additive only; does not modify payroll/POS/costing source records.

create table if not exists public.roma_ai_skills (
  id text primary key,
  name text not null,
  description text not null,
  instruction text not null default '',
  tools text[] not null default '{}',
  allowed_roles text[] not null default array['owner','admin','hr','supervisor','asst_supervisor']::text[],
  enabled boolean not null default true,
  risk_class text not null default 'read',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.roma_ai_developer_runs (
  id uuid primary key default gen_random_uuid(),
  change_request_id uuid not null references public.roma_ai_change_requests(id) on delete cascade,
  requested_by uuid not null default auth.uid(),
  status text not null default 'preview_pending',
  branch text,
  base_sha text,
  head_sha text,
  preview_url text,
  production_url text,
  checks jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.roma_ai_knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_type text not null default 'system_document',
  source_ref text,
  vector_store_id text,
  vector_file_id text,
  status text not null default 'registered',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.roma_ai_skills enable row level security;
alter table public.roma_ai_developer_runs enable row level security;
alter table public.roma_ai_knowledge_sources enable row level security;
revoke all on public.roma_ai_skills from anon;
revoke all on public.roma_ai_developer_runs from anon;
revoke all on public.roma_ai_knowledge_sources from anon;

create or replace function public.roma_ai_role_v1()
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select lower(coalesce((select a.role from public.admin_users a where a.auth_user_id=auth.uid() and coalesce(a.is_active,true)=true limit 1),''));
$$;
revoke all on function public.roma_ai_role_v1() from public;
grant execute on function public.roma_ai_role_v1() to authenticated;

create or replace function public.roma_ai_is_owner_v1()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$ select public.roma_ai_role_v1()='owner'; $$;
revoke all on function public.roma_ai_is_owner_v1() from public;
grant execute on function public.roma_ai_is_owner_v1() to authenticated;

create policy roma_ai_skills_read on public.roma_ai_skills for select to authenticated using (public.roma_ai_role_v1() = any(allowed_roles));
create policy roma_ai_skills_owner_write on public.roma_ai_skills for all to authenticated using (public.roma_ai_is_owner_v1()) with check (public.roma_ai_is_owner_v1());
create policy roma_ai_developer_runs_owner_only on public.roma_ai_developer_runs for all to authenticated using (public.roma_ai_is_owner_v1()) with check (public.roma_ai_is_owner_v1());
create policy roma_ai_knowledge_read on public.roma_ai_knowledge_sources for select to authenticated using (public.roma_ai_role_v1() in ('owner','admin','hr','supervisor','asst_supervisor'));
create policy roma_ai_knowledge_owner_write on public.roma_ai_knowledge_sources for all to authenticated using (public.roma_ai_is_owner_v1()) with check (public.roma_ai_is_owner_v1());

insert into public.roma_ai_skills(id,name,description,instruction,tools,allowed_roles,risk_class) values
('business_brain','Business Brain','Cross-module business questions, comparisons, trends and explanations.','Use verified business tools and synthesize across modules. Never invent business figures.',array['read_business','read_records'],array['owner','admin','hr','supervisor','asst_supervisor'],'read'),
('hr_payroll','HR & Payroll Auditor','Employee, attendance, DTR, leave, overtime, payroll and final-pay analysis.','Use role-authorized HR/payroll records and deterministic calculations.',array['read_business','read_records'],array['owner','admin','hr'],'read'),
('inventory_supply','Inventory & Supply','Stocks, suppliers, purchasing, expiry, wastage and reorder analysis.','Verify stock and supplier records; distinguish recorded quantity from inference.',array['read_business','read_records'],array['owner','admin','supervisor','asst_supervisor'],'read'),
('costing_pricing','Costing & Pricing','Recipe, ingredient, handling, packaging, overhead and margin explanation.','Trace every material figure to system data before giving pricing advice.',array['read_business','read_records'],array['owner','admin'],'read'),
('integrity_investigator','Business Integrity Investigator','Investigate reconciliation findings, anomalies and cross-module exceptions.','Explain evidence, exposure, likely cause and next action without silently correcting source records.',array['read_business','read_records'],array['owner','admin'],'read'),
('system_doctor','System Doctor','Screenshot diagnosis, source-code inspection, debugging and safe fix proposals.','Inspect screenshot/context and relevant source before proposing code changes. All changes require Owner approval.',array['search_source','read_source','request_change'],array['owner','admin','hr','supervisor','asst_supervisor'],'propose'),
('developer','Developer Mode','Owner-governed code repair, preview, verification, deployment and rollback workflow.','Never execute without Owner approval and the Developer Execution broker.',array['search_source','read_source','request_change','developer_capabilities'],array['owner'],'execute'),
('knowledge','Knowledge Assistant','Company SOP, policy, document and operating-procedure Q&A.','Ground answers in authorized system documents or configured file search.',array['read_records','file_search'],array['owner','admin','hr','supervisor','asst_supervisor'],'read')
on conflict (id) do update set name=excluded.name,description=excluded.description,instruction=excluded.instruction,tools=excluded.tools,allowed_roles=excluded.allowed_roles,risk_class=excluded.risk_class,updated_at=now();

create or replace function public.roma_ai_list_skills_v1()
returns table(id text,name text,description text,enabled boolean,risk_class text)
language sql stable security definer set search_path = public, pg_temp as $$
  select s.id,s.name,s.description,s.enabled,s.risk_class from public.roma_ai_skills s
  where s.enabled=true and public.roma_ai_role_v1()=any(s.allowed_roles) order by s.name;
$$;
revoke all on function public.roma_ai_list_skills_v1() from public;
grant execute on function public.roma_ai_list_skills_v1() to authenticated;

create or replace function public.roma_ai_thread_history_v1(p_thread_id uuid,p_limit integer default 30)
returns table(sender text,content text,created_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.roma_ai_threads t where t.id=p_thread_id and (t.created_by=auth.uid() or public.roma_ai_is_owner_v1())) then raise exception 'Thread access denied'; end if;
  return query select q.sender,q.content,q.created_at from (
    select m.sender,m.content,m.created_at from public.roma_ai_messages m where m.thread_id=p_thread_id order by m.created_at desc limit greatest(1,least(coalesce(p_limit,30),60))
  ) q order by q.created_at asc;
end;
$$;
revoke all on function public.roma_ai_thread_history_v1(uuid,integer) from public;
grant execute on function public.roma_ai_thread_history_v1(uuid,integer) to authenticated;

create or replace function public.roma_ai_request_change_v3(
  p_request_text text,p_thread_id uuid default null,p_module text default null,p_issue_type text default 'modification',p_risk_level text default 'medium',
  p_diagnosis text default null,p_proposed_change text default null,p_execution_plan jsonb default '{}'::jsonb,p_evidence jsonb default '{}'::jsonb,p_screenshot_meta jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.admin_users%rowtype; r public.roma_ai_change_requests%rowtype;
begin
  select * into a from public.admin_users where auth_user_id=auth.uid() and coalesce(is_active,true)=true limit 1;
  if a.auth_user_id is null then raise exception 'Roma AI access denied'; end if;
  if trim(coalesce(p_request_text,''))='' then raise exception 'Request text required'; end if;
  if lower(coalesce(p_risk_level,'medium')) not in ('low','medium','high','critical') then p_risk_level:='medium'; end if;
  perform pg_advisory_xact_lock(hashtext('roma_ai_change_requests_request_no'));
  insert into public.roma_ai_change_requests(request_no,requester_user_id,requester_name,requester_role,thread_id,request_text,module,issue_type,risk_level,diagnosis,proposed_change,evidence,screenshot_meta,status,execution_plan)
  values((select coalesce(max(request_no),0)+1 from public.roma_ai_change_requests),auth.uid(),a.full_name,a.role,p_thread_id,left(p_request_text,16000),left(p_module,200),coalesce(p_issue_type,'modification'),lower(p_risk_level),left(p_diagnosis,20000),left(p_proposed_change,20000),coalesce(p_evidence,'{}'::jsonb),coalesce(p_screenshot_meta,'{}'::jsonb),'pending_owner',coalesce(p_execution_plan,'{}'::jsonb)) returning * into r;
  return jsonb_build_object('id',r.id,'request_no',r.request_no,'status',r.status,'risk_level',r.risk_level,'owner_approval_required',true,'execution_plan_present',(r.execution_plan<>'{}'::jsonb));
end;
$$;
revoke all on function public.roma_ai_request_change_v3(text,uuid,text,text,text,text,text,jsonb,jsonb,jsonb) from public;
grant execute on function public.roma_ai_request_change_v3(text,uuid,text,text,text,text,text,jsonb,jsonb,jsonb) to authenticated;

create or replace function public.roma_ai_developer_capabilities_v1()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare s public.roma_ai_settings%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into s from public.roma_ai_settings where id='default';
  return jsonb_build_object('role',public.roma_ai_role_v1(),'developer_execution_enabled',coalesce(s.developer_execution_enabled,false),'owner_approval_required',coalesce(s.require_owner_approval_all_modifications,true),'voice_enabled',coalesce(s.voice_enabled,true),'screenshots_enabled',coalesce(s.screenshots_enabled,true));
end;
$$;
revoke all on function public.roma_ai_developer_capabilities_v1() from public;
grant execute on function public.roma_ai_developer_capabilities_v1() to authenticated;

create or replace function public.roma_ai_get_change_for_execution_v1(p_change_request_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare r public.roma_ai_change_requests%rowtype;
begin
  if not public.roma_ai_is_owner_v1() then raise exception 'Owner required'; end if;
  select * into r from public.roma_ai_change_requests where id=p_change_request_id;
  if r.id is null then raise exception 'Change request not found'; end if;
  return jsonb_build_object('id',r.id,'request_no',r.request_no,'status',r.status,'request_text',r.request_text,'module',r.module,'risk_level',r.risk_level,'diagnosis',r.diagnosis,'proposed_change',r.proposed_change,'execution_plan',r.execution_plan,'owner_note',r.owner_note);
end;
$$;
revoke all on function public.roma_ai_get_change_for_execution_v1(uuid) from public;
grant execute on function public.roma_ai_get_change_for_execution_v1(uuid) to authenticated;

create or replace function public.roma_ai_create_developer_run_v1(p_change_request_id uuid,p_branch text,p_base_sha text,p_head_sha text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.roma_ai_developer_runs%rowtype;
begin
  if not public.roma_ai_is_owner_v1() then raise exception 'Owner required'; end if;
  if not exists(select 1 from public.roma_ai_change_requests c where c.id=p_change_request_id and c.status='approved') then raise exception 'Approved change request required'; end if;
  insert into public.roma_ai_developer_runs(change_request_id,requested_by,status,branch,base_sha,head_sha) values(p_change_request_id,auth.uid(),'preview_pending',left(p_branch,250),left(p_base_sha,100),left(p_head_sha,100)) returning * into r;
  update public.roma_ai_change_requests set git_commit=r.head_sha,rollback_reference=r.base_sha,updated_at=now() where id=p_change_request_id;
  return to_jsonb(r);
end;
$$;
revoke all on function public.roma_ai_create_developer_run_v1(uuid,text,text,text) from public;
grant execute on function public.roma_ai_create_developer_run_v1(uuid,text,text,text) to authenticated;

create or replace function public.roma_ai_get_latest_developer_run_v1(p_change_request_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare r public.roma_ai_developer_runs%rowtype;
begin
  if not public.roma_ai_is_owner_v1() then raise exception 'Owner required'; end if;
  select * into r from public.roma_ai_developer_runs where change_request_id=p_change_request_id order by created_at desc limit 1;
  if r.id is null then return '{}'::jsonb; end if; return to_jsonb(r);
end;
$$;
revoke all on function public.roma_ai_get_latest_developer_run_v1(uuid) from public;
grant execute on function public.roma_ai_get_latest_developer_run_v1(uuid) to authenticated;

create or replace function public.roma_ai_update_developer_run_v1(p_run_id uuid,p_status text,p_preview_url text default null,p_production_url text default null,p_checks jsonb default '{}'::jsonb,p_error text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.roma_ai_developer_runs%rowtype;
begin
  if not public.roma_ai_is_owner_v1() then raise exception 'Owner required'; end if;
  update public.roma_ai_developer_runs set status=left(coalesce(p_status,status),80),preview_url=coalesce(p_preview_url,preview_url),production_url=coalesce(p_production_url,production_url),checks=coalesce(p_checks,'{}'::jsonb),error=p_error,updated_at=now() where id=p_run_id returning * into r;
  if r.id is null then raise exception 'Developer run not found'; end if;
  update public.roma_ai_change_requests set preview_deployment=coalesce(r.preview_url,preview_deployment),production_deployment=coalesce(r.production_url,production_deployment),execution_result=jsonb_build_object('developer_run_id',r.id,'status',r.status,'checks',r.checks,'error',r.error),updated_at=now() where id=r.change_request_id;
  return to_jsonb(r);
end;
$$;
revoke all on function public.roma_ai_update_developer_run_v1(uuid,text,text,text,jsonb,text) from public;
grant execute on function public.roma_ai_update_developer_run_v1(uuid,text,text,text,jsonb,text) to authenticated;

create index if not exists roma_ai_developer_runs_change_idx on public.roma_ai_developer_runs(change_request_id,created_at desc);
create index if not exists roma_ai_messages_thread_created_idx on public.roma_ai_messages(thread_id,created_at desc);
comment on table public.roma_ai_developer_runs is 'Owner-gated Roma AI code repair/deployment execution journal. Never bypasses change-request approval.';
comment on table public.roma_ai_skills is 'Role-aware Roma AI skill registry.';
