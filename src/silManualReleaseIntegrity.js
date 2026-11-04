// A manual SIL payment is a financial transaction: one authenticated database
// command creates the release ledger, expense and balance/adjustment effects.
// Do not fall back to direct browser inserts if the SQL migration is missing.
export function parseSILCashoutCycle(notes) {
  const m = String(notes || '').match(/([0-9]+) day\(s\) from (\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})/i)
  return m ? { days: Number(m[1]), start: m[2], end: m[3] } : null
}

export async function runManualSILReleaseCommand(client, payload) {
  try {
    const { data: session, error: sessionError } = await client.auth.getSession()
    if (sessionError || !session?.session?.user?.id) {
      throw new Error('Your secure owner session is unavailable. Sign in again before recording SIL payment.')
    }
    const { data, error } = await client.rpc('record_manual_sil_release', payload)
    if (error) throw error
    if (!data || data.ok !== true || !data.release_id || !data.expense_id) {
      throw new Error('The SIL payment command did not return a confirmed ledger and expense.')
    }
    return data
  } catch (error) {
    return {
      ok: false,
      error: (error?.message || 'SIL payment verification failed.') +
        ' No browser fallback was attempted. Refresh the SIL ledger and expenses before retrying.'
    }
  }
}
