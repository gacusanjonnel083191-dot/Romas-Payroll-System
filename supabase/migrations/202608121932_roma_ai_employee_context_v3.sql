-- Roma AI conversation state v3.
-- Keeps employee + topic + exact period together across follow-ups and returns entity-scoped payroll/attendance/CA data.

create or replace function public.roma_ai_employee_context_read_v1(
  p_intent text, p_employee_id uuid, p_from date, p_to date, p_message text default ''
) returns jsonb
language plpgsql
stable security definer
set search_path=public,extensions,pg_temp
set "TimeZone"='Asia/Manila'
as $$
declare
  ctx jsonb:=public.roma_ai_session_context(); emp public.employees%rowtype;
  skill text; n int:=0; amt numeric:=0; amt2 numeric:=0; amt3 numeric:=0; rows_text text; reply text; evidence jsonb:='{}'::jsonb;
  r public.payroll_records%rowtype;
begin
  select * into emp from public.employees where id=p_employee_id;
  if emp.id is null then return jsonb_build_object('handled',false); end if;
  skill:=case p_intent
    when 'employee_profile' then 'attendance' when 'employee_attendance' then 'attendance'
    when 'leave' then 'attendance' when 'schedule' then 'attendance'
    when 'payroll' then 'payroll' when 'cash_advance' then 'payroll' when 'final_pay' then 'payroll'
    when 'documents' then 'integrity' else null end;
  if skill is null then return jsonb_build_object('handled',false); end if;
  if not coalesce(ctx->'skills','[]'::jsonb) ? skill then
    return jsonb_build_object('handled',true,'intent',p_intent,'skill',skill,'reply','Your '||coalesce(ctx#>>'{actor,role}','current')||' role is not authorized to access this '||replace(skill,'_',' ')||' information.');
  end if;

  if p_intent='employee_profile' then
    reply:=emp.full_name||' — employee code '||coalesce(emp.employee_code,'n/a')||', position '||coalesce(emp.position,'not recorded')||', department '||coalesce(emp.department,'not recorded')||', employment type '||coalesce(emp.employment_type,'not recorded')||', hire date '||coalesce(emp.hire_date::text,'not recorded')||', work location '||coalesce(emp.work_location,'not recorded')||'.';
    evidence:=jsonb_build_object('employee_id',emp.id,'employee_name',emp.full_name);
  elsif p_intent='employee_attendance' then
    select count(distinct attendance_date) filter(where time_in is not null),coalesce(sum(late_minutes),0),coalesce(sum(undertime_minutes),0),coalesce(sum(overtime_minutes),0),
      string_agg(to_char(attendance_date,'Mon DD')||': '||coalesce(to_char(time_in,'HH24:MI'),'—')||'–'||coalesce(to_char(time_out,'HH24:MI'),'—')||case when coalesce(status,'')<>'' then ' ('||status||')' else '' end,E'\n' order by attendance_date)
    into n,amt,amt2,amt3,rows_text from public.attendance_logs where employee_id=emp.id and attendance_date between p_from and p_to;
    reply:=emp.full_name||' has '||n||' verified worked day(s) from '||p_from||' to '||p_to||', based on distinct attendance dates with a recorded time-in. Late minutes: '||amt||'; undertime minutes: '||amt2||'; overtime minutes: '||amt3||'.';
    if public.roma_ai_norm(p_message) ~ '(dtr|detail|details|breakdown|list|show|ipakita|isa isahin)' and coalesce(rows_text,'')<>'' then reply:=reply||E'\nDTR:\n'||rows_text; end if;
    evidence:=jsonb_build_object('employee_id',emp.id,'employee_name',emp.full_name,'from',p_from,'to',p_to,'worked_days',n,'late_minutes',amt,'undertime_minutes',amt2,'overtime_minutes',amt3);
  elsif p_intent='payroll' then
    select * into r from public.payroll_records where employee_id=emp.id and payroll_end>=p_from and payroll_start<=p_to order by payroll_end desc,created_at desc limit 1;
    if r.id is null then
      reply:='I found no payroll record for '||emp.full_name||' overlapping '||p_from||' to '||p_to||'.'; evidence:=jsonb_build_object('employee_id',emp.id,'employee_name',emp.full_name,'from',p_from,'to',p_to,'record_found',false);
    else
      reply:=emp.full_name||' payroll for '||r.payroll_start||' to '||r.payroll_end||': basic pay ₱'||to_char(coalesce(r.basic_pay,0),'FM999,999,990.00')||', overtime pay ₱'||to_char(coalesce(r.overtime_pay,0),'FM999,999,990.00')||', gross pay ₱'||to_char(coalesce(r.gross_pay,0),'FM999,999,990.00')||', deductions ₱'||to_char(coalesce(r.total_deductions,0),'FM999,999,990.00')||', net pay ₱'||to_char(coalesce(r.net_pay,0),'FM999,999,990.00')||'. Worked days: '||coalesce(r.worked_days,0)||'; late: '||coalesce(r.late_minutes,0)||' min; undertime: '||coalesce(r.undertime_minutes,0)||' min; overtime: '||coalesce(r.overtime_minutes,0)||' min. Status: '||coalesce(r.payroll_status,case when r.payroll_released then 'released' else 'not released' end)||'.';
      evidence:=jsonb_build_object('employee_id',emp.id,'employee_name',emp.full_name,'payroll_record_id',r.id,'payroll_start',r.payroll_start,'payroll_end',r.payroll_end,'net_pay',r.net_pay,'record_found',true);
    end if;
  elsif p_intent='cash_advance' then
    select count(*),coalesce(sum(amount),0),coalesce(sum(amount_paid),0),coalesce(sum(balance),0) into n,amt,amt2,amt3 from public.cash_advances where employee_id=emp.id;
    reply:=emp.full_name||' has '||n||' cash-advance ledger record(s): original advances ₱'||to_char(amt,'FM999,999,990.00')||', paid ₱'||to_char(amt2,'FM999,999,990.00')||', remaining balance ₱'||to_char(amt3,'FM999,999,990.00')||'.';
    evidence:=jsonb_build_object('employee_id',emp.id,'employee_name',emp.full_name,'record_count',n,'original_advances',amt,'paid',amt2,'balance',amt3);
  elsif p_intent='final_pay' then
    select count(*),coalesce(max(total_final_pay),0) into n,amt from (select * from public.final_pay_records where employee_id=emp.id order by created_at desc limit 1) z;
    reply:=case when n=0 then 'I found no final-pay record for '||emp.full_name||'.' else 'Latest final-pay record for '||emp.full_name||': ₱'||to_char(amt,'FM999,999,990.00')||'.' end;
    evidence:=jsonb_build_object('employee_id',emp.id,'employee_name',emp.full_name,'record_found',n>0,'total_final_pay',amt);
  elsif p_intent='leave' then
    select count(*),string_agg(coalesce(leave_type,'Leave')||' '||coalesce(leave_start::text,leave_date::text)||case when leave_end is not null and leave_end<>coalesce(leave_start,leave_date) then ' to '||leave_end else '' end||' — '||coalesce(status,'unknown'),'; ' order by coalesce(leave_start,leave_date) desc) into n,rows_text from public.leave_requests where employee_id=emp.id and coalesce(leave_start,leave_date) between p_from and p_to;
    reply:=emp.full_name||' has '||n||' leave request(s) from '||p_from||' to '||p_to||case when n>0 then ': '||rows_text else '.' end; evidence:=jsonb_build_object('employee_id',emp.id,'employee_name',emp.full_name,'from',p_from,'to',p_to,'record_count',n);
  elsif p_intent='schedule' then
    select count(*),string_agg(to_char(schedule_date,'Mon DD')||' '||to_char(shift_start,'HH24:MI')||'–'||to_char(shift_end,'HH24:MI'),'; ' order by schedule_date) into n,rows_text from public.daily_schedules where employee_id=emp.id and schedule_date between p_from and p_to;
    reply:=emp.full_name||' has '||n||' schedule record(s) from '||p_from||' to '||p_to||case when n>0 then ': '||rows_text else '.' end; evidence:=jsonb_build_object('employee_id',emp.id,'employee_name',emp.full_name,'from',p_from,'to',p_to,'record_count',n);
  elsif p_intent='documents' then
    select count(*),string_agg(coalesce(document_no,'No #')||' '||coalesce(document_type,form_key,'Document')||' — '||coalesce(subject,'No subject')||' ('||coalesce(status,'unknown')||')','; ' order by document_date desc nulls last,created_at desc) into n,rows_text from public.company_document_records where employee_id in (emp.id::text,emp.employee_code) or public.roma_ai_norm(employee_name)=public.roma_ai_norm(emp.full_name);
    reply:=emp.full_name||' has '||n||' company-document record(s)'||case when public.roma_ai_norm(p_message)~'(detail|list|show|ipakita)' and coalesce(rows_text,'')<>'' then ': '||rows_text else '.' end; evidence:=jsonb_build_object('employee_id',emp.id,'employee_name',emp.full_name,'record_count',n);
  end if;
  return jsonb_build_object('handled',true,'intent',p_intent,'skill',skill,'reply',reply,'period',jsonb_build_object('from',p_from,'to',p_to),'evidence',evidence,'entities',jsonb_build_object('employee',jsonb_build_object('id',emp.id,'name',emp.full_name,'code',emp.employee_code)));
end $$;

create or replace function public.roma_ai_service_ask_context_v3(p_message text,p_thread_id uuid default null,p_input_mode text default 'text',p_has_screenshot boolean default false)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp set "TimeZone"='Asia/Manila' as $$
declare
  ctx jsonb:=public.roma_ai_session_context(); tid uuid:=p_thread_id; t jsonb; st public.roma_ai_conversation_state%rowtype;
  q text:=public.roma_ai_norm(p_message); raw_lower text:=lower(trim(coalesce(p_message,''))); ij jsonb; direct_intent text; target_intent text;
  emp jsonb:='{}'::jsonb; state_emp jsonb:='{}'::jsonb; use_emp jsonb:='{}'::jsonb; period jsonb; d1 date; d2 date;
  explicit_period boolean:=false; followup boolean:=false; pronoun boolean:=false; global_scope boolean:=false;
  correction_target text; corrected_emp jsonb:='{}'::jsonb; correction boolean:=false; r jsonb; reply text; evidence jsonb; new_entities jsonb;
  resolution text:='direct'; input_mode text:=case when p_input_mode in ('text','voice','screenshot') then p_input_mode else 'text' end;
begin
  if trim(coalesce(p_message,''))='' then raise exception 'Message is required.'; end if;
  if not coalesce((ctx->>'enabled')::boolean,false) then raise exception 'Roma AI access denied'; end if;
  if tid is null then t:=public.roma_ai_create_thread(left(trim(p_message),120)); tid:=(t->>'id')::uuid; end if;
  if coalesce(p_has_screenshot,false) then return public.roma_ai_service_ask_context_v2(p_message,tid,input_mode,p_has_screenshot); end if;
  select * into st from public.roma_ai_conversation_state where thread_id=tid and user_id=auth.uid();
  if st.thread_id is not null then state_emp:=coalesce(st.active_entities->'employee','{}'::jsonb); end if;
  emp:=public.roma_ai_resolve_entity_v3('employee',p_message); ij:=public.roma_ai_resolve_intent_v2(p_message); direct_intent:=ij->>'intent';
  if q ~ '(final pay|separation pay|back pay|backpay|last pay|huling sahod|final na sahod)' then direct_intent:='final_pay'; end if;
  followup:=q ~ '^(how about|what about|and |then |same |si |kay |eh si |paano naman|kumusta naman|yung |ung |ito |iyan |iyon )' or length(q)<=35;
  pronoun:=q ~ '(^| )(niya|nya|noya|kanya|siya|his|her|him|nito|neto)( |$)' or q ~ '(sa kanya|that employee|same employee|same person|that one|same one)';
  global_scope:=q ~ '(all employees|all staff|everyone|every employee|lahat ng empleyado|lahat ng staff|company total|overall|buong company|total cash advance|all cash advance)';
  explicit_period:=q ~ '(today|yesterday|tomorrow|ngayon|kahapon|bukas|last cutoff|previous cutoff|current cutoff|this cutoff|last month|this month|previous month|whole month|january|february|march|april|may |june|july|august|september|october|november|december|enero|pebrero|marzo|abril|mayo|hunyo|hulyo|agosto|setyembre|oktubre|nobyembre|disyembre|20[0-9]{2}-[0-9]{2}-[0-9]{2})';

  if raw_lower like '%i mean %' then correction_target:=substring(raw_lower from position('i mean ' in raw_lower)+7);
  elsif raw_lower like '%ibig kong sabihin%' then correction_target:=substring(raw_lower from position('ibig kong sabihin' in raw_lower)+18);
  elsif raw_lower ~ '[[:space:]]not[[:space:]]' then correction_target:=regexp_replace(raw_lower,'^.*[[:space:]]not[[:space:]]+','','i');
  elsif raw_lower ~ '[[:space:]]hindi[[:space:]]+(si|kay)?[[:space:]]*' then correction_target:=regexp_replace(raw_lower,'^.*[[:space:]]hindi[[:space:]]+(si|kay)?[[:space:]]*','','i');
  elsif raw_lower ~ '[[:space:]]di[[:space:]]+(si|kay)?[[:space:]]*' then correction_target:=regexp_replace(raw_lower,'^.*[[:space:]]di[[:space:]]+(si|kay)?[[:space:]]*','','i');
  elsif raw_lower ~ '^(no|mali|wrong)[, ]+' then correction_target:=regexp_replace(raw_lower,'^(no|mali|wrong)[, ]+','','i'); end if;
  if coalesce(trim(correction_target),'')<>'' then corrected_emp:=public.roma_ai_resolve_entity_v3('employee',correction_target); end if;
  if coalesce(corrected_emp->>'id','')<>'' then emp:=corrected_emp; correction:=true; end if;

  if direct_intent is not null and not (followup and st.active_intent is not null and direct_intent='employee_profile') then target_intent:=direct_intent;
  elsif st.active_intent is not null and (followup or pronoun or correction or coalesce(emp->>'id','')<>'') then target_intent:=st.active_intent;
  elsif coalesce(emp->>'id','')<>'' then target_intent:='employee_profile'; end if;
  if coalesce(emp->>'id','')<>'' then use_emp:=emp; elsif coalesce(state_emp->>'id','')<>'' then use_emp:=state_emp; end if;
  if explicit_period or st.thread_id is null or coalesce(st.active_period->>'from','')='' then period:=public.roma_ai_parse_business_period_v3(p_message); else period:=st.active_period; resolution:='inherited_period'; end if;
  d1:=coalesce(nullif(period->>'from','')::date,(timezone('Asia/Manila',now()))::date-30); d2:=coalesce(nullif(period->>'to','')::date,(timezone('Asia/Manila',now()))::date);

  if not global_scope and target_intent in ('employee_profile','employee_attendance','payroll','cash_advance','final_pay','leave','schedule','documents') and coalesce(use_emp->>'id','')<>'' then
    r:=public.roma_ai_employee_context_read_v1(target_intent,(use_emp->>'id')::uuid,d1,d2,p_message);
    if coalesce((r->>'handled')::boolean,false) then
      reply:=r->>'reply'; evidence:=coalesce(r->'evidence','{}'::jsonb); new_entities:=coalesce(case when st.thread_id is not null then st.active_entities else '{}'::jsonb end,'{}'::jsonb); new_entities:=jsonb_set(new_entities,'{employee}',use_emp,true);
      if correction then resolution:='correction_applied'; reply:='Correction applied — I will keep '||(use_emp->>'name')||' as the employee you mean. '||reply;
      elsif coalesce(emp->>'id','')<>'' and st.thread_id is not null and target_intent=st.active_intent then resolution:='switched_employee_same_topic';
      elsif pronoun and coalesce(emp->>'id','')='' then resolution:='pronoun_resolved'; elsif resolution='direct' and coalesce(emp->>'id','')='' then resolution:='inherited_employee'; end if;
      perform public.roma_ai_log_message(tid,'user',left(trim(p_message),10000),input_mode,jsonb_build_object('service_mode','conversation-state-v3','intent',target_intent,'resolution',resolution));
      perform public.roma_ai_log_message(tid,'assistant',reply,'system',jsonb_build_object('service_mode','conversation-state-v3','intent',target_intent,'period',jsonb_build_object('from',d1,'to',d2),'evidence',evidence,'resolution',resolution,'active_entities',new_entities));
      insert into public.roma_ai_conversation_state(thread_id,user_id,active_intent,active_entities,active_period,last_user_message,last_reply,last_evidence,last_resolution,correction_count,updated_at)
      values(tid,auth.uid(),target_intent,new_entities,jsonb_build_object('from',d1,'to',d2),left(p_message,10000),left(reply,20000),evidence,resolution,case when correction then 1 else 0 end,now())
      on conflict(thread_id) do update set active_intent=excluded.active_intent,active_entities=excluded.active_entities,active_period=excluded.active_period,last_user_message=excluded.last_user_message,last_reply=excluded.last_reply,last_evidence=excluded.last_evidence,last_resolution=excluded.last_resolution,correction_count=public.roma_ai_conversation_state.correction_count+case when correction then 1 else 0 end,updated_at=now();
      return jsonb_build_object('reply',reply,'threadId',tid,'role',ctx#>>'{actor,role}','skills',coalesce(ctx->'skills','[]'::jsonb),'ownerApprovalRequired',true,'developerExecutionEnabled',false,'clientActions','[]'::jsonb,'providerMode','conversation-state-v3','version','2026.08.12.15-context','intent',target_intent,'period',jsonb_build_object('from',d1,'to',d2),'evidence',evidence,'contextResolution',resolution,'activeContext',jsonb_build_object('intent',target_intent,'entities',new_entities));
    end if;
  end if;
  return public.roma_ai_service_ask_context_v2(p_message,tid,input_mode,p_has_screenshot);
end $$;

create or replace function public.roma_ai_service_ask(p_message text,p_thread_id uuid default null,p_input_mode text default 'text',p_has_screenshot boolean default false)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp set "TimeZone"='Asia/Manila' as $$
begin return public.roma_ai_service_ask_context_v3(p_message,p_thread_id,p_input_mode,p_has_screenshot); end $$;

revoke all on function public.roma_ai_employee_context_read_v1(text,uuid,date,date,text) from public,anon;
revoke all on function public.roma_ai_service_ask_context_v3(text,uuid,text,boolean) from public,anon;
revoke all on function public.roma_ai_service_ask(text,uuid,text,boolean) from public,anon;
grant execute on function public.roma_ai_employee_context_read_v1(text,uuid,date,date,text) to authenticated;
grant execute on function public.roma_ai_service_ask_context_v3(text,uuid,text,boolean) to authenticated;
grant execute on function public.roma_ai_service_ask(text,uuid,text,boolean) to authenticated;
