import { useEffect, useMemo, useState } from 'react'
import { calculateResellerLine, calculateResellerTotals } from './resellerCalculator.js'
import './ResellerCalculator.css'

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
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function quantityValue(value) {
  if (value === '') return ''
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return ''
  return String(Math.floor(parsed))
}

export default function ResellerCalculator({ products = [], resellerName = '' }) {
  const [calculationDate, setCalculationDate] = useState(localDateValue)
  const [quantities, setQuantities] = useState({})
  const [installPrompt, setInstallPrompt] = useState(() => window.__romasInstallPrompt || null)
  const [showInstallHelp, setShowInstallHelp] = useState(false)
  const [isInstalled, setIsInstalled] = useState(() => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true)

  useEffect(() => {
    const manifest = document.querySelector('link[rel="manifest"]')
    const previousHref = manifest?.getAttribute('href') || '/manifest.json'
    if (manifest) manifest.setAttribute('href', '/reseller-calculator-manifest.json')
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
      document.documentElement.style.removeProperty('color-scheme')
      window.removeEventListener('romasinstallready', handleInstallReady)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  const rows = useMemo(() => products.map(product => {
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
  }), [products, quantities])
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

  function resetCalculator() {
    setQuantities(Object.fromEntries(products.map(product => [
      String(product.variant_id || product.variant_name),
      { ordered: '', delivered: '', added: '', deducted: '', unsold: '' },
    ])))
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
    <section className="reseller-calculator" aria-labelledby="reseller-calculator-title">
      <div className="calculator-intro">
        <div className="calculator-brand-lockup">
          <img src="/logo.png" alt="Roma's Donuts" />
          <div>
            <p className="calculator-eyebrow">Roma's Donuts</p>
            <h2 id="reseller-calculator-title">Daily Reseller Calculator</h2>
            <p>Enter today&apos;s actual quantities. Your settlement updates automatically.</p>
          </div>
        </div>
        {!isInstalled && (
          <button type="button" className="calculator-install" onClick={installApp}>
            Install app
          </button>
        )}
      </div>

      {showInstallHelp && !installPrompt && (
        <div className="calculator-install-help" role="status">
          Open your browser menu and choose <strong>Install app</strong> or <strong>Add to Home Screen</strong>.
        </div>
      )}

      <div className="calculator-safety-note">
        <strong>Calculator only.</strong> Nothing entered here changes official invoices, inventory, receivables, returns, or production records.
      </div>

      <div className="calculator-meta">
        <label>
          <span>Date</span>
          <input type="date" value={calculationDate} onChange={event => setCalculationDate(event.target.value)} />
        </label>
        <div>
          <span>Outlet / reseller</span>
          <strong>{resellerName || 'Roma’s Donuts Reseller'}</strong>
        </div>
      </div>

      <div className="calculator-formula">
        <strong>How it works:</strong> Sold = Actual delivered + Added − Deducted − Unsold
      </div>

      <div className="calculator-products" aria-live="polite">
        {calculatedRows.length === 0 ? (
          <div className="calculator-empty">Loading current products and reseller prices…</div>
        ) : calculatedRows.map(row => (
          <article className={`calculator-product${row.result.hasDeductionError || row.result.hasUnsoldError ? ' has-error' : ''}`} key={row.key}>
            <header>
              <div>
                <span className="calculator-category">{row.category}</span>
                <h3>{row.name}</h3>
              </div>
              <div className="calculator-price">
                <span>Reseller price</span>
                <strong>{currency(row.resellerPrice)}</strong>
              </div>
            </header>

            <div className="calculator-inputs">
              {quantityFields.map(([field, label]) => (
                <label key={field}>
                  <span>{label}</span>
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
                </label>
              ))}
            </div>

            {(row.result.hasDeductionError || row.result.hasUnsoldError) && (
              <p className="calculator-error" role="alert">
                {row.result.hasDeductionError
                  ? 'Deducted cannot be more than delivered plus added.'
                  : 'Unsold cannot be more than the accountable quantity.'}
              </p>
            )}

            <footer>
              <div><span>Sold</span><strong>{row.result.sold} pcs</strong></div>
              <div><span>Amount due</span><strong>{currency(row.result.amountDue)}</strong></div>
            </footer>
          </article>
        ))}
      </div>

      <div className="calculator-summary">
        <div className="calculator-summary-title">
          <div>
            <span>Total payable to Roma&apos;s</span>
            <strong>{currency(totals.amountDue)}</strong>
          </div>
          <button type="button" onClick={resetCalculator}>Reset</button>
        </div>
        <div className="calculator-summary-grid">
          <div><span>Ordered</span><strong>{totals.ordered}</strong></div>
          <div><span>Delivered</span><strong>{totals.delivered}</strong></div>
          <div><span>Added</span><strong>{totals.added}</strong></div>
          <div><span>Deducted</span><strong>{totals.deducted}</strong></div>
          <div><span>Unsold</span><strong>{totals.unsold}</strong></div>
          <div className="is-highlight"><span>Sold</span><strong>{totals.sold}</strong></div>
        </div>
        <div className="calculator-profit">
          <span>Estimated reseller profit</span>
          <strong>{currency(totals.estimatedProfit)}</strong>
        </div>
        {totals.hasErrors && <p className="calculator-summary-warning">Please correct the highlighted product before using this total.</p>}
      </div>
    </section>
  )
}
