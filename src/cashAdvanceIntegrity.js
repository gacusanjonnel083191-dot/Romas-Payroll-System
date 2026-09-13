// All financial mutations are one database transaction. Never fall back to
// browser balance updates when the migration, session or network is unavailable.
export async function runCashAdvancePayrollCommand(client, command, start, end) {
  try {
    const { data: session, error: sessionError } = await client.auth.getSession()
    if (sessionError || !session?.session?.user?.id) {
      throw new Error('Your secure admin session is unavailable. Sign in again before processing payroll.')
    }
    const { data, error } = await client.rpc('cash_advance_payroll_command', {
      p_command: command, p_start: start, p_end: end
    })
    if (error) throw error
    if (!data || data.ok !== true) throw new Error('Cash-advance verification did not return a confirmed result.')
    return data
  } catch (error) {
    return { ok: false, applied: false, reversed: false, amount: 0,
      error: `${error?.message || 'Cash-advance verification failed.'} No browser fallback was attempted. Refresh to verify the saved state before retrying.` }
  }
}
