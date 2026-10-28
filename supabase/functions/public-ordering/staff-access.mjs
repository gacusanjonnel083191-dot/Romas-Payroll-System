const READ_ACTIONS = new Set(['staff-list', 'staff-get', 'staff-forecast'])

export function canPerformStaffAction(accessLevel, action) {
  return accessLevel === 'full' || (accessLevel === 'view' && READ_ACTIONS.has(action))
}
