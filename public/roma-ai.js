(() => {
  'use strict'
  if (window.__ROMA_AI_LOADED__) return
  window.__ROMA_AI_LOADED__ = true

  const VERSION = '2026.08.12.13-universal'
  const PROVIDER_RETRY_MS = 5 * 60 * 1000
  let providerBlockedUntil = 0

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))
  const norm = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim()

  function getBridge() { return window.__ROMA_AI_BRIDGE__ || null }
  function getContext() { return getBridge()?.getContext?.() || { role:'guest', isOwner:false, userName:'User' } }

  function sanitizeText(text) {
    return String(text || '')
      .replace(/\b\d{12,19}\b/g, '[REDACTED_LONG_NUMBER]')
      .replace(/\b[A-Fa-f0-9]{32,}\b/g, '[REDACTED_TOKEN]')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function currentScreenContext(root) {
    const visible = element => {
      const style = window.getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
    }
    const controls = Array.from(document.querySelectorAll('button,a,[role="button"]'))
      .filter(el => !root.contains(el) && visible(el))
      .map(el => sanitizeText(el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || ''))
      .filter(Boolean)
      .slice(0,80)

    const clone = document.body.cloneNode(true)
    clone.querySelector('#roma-ai-root')?.remove()
    clone.querySelectorAll('script,style,input,textarea,select,option').forEach(el => el.remove())
    const visibleText = sanitizeText(clone.innerText || clone.textContent || '').slice(0,8000)
    const scripts = Array.from(document.scripts).map(s => s.src).filter(Boolean)
    const aiScript = scripts.find(src => src.includes('/roma-ai.js')) || ''
    const deploymentVersion = aiScript.includes('?') ? aiScript.split('?')[1].slice(0,200) : VERSION
    return {
      path: location.pathname + location.search,
      title: document.title,
      deploymentVersion,
      visibleText,
      visibleControls: controls
    }
  }

  async function ensureThread() {
    const bridge = getBridge()
    if (!bridge?.supabase) throw new Error('Roma AI is waiting for the app session. Close and reopen Roma AI once.')
    const { data, error } = await bridge.supabase.rpc('roma_ai_create_thread', { p_title:'Roma AI conversation' })
    if (error) throw error
    return data?.id || null
  }

  async function sessionToken() {
    const bridge = getBridge()
    if (!bridge?.supabase) throw new Error('Roma AI is waiting for the app session. Close and reopen Roma AI once.')
    const { data, error } = await bridge.supabase.auth.getSession()
    if (error) throw error
    const token = data?.session?.access_token || ''
    if (!token) throw new Error('Your login session is not available. Please sign in again.')
    return token
  }

  async function logModelExchange(threadId, message, reply, inputMode, provider, model) {
    const bridge = getBridge()
    if (!bridge?.supabase || !threadId) return
    try {
      await bridge.supabase.rpc('roma_ai_log_message', {
        p_thread_id:threadId,
        p_sender:'user',
        p_content:message.slice(0,10000),
        p_input_mode:inputMode,
        p_metadata:{ service_mode:'llm-orchestrated', provider, model }
      })
      await bridge.supabase.rpc('roma_ai_log_message', {
        p_thread_id:threadId,
        p_sender:'assistant',
        p_content:reply.slice(0,20000),
        p_input_mode:'system',
        p_metadata:{ service_mode:'llm-orchestrated', provider, model }
      })
    } catch { /* logging must never block the assistant */ }
  }

  async function askModel({ message, threadId, history, screenshot, screenContext }) {
    if (Date.now() < providerBlockedUntil) {
      const error = new Error('provider_temporarily_unavailable')
      error.fallback = true
      throw error
    }
    const token = await sessionToken()
    const response = await fetch('/api/roma-ai', {
      method:'POST',
      headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' },
      body:JSON.stringify({ message, threadId, history, screenshot, screenContext })
    })
    let payload = null
    try { payload = await response.json() } catch { payload = {} }
    if (!response.ok || !payload?.ok) {
      if (response.status === 503 || payload?.fallbackAvailable) {
        providerBlockedUntil = Date.now() + PROVIDER_RETRY_MS
        const error = new Error(payload?.message || payload?.error || 'provider_unavailable')
        error.fallback = true
        throw error
      }
      throw new Error(payload?.message || payload?.error || `Roma AI server returned ${response.status}`)
    }
    return payload
  }

  async function askSemantic(message, threadId, inputMode, hasScreenshot) {
    const bridge = getBridge()
    if (!bridge?.supabase) throw new Error('Roma AI is waiting for the app session. Close and reopen Roma AI once.')
    const { data, error } = await bridge.supabase.rpc('roma_ai_service_ask', {
      p_message:message,
      p_thread_id:threadId || null,
      p_input_mode:inputMode,
      p_has_screenshot:Boolean(hasScreenshot)
    })
    if (error) throw error
    return data
  }

  function looksLikeFilipino(text) {
    const q = norm(text)
    return ['ang ','mga ','natin','namin','sino','ilan','magkano','ano ','bakit','paano','kahapon','ngayon','noong','nitong','pumasok','gastos','benta','utang','sahod','sweldo','stock na','supplier ng'].some(token => q.includes(token))
  }

  function speak(text) {
    if (!('speechSynthesis' in window) || !text) return
    try {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(String(text).slice(0,3500))
      utterance.lang = looksLikeFilipino(text) ? 'fil-PH' : 'en-PH'
      utterance.rate = 1
      window.speechSynthesis.speak(utterance)
    } catch { /* voice output is optional */ }
  }

  function mount() {
    if (document.getElementById('roma-ai-root')) return
    const root = document.createElement('div')
    root.id = 'roma-ai-root'
    root.innerHTML = `
      <button class="rai-launch" type="button" aria-label="Open Roma AI" title="Roma AI"><span class="rai-launch-spark" aria-hidden="true">✦</span><span class="rai-launch-label" aria-hidden="true">AI</span></button>
      <section class="rai-panel" role="dialog" aria-label="Roma AI Business Assistant" aria-hidden="true">
        <header class="rai-head"><div class="rai-mark">RA</div><div class="rai-title"><strong>Roma AI</strong><span>Business & System Assistant · ${esc(VERSION)}</span></div><button class="rai-icon-btn rai-close" type="button" aria-label="Close">×</button></header>
        <div class="rai-status"><span class="rai-mode">AI + verified business tools</span><b class="rai-role">Connecting…</b></div>
        <div class="rai-chips"><button class="rai-chip" data-prompt="How much did we spend last month? Give me the breakdown.">Expenses</button><button class="rai-chip" data-prompt="How much did we make yesterday?">Sales</button><button class="rai-chip" data-prompt="Give me the DTR of Jimmy Dela Cruz for the last cutoff.">DTR</button><button class="rai-chip" data-prompt="Ano ang stocks na malapit nang maubos?">Low stock</button><button class="rai-chip" data-prompt="Which reseller owes us the most?">Receivables</button></div>
        <div class="rai-messages" aria-live="polite"></div>
        <div class="rai-attachment"><img alt="Attached screenshot"><span>Screenshot ready</span><button type="button">Remove</button></div>
        <div class="rai-compose"><div class="rai-input-wrap"><button class="rai-action rai-attach" type="button" title="Attach screenshot">＋</button><button class="rai-action rai-mic" type="button" title="Speak">🎙</button><textarea rows="1" placeholder="Ask Roma AI in English, Filipino, or Taglish…"></textarea><button class="rai-action rai-send" type="button" title="Send">➤</button></div><div class="rai-foot">Business reads are role-aware. Every modification requires Owner approval.</div></div>
        <input class="rai-file" type="file" accept="image/*" hidden>
      </section>`
    document.body.appendChild(root)

    const launch = root.querySelector('.rai-launch')
    const panel = root.querySelector('.rai-panel')
    const close = root.querySelector('.rai-close')
    const messages = root.querySelector('.rai-messages')
    const input = root.querySelector('textarea')
    const send = root.querySelector('.rai-send')
    const mic = root.querySelector('.rai-mic')
    const attach = root.querySelector('.rai-attach')
    const file = root.querySelector('.rai-file')
    const attachmentBox = root.querySelector('.rai-attachment')
    const attachmentImg = attachmentBox.querySelector('img')
    const role = root.querySelector('.rai-role')
    const mode = root.querySelector('.rai-mode')

    let attachment = null
    let recognition = null
    let threadId = null
    let chatHistory = []

    function refreshRole() {
      const ctx = getContext()
      role.textContent = ctx.role ? String(ctx.role).replace(/_/g,' ').toUpperCase() : 'GUEST'
    }

    function addMessage(text, type='bot', meta='') {
      const row = document.createElement('div')
      row.className = `rai-row rai-${type}`
      const bubble = document.createElement('div')
      bubble.className = 'rai-bubble'
      bubble.textContent = text
      row.appendChild(bubble)
      if (meta) {
        const m = document.createElement('div')
        m.className = 'rai-meta'
        m.textContent = meta
        bubble.appendChild(m)
      }
      messages.appendChild(row)
      messages.scrollTop = messages.scrollHeight
      return row
    }

    function addTyping() {
      const row = document.createElement('div')
      row.className = 'rai-row rai-bot'
      row.innerHTML = '<div class="rai-bubble"><span class="rai-typing"><i></i><i></i><i></i></span></div>'
      messages.appendChild(row)
      messages.scrollTop = messages.scrollHeight
      return row
    }

    function clearAttachment() {
      attachment = null
      file.value = ''
      attachmentBox.classList.remove('rai-show')
      attachmentImg.removeAttribute('src')
    }

    async function submit(prefill='', inputMode='text') {
      const message = String(prefill || input.value || '').trim()
      if (!message && !attachment) return
      input.value = ''
      input.style.height = 'auto'
      addMessage(message || 'Screenshot attached', 'user')
      const typing = addTyping()
      send.disabled = true

      try {
        if (!threadId) threadId = await ensureThread()
        const screenContext = currentScreenContext(root)
        let result
        try {
          result = await askModel({
            message: message || 'Please explain this screenshot and what it means in the system.',
            threadId,
            history:chatHistory,
            screenshot:attachment?.dataUrl || '',
            screenContext
          })
          mode.textContent = 'Full AI · verified business tools'
          await logModelExchange(threadId, message || 'Screenshot attached', result.reply, inputMode, result.provider, result.model)
        } catch (modelError) {
          if (!modelError?.fallback) throw modelError
          result = await askSemantic(message || 'What is this screen telling me?', threadId, inputMode, Boolean(attachment))
          if (result?.threadId) threadId = result.threadId
          mode.textContent = 'Verified business engine · Full AI waiting for provider activation'
        }

        const reply = String(result?.reply || 'Roma AI did not return an answer.')
        typing.remove()
        addMessage(reply, 'bot', result?.providerMode === 'llm-orchestrated' ? 'Full AI · live authorized tools' : 'Verified live system data')
        chatHistory.push({ role:'user', content:message || 'Screenshot attached' }, { role:'assistant', content:reply })
        chatHistory = chatHistory.slice(-12)
        if (inputMode === 'voice') speak(reply)
        getBridge()?.logAudit?.('ROMA AI QUERY', getContext().userName || getContext().role, 'Roma AI', `${message.slice(0,180)} | ${result?.providerMode || 'semantic'}`).catch?.(()=>{})
      } catch (error) {
        typing.remove()
        addMessage(`I could not complete that query. ${error?.message || error}`, 'bot')
      } finally {
        send.disabled = false
        clearAttachment()
        input.focus()
      }
    }

    function open() {
      panel.classList.add('rai-open')
      panel.setAttribute('aria-hidden','false')
      refreshRole()
      if (!messages.children.length) {
        addMessage(`Hello ${getContext().userName && getContext().userName !== 'Admin' ? getContext().userName : 'Jonnel'}. Ask me naturally in English, Filipino, or Taglish. I can use the live business data your role is authorized to see, and I can keep context across follow-up questions.`)
      }
      setTimeout(() => input.focus(),80)
    }

    function shut() {
      panel.classList.remove('rai-open')
      panel.setAttribute('aria-hidden','true')
      try { window.speechSynthesis?.cancel?.() } catch {}
    }

    launch.addEventListener('click', () => panel.classList.contains('rai-open') ? shut() : open())
    close.addEventListener('click', shut)
    send.addEventListener('click', () => submit())
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit() }
    })
    input.addEventListener('input', () => {
      input.style.height = 'auto'
      input.style.height = `${Math.min(input.scrollHeight,110)}px`
    })
    root.querySelectorAll('.rai-chip').forEach(button => button.addEventListener('click', () => submit(button.dataset.prompt)))

    attach.addEventListener('click', () => file.click())
    file.addEventListener('change', () => {
      const selected = file.files?.[0]
      if (!selected || !selected.type.startsWith('image/')) return
      if (selected.size > 3_500_000) {
        addMessage('That screenshot is too large. Please use a screenshot under about 3.5 MB.', 'bot')
        file.value = ''
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        attachment = { name:selected.name, type:selected.type, dataUrl:String(reader.result) }
        attachmentImg.src = attachment.dataUrl
        attachmentBox.classList.add('rai-show')
      }
      reader.readAsDataURL(selected)
    })
    attachmentBox.querySelector('button').addEventListener('click', clearAttachment)

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      recognition = new SpeechRecognition()
      recognition.lang = 'en-PH'
      recognition.interimResults = false
      recognition.continuous = false
      recognition.onstart = () => mic.classList.add('rai-listening')
      recognition.onend = () => mic.classList.remove('rai-listening')
      recognition.onerror = () => mic.classList.remove('rai-listening')
      recognition.onresult = event => {
        const transcript = event.results?.[0]?.[0]?.transcript || ''
        if (transcript.trim()) submit(transcript, 'voice')
      }
      mic.addEventListener('click', () => { try { recognition.start() } catch {} })
    } else {
      mic.disabled = true
      mic.title = 'Voice recognition is not supported by this browser'
    }

    window.addEventListener('roma-ai-context-ready', refreshRole)
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once:true })
  else mount()
})()
