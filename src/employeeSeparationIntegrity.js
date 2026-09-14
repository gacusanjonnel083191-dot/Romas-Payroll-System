// Employee separation is a financial transaction when a cash advance remains.
// Never fall back to browser writes if the verified database command is unavailable.
export async function runEmployeeSeparationCommand(client, payload) {
  try {
    const { data: session, error: sessionError } = await client.auth.getSession()
    if (sessionError || !session?.session?.user?.id) {
      throw new Error('Your secure owner session is unavailable. Sign in again before processing final pay.')
    }
    const { data, error } = await client.rpc('employee_separation_command', payload)
    if (error) throw error
    if (!data || data.ok !== true) throw new Error('Employee separation did not return a confirmed result.')
    return data
  } catch (error) {
    return {
      ok: false,
      error: `${error?.message || 'Employee separation verification failed.'} No browser fallback was attempted. Refresh to verify the saved state before retrying.`
    }
  }
}
