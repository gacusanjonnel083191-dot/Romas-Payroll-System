import { scheduleDateAt } from './staffScheduleDates.js'
export function scheduleRange(from, until, today) {
 const valid = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0,10) === value
 if (!valid(from) || !valid(until)) throw new Error('Choose valid Apply from and Until dates.')
 if (from < today) throw new Error('Apply from must be today or a future date.')
 if (until < from) throw new Error('Until must be on or after Apply from.')
 const count = Math.round((Date.parse(`${until}T00:00:00Z`)-Date.parse(`${from}T00:00:00Z`))/86400000)+1
 if (count > 366) throw new Error('Apply up to one year at a time.')
 return Array.from({length:count},(_,i)=>scheduleDateAt(from,i))
}
export function shiftLabel(row) {
 if (!row?.shift_start || !row?.shift_end) return 'No schedule assigned'
 const time = value => {const [h,m] = String(value).split(':');return `${Number(h)%12 || 12}:${m} ${Number(h)<12?'AM':'PM'}`}
 return `${time(row.shift_start)} – ${time(row.shift_end)}${row.shift_end < row.shift_start ? ' (next day)' : ''}`
}
