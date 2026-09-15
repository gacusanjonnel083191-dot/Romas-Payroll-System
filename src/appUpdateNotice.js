const CURRENT_BUILD_ID = __APP_BUILD_ID__
const CHECK_INTERVAL_MS = 5 * 60 * 1000

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;')

const formatReleaseDate = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(date)
}

const showUpdateNotice = (release) => {
  if (document.getElementById('romas-app-update-notice')) return

  const overlay = document.createElement('div')
  overlay.id = 'romas-app-update-notice'
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.setAttribute('aria-labelledby', 'romas-update-title')
  overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.48);display:flex;align-items:center;justify-content:center;padding:20px;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'

  const releasedAt = formatReleaseDate(release.releasedAt)
  overlay.innerHTML = `
    <div style="width:min(460px,100%);max-height:85vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 18px 60px rgba(0,0,0,.28);padding:22px;color:#222">
      <div style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#ca1b1b;margin-bottom:6px">Roma's Donuts</div>
      <h2 id="romas-update-title" style="margin:0 0 10px;font-size:22px;line-height:1.2">New Update Available</h2>
      <div style="font-size:14px;font-weight:700;margin-bottom:6px">What's new</div>
      <div style="font-size:15px;line-height:1.55;background:#f7f7f7;border-radius:12px;padding:12px 14px;white-space:pre-wrap">${escapeHtml(release.summary || 'General improvements and fixes.')}</div>
      ${releasedAt ? `<div style="font-size:12px;color:#777;margin-top:10px">Released ${escapeHtml(releasedAt)}</div>` : ''}
      <div style="font-size:13px;color:#666;margin-top:12px">Refresh the app to apply this update.</div>
      <button id="romas-apply-update" type="button" style="width:100%;margin-top:16px;border:0;border-radius:12px;background:#ca1b1b;color:#fff;font-size:15px;font-weight:800;padding:13px 16px;cursor:pointer">Update Now</button>
    </div>`

  document.body.appendChild(overlay)
  document.getElementById('romas-apply-update')?.addEventListener('click', () => window.location.reload())
}

const checkForUpdate = async () => {
  if (!CURRENT_BUILD_ID || CURRENT_BUILD_ID === 'development') return
  try {
    const response = await fetch(`/app-update.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!response.ok) return
    const release = await response.json()
    if (release?.buildId && release.buildId !== CURRENT_BUILD_ID) showUpdateNotice(release)
  } catch {
    // Update checks must never interrupt normal app use.
  }
}

export const installAppUpdateNotice = () => {
  if (typeof window === 'undefined') return
  window.addEventListener('load', () => {
    checkForUpdate()
    window.setInterval(checkForUpdate, CHECK_INTERVAL_MS)
  }, { once: true })
}
