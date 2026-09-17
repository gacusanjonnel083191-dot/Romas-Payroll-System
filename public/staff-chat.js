(() => {
  'use strict';
  if (window.__ROMAS_STAFF_CHAT__) return;
  window.__ROMAS_STAFF_CHAT__ = true;

  const POLL_MS = 3000;
  const SESSION_KEY = 'romas_staff_chat_session_token';
  let bridge = null;
  let client = null;
  let state = { bootstrap:null, conversationId:null, messages:[], open:false, poll:null };

  const root = document.createElement('div');
  root.className = 'staff-chat-root';
  root.innerHTML = `
    <button class="staff-chat-fab" type="button" aria-label="Open staff messages">
      <span>💬</span><span class="staff-chat-fab-label">Messages</span><span class="staff-chat-badge" hidden>0</span>
    </button>
    <section class="staff-chat-panel" hidden>
      <header class="staff-chat-header">
        <div><strong>Staff Messages</strong><small>Roma's Donuts internal communication</small></div>
        <button class="staff-chat-close" type="button" aria-label="Close">×</button>
      </header>
      <div class="staff-chat-layout">
        <aside class="staff-chat-sidebar">
          <div class="staff-chat-actions"><button class="staff-chat-new" type="button">+ New message</button><button class="staff-chat-group" type="button">+ Group</button></div>
          <input class="staff-chat-search" type="search" placeholder="Search conversations" />
          <div class="staff-chat-conversations"></div>
        </aside>
        <main class="staff-chat-thread">
          <div class="staff-chat-thread-empty"><div class="staff-chat-empty-icon">💬</div><strong>Select a conversation</strong><span>Message staff without leaving the business app.</span></div>
          <div class="staff-chat-thread-active" hidden>
            <div class="staff-chat-thread-title"></div>
            <div class="staff-chat-messages"></div>
            <form class="staff-chat-compose"><textarea rows="1" maxlength="4000" placeholder="Write a message…"></textarea><button type="submit">Send</button></form>
          </div>
        </main>
      </div>
    </section>
    <div class="staff-chat-modal-backdrop" hidden><div class="staff-chat-modal"><div class="staff-chat-modal-head"><strong></strong><button type="button">×</button></div><div class="staff-chat-modal-body"></div></div></div>`;
  document.body.append(root);

  const q = s => root.querySelector(s);
  const fab=q('.staff-chat-fab'), badge=q('.staff-chat-badge'), panel=q('.staff-chat-panel'), close=q('.staff-chat-close');
  const convos=q('.staff-chat-conversations'), search=q('.staff-chat-search'), threadEmpty=q('.staff-chat-thread-empty');
  const threadActive=q('.staff-chat-thread-active'), threadTitle=q('.staff-chat-thread-title'), messages=q('.staff-chat-messages');
  const compose=q('.staff-chat-compose'), textarea=compose.querySelector('textarea'), newBtn=q('.staff-chat-new'), groupBtn=q('.staff-chat-group');
  const modalBg=q('.staff-chat-modal-backdrop'), modalTitle=q('.staff-chat-modal-head strong'), modalClose=q('.staff-chat-modal-head button'), modalBody=q('.staff-chat-modal-body');

  const make = (tag, cls, text='') => { const n=document.createElement(tag); if(cls)n.className=cls; if(text)n.textContent=text; return n; };
  const initials = name => String(name||'').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase() || '?';
  const fmt = v => { if(!v)return ''; try { return new Intl.DateTimeFormat('en-PH',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(v)); } catch { return ''; } };
  const toast = msg => { try { bridge?.showToast?.(msg); } catch {} };
  const token = () => sessionStorage.getItem(SESSION_KEY) || null;

  async function rpc(name,args={}) {
    if (!client) throw new Error('App connection is unavailable.');
    const payload={...args};
    if (!Object.prototype.hasOwnProperty.call(payload,'p_session_token')) payload.p_session_token=token();
    const {data,error}=await client.rpc(name,payload);
    if(error) throw error;
    return data;
  }

  function isSessionError(err) {
    const m=String(err?.message||err||'').toLowerCase();
    return m.includes('valid staff session required') || m.includes('invalid employee id or pin') || err?.code==='28000';
  }

  function closeModal(){ modalBg.hidden=true; modalBody.replaceChildren(); }

  function showLoginModal() {
    modalTitle.textContent='Verify staff account';
    modalBody.replaceChildren();
    const note=make('p','staff-chat-login-note','Enter the same Employee ID and PIN you use in the employee portal. This verification is kept only for this browser tab.');
    const id=document.createElement('input'); id.className='staff-chat-modal-search'; id.placeholder='Employee ID'; id.autocomplete='username';
    const pin=document.createElement('input'); pin.className='staff-chat-modal-search'; pin.placeholder='PIN'; pin.type='password'; pin.autocomplete='current-password';
    const btn=make('button','staff-chat-create-group','Continue'); btn.type='button';
    btn.addEventListener('click', async()=>{
      if(!id.value.trim()||!pin.value.trim()) return;
      btn.disabled=true;
      try {
        const {data,error}=await client.rpc('employee_portal_login',{p_employee_code:id.value.trim(),p_pin:pin.value.trim()});
        if(error) throw error;
        const t=data?.cash_advance_session_token;
        if(!t) throw new Error('Staff session was not created.');
        sessionStorage.setItem(SESSION_KEY,t);
        closeModal();
        await loadBootstrap(false);
      } catch(err) { toast(err?.message||'Unable to verify staff account.'); }
      finally { btn.disabled=false; }
    });
    modalBody.append(note,id,pin,btn); modalBg.hidden=false; setTimeout(()=>id.focus(),0);
  }

  function updateBadge(){ const n=(state.bootstrap?.conversations||[]).reduce((s,c)=>s+Number(c.unread_count||0),0); badge.hidden=n<=0; badge.textContent=n>99?'99+':String(n); }

  function renderConversations(){
    const term=search.value.trim().toLowerCase(); convos.replaceChildren();
    const rows=(state.bootstrap?.conversations||[]).filter(c=>!term||String(c.title||'').toLowerCase().includes(term)||String(c.last_message||'').toLowerCase().includes(term));
    if(!rows.length){ convos.append(make('div','staff-chat-no-results','No conversations yet.')); return; }
    rows.forEach(c=>{
      const b=make('button','staff-chat-conversation'+(c.id===state.conversationId?' active':'')); b.type='button';
      const av=make('span','staff-chat-avatar',c.conversation_type==='announcement'?'📢':initials(c.title));
      const info=make('span','staff-chat-convo-info'); info.append(make('strong','',c.title||'Conversation'),make('small','',c.last_message||'No messages yet'));
      const meta=make('span','staff-chat-convo-meta'); meta.append(make('time','',fmt(c.last_message_at))); if(Number(c.unread_count)>0) meta.append(make('span','staff-chat-unread',String(c.unread_count)));
      b.append(av,info,meta); b.addEventListener('click',()=>openConversation(c)); convos.append(b);
    });
  }

  function renderMessages(){
    messages.replaceChildren();
    state.messages.forEach(m=>{
      const row=make('div','staff-chat-message-row '+(m.is_mine?'mine':'theirs'));
      const bubble=make('div','staff-chat-message');
      if(!m.is_mine) bubble.append(make('strong','staff-chat-sender',m.sender?.display_name||'Staff'));
      bubble.append(make('div','staff-chat-body',m.body||''),make('small','staff-chat-message-time',fmt(m.created_at)));
      row.append(bubble); messages.append(row);
    });
    requestAnimationFrame(()=>{ messages.scrollTop=messages.scrollHeight; });
  }

  async function loadBootstrap(showErrors=true){
    try {
      state.bootstrap=await rpc('staff_chat_bootstrap') || {contacts:[],conversations:[]};
      renderConversations(); updateBadge();
      const role=String(state.bootstrap?.me?.role||'').toLowerCase();
      groupBtn.hidden=!['owner','manager','admin','supervisor','asst_supervisor','hr','payroll'].includes(role);
      return true;
    } catch(err) {
      if(isSessionError(err)){ sessionStorage.removeItem(SESSION_KEY); if(showErrors) showLoginModal(); return false; }
      if(showErrors) toast('Messages unavailable: '+(err?.message||err));
      return false;
    }
  }

  async function loadMessages(showErrors=false){
    if(!state.conversationId) return;
    try {
      const data=await rpc('staff_chat_list_messages',{p_conversation_id:state.conversationId,p_limit:100});
      state.messages=Array.isArray(data)?data:[]; renderMessages(); await loadBootstrap(false);
    } catch(err) { if(isSessionError(err)) showLoginModal(); else if(showErrors) toast('Could not load messages: '+(err?.message||err)); }
  }

  async function openConversation(c){ state.conversationId=c.id; threadEmpty.hidden=true; threadActive.hidden=false; threadTitle.textContent=c.title||'Conversation'; renderConversations(); await loadMessages(true); if(innerWidth<=720) root.classList.add('staff-chat-mobile-thread'); }

  function openContactModal(){
    modalTitle.textContent='New message'; modalBody.replaceChildren();
    const s=document.createElement('input'); s.className='staff-chat-modal-search'; s.placeholder='Search staff';
    const list=make('div','staff-chat-contact-list');
    const draw=()=>{ list.replaceChildren(); const t=s.value.trim().toLowerCase(); (state.bootstrap?.contacts||[]).filter(c=>!t||String(c.display_name||'').toLowerCase().includes(t)).forEach(c=>{ const b=make('button','staff-chat-contact'); b.type='button'; b.append(make('span','staff-chat-avatar',initials(c.display_name))); const i=make('span','staff-chat-contact-info'); i.append(make('strong','',c.display_name),make('small','',[c.role,c.department].filter(Boolean).join(' • '))); b.append(i); b.addEventListener('click',async()=>{ b.disabled=true; try{ const id=await rpc('staff_chat_start_direct',{p_other_chat_user_id:c.id}); closeModal(); await loadBootstrap(false); const conv=(state.bootstrap?.conversations||[]).find(x=>x.id===id); if(conv) await openConversation(conv);}catch(e){toast(e?.message||'Could not start chat.');}finally{b.disabled=false;} }); list.append(b); }); };
    s.addEventListener('input',draw); draw(); modalBody.append(s,list); modalBg.hidden=false; s.focus();
  }

  function openGroupModal(){
    modalTitle.textContent='Create group'; modalBody.replaceChildren();
    const name=document.createElement('input'); name.className='staff-chat-modal-search'; name.placeholder='Group name';
    const list=make('div','staff-chat-contact-list');
    (state.bootstrap?.contacts||[]).forEach(c=>{ const label=make('label','staff-chat-check'); const cb=document.createElement('input'); cb.type='checkbox'; cb.value=c.id; label.append(cb,document.createTextNode(c.display_name)); list.append(label); });
    const btn=make('button','staff-chat-create-group','Create group'); btn.type='button'; btn.addEventListener('click',async()=>{ const title=name.value.trim(); const ids=[...list.querySelectorAll('input:checked')].map(x=>x.value); if(title.length<2||!ids.length){toast('Enter a group name and select at least one staff member.');return;} btn.disabled=true; try{const id=await rpc('staff_chat_create_group',{p_title:title,p_member_ids:ids}); closeModal(); await loadBootstrap(false); const conv=(state.bootstrap?.conversations||[]).find(x=>x.id===id); if(conv) await openConversation(conv);}catch(e){toast(e?.message||'Could not create group.');}finally{btn.disabled=false;} });
    modalBody.append(name,list,btn); modalBg.hidden=false; name.focus();
  }

  async function openPanel(){ state.open=true; panel.hidden=false; const ok=await loadBootstrap(true); if(ok&&state.conversationId) await loadMessages(false); }
  function closePanel(){ state.open=false; panel.hidden=true; root.classList.remove('staff-chat-mobile-thread'); }

  fab.addEventListener('click',()=>state.open?closePanel():openPanel()); close.addEventListener('click',closePanel); search.addEventListener('input',renderConversations); newBtn.addEventListener('click',openContactModal); groupBtn.addEventListener('click',openGroupModal); modalClose.addEventListener('click',closeModal); modalBg.addEventListener('click',e=>{if(e.target===modalBg)closeModal();});
  compose.addEventListener('submit',async e=>{ e.preventDefault(); const body=textarea.value.trim(); if(!body||!state.conversationId)return; const btn=compose.querySelector('button'); btn.disabled=true; try{await rpc('staff_chat_send_message',{p_conversation_id:state.conversationId,p_body:body}); textarea.value=''; await loadMessages(true);}catch(err){if(isSessionError(err))showLoginModal();else toast('Message not sent: '+(err?.message||err));}finally{btn.disabled=false;textarea.focus();} });

  async function connect(){
    bridge=window.__ROMA_AI_BRIDGE__;
    client=bridge?.supabase;
    if(!client) return false;
    if(!state.poll) state.poll=setInterval(async()=>{ if(document.hidden)return; if(state.open&&state.conversationId) await loadMessages(false); else await loadBootstrap(false); },POLL_MS);
    await loadBootstrap(false);
    return true;
  }
  let attempts=0; const boot=async()=>{ if(await connect()) return; if(++attempts<80) setTimeout(boot,250); else fab.hidden=true; };
  window.addEventListener('roma-ai-context-ready',()=>{ bridge=window.__ROMA_AI_BRIDGE__; client=bridge?.supabase||client; });
  boot();
})();
