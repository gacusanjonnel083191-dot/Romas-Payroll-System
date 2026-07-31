(function () {
  'use strict'

  const ua = navigator.userAgent || ''
  const isAndroid = /Android/i.test(ua)
  const isEmbeddedAndroidBrowser = isAndroid && (
    /;\s*wv\)/i.test(ua) ||
    /\bwv\b/i.test(ua) ||
    /Version\/4\.0.*Chrome\//i.test(ua) ||
    /WebView/i.test(ua) ||
    /FBAN|FBAV|Instagram|Line\//i.test(ua) ||
    Boolean(window.ReactNativeWebView) ||
    Boolean(window.AndroidInterface)
  )

  if (!isEmbeddedAndroidBrowser) return

  const STYLE_ID = 'romas-passkey-browser-guard-style'
  const MODAL_ID = 'romas-passkey-browser-guard'

  function openInChrome() {
    const currentUrl = window.location.href
    const protocol = window.location.protocol.replace(':', '') || 'https'
    const path = `${window.location.host}${window.location.pathname}${window.location.search}${window.location.hash}`
    const intentUrl = `intent://${path}#Intent;scheme=${protocol};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(currentUrl)};end`

    window.location.href = intentUrl
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return

    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `
      #${MODAL_ID} {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background: rgba(0, 0, 0, 0.58);
        font-family: Arial, sans-serif;
      }
      #${MODAL_ID} .romas-passkey-card {
        width: min(420px, 100%);
        border-radius: 16px;
        background: #fff;
        padding: 22px;
        box-shadow: 0 18px 50px rgba(0, 0, 0, 0.28);
      }
      #${MODAL_ID} h2 {
        margin: 0 0 10px;
        color: #ca1b1b;
        font-size: 20px;
      }
      #${MODAL_ID} p {
        margin: 0 0 12px;
        color: #333;
        font-size: 14px;
        line-height: 1.5;
      }
      #${MODAL_ID} .romas-passkey-note {
        padding: 10px 12px;
        border: 1px solid #f1d56d;
        border-radius: 10px;
        background: #fff8dc;
        font-size: 13px;
      }
      #${MODAL_ID} .romas-passkey-actions {
        display: flex;
        gap: 10px;
        margin-top: 18px;
      }
      #${MODAL_ID} button {
        flex: 1;
        min-height: 44px;
        border: 0;
        border-radius: 10px;
        padding: 10px 12px;
        font-weight: 700;
        cursor: pointer;
      }
      #${MODAL_ID} .romas-open-chrome {
        background: #ca1b1b;
        color: #fff;
      }
      #${MODAL_ID} .romas-close-dialog {
        background: #eee;
        color: #333;
      }
    `
    document.head.appendChild(style)
  }

  function showBrowserRequiredDialog() {
    ensureStyles()
    document.getElementById(MODAL_ID)?.remove()

    const overlay = document.createElement('div')
    overlay.id = MODAL_ID
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-modal', 'true')
    overlay.innerHTML = `
      <div class="romas-passkey-card">
        <h2>Open in Chrome to register fingerprint</h2>
        <p>This installed app window does not provide Android's fingerprint/passkey service, which is why it reports â€œNot implemented.â€</p>
        <p class="romas-passkey-note"><strong>Next step:</strong> Open the system in Chrome, sign in again using the employee ID and PIN, then tap <strong>Fingerprint</strong>.</p>
        <div class="romas-passkey-actions">
          <button type="button" class="romas-close-dialog">Cancel</button>
          <button type="button" class="romas-open-chrome">Open in Chrome</button>
        </div>
      </div>
    `

    overlay.querySelector('.romas-close-dialog').addEventListener('click', () => overlay.remove())
    overlay.querySelector('.romas-open-chrome').addEventListener('click', openInChrome)
    overlay.addEventListener('click', event => {
      if (event.target === overlay) overlay.remove()
    })
    document.body.appendChild(overlay)
  }

  function isFingerprintControl(element) {
    if (!(element instanceof HTMLElement)) return false
    const control = element.closest('button, [role="button"], a')
    if (!control) return false

    const label = String(control.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()

    return label.includes('fingerprint')
  }

  document.addEventListener('click', event => {
    if (!isFingerprintControl(event.target)) return

    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    showBrowserRequiredDialog()
  }, true)

  window.RomasPasskeyCompatibility = Object.freeze({
    embeddedAndroidBrowser: true,
    openInChrome,
    showBrowserRequiredDialog,
  })
})()