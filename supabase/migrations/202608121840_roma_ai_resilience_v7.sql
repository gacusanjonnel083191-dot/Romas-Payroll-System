-- Roma AI semantic resilience v7
-- Applied to production Supabase on 2026-08-12.
-- Purpose: preserve explicit month/day dates, answer natural inventory/absence/employee-count questions,
-- and route the existing Roma AI service through v7 while keeping all role checks and Owner approval controls.

create or replace function public.roma_ai_parse_business_period_v3(p_message text)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public','extensions','pg_temp'
set "TimeZone" to 'Asia/Manila'
as $$
declare
  q text:=public.roma_ai_norm(p_message);
  m text[]; mon int; d int;
  y int:=extract(year from timezone('Asia/Manila',now()))::int;
  result_date date; month_token text;
begin
  m:=regexp_match(q,'\m(january|jan|enero|february|feb|pebrero|march|mar|marzo|april|apr|abril|may|mayo|june|jun|hunyo|july|jul|hulyo|august|aug|agosto|september|sep|setyembre|october|oct|oktubre|november|nov|nobyembre|december|dec|disyembre)\M\s+(\d{1,2})(?:\s+(20\d{2}))?');
  if m is not null then
    month_token:=m[1]; d:=m[2]::int; if m[3] is not null then y:=m[3]::int; end if;
  else
    m:=regexp_match(q,'\m(\d{1,2})\s+(january|jan|enero|february|feb|pebrero|march|mar|marzo|april|apr|abril|may|mayo|june|jun|hunyo|july|jul|hulyo|august|aug|agosto|september|sep|setyembre|october|oct|oktubre|november|nov|nobyembre|december|dec|disyembre)\M(?:\s+(20\d{2}))?');
    if m is not null then d:=m[1]::int; month_token:=m[2]; if m[3] is not null then y:=m[3]::int; end if; end if;
  end if;
  if month_token is not null then
    mon:=case month_token
      when 'january' then 1 when 'jan' then 1 when 'enero' then 1
      when 'february' then 2 when 'feb' then 2 when 'pebrero' then 2
      when 'march' then 3 when 'mar' then 3 when 'marzo' then 3
      when 'april' then 4 when 'apr' then 4 when 'abril' then 4
      when 'may' then 5 when 'mayo' then 5 when 'june' then 6 when 'jun' then 6 when 'hunyo' then 6
      when 'july' then 7 when 'jul' then 7 when 'hulyo' then 7 when 'august' then 8 when 'aug' then 8 when 'agosto' then 8
      when 'september' then 9 when 'sep' then 9 when 'setyembre' then 9 when 'october' then 10 when 'oct' then 10 when 'oktubre' then 10
      when 'november' then 11 when 'nov' then 11 when 'nobyembre' then 11 when 'december' then 12 when 'dec' then 12 when 'disyembre' then 12 end;
    begin
      result_date:=make_date(y,mon,d);
      return jsonb_build_object('from',result_date,'to',result_date,'source','month_day');
    exception when others then null; end;
  end if;
  return public.roma_ai_parse_business_period_v2(p_message);
end;
$$;

create or replace function public.roma_ai_universal_read_v7(p_message text)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public','extensions','pg_temp'
set "TimeZone" to 'Asia/Manila'
as $$
declare
  q text:=public.roma_ai_norm(p_message);
  ctx jsonb:=public.roma_ai_session_context();
  period jsonb:=public.roma_ai_parse_business_period_v3(p_message);
  d1 date:=(period->>'from')::date; d2 date:=(period->>'to')::date;
  item jsonb; sup_name text; reply text;
  active_count int:=0; inactive_count int:=0; explicit_absent int:=0; scheduled_no_show int:=0;
  absent_names text; no_show_names text; u jsonb;
begin
  if q='' then return jsonb_build_object('handled',false); end if;
  if not coalesce((ctx->>'enabled')::boolean,false) then return jsonb_build_object('handled',false); end if;

  if q ~ '(stock|stocks|inventory|natira|natitira|remaining|left|available|on hand|ilan pa|how much.*left|how many.*left|cost|price|halaga)' then
    item:=public.roma_ai_resolve_entity_v3('inventory',p_message);
    if coalesce(item->>'id','')<>'' and coalesce((item->>'score')::numeric,0)>=0.70 then
      if not coalesce(ctx->'skills','[]'::jsonb) ? 'inventory' then
        return jsonb_build_object('handled',true,'intent','inventory','skill','inventory','period',period,'reply','Your '||coalesce(ctx#>>'{actor,role}','current')||' role is not authorized to access this inventory information.');
      end if;
      select s.name into sup_name from public.inventory_suppliers s where s.id=nullif(item->>'supplier_id','')::uuid;
      reply:=(item->>'name')||' currently has '||to_char(coalesce((item->>'current_stock')::numeric,0),'FM999,999,999,990.###')||' '||coalesce(item->>'unit','')||' recorded in Inventory.'||
        ' Minimum stock: '||to_char(coalesce((item->>'min_stock')::numeric,0),'FM999,999,999,990.###')||' '||coalesce(item->>'unit','')||'.'||
        ' Recorded unit cost: ₱'||to_char(coalesce((item->>'cost_per_unit')::numeric,0),'FM999,999,990.000000')||'.'||
        case when sup_name is not null then ' Supplier: '||sup_name||'.' else '' end||
        case when item->>'expiry_date' is not null then ' Expiry: '||(item->>'expiry_date')||'.' else '' end;
      return jsonb_build_object('handled',true,'intent','inventory','skill','inventory','period',period,'reply',reply,
        'evidence',jsonb_build_object('inventory_item_id',item->>'id','inventory_item',item->>'name','current_stock',item->'current_stock','unit',item->>'unit','minimum_stock',item->'min_stock','data_status','verified_record'));
    end if;
  end if;

  if q ~ '(how many employees|number of employees|employee count|how many staff|staff count|ilang empleyado|ilan ang empleyado|ilan.*staff|bilang ng empleyado)' then
    if not (coalesce(ctx->'skills','[]'::jsonb) ? 'attendance' or coalesce(ctx->'skills','[]'::jsonb) ? 'payroll') then
      return jsonb_build_object('handled',true,'intent','employee_profile','skill','attendance','period',period,'reply','Your '||coalesce(ctx#>>'{actor,role}','current')||' role is not authorized to access employee information.');
    end if;
    select count(*) filter(where coalesce(is_active,true)), count(*) filter(where not coalesce(is_active,true)) into active_count,inactive_count from public.employees;
    reply:='The employee master currently has '||active_count||' active employee(s) and '||inactive_count||' inactive employee record(s), '||(active_count+inactive_count)||' total.';
    return jsonb_build_object('handled',true,'intent','employee_profile','skill','attendance','period',period,'reply',reply,'evidence',jsonb_build_object('active_employees',active_count,'inactive_employees',inactive_count,'total_records',active_count+inactive_count,'source','employees'));
  end if;

  if q ~ '(absent|absence|wala.*pasok|hindi pumasok|di pumasok)' then
    if not coalesce(ctx->'skills','[]'::jsonb) ? 'attendance' then
      return jsonb_build_object('handled',true,'intent','employee_attendance','skill','attendance','period',period,'reply','Your '||coalesce(ctx#>>'{actor,role}','current')||' role is not authorized to access attendance information.');
    end if;
    select count(distinct a.employee_id), string_agg(distinct coalesce(a.employee_name,e.full_name,a.employee_code,'Unknown'),', ')
      into explicit_absent,absent_names from public.attendance_logs a left join public.employees e on e.id=a.employee_id
      where a.attendance_date between d1 and d2 and public.roma_ai_norm(coalesce(a.status,'')) like '%absent%';
    if d1=d2 and d1=(timezone('Asia/Manila',now()))::date then
      select count(distinct ds.employee_id), string_agg(distinct e.full_name,', ')
        into scheduled_no_show,no_show_names from public.daily_schedules ds join public.employees e on e.id=ds.employee_id and coalesce(e.is_active,true)=true
        where ds.schedule_date=d1 and ds.shift_start <= (timezone('Asia/Manila',now()))::time
          and not exists (select 1 from public.attendance_logs a where a.employee_id=ds.employee_id and a.attendance_date=ds.schedule_date and (a.time_in is not null or public.roma_ai_norm(coalesce(a.status,'')) like '%absent%'));
    end if;
    reply:='Attendance for '||d1||case when d2<>d1 then ' to '||d2 else '' end||': '||explicit_absent||' employee(s) have an explicit absent record.'||
      case when d1=d2 and d1=(timezone('Asia/Manila',now()))::date then ' In addition, '||scheduled_no_show||' scheduled employee(s) whose shift already started have no time-in yet.' else '' end||
      case when coalesce(absent_names,'')<>'' then ' Explicit absences: '||absent_names||'.' else '' end||case when coalesce(no_show_names,'')<>'' then ' Scheduled with no time-in yet: '||no_show_names||'.' else '' end||' Unscheduled employees are not counted as absent.';
    return jsonb_build_object('handled',true,'intent','employee_attendance','skill','attendance','period',period,'reply',reply,'evidence',jsonb_build_object('explicit_absent',explicit_absent,'scheduled_no_time_in',scheduled_no_show,'from',d1,'to',d2,'method','explicit absence + started scheduled shift without time-in'));
  end if;

  if coalesce(period->>'source','')='month_day' then u:=public.roma_ai_universal_read_v6(p_message||' '||(period->>'from')); else u:=public.roma_ai_universal_read_v6(p_message); end if;
  return u;
end;
$$;

create or replace function public.roma_ai_service_ask(p_message text, p_thread_id uuid default null::uuid, p_input_mode text default 'text'::text, p_has_screenshot boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
set "TimeZone" to 'Asia/Manila'
as $$
declare
  u jsonb; ctx jsonb; tid uuid:=p_thread_id; t jsonb;
  input_mode text:=case when p_input_mode in ('text','voice','screenshot') then p_input_mode else 'text' end;
  reply text; prev_intent text; canonical text; context_used boolean:=false;
begin
  if trim(coalesce(p_message,''))='' then raise exception 'Message is required.'; end if;
  if coalesce(p_has_screenshot,false) then return public.roma_ai_service_ask_legacy_20260812(p_message,p_thread_id,p_input_mode,p_has_screenshot); end if;
  u:=public.roma_ai_universal_read_v7(p_message);
  if not coalesce((u->>'handled')::boolean,false) and tid is not null then
    select metadata->>'intent' into prev_intent from public.roma_ai_messages where thread_id=tid and sender='assistant' and coalesce(metadata->>'service_mode','') like 'bilingual-semantic%' order by created_at desc limit 1;
    canonical:=case prev_intent
      when 'sales' then 'sales ' when 'expenses' then 'expenses ' when 'employee_attendance' then 'attendance ' when 'employee_profile' then 'employee details '
      when 'payroll' then 'payroll ' when 'cash_advance' then 'cash advance ' when 'final_pay' then 'final pay ' when 'inventory' then 'inventory '
      when 'supplier' then 'supplier ' when 'purchase_orders' then 'purchase order ' when 'wastage' then 'wastage ' when 'production' then 'production '
      when 'costing' then 'costing ' when 'receivables' then 'receivables ' when 'reseller' then 'reseller ' when 'returns' then 'returns '
      when 'crates' then 'crates ' when 'payables' then 'payables ' when 'leave' then 'leave ' when 'schedule' then 'schedule ' when 'pos' then 'pos '
      when 'integrity' then 'business integrity ' when 'business_summary' then 'business summary ' when 'sop' then 'sop ' when 'bank_deposit' then 'bank deposit '
      when 'cash_reconciliation' then 'cash reconciliation ' when 'remittance' then 'remittance ' when 'documents' then 'company documents ' when 'weather' then 'pagasa weather ' else null end;
    if canonical is not null then u:=public.roma_ai_universal_read_v7(canonical||p_message); context_used:=coalesce((u->>'handled')::boolean,false); end if;
  end if;
  if not coalesce((u->>'handled')::boolean,false) then return public.roma_ai_service_ask_legacy_20260812(p_message,p_thread_id,p_input_mode,p_has_screenshot); end if;
  ctx:=public.roma_ai_session_context();
  if tid is null then t:=public.roma_ai_create_thread(left(trim(p_message),120)); tid:=(t->>'id')::uuid; end if;
  perform public.roma_ai_log_message(tid,'user',left(trim(p_message),10000),input_mode,jsonb_build_object('service_mode','bilingual-semantic-v7','intent',u->>'intent','context_inherited',context_used));
  reply:=u->>'reply';
  perform public.roma_ai_log_message(tid,'assistant',reply,'system',jsonb_build_object('service_mode','bilingual-semantic-v7','intent',u->>'intent','period',u->'period','evidence',u->'evidence','context_inherited',context_used));
  return jsonb_build_object('reply',reply,'threadId',tid,'role',ctx#>>'{actor,role}','skills',coalesce(ctx->'skills','[]'::jsonb),'ownerApprovalRequired',true,'developerExecutionEnabled',false,'clientActions','[]'::jsonb,'providerMode','bilingual-semantic-v7','version','2026.08.12.14','intent',u->>'intent','period',u->'period','evidence',u->'evidence','contextInherited',context_used);
end;
$$;

grant execute on function public.roma_ai_parse_business_period_v3(text) to authenticated;
grant execute on function public.roma_ai_universal_read_v7(text) to authenticated;
grant execute on function public.roma_ai_service_ask(text,uuid,text,boolean) to authenticated;
