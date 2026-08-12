-- Let the existing GENERATED ALWAYS identity create request_no.
create or replace function public.roma_ai_request_change_v3(
  p_request_text text,p_thread_id uuid default null,p_module text default null,p_issue_type text default 'modification',p_risk_level text default 'medium',
  p_diagnosis text default null,p_proposed_change text default null,p_execution_plan jsonb default '{}'::jsonb,p_evidence jsonb default '{}'::jsonb,p_screenshot_meta jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.admin_users%rowtype; r public.roma_ai_change_requests%rowtype;
begin
  select * into a from public.admin_users where auth_user_id=auth.uid() and coalesce(is_active,true)=true limit 1;
  if a.auth_user_id is null then raise exception 'Roma AI access denied'; end if;
  if trim(coalesce(p_request_text,''))='' then raise exception 'Request text required'; end if;
  if lower(coalesce(p_risk_level,'medium')) not in ('low','medium','high','critical') then p_risk_level:='medium'; end if;
  insert into public.roma_ai_change_requests(requester_user_id,requester_name,requester_role,thread_id,request_text,module,issue_type,risk_level,diagnosis,proposed_change,evidence,screenshot_meta,status,execution_plan)
  values(auth.uid(),a.full_name,a.role,p_thread_id,left(p_request_text,16000),left(p_module,200),coalesce(p_issue_type,'modification'),lower(p_risk_level),left(p_diagnosis,20000),left(p_proposed_change,20000),coalesce(p_evidence,'{}'::jsonb),coalesce(p_screenshot_meta,'{}'::jsonb),'pending_owner',coalesce(p_execution_plan,'{}'::jsonb)) returning * into r;
  return jsonb_build_object('id',r.id,'request_no',r.request_no,'status',r.status,'risk_level',r.risk_level,'owner_approval_required',true,'execution_plan_present',(r.execution_plan<>'{}'::jsonb));
end;
$$;
revoke all on function public.roma_ai_request_change_v3(text,uuid,text,text,text,text,text,jsonb,jsonb,jsonb) from public;
grant execute on function public.roma_ai_request_change_v3(text,uuid,text,text,text,text,text,jsonb,jsonb,jsonb) to authenticated;
