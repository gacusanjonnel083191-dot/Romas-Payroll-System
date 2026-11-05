export function formatProductionScreens(pieces) {
  const count = Number(pieces)
  if (!Number.isSafeInteger(count) || count < 0) return '—'
  const screens = Math.floor(count / 40)
  const excess = count % 40
  return `${screens.toLocaleString('en-PH')} + ${excess} pcs`
}
