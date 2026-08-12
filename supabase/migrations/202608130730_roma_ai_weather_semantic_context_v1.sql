create or replace function public.roma_ai_weather_read_v1(p_message text)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public','extensions','pg_temp'
set "TimeZone" to 'Asia/Manila'
as $function$
declare
  q text:=public.roma_ai_norm(p_message);
  ctx jsonb:=public.roma_ai_session_context();
  p jsonb; fetched timestamptz; cache_status text;
  today_date date:=(timezone('Asia/Manila',now()))::date;
  target_date date:=(timezone('Asia/Manila',now()))::date;
  target_day text; day_row jsonb; muni jsonb; matched_muni jsonb;
  nm text; alias_nm text;
  red_names text; yellow_names text; green_names text;
  red_count int:=0; yellow_count int:=0; green_count int:=0;
  age_hours numeric:=0; stale_now boolean:=false;
  asks_weather boolean:=false; asks_color_list boolean:=false;
  reply text; freshness text; forecast_text text:='';
begin
  if q='' or not coalesce((ctx->>'enabled')::boolean,false) then return jsonb_build_object('handled',false); end if;

  asks_weather := q ~ '(weather|pagasa|forecast|ulan|rain|bagyo|habagat|thunderstorm|rainfall|panahon|red|yellow|green)';
  if not asks_weather then
    if not q ~ '^(how about|what about|paano naman|kumusta naman|si |ang |sa |dagupan|calasiao|binmaley|mangaldan|san |santa |santo )' then
      return jsonb_build_object('handled',false);
    end if;
  end if;

  if q ~ '(tomorrow|bukas)' then target_date:=today_date+1;
  elsif q ~ '(yesterday|kahapon)' then target_date:=today_date-1;
  else target_date:=today_date; end if;
  target_day:=trim(to_char(target_date,'Day'));

  select payload,fetched_at,status into p,fetched,cache_status
  from public.pagasa_region1_weather_cache
  order by fetched_at desc nulls last limit 1;

  if p is null then
    return jsonb_build_object('handled',true,'intent','weather','reply','I do not have a PAGASA Region 1 cache record available yet.','evidence',jsonb_build_object('source','pagasa_region1_weather_cache','data_status','no_record'));
  end if;

  age_hours:=round((extract(epoch from (now()-fetched))/3600.0)::numeric,1);
  stale_now:=fetched is null or now()-fetched > interval '6 hours';
  freshness:=case when stale_now then 'The latest PAGASA cache is '||age_hours||' hour(s) old, so municipality warning colors may no longer represent current conditions.' else 'The PAGASA cache was refreshed about '||age_hours||' hour(s) ago.' end;

  for day_row in select value from jsonb_array_elements(coalesce(p#>'{regional,days}','[]'::jsonb)) loop
    if lower(coalesce(day_row->>'day',''))=lower(target_day) then exit; end if;
    day_row:=null;
  end loop;

  for muni in select value from jsonb_array_elements(coalesce(p#>'{pangasinan,municipalities}','[]'::jsonb)) loop
    nm:=public.roma_ai_norm(muni->>'name');
    alias_nm:=regexp_replace(nm,' (city|municipality)$','','i');
    if (length(nm)>=4 and position(nm in q)>0) or (length(alias_nm)>=4 and position(alias_nm in q)>0) then
      matched_muni:=muni; exit;
    end if;
  end loop;

  asks_color_list:=q ~ '(red|yellow|green)' and q ~ '(which|what|town|municip|city|list|summary|group|ano|alin|saan|bayan|lugar)';

  select
    count(*) filter(where lower(value->>'risk_level')='red'),
    count(*) filter(where lower(value->>'risk_level')='yellow'),
    count(*) filter(where lower(value->>'risk_level')='green'),
    string_agg(value->>'name',', ' order by value->>'name') filter(where lower(value->>'risk_level')='red'),
    string_agg(value->>'name',', ' order by value->>'name') filter(where lower(value->>'risk_level')='yellow'),
    string_agg(value->>'name',', ' order by value->>'name') filter(where lower(value->>'risk_level')='green')
  into red_count,yellow_count,green_count,red_names,yellow_names,green_names
  from jsonb_array_elements(coalesce(p#>'{pangasinan,municipalities}','[]'::jsonb));

  if day_row is not null then
    forecast_text:=target_day||' regional forecast: high '||coalesce(day_row->>'max_c','?')||'°C, low '||coalesce(day_row->>'min_c','?')||'°C'||
      case when coalesce(day_row->>'wind_direction','')<>'' then ', wind '||coalesce(day_row->>'wind_direction','')||' ('||coalesce(day_row->>'wind_speed','')||')' else '' end||
      case when coalesce(day_row->>'coastal_condition','')<>'' then ', coastal condition '||coalesce(day_row->>'coastal_condition','') else '' end||'.';
  else
    forecast_text:='The cached PAGASA regional feed does not contain a '||target_day||' forecast row.';
  end if;

  if matched_muni is not null then
    reply:=(matched_muni->>'name')||': '||upper(coalesce(matched_muni->>'risk_level','unknown'))||' — '||coalesce(matched_muni->>'status_label','No status label')||'.'||
      case when coalesce(matched_muni->>'warning_type','')<>'' then ' Warning type: '||(matched_muni->>'warning_type')||'.' else '' end||
      case when target_date>today_date then ' The municipality color comes from the latest cached active advisory; it is not a municipality-specific forecast for tomorrow. '||forecast_text else ' '||forecast_text end||
      ' '||freshness;
    return jsonb_build_object('handled',true,'intent','weather','reply',reply,
      'period',jsonb_build_object('from',target_date,'to',target_date,'source',case when target_date=today_date+1 then 'tomorrow' when target_date=today_date then 'today' else 'relative_day' end),
      'evidence',jsonb_build_object('location',matched_muni->>'name','risk_level',matched_muni->>'risk_level','status_label',matched_muni->>'status_label','warning_type',matched_muni->>'warning_type','basis',matched_muni->>'basis','cache_fetched_at',fetched,'cache_age_hours',age_hours,'stale',stale_now,'source','pagasa_region1_weather_cache'));
  end if;

  if asks_color_list then
    reply:='Pangasinan municipality classification in the latest PAGASA cache:'||E'\n'||
      'RED ('||red_count||'): '||coalesce(red_names,'none')||E'\n'||
      'YELLOW ('||yellow_count||'): '||coalesce(yellow_names,'none')||E'\n'||
      'GREEN ('||green_count||'): '||coalesce(green_names,'none')||E'\n'||freshness||' These are operational classifications derived from the cached PAGASA advisory, not a guarantee of actual local conditions.';
    return jsonb_build_object('handled',true,'intent','weather','reply',reply,
      'period',jsonb_build_object('from',target_date,'to',target_date),
      'evidence',jsonb_build_object('red_count',red_count,'yellow_count',yellow_count,'green_count',green_count,'cache_fetched_at',fetched,'cache_age_hours',age_hours,'stale',stale_now,'source','pagasa_region1_weather_cache'));
  end if;

  reply:=forecast_text||' Current cached Pangasinan operational classifications: red/high-risk '||red_count||', yellow/watch '||yellow_count||', green/routine '||green_count||'. '||freshness||
    case when stale_now then ' For operational decisions, refresh the PAGASA feed before relying on the warning colors.' else '' end;

  return jsonb_build_object('handled',true,'intent','weather','reply',reply,
    'period',jsonb_build_object('from',target_date,'to',target_date,'source',case when target_date=today_date+1 then 'tomorrow' when target_date=today_date then 'today' else 'relative_day' end),
    'evidence',jsonb_build_object('target_day',target_day,'forecast',day_row,'red_count',red_count,'yellow_count',yellow_count,'green_count',green_count,'cache_fetched_at',fetched,'cache_age_hours',age_hours,'stale',stale_now,'source','pagasa_region1_weather_cache'));
end
$function$;

create or replace function public.roma_ai_universal_read_v8(p_message text)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public','extensions','pg_temp'
set "TimeZone" to 'Asia/Manila'
as $function$
declare q text:=public.roma_ai_norm(p_message); w jsonb;
begin
  if q ~ '(weather|pagasa|forecast|ulan|rain|bagyo|habagat|thunderstorm|rainfall|panahon|red|yellow|green)' then
    w:=public.roma_ai_weather_read_v1(p_message);
    if coalesce((w->>'handled')::boolean,false) then return w; end if;
  end if;
  return public.roma_ai_universal_read_v7(p_message);
end
$function$;

create or replace function public.roma_ai_service_ask_context_v4(p_message text,p_thread_id uuid default null,p_input_mode text default 'text',p_has_screenshot boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
set "TimeZone" to 'Asia/Manila'
as $function$
declare
  ctx jsonb:=public.roma_ai_session_context(); tid uuid:=p_thread_id; t jsonb;
  q text:=public.roma_ai_norm(p_message); st public.roma_ai_conversation_state%rowtype;
  input_mode text:=case when p_input_mode in ('text','voice','screenshot') then p_input_mode else 'text' end;
  weather_context boolean:=false; followup boolean:=false; w jsonb; reply text; ev jsonb; per jsonb; entities jsonb:='{}'::jsonb;
begin
  if trim(coalesce(p_message,''))='' then raise exception 'Message is required.'; end if;
  if not coalesce((ctx->>'enabled')::boolean,false) then raise exception 'Roma AI access denied'; end if;
  if tid is null then t:=public.roma_ai_create_thread(left(trim(p_message),120)); tid:=(t->>'id')::uuid; end if;
  if coalesce(p_has_screenshot,false) then return public.roma_ai_service_ask_context_v3(p_message,tid,input_mode,p_has_screenshot); end if;

  select * into st from public.roma_ai_conversation_state where thread_id=tid and user_id=auth.uid();
  followup:=q ~ '^(how about|what about|paano naman|kumusta naman|and |then |same |ang |sa )' or length(q)<=28;
  weather_context:=q ~ '(weather|pagasa|forecast|ulan|rain|bagyo|habagat|thunderstorm|rainfall|panahon|red|yellow|green)' or (st.active_intent='weather' and followup);

  if weather_context then
    w:=public.roma_ai_weather_read_v1(p_message);
    if coalesce((w->>'handled')::boolean,false) then
      reply:=w->>'reply'; ev:=coalesce(w->'evidence','{}'::jsonb); per:=coalesce(w->'period','{}'::jsonb); entities:=coalesce(st.active_entities,'{}'::jsonb);
      if coalesce(ev->>'location','')<>'' then entities:=jsonb_set(entities,'{weather_location}',to_jsonb(ev->>'location'),true); end if;
      perform public.roma_ai_log_message(tid,'user',left(trim(p_message),10000),input_mode,jsonb_build_object('service_mode','weather-context-v1','intent','weather'));
      perform public.roma_ai_log_message(tid,'assistant',reply,'system',jsonb_build_object('service_mode','weather-context-v1','intent','weather','period',per,'evidence',ev));
      insert into public.roma_ai_conversation_state(thread_id,user_id,active_intent,active_entities,active_period,last_user_message,last_reply,last_evidence,last_resolution,updated_at)
      values(tid,auth.uid(),'weather',entities,per,left(p_message,10000),left(reply,20000),ev,case when st.active_intent='weather' and followup then 'weather_followup' else 'direct_weather' end,now())
      on conflict(thread_id) do update set active_intent='weather',active_entities=excluded.active_entities,active_period=excluded.active_period,last_user_message=excluded.last_user_message,last_reply=excluded.last_reply,last_evidence=excluded.last_evidence,last_resolution=excluded.last_resolution,updated_at=now();
      return jsonb_build_object('reply',reply,'threadId',tid,'role',ctx#>>'{actor,role}','skills',coalesce(ctx->'skills','[]'::jsonb),'ownerApprovalRequired',true,'developerExecutionEnabled',false,'clientActions','[]'::jsonb,'providerMode','weather-context-v1','version','2026.08.13.1-weather','intent','weather','period',per,'evidence',ev,'contextResolution',case when st.active_intent='weather' and followup then 'weather_followup' else 'direct_weather' end);
    end if;
  end if;
  return public.roma_ai_service_ask_context_v3(p_message,tid,input_mode,p_has_screenshot);
end
$function$;

create or replace function public.roma_ai_service_ask(p_message text,p_thread_id uuid default null,p_input_mode text default 'text',p_has_screenshot boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
set "TimeZone" to 'Asia/Manila'
as $function$
begin return public.roma_ai_service_ask_context_v4(p_message,p_thread_id,p_input_mode,p_has_screenshot); end
$function$;

grant execute on function public.roma_ai_weather_read_v1(text) to authenticated;
grant execute on function public.roma_ai_universal_read_v8(text) to authenticated;
grant execute on function public.roma_ai_service_ask_context_v4(text,uuid,text,boolean) to authenticated;
revoke all on function public.roma_ai_weather_read_v1(text) from anon;
revoke all on function public.roma_ai_universal_read_v8(text) from anon;
revoke all on function public.roma_ai_service_ask_context_v4(text,uuid,text,boolean) from anon;
