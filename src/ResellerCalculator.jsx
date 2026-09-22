import { useEffect, useMemo, useRef, useState } from 'react'
import { buildResetQuantities, calculateResellerLine, calculateResellerTotals } from './resellerCalculator.js'
import './ResellerCalculator.css'

const DRAFT_STORAGE_PREFIX = 'romas-reseller-calculator-draft-v3:'
const PRODUCT_CACHE_KEY = 'romas-reseller-calculator-products-v2'

const quantityFields = [
  ['ordered', 'Ordered'],
  ['delivered', 'Actual delivered'],
  ['added', 'Added'],
  ['deducted', 'Deducted'],
  ['unsold', 'Unsold'],
]

function currency(value) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(Number(value) || 0)
}

function localDateValue() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function quantityValue(value) {
  if (value === '') return ''
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return ''
  return String(Math.floor(parsed))
}

function draftStorageKey(resellerName = '') {
  const normalized = String(resellerName || 'default')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'default'
  return `${DRAFT_STORAGE_PREFIX}${normalized}`
}

function readJsonStorage(key, fallback) {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJsonStorage(key, value) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Keep the calculator usable even when storage is blocked.
  }
}

function readDraft(resellerName) {
  const draft = readJsonStorage(draftStorageKey(resellerName), null)
  return draft && typeof draft === 'object' ? draft : null
}

function readProductCache() {
  const cache = readJsonStorage(PRODUCT_CACHE_KEY, null)
  return Array.isArray(cache?.products) ? cache.products : []
}

export default function ResellerCalculator({
  products = [],
  resellerName = '',
  resellerArea = '',
  branches = [],
  selectedBranchId = '',
  onBranchChange,
  onRefresh,
  refreshing = false,
  onLogout,
  onBackToPortal,
}) {
  const currentDraftKey = draftStorageKey(resellerName)
  const [initialDraft] = useState(() => readDraft(resellerName))
  const [calculationDate, setCalculationDate] = useState(() => initialDraft?.calculationDate || localDateValue())
  const [quantities, setQuantities] = useState(() => initialDraft?.quantities || {})
  const [cachedProducts, setCachedProducts] = useState(readProductCache)
  const [installPrompt, setInstallPrompt] = useState(() => typeof window !== 'undefined' ? window.__romasInstallPrompt || null : null)
  const [showInstallHelp, setShowInstallHelp] = useState(false)
  const [isInstalled, setIsInstalled] = useState(() => typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true))
  const previousDraftKey = useRef(currentDraftKey)
  const skipNextPersist = useRef(false)

  useEffect(() => {
    const manifest = document.querySelector('link[rel="manifest"]')
    const previousHref = manifest?.getAttribute('href') || '/manifest.json'
    const hadCalculatorClass = document.documentElement.classList.contains('reseller-calculator-app')
    if (manifest) manifest.setAttribute('href', '/reseller-calculator-manifest.json')
    document.documentElement.classList.add('reseller-calculator-app')
    document.documentElement.style.colorScheme = 'light'

    const handleInstallReady = () => setInstallPrompt(window.__romasInstallPrompt || null)
    const handleInstalled = () => {
      setIsInstalled(true)
      setInstallPrompt(null)
      window.__romasInstallPrompt = null
    }

    window.addEventListener('romasinstallready', handleInstallReady)
    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      if (manifest) manifest.setAttribute('href', previousHref)
      if (!hadCalculatorClass) document.documentElement.classList.remove('reseller-calculator-app')
      document.documentElement.style.removeProperty('color-scheme')
      window.removeEventListener('romasinstallready', handleInstallReady)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  useEffect(() => {
    if (!products.length) return
    setCachedProducts(products)
    writeJsonStorage(PRODUCT_CACHE_KEY, {
      savedAt: new Date().toISOString(),
      products,
    })
  }, [products])

  useEffect(() => {
    if (previousDraftKey.current === currentDraftKey) return
    const draft = readDraft(resellerName)
    skipNextPersist.current = true
    setCalculationDate(draft?.calculationDate || localDateValue())
    setQuantities(draft?.quantities || {})
    previousDraftKey.current = currentDraftKey
  }, [currentDraftKey, resellerName])

  useEffect(() => {
    if (skipNextPersist.current) {
      skipNextPersist.current = false
      return
    }
    writeJsonStorage(currentDraftKey, {
      calculationDate,
      quantities,
      savedAt: new Date().toISOString(),
    })
  }, [calculationDate, currentDraftKey, quantities])

  const effectiveProducts = products.length ? products : cachedProducts
  const usingCachedProducts = products.length === 0 && cachedProducts.length > 0

  const rows = useMemo(() => effectiveProducts.map(product => {
    const key = String(product.variant_id || product.variant_name)
    const saved = quantities[key] || {}
    return {
      key,
      name: product.variant_name || 'Product',
      category: product.category || 'Donuts',
      resellerPrice: Number(product.reseller_price) || 0,
      retailPrice: Number(product.retail_price) || Number(product.reseller_price) || 0,
      ordered: saved.ordered ?? quantityValue(product.quantity || ''),
      delivered: saved.delivered ?? '',
      added: saved.added ?? '',
      deducted: saved.deducted ?? '',
      unsold: saved.unsold ?? '',
    }
  }), [effectiveProducts, quantities])

  const calculatedRows = useMemo(
    () => rows.map(row => ({ ...row, result: calculateResellerLine(row) })),
    [rows],
  )
  const totals = useMemo(() => calculateResellerTotals(rows), [rows])

  function updateQuantity(key, field, value) {
    setQuantities(current => ({
      ...current,
      [key]: { ...current[key], [field]: quantityValue(value) },
    }))
  }

  function useOrderedAsDelivered() {
    setQuantities(current => Object.fromEntries(rows.map(row => [
      row.key,
      {
        ...current[row.key],
        ordered: row.ordered,
        delivered: quantityValue(row.ordered),
        added: current[row.key]?.added ?? row.added,
        deducted: current[row.key]?.deducted ?? row.deducted,
        unsold: current[row.key]?.unsold ?? row.unsold,
      },
    ])))
  }

  function resetCalculator() {
    setQuantities(buildResetQuantities(rows))
    setCalculationDate(localDateValue())
  }

  async function installApp() {
    const prompt = installPrompt || window.__romasInstallPrompt
    if (!prompt) {
      setShowInstallHelp(value => !value)
      return
    }
    await prompt.prompt()
    await prompt.userChoice
    setInstallPrompt(null)
    window.__romasInstallPrompt = null
  }

  return (
    <main className="reseller-calculator" aria-labelledby="reseller-calculator-title">
      <header className="calculator-header">
        <div className="calculator-brand">
          <img src="/logo.png" alt="Roma's Donuts" />
          <div>
            <p className="calculator-eyebrow">Roma's Donuts</p>
            <h1 id="reseller-calculator-title">Reseller Calculator</h1>
            <p className="calculator-subtitle">Daily delivery, sales and settlement</p>
          </div>
        </div>

        <div className="calculator-header-total">
          <span>Total payable to Roma's</span>
          <strong>{currency(totals.amountDue)}</strong>
        </div>
      </header>

      <section className="calculator-toolbar" aria-label="Calculator controls">
        <div className="calculator-outlet">
          <span>Outlet / reseller</span>
          {branches.length > 1 ? (
            <select value={selectedBranchId} onChange={event => onBranchChange?.(event.target.value)}>
              {branches.map(branch => (
                <option key={branch.id} value={branch.id}>{branch.name}{branch.area ? ` — ${branch.area}` : ''}</option>
              ))}
            </select>
          ) : (
            <strong>{resellerName || 'Roma’s Donuts Reseller'}{resellerArea ? ` — ${resellerArea}` : ''}</strong>
          )}
        </div>

        <label className="calculator-date">
          <span>Date</span>
          <input type="date" value={calculationDate} onChange={event => setCalculationDate(event.target.value)} />
        </label>

        <div className="calculator-toolbar-actions">
          <button type="button" className="calculator-action secondary" onClick={useOrderedAsDelivered} disabled={rows.length === 0}>Use ordered as delivered</button>
          <button type="button" className="calculator-action secondary" onClick={onRefresh} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>
          {!isInstalled && <button type="button" className="calculator-action install" onClick={installApp}>Install app</button>}
          <button type="button" className="calculator-action secondary" onClick={resetCalculator}>Reset actuals</button>
          {onBackToPortal && <button type="button" className="calculator-action secondary" onClick={onBackToPortal}>Back to portal</button>}
          <button type="button" className="calculator-action logout" onClick={onLogout}>Logout</button>
        </div>
      </section>

      {showInstallHelp && !installPrompt && (
        <div className="calculator-notice" role="status">
          Open your browser menu and choose <strong>Install app</strong> or <strong>Add to Home Screen</strong>.
        </div>
      )}

      {usingCachedProducts && (
        <div className="calculator-notice warning" role="status">
          Showing the last saved product and price list from this device. Reconnect before final settlement to confirm current pricing.
        </div>
      )}

      <div className="calculator-info-strip">
        <span><strong>Accountable</strong> = Delivered + Added − Deducted</span>
        <span><strong>Sold</strong> = Accountable − Unsold</span>
        <span><strong>Amount due</strong> = Sold × Reseller Price</span>
        <span className="calculator-local-save">Draft saves automatically on this device.</span>
      </div>

      <section className="calculator-table-panel">
        {calculatedRows.length === 0 ? (
          <div className="calculator-empty">Loading current products and reseller prices…</div>
        ) : (
          <div className="calculator-table-scroll">
            <table className="calculator-table">
              <thead>
                <tr>
                  <th className="product-column">Product</th>
                  <th>Retail</th>
                  <th>Reseller</th>
                  {quantityFields.map(([, label]) => <th key={label}>{label}</th>)}
                  <th>Accountable</th>
                  <th>Sold</th>
                  <th>Amount due</th>
                </tr>
              </thead>
              <tbody>
                {calculatedRows.map(row => {
                  const hasError = row.result.hasDeductionError || row.result.hasUnsoldError
                  return (
                    <tr key={row.key} className={hasError ? 'has-error' : ''}>
                      <td className="product-column">
                        <span className="calculator-category">{row.category}</span>
                        <strong>{row.name}</strong>
                        {hasError && (
                          <small className="calculator-row-error">
                            {row.result.hasDeductionError
                              ? 'Deducted exceeds delivered + added.'
                              : 'Unsold exceeds accountable quantity.'}
                          </small>
                        )}
                      </td>
                      <td className="money-cell">{currency(row.retailPrice)}</td>
                      <td className="money-cell reseller-price-cell">{currency(row.resellerPrice)}</td>
                      {quantityFields.map(([field, label]) => (
                        <td key={field} className="input-cell">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            inputMode="numeric"
                            placeholder="0"
                            value={row[field]}
                            onChange={event => updateQuantity(row.key, field, event.target.value)}
                            aria-label={`${row.name} ${label}`}
                          />
                        </td>
                      ))}
                      <td className="result-cell">{row.result.accountable}</td>
                      <td className="result-cell sold-cell">{row.result.sold}</td>
                      <td className="amount-cell">{currency(row.result.amountDue)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="calculator-summary" aria-label="Daily settlement summary">
        <div className="calculator-summary-primary">
          <span>Total payable to Roma's</span>
          <strong>{currency(totals.amountDue)}</strong>
        </div>

        <div className="calculator-summary-metrics">
          <div><span>Ordered</span><strong>{totals.ordered}</strong></div>
          <div><span>Delivered</span><strong>{totals.delivered}</strong></div>
          <div><span>Added</span><strong>{totals.added}</strong></div>
          <div><span>Deducted</span><strong>{totals.deducted}</strong></div>
          <div><span>Accountable</span><strong>{totals.accountable}</strong></div>
          <div><span>Unsold</span><strong>{totals.unsold}</strong></div>
          <div><span>Sold</span><strong>{totals.sold}</strong></div>
          <div><span>Est. reseller profit</span><strong className="profit-value">{currency(totals.estimatedProfit)}</strong></div>
        </div>

        <p className="calculator-record-note">
          Calculator only — entries here do not change official invoices, inventory, receivables, returns, production forecast, or payroll.
        </p>
        {totals.hasErrors && <p className="calculator-summary-warning">Correct the highlighted product quantities before using this settlement total.</p>}
      </section>
    </main>
  )
}
