export function formatProductionScreens(pieces, piecesPerScreen = 40) {
  const count = Number(pieces)
  const capacity = Number(piecesPerScreen)
  if (!Number.isSafeInteger(count) || count < 0 || !Number.isSafeInteger(capacity) || capacity <= 0) return '—'
  const screens = Math.floor(count / capacity)
  const excess = count % capacity
  return `${screens.toLocaleString('en-PH')} + ${excess} pcs`
}
