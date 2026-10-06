export function scheduleDateAt(start, offset) {
 const date = new Date(`${start}T00:00:00Z`)
 date.setUTCDate(date.getUTCDate() + offset)
 return date.toISOString().slice(0,10)
}
export function scheduleSunday(date) {
 const value = new Date(`${date}T00:00:00Z`)
 return scheduleDateAt(date, -value.getUTCDay())
}
export function staffScheduleDates(start, duration = '1week') {
 const sunday = scheduleSunday(start)
 let days = {'1week':7, '2weeks':14, '3weeks':21}[duration]
 if (duration === '1month') {
  const first = new Date(`${sunday}T00:00:00Z`)
  const end = new Date(first)
  end.setUTCDate(1)
  end.setUTCMonth(end.getUTCMonth()+1)
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()+1,0)).getUTCDate()
  end.setUTCDate(Math.min(first.getUTCDate(),lastDay))
  days = Math.round((end-first)/86400000)
 }
 if (!days) throw new Error('Select a valid schedule duration.')
 return Array.from({length:days},(_,i)=>scheduleDateAt(sunday,i))
}
