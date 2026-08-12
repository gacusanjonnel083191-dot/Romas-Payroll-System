-- Roma AI conversation context v1/v2.
-- Persists entities by thread, resolves pronouns/follow-ups, and applies explicit corrections.

create or replace function public.roma_ai_service_ask_context_v1(
  p_message text,
  p_thread_id uuid default null,
  p_input_mode text default 'text',
  p_has_screenshot boolean default false
) returns jsonb
language plpgsql
security definer
set search_path=public,extensions,pg_temp
set "TimeZone"='Asia/Manila'
as $$
declare
  ctx jsonb; tid uuid:=p_thread_id; t jsonb;
  input_mode text:=case when p_input_mode in ('text','voice','screenshot') then p_input_mode else 'text' end;
  q text:=public.roma_ai_norm(p_message);
  raw_lower text:=lower(trim(coalesce(p_message,'')));
  state_row public.roma_ai_conversation_state%rowtype;
  state_entities jsonb:='{}'::jsonb;
  emp jsonb:='{}'::jsonb; inv jsonb:='{}'::jsonb; reseller jsonb:='{}'::jsonb; product jsonb:='{}'::jsonb; supplier jsonb:='{}'::jsonb;
  use_emp jsonb:='{}'::jsonb; use_inv jsonb:='{}'::jsonb; use_reseller jsonb:='{}'::jsonb; use_product jsonb:='{}'::jsonb;
  u0 jsonb; u jsonb; period jsonb; intent0 text; target_intent text; canonical_prefix text; canonical text;
  topic_cue boolean:=false; global_scope boolean:=false; followup boolean:=false; pronoun_ref boolean:=false;
  correction boolean:=false; dissatisfaction boolean:=false; correction_target text; correction_emp jsonb:='{}'::jsonb;
  resolution text:='direct'; reply text; evidence jsonb:='{}'::jsonb;
  new_entities jsonb:='{}'::jsonb;
begin
  if trim(coalesce(p_message,''))='' then raise exception 'Message is required.'; end if;
  ctx:=public.roma_ai_session_context();
  if not coalesce((ctx->>'enabled')::boolean,false) then raise exception 'Roma AI access denied'; end if;
  if tid is null then t:=public.roma_ai_create_thread(left(trim(p_message),120)); tid:=(t->>'id')::uuid;
  elsif not exists(select 1 from public.roma_ai_threads rt where rt.id=tid and (rt.created_by=auth.uid() or public.business_control_has_role(array['owner']))) then raise exception 'Thread access denied'; end if;
  if coalesce(p_has_screenshot,false) then return public.roma_ai_service_ask_legacy_20260812(p_message,tid,input_mode,p_has_screenshot); end if;

  select * into state_row from public.roma_ai_conversation_state where thread_id=tid;
  if found then state_entities:=coalesce(state_row.active_entities,'{}'::jsonb); end if;
  u0:=public.roma_ai_universal_read_v7(p_message);
  intent0:=u0->>'intent'; period:=public.roma_ai_parse_business_period_v3(p_message);
  emp:=public.roma_ai_resolve_entity_v3('employee',p_message);
  inv:=public.roma_ai_resolve_entity_v3('inventory',p_message);
  reseller:=public.roma_ai_resolve_entity_v3('reseller',p_message);
  product:=public.roma_ai_resolve_entity_v3('product',p_message);
  supplier:=public.roma_ai_resolve_supplier_v1(p_message);

  topic_cue:=q ~ '(cash advance|cashadvance|\mca\M|dtr|attendance|absent|absence|late|lateness|undertime|overtime|payroll|salary|sahod|sweldo|final pay|leave|schedule|sales|benta|revenue|expense|expenses|gastos|spend|spent|stock|stocks|inventory|supplier|supply|purchase|wastage|production|produce|costing|recipe|reseller|receivable|utang|return|crate|cover|remittance|payable|bank deposit|cash reconciliation|\mpos\M|integrity|document|contract|weather|pagasa)';
  global_scope:=q ~ '(all employees|all staff|everyone|every employee|lahat ng empleyado|lahat ng staff|company total|overall|buong company|total cash advance|all cash advance)';
  followup:=q ~ '^(how about|what about|and |then |same |si |kay |eh si |paano naman|kumusta naman|what if|yung |ung |ito |iyan |iyon )' or length(q)<=35;
  pronoun_ref:=q ~ '(^| )(niya|nya|noya|kanya|siya|his|her|him|nito|neto)( |$)' or q ~ '(sa kanya|that employee|same employee|same person|that one|same one)';
  dissatisfaction:=q ~ '(you dont understand|you do not understand|not what i mean|wrong answer|that is wrong|mali|hindi mo.*intindi|di mo.*intindi|hindi yan|hindi iyon|hindi yun)';

  if raw_lower like '%i mean %' then correction_target:=substring(raw_lower from position('i mean ' in raw_lower)+7);
  elsif raw_lower like '%ibig kong sabihin%' then correction_target:=substring(raw_lower from position('ibig kong sabihin' in raw_lower)+18);
  elsif raw_lower ~ '^(no|hindi|di|mali|wrong)[, ]' and position(',' in raw_lower)>0 then correction_target:=substring(raw_lower from position(',' in raw_lower)+1);
  elsif raw_lower ~ '[[:space:]]not[[:space:]]' then correction_target:=regexp_replace(raw_lower,'^.*[[:space:]]not[[:space:]]+','','i');
  elsif raw_lower ~ '[[:space:]]hindi[[:space:]]+(si|kay)?[[:space:]]*' then correction_target:=regexp_replace(raw_lower,'^.*[[:space:]]hindi[[:space:]]+(si|kay)?[[:space:]]*','','i');
  elsif raw_lower ~ '[[:space:]]di[[:space:]]+(si|kay)?[[:space:]]*' then correction_target:=regexp_replace(raw_lower,'^.*[[:space:]]di[[:space:]]+(si|kay)?[[:space:]]*','','i'); end if;
  if coalesce(trim(correction_target),'')<>'' then correction_emp:=public.roma_ai_resolve_entity_v3('employee',correction_target); if coalesce(correction_emp->>'id','')<>'' then emp:=correction_emp; correction:=true; end if; end if;

  if topic_cue and intent0 is not null then target_intent:=intent0;
  elsif state_row.active_intent is not null and (followup or pronoun_ref or coalesce(emp->>'id','')<>'' or dissatisfaction or correction) then target_intent:=state_row.active_intent; resolution:='inherited_intent';
  else target_intent:=intent0; end if;
  if target_intent is null and state_row.active_intent is not null and (followup or pronoun_ref or dissatisfaction) then target_intent:=state_row.active_intent; resolution:='inherited_intent'; end if;

  if coalesce(emp->>'id','')<>'' then use_emp:=emp; elsif coalesce(state_entities#>>'{employee,id}','')<>'' then use_emp:=state_entities->'employee'; end if;
  if coalesce(inv->>'id','')<>'' then use_inv:=inv; elsif coalesce(state_entities#>>'{inventory,id}','')<>'' then use_inv:=state_entities->'inventory'; end if;
  if coalesce(reseller->>'id','')<>'' then use_reseller:=reseller; elsif coalesce(state_entities#>>'{reseller,id}','')<>'' then use_reseller:=state_entities->'reseller'; end if;
  if coalesce(product->>'id','')<>'' then use_product:=product; elsif coalesce(state_entities#>>'{product,id}','')<>'' then use_product:=state_entities->'product'; end if;

  canonical_prefix:=public.roma_ai_intent_canonical_v1(target_intent);
  canonical:=trim(coalesce(canonical_prefix,'')||' '||p_message);
  if not global_scope then
    if target_intent in ('employee_profile','employee_attendance','payroll','cash_advance','final_pay','leave','schedule','documents') and coalesce(use_emp->>'id','')<>'' then canonical:=trim(coalesce(canonical_prefix,'')||' '||(use_emp->>'name')||' '||p_message); if coalesce(emp->>'id','')='' then resolution:='inherited_employee'; end if;
    elsif target_intent in ('inventory','supplier','purchase_orders','wastage') and coalesce(use_inv->>'id','')<>'' then canonical:=trim(coalesce(canonical_prefix,'')||' '||(use_inv->>'name')||' '||p_message); if coalesce(inv->>'id','')='' then resolution:='inherited_inventory_item'; end if;
    elsif target_intent in ('receivables','reseller','returns','remittance','crates') and coalesce(use_reseller->>'id','')<>'' then canonical:=trim(coalesce(canonical_prefix,'')||' '||(use_reseller->>'name')||' '||p_message); if coalesce(reseller->>'id','')='' then resolution:='inherited_reseller'; end if;
    elsif target_intent in ('production','costing') and coalesce(use_product->>'id','')<>'' then canonical:=trim(coalesce(canonical_prefix,'')||' '||(use_product->>'name')||' '||p_message); if coalesce(product->>'id','')='' then resolution:='inherited_product'; end if; end if;
  end if;
  if correction then resolution:='correction_applied'; elsif dissatisfaction and state_row.thread_id is not null then resolution:='conversation_repair'; end if;

  if canonical<>trim(p_message) then u:=public.roma_ai_universal_read_v7(canonical); else u:=u0; end if;
  if not coalesce((u->>'handled')::boolean,false) then return public.roma_ai_service_ask_legacy_20260812(p_message,tid,input_mode,p_has_screenshot); end if;
  reply:=u->>'reply'; evidence:=coalesce(u->'evidence','{}'::jsonb);
  if correction and coalesce(use_emp->>'name','')<>'' then reply:='Correction applied — keeping '||(use_emp->>'name')||' as the employee you mean. '||reply;
  elsif dissatisfaction and coalesce(use_emp->>'name','')<>'' and target_intent in ('employee_profile','employee_attendance','payroll','cash_advance','final_pay','leave','schedule','documents') then reply:='You are right to correct me. I am keeping '||(use_emp->>'name')||' as the active employee. '||reply; end if;

  new_entities:=coalesce(state_entities,'{}'::jsonb);
  if coalesce(emp->>'id','')<>'' then new_entities:=jsonb_set(new_entities,'{employee}',emp,true); elsif target_intent in ('employee_profile','employee_attendance','payroll','cash_advance','final_pay','leave','schedule','documents') and coalesce(use_emp->>'id','')<>'' then new_entities:=jsonb_set(new_entities,'{employee}',use_emp,true); end if;
  if coalesce(inv->>'id','')<>'' then new_entities:=jsonb_set(new_entities,'{inventory}',inv,true); elsif target_intent in ('inventory','supplier','purchase_orders','wastage') and coalesce(use_inv->>'id','')<>'' then new_entities:=jsonb_set(new_entities,'{inventory}',use_inv,true); end if;
  if coalesce(reseller->>'id','')<>'' then new_entities:=jsonb_set(new_entities,'{reseller}',reseller,true); elsif target_intent in ('receivables','reseller','returns','remittance','crates') and coalesce(use_reseller->>'id','')<>'' then new_entities:=jsonb_set(new_entities,'{reseller}',use_reseller,true); end if;
  if coalesce(product->>'id','')<>'' then new_entities:=jsonb_set(new_entities,'{product}',product,true); elsif target_intent in ('production','costing') and coalesce(use_product->>'id','')<>'' then new_entities:=jsonb_set(new_entities,'{product}',use_product,true); end if;
  if coalesce(supplier->>'id','')<>'' then new_entities:=jsonb_set(new_entities,'{supplier}',supplier,true); end if;

  perform public.roma_ai_log_message(tid,'user',left(trim(p_message),10000),input_mode,jsonb_build_object('service_mode','conversation-state-v1','intent',u->>'intent','resolution',resolution,'correction',correction));
  perform public.roma_ai_log_message(tid,'assistant',reply,'system',jsonb_build_object('service_mode','conversation-state-v1','intent',u->>'intent','period',u->'period','evidence',evidence,'resolution',resolution,'active_entities',new_entities));
  insert into public.roma_ai_conversation_state(thread_id,user_id,active_intent,active_entities,active_period,last_user_message,last_reply,last_evidence,last_resolution,correction_count,updated_at)
  values(tid,auth.uid(),coalesce(u->>'intent',target_intent),new_entities,coalesce(u->'period',period),left(p_message,10000),left(reply,20000),evidence,resolution,case when correction then 1 else 0 end,now())
  on conflict(thread_id) do update set active_intent=excluded.active_intent,active_entities=excluded.active_entities,active_period=excluded.active_period,last_user_message=excluded.last_user_message,last_reply=excluded.last_reply,last_evidence=excluded.last_evidence,last_resolution=excluded.last_resolution,correction_count=public.roma_ai_conversation_state.correction_count+case when correction then 1 else 0 end,updated_at=now();
  return jsonb_build_object('reply',reply,'threadId',tid,'role',ctx#>>'{actor,role}','skills',coalesce(ctx->'skills','[]'::jsonb),'ownerApprovalRequired',true,'developerExecutionEnabled',false,'clientActions','[]'::jsonb,'providerMode','conversation-state-v1','version','2026.08.12.15-context','intent',coalesce(u->>'intent',target_intent),'period',coalesce(u->'period',period),'evidence',evidence,'contextResolution',resolution,'activeContext',jsonb_build_object('intent',coalesce(u->>'intent',target_intent),'entities',new_entities));
end $$;

create or replace function public.roma_ai_service_ask_context_v2(p_message text,p_thread_id uuid default null,p_input_mode text default 'text',p_has_screenshot boolean default false)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp set "TimeZone"='Asia/Manila' as $$
declare
  tid uuid:=p_thread_id; t jsonb; ctx jsonb:=public.roma_ai_session_context(); raw_lower text:=lower(trim(coalesce(p_message,'')));
  correction_target text; corrected_emp jsonb:='{}'::jsonb; st public.roma_ai_conversation_state%rowtype;
  target_intent text; prefix text; canonical text; u jsonb; reply text; evidence jsonb:='{}'::jsonb; new_entities jsonb:='{}'::jsonb;
  input_mode text:=case when p_input_mode in ('text','voice','screenshot') then p_input_mode else 'text' end;
begin
  if trim(coalesce(p_message,''))='' then raise exception 'Message is required.'; end if;
  if not coalesce((ctx->>'enabled')::boolean,false) then raise exception 'Roma AI access denied'; end if;
  if tid is null then t:=public.roma_ai_create_thread(left(trim(p_message),120)); tid:=(t->>'id')::uuid; end if;
  if coalesce(p_has_screenshot,false) then return public.roma_ai_service_ask_context_v1(p_message,tid,input_mode,p_has_screenshot); end if;
  select * into st from public.roma_ai_conversation_state where thread_id=tid and user_id=auth.uid();

  if raw_lower like '%i mean %' then correction_target:=substring(raw_lower from position('i mean ' in raw_lower)+7);
  elsif raw_lower like '%ibig kong sabihin%' then correction_target:=substring(raw_lower from position('ibig kong sabihin' in raw_lower)+18);
  elsif raw_lower ~ '[[:space:]]not[[:space:]]' then correction_target:=regexp_replace(raw_lower,'^.*[[:space:]]not[[:space:]]+','','i');
  elsif raw_lower ~ '[[:space:]]hindi[[:space:]]+(si|kay)?[[:space:]]*' then correction_target:=regexp_replace(raw_lower,'^.*[[:space:]]hindi[[:space:]]+(si|kay)?[[:space:]]*','','i');
  elsif raw_lower ~ '[[:space:]]di[[:space:]]+(si|kay)?[[:space:]]*' then correction_target:=regexp_replace(raw_lower,'^.*[[:space:]]di[[:space:]]+(si|kay)?[[:space:]]*','','i');
  elsif raw_lower ~ '^(no|mali|wrong)[, ]+' then correction_target:=regexp_replace(raw_lower,'^(no|mali|wrong)[, ]+','','i'); end if;
  if coalesce(trim(correction_target),'')<>'' then corrected_emp:=public.roma_ai_resolve_entity_v3('employee',correction_target); end if;

  if coalesce(corrected_emp->>'id','')<>'' and st.thread_id is not null then
    target_intent:=coalesce(st.active_intent,'employee_profile'); prefix:=public.roma_ai_intent_canonical_v1(target_intent);
    canonical:=trim(coalesce(prefix,'employee details')||' '||(corrected_emp->>'name')); u:=public.roma_ai_universal_read_v7(canonical);
    if coalesce((u->>'handled')::boolean,false) then
      evidence:=coalesce(u->'evidence','{}'::jsonb); reply:='Correction applied — I will keep '||(corrected_emp->>'name')||' as the employee you mean. '||(u->>'reply');
      new_entities:=coalesce(st.active_entities,'{}'::jsonb); new_entities:=jsonb_set(new_entities,'{employee}',corrected_emp,true);
      perform public.roma_ai_log_message(tid,'user',left(trim(p_message),10000),input_mode,jsonb_build_object('service_mode','conversation-state-v2','intent',u->>'intent','resolution','correction_applied','correction_target',corrected_emp->>'name'));
      perform public.roma_ai_log_message(tid,'assistant',reply,'system',jsonb_build_object('service_mode','conversation-state-v2','intent',u->>'intent','period',u->'period','evidence',evidence,'resolution','correction_applied','active_entities',new_entities));
      update public.roma_ai_conversation_state set active_intent=coalesce(u->>'intent',target_intent),active_entities=new_entities,active_period=coalesce(u->'period',active_period),last_user_message=left(p_message,10000),last_reply=left(reply,20000),last_evidence=evidence,last_resolution='correction_applied',correction_count=correction_count+1,updated_at=now() where thread_id=tid;
      return jsonb_build_object('reply',reply,'threadId',tid,'role',ctx#>>'{actor,role}','skills',coalesce(ctx->'skills','[]'::jsonb),'ownerApprovalRequired',true,'developerExecutionEnabled',false,'clientActions','[]'::jsonb,'providerMode','conversation-state-v2','version','2026.08.12.15-context','intent',coalesce(u->>'intent',target_intent),'period',u->'period','evidence',evidence,'contextResolution','correction_applied','activeContext',jsonb_build_object('intent',coalesce(u->>'intent',target_intent),'entities',new_entities));
    end if;
  end if;
  return public.roma_ai_service_ask_context_v1(p_message,tid,input_mode,p_has_screenshot);
end $$;

revoke all on function public.roma_ai_service_ask_context_v1(text,uuid,text,boolean) from public,anon;
revoke all on function public.roma_ai_service_ask_context_v2(text,uuid,text,boolean) from public,anon;
grant execute on function public.roma_ai_service_ask_context_v1(text,uuid,text,boolean) to authenticated;
grant execute on function public.roma_ai_service_ask_context_v2(text,uuid,text,boolean) to authenticated;
