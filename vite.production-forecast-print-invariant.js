const FORECAST_PRINT_DECLARATION = 'const printForecast'

function findMatchingBrace(source, openIndex) {
  let depth = 0
  let mode = 'code'
  let quote = ''
  let escaped = false

  for (let i = openIndex; i < source.length; i += 1) {
    const ch = source[i]
    const next = source[i + 1]

    if (mode === 'line-comment') {
      if (ch === '\n') mode = 'code'
      continue
    }
    if (mode === 'block-comment') {
      if (ch === '*' && next === '/') {
        mode = 'code'
        i += 1
      }
      continue
    }
    if (mode === 'string') {
      if (escaped) {
        escaped = false
        continue
      }
      if (ch === '\\') {
        escaped = true
        continue
      }
      if (ch === quote) mode = 'code'
      continue
    }
    if (mode === 'template') {
      if (escaped) {
        escaped = false
        continue
      }
      if (ch === '\\') {
        escaped = true
        continue
      }
      if (ch === '`') mode = 'code'
      continue
    }

    if (ch === '/' && next === '/') {
      mode = 'line-comment'
      i += 1
      continue
    }
    if (ch === '/' && next === '*') {
      mode = 'block-comment'
      i += 1
      continue
    }
    if (ch === '"' || ch === "'") {
      mode = 'string'
      quote = ch
      continue
    }
    if (ch === '`') {
      mode = 'template'
      continue
    }
    if (ch === '{') depth += 1
    if (ch === '}') {
      depth -= 1
      if (depth === 0) return i
    }
  }

  return -1
}

function rewriteForecastPrintBlock(block) {
  const hasTotalLabel = /Total Dry Premix to Knead/i.test(block)
  const hasTotalValue = /totalDryPremixKg/.test(block)
  const hasActualColumn = />\s*Actual\s*<\/th>/i.test(block)
  if (!hasTotalLabel || !hasTotalValue || !hasActualColumn) {
    throw new Error('Production Forecast print invariant failed: required total premix or Actual column is missing.')
  }

  const headerPattern = /<th\b[^>]*>\s*Dry Premix\s*<\/th>/gi
  const valueCellPattern = /<td\b[^>]*>\s*'\s*\+\s*kgDisplay\s*\+\s*'\s*<\/td>/gi
  const duplicateTotalCellPattern = /<td\b[^>]*>\s*\$\{totalDryPremixKg\}\s*kg\s*<\/td>/gi

  const headerMatches = block.match(headerPattern) || []
  const valueCellMatches = block.match(valueCellPattern) || []
  const duplicateTotalMatches = block.match(duplicateTotalCellPattern) || []

  if (headerMatches.length > 1 || valueCellMatches.length > 1 || duplicateTotalMatches.length > 1) {
    throw new Error('Production Forecast print invariant failed: multiple premix table columns/cells were found.')
  }

  const next = block
    .replace(headerPattern, '')
    .replace(valueCellPattern, '')
    .replace(duplicateTotalCellPattern, '')

  if (/<th\b[^>]*>\s*Dry Premix\s*<\/th>/i.test(next)) {
    throw new Error('Production Forecast print invariant failed: Dry Premix header still exists in print output.')
  }
  if (/<td\b[^>]*>\s*'\s*\+\s*kgDisplay\s*\+\s*'\s*<\/td>/i.test(next)) {
    throw new Error('Production Forecast print invariant failed: per-variant premix value still exists in print output.')
  }
  if (/<td\b[^>]*>\s*\$\{totalDryPremixKg\}\s*kg\s*<\/td>/i.test(next)) {
    throw new Error('Production Forecast print invariant failed: duplicate total premix cell still exists inside the table.')
  }
  if (!/Total Dry Premix to Knead/i.test(next) || !/totalDryPremixKg/.test(next)) {
    throw new Error('Production Forecast print invariant failed: overall premix total was accidentally removed.')
  }
  if (!/>\s*Actual\s*<\/th>/i.test(next)) {
    throw new Error('Production Forecast print invariant failed: Actual column was accidentally removed.')
  }

  return next
}

export function enforceProductionForecastPrintInvariant(source, id = '') {
  if (!/[\\/]src[\\/]App\.jsx(?:\?.*)?$/.test(id)) return source

  const declarationIndex = source.indexOf(FORECAST_PRINT_DECLARATION)
  if (declarationIndex < 0) {
    throw new Error('Production Forecast print invariant failed: printForecast function was not found.')
  }

  const openIndex = source.indexOf('{', declarationIndex)
  const closeIndex = openIndex >= 0 ? findMatchingBrace(source, openIndex) : -1
  if (openIndex < 0 || closeIndex < 0) {
    throw new Error('Production Forecast print invariant failed: printForecast function boundaries could not be resolved.')
  }

  const block = source.slice(declarationIndex, closeIndex + 1)
  const rewritten = rewriteForecastPrintBlock(block)
  return source.slice(0, declarationIndex) + rewritten + source.slice(closeIndex + 1)
}

export function productionForecastPrintInvariant() {
  return {
    name: 'romas-production-forecast-print-invariant',
    enforce: 'pre',
    transform(code, id) {
      if (!/[\\/]src[\\/]App\.jsx(?:\?.*)?$/.test(id)) return null
      return {
        code: enforceProductionForecastPrintInvariant(code, id),
        map: null,
      }
    },
  }
}
