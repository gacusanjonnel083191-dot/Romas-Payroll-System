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
export const dayOffMarker = '[schedule:day-off]'
export function isScheduleDayOff(row) {
 return String(row?.notes || '').includes(dayOffMarker)
}
export function scheduleRecords({employeeId, dates, start, end, mode, dayOff = '', previous = []}) {
 if (!['variable','fixed','off'].includes(mode)) throw new Error('Choose a valid schedule type.')
 if (dayOff !== '' && !/^[0-6]$/.test(String(dayOff))) throw new Error('Choose a valid weekly day off.')
 const offDates = dates.map(date => mode === 'off' || (dayOff !== '' && new Date(`${date}T00:00:00Z`).getUTCDay() === Number(dayOff)))
 if (offDates.some(off => !off) && (!start || !end || start === end)) throw new Error('Enter different start and end times. Overnight shifts are allowed.')
 return dates.map((date,index) => {
  const off = offDates[index]
  const notes = String(previous.find(row => row.schedule_date === date)?.notes || '').replaceAll('[schedule:fixed]','').replaceAll(dayOffMarker,'').trim()
  const tag = off ? dayOffMarker : mode === 'fixed' ? '[schedule:fixed]' : ''
  return {employee_id:employeeId, schedule_date:date, shift_start:off ? null : start, shift_end:off ? null : end, notes:[notes,tag].filter(Boolean).join(' ')}
 })
}
export function scheduleRecordMatches(expected, actual) {
 return actual?.employee_id === expected.employee_id && actual?.schedule_date === expected.schedule_date
  && (actual.shift_start == null ? null : String(actual.shift_start).slice(0,5)) === expected.shift_start
  && (actual.shift_end == null ? null : String(actual.shift_end).slice(0,5)) === expected.shift_end
  && String(actual.notes || '') === expected.notes
}
export function shiftLabel(row) {
 if (isScheduleDayOff(row)) return 'Day off'
 if (!row?.shift_start || !row?.shift_end) return 'No schedule assigned'
 const time = value => {const [h,m] = String(value).split(':');return `${Number(h)%12 || 12}:${m} ${Number(h)<12?'AM':'PM'}`}
 return `${time(row.shift_start)} – ${time(row.shift_end)}${row.shift_end < row.shift_start ? ' (next day)' : ''}`
}
