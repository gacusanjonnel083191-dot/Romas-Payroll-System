-- Roma AI 2.0 general-agent role and repair policy
-- Broadens safe AI read/diagnostic capability for privileged staff while preserving
-- Owner-only approval and execution for system modifications.

create or replace function public.roma_ai_session_context()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public','pg_temp'
set timezone to 'Asia/Manila'
as $function$
declare
  a jsonb;
  r text;
  skills jsonb;
  common_skills jsonb := '["business_summary","sales","expenses","inventory","receivables","production","costing","attendance","payroll","pos","integrity","screenshot_doctor","developer","voice_navigation"]'::jsonb;
begin
  a := public.business_control_current_actor();
  r := lower(coalesce(a->>'role',''));
  if not coalesce((a->>'is_active')::boolean,false)
     or r not in ('owner','admin','hr','supervisor','asst_supervisor') then
    return jsonb_build_object(
      'enabled',false,
      'actor',a,
      'skills','[]'::jsonb,
      'owner_approval_required',true,
      'can_request_repairs',false,
      'can_inspect_source',false,
      'can_approve_changes',false,
      'can_execute_repairs',false
    );
  end if;

  -- Privileged staff use the same general AI brain and may read the complete
  -- SAFE-COLUMN business catalog, diagnose any module, inspect approved source,
  -- and create repair requests. Sensitive columns remain excluded by
  -- roma_ai_read_records_v1. Only the Owner may approve/execute changes.
  skills := common_skills || case when r='owner' then '["deployment"]'::jsonb else '[]'::jsonb end;

  return jsonb_build_object(
    'enabled',true,
    'actor',a,
    'skills',skills,
    'owner_approval_required',true,
    'general_agent_access',true,
    'safe_cross_module_read',true,
    'can_request_repairs',true,
    'can_inspect_source',true,
    'can_approve_changes',(r='owner'),
    'can_execute_repairs',(r='owner'),
    'developer_execution_enabled',(select coalesce(developer_execution_enabled,false) from public.roma_ai_settings where id='default')
  );
end;
$function$;

create or replace function public.roma_ai_role_policy_v2()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public','pg_temp'
as $function$
declare
  ctx jsonb := public.roma_ai_session_context();
  r text := lower(coalesce(ctx#>>'{actor,role}',''));
begin
  if not coalesce((ctx->>'enabled')::boolean,false) then
    raise exception 'Roma AI access denied';
  end if;
  return jsonb_build_object(
    'role',r,
    'can_ask_general_questions',true,
    'can_read_safe_cross_module_data',true,
    'can_use_system_doctor',true,
    'can_inspect_approved_source',true,
    'can_request_repairs',true,
    'can_approve_changes',(r='owner'),
    'can_execute_repairs',(r='owner'),
    'owner_approval_required',true,
    'sensitive_fields_redacted',true,
    'unrestricted_sql_allowed',false,
    'secrets_exposed_to_model',false
  );
end;
$function$;

create or replace function public.roma_ai_system_health_v2()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public','pg_temp'
set timezone to 'Asia/Manila'
as $function$
declare
  ctx jsonb := public.roma_ai_session_context();
  latest_run record;
  pending_changes integer := 0;
  critical_open integer := 0;
  active_staff integer := 0;
begin
  if not coalesce((ctx->>'enabled')::boolean,false) then raise exception 'Roma AI access denied'; end if;

  select id,status,started_at,completed_at,total_findings,critical_count,high_count,total_exposure
    into latest_run
    from public.business_integrity_runs
    order by started_at desc nulls last
    limit 1;

  select count(*) into pending_changes
    from public.roma_ai_change_requests
    where status in ('pending_owner','approved');

  select count(*) into critical_open
    from public.business_integrity_exceptions
    where severity='critical' and status not in ('resolved','waived');

  select count(*) into active_staff
    from public.admin_users
    where coalesce(is_active,true)=true
      and lower(role) in ('owner','admin','hr','supervisor','asst_supervisor');

  return jsonb_build_object(
    'checked_at',now(),
    'role',ctx#>>'{actor,role}',
    'roma_ai_enabled',true,
    'general_agent_access',coalesce((ctx->>'general_agent_access')::boolean,false),
    'developer_execution_enabled',coalesce((ctx->>'developer_execution_enabled')::boolean,false),
    'owner_approval_required',true,
    'active_privileged_users',active_staff,
    'pending_or_approved_change_requests',pending_changes,
    'open_critical_integrity_findings',critical_open,
    'latest_integrity_run',case when latest_run.id is null then null else jsonb_build_object(
      'id',latest_run.id,
      'status',latest_run.status,
      'started_at',latest_run.started_at,
      'completed_at',latest_run.completed_at,
      'total_findings',latest_run.total_findings,
      'critical_count',latest_run.critical_count,
      'high_count',latest_run.high_count,
      'total_exposure',latest_run.total_exposure
    ) end
  );
end;
$function$;

-- All privileged staff see the same reasoning/diagnostic skill catalog. Execution
-- is still blocked server-side unless the authenticated role is Owner.
update public.roma_ai_skills
set allowed_roles='["owner","admin","hr","supervisor","asst_supervisor"]'::jsonb,
    updated_at=now()
where id in ('business_brain','integrity_investigator','costing_pricing','hr_payroll','inventory_supply','knowledge','system_doctor','developer');

update public.roma_ai_skills
set description='System-wide code diagnosis and repair proposals for privileged staff; Owner governs approval, preview promotion, deployment and rollback.',
    instruction='Inspect approved source and verified system evidence before proposing a repair. Staff may diagnose and request repairs; only Owner may approve or execute production-changing actions.',
    tools='["search_source","read_source","request_change","developer_capabilities"]'::jsonb,
    risk_class='propose',
    updated_at=now()
where id='developer';

revoke all on function public.roma_ai_role_policy_v2() from public, anon;
revoke all on function public.roma_ai_system_health_v2() from public, anon;
grant execute on function public.roma_ai_role_policy_v2() to authenticated;
grant execute on function public.roma_ai_system_health_v2() to authenticated;
