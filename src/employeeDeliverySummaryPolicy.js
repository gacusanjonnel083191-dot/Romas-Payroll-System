// Verified active employee records; the RPC independently enforces the same access.
export const DELIVERY_SUMMARY_EMPLOYEE_IDS = Object.freeze([
  '8dad9f5c-3228-416f-8d1c-ddc8c8abfd61',
  '8587695c-fcc0-4875-b52a-95625985d477',
])

export function canViewEmployeeDeliverySummary(employee) {
  return employee?.is_active === true && DELIVERY_SUMMARY_EMPLOYEE_IDS.includes(employee.id)
}

export function tomorrowInManila(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const value = type => Number(parts.find(part => part.type === type).value)
  return new Date(Date.UTC(value('year'), value('month') - 1, value('day') + 1)).toISOString().slice(0, 10)
}
