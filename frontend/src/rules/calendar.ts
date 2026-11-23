/**
 * Calendar rules: meetings with the features of a Google Calendar event (Google Calendar API v3
 * "Event" resource), worked out inside the app (November 2026):
 *   repeating events (RRULE: daily / weekly on days / monthly / yearly, every N, until a date or
 *   N times), single occurrences changed or cancelled, free/busy for people, finding a free time,
 *   "quick add" from a sentence, .ics files and the "Add to Google Calendar" link.
 *
 * Times are stored in UTC (ISO); each event has an IANA time zone for showing and repeating it.
 * Repeats step in the event's own time zone (Asia/Dhaka has no daylight saving).
 * Pure functions: no screen code, no storage.
 */
import type { CalendarEvent, ID, Recurrence, Weekday } from '../types'

export const WEEKDAYS: Weekday[] = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
export const WEEKDAY_NAME: Record<Weekday, string> = { SU: 'Sunday', MO: 'Monday', TU: 'Tuesday', WE: 'Wednesday', TH: 'Thursday', FR: 'Friday', SA: 'Saturday' }
export const DEFAULT_TZ = 'Asia/Dhaka'

/** Google Calendar's 11 event colours (colorId 1–11). */
export const EVENT_COLORS: Record<string, { name: string; hex: string }> = {
  '1': { name: 'Lavender', hex: '#7986cb' }, '2': { name: 'Sage', hex: '#33b679' }, '3': { name: 'Grape', hex: '#8e24aa' }, '4': { name: 'Flamingo', hex: '#e67c73' },
  '5': { name: 'Banana', hex: '#f6bf26' }, '6': { name: 'Tangerine', hex: '#f4511e' }, '7': { name: 'Peacock', hex: '#039be5' }, '8': { name: 'Graphite', hex: '#616161' },
  '9': { name: 'Blueberry', hex: '#3f51b5' }, '10': { name: 'Basil', hex: '#0b8043' }, '11': { name: 'Tomato', hex: '#d50000' },
}

// ─── Time zones ─────────────────────────────────────────────────────────

/** Minutes the zone is ahead of UTC at that moment. */
export function tzOffset(tz: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(at)
  const v = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const asUtc = Date.UTC(v('year'), v('month') - 1, v('day'), v('hour') % 24, v('minute'), v('second'))
  return Math.round((asUtc - at.getTime()) / 60000)
}

/** A wall-clock date and time in a zone → UTC ISO. */
export function zonedToUtc(date: string, time: string, tz: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  const off = tzOffset(tz, new Date(guess))
  return new Date(guess - off * 60000).toISOString()
}

/** UTC ISO → the wall-clock date (yyyy-mm-dd), time (HH:MM) and weekday in a zone. */
export function utcToZoned(iso: string, tz: string): { date: string; time: string; weekday: Weekday } {
  const at = new Date(iso)
  const local = new Date(at.getTime() + tzOffset(tz, at) * 60000)
  const date = local.toISOString().slice(0, 10)
  return { date, time: local.toISOString().slice(11, 16), weekday: WEEKDAYS[local.getUTCDay()] }
}

const addDays = (date: string, n: number) => new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10) + n)).toISOString().slice(0, 10)
const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)

// ─── Repeating events ───────────────────────────────────────────────────

export interface Instance {
  eventId: ID
  start: string // UTC ISO (all-day: yyyy-mm-dd)
  end: string
  originalStart: string // the series slot this occurrence fills (the key for exceptions)
  recurring: boolean
}

/** Every occurrence of an event that overlaps [from, to). Cancelled slots (exdates) are left out. */
export function expand(ev: Pick<CalendarEvent, 'id' | 'start' | 'end' | 'allDay' | 'timeZone' | 'recurrence' | 'exdates'>, from: string, to: string, max = 500): Instance[] {
  const r = ev.recurrence
  const length = ev.allDay ? dayDiff(ev.start, ev.end) : Date.parse(ev.end) - Date.parse(ev.start)
  const mk = (start: string): Instance => {
    const end = ev.allDay ? addDays(start, length) : new Date(Date.parse(start) + length).toISOString()
    return { eventId: ev.id, start, end, originalStart: start, recurring: !!r }
  }
  const overlaps = (i: Instance) => (ev.allDay ? i.start < to.slice(0, 10) && i.end > from.slice(0, 10) : Date.parse(i.start) < Date.parse(to) && Date.parse(i.end) > Date.parse(from))
  if (!r) return [mk(ev.start)].filter(overlaps)

  const startLocal = ev.allDay ? { date: ev.start, time: '00:00' } : utcToZoned(ev.start, ev.timeZone)
  const at = (date: string) => (ev.allDay ? date : zonedToUtc(date, startLocal.time, ev.timeZone))
  const ex = new Set(ev.exdates ?? [])
  const out: Instance[] = []
  let made = 0
  const interval = Math.max(1, r.interval || 1)
  const until = r.until
  const firstDate = startLocal.date
  const firstDay = new Date(firstDate + 'T00:00:00Z')
  const byDay = r.freq === 'WEEKLY' ? (r.byDay?.length ? r.byDay : [WEEKDAYS[firstDay.getUTCDay()]]) : undefined
  const nthWeek = Math.ceil(firstDay.getUTCDate() / 7)
  const weekdayOfFirst = WEEKDAYS[firstDay.getUTCDay()]

  for (let step = 0; step < 5000 && made < max; step++) {
    let dates: string[] = []
    if (r.freq === 'DAILY') dates = [addDays(firstDate, step * interval)]
    else if (r.freq === 'WEEKLY') {
      const weekStart = addDays(firstDate, -firstDay.getUTCDay() + step * 7 * interval)
      dates = byDay!.map((d) => addDays(weekStart, WEEKDAYS.indexOf(d))).sort()
    } else if (r.freq === 'MONTHLY') {
      const y = firstDay.getUTCFullYear()
      const m = firstDay.getUTCMonth() + step * interval
      if (r.monthlyBy === 'weekday') {
        // e.g. "the 2nd Tuesday of each month"
        const first = new Date(Date.UTC(y, m, 1))
        const shift = (WEEKDAYS.indexOf(weekdayOfFirst) - first.getUTCDay() + 7) % 7
        const day = 1 + shift + (nthWeek - 1) * 7
        const cand = new Date(Date.UTC(y, m, day))
        dates = cand.getUTCMonth() === ((m % 12) + 12) % 12 ? [cand.toISOString().slice(0, 10)] : []
      } else {
        const cand = new Date(Date.UTC(y, m, firstDay.getUTCDate()))
        dates = cand.getUTCDate() === firstDay.getUTCDate() ? [cand.toISOString().slice(0, 10)] : [] // no 31 February
      }
    } else {
      const cand = new Date(Date.UTC(firstDay.getUTCFullYear() + step * interval, firstDay.getUTCMonth(), firstDay.getUTCDate()))
      dates = cand.getUTCMonth() === firstDay.getUTCMonth() ? [cand.toISOString().slice(0, 10)] : []
    }
    let past = false
    for (const d of dates) {
      if (d < firstDate) continue
      if (until && d > until) { past = true; break }
      if (r.count && made >= r.count) { past = true; break }
      made++
      const start = at(d)
      if (ex.has(start)) continue
      const inst = mk(start)
      if (overlaps(inst)) out.push(inst)
      else if (ev.allDay ? inst.start >= to.slice(0, 10) : Date.parse(inst.start) >= Date.parse(to)) { past = true; break }
    }
    if (past) break
  }
  return out
}

/** The RRULE line of a repeat (as Google Calendar and .ics files write it). */
export function toRRule(r: Recurrence): string {
  const parts = [`FREQ=${r.freq}`]
  if ((r.interval ?? 1) > 1) parts.push(`INTERVAL=${r.interval}`)
  if (r.freq === 'WEEKLY' && r.byDay?.length) parts.push(`BYDAY=${r.byDay.join(',')}`)
  if (r.count) parts.push(`COUNT=${r.count}`)
  if (r.until) parts.push(`UNTIL=${r.until.replace(/-/g, '')}T235959Z`)
  return `RRULE:${parts.join(';')}`
}

/** "Weekly on Tuesday and Thursday, 10 times" */
export function describeRecurrence(r: Recurrence | undefined, startIso?: string, tz = DEFAULT_TZ): string {
  if (!r) return 'Does not repeat'
  const n = r.interval && r.interval > 1 ? r.interval : 1
  const unit = { DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month', YEARLY: 'year' }[r.freq]
  let text = n === 1 ? { DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly', YEARLY: 'Yearly' }[r.freq] : `Every ${n} ${unit}s`
  if (r.freq === 'WEEKLY' && r.byDay?.length) text += ` on ${listWords(r.byDay.map((d) => WEEKDAY_NAME[d]))}`
  if (r.freq === 'MONTHLY' && startIso) {
    const z = utcToZoned(startIso, tz)
    const day = Number(z.date.slice(8, 10))
    text += r.monthlyBy === 'weekday' ? ` on the ${['first', 'second', 'third', 'fourth', 'fifth'][Math.ceil(day / 7) - 1]} ${WEEKDAY_NAME[z.weekday]}` : ` on day ${day}`
  }
  if (r.count) text += `, ${r.count} times`
  if (r.until) text += `, until ${r.until}`
  return text
}

const listWords = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)

// ─── Free / busy ────────────────────────────────────────────────────────

export interface BusyBlock {
  userId: ID
  start: string
  end: string
  eventId: ID
  summary: string // shown only where the viewer may see it
}

/** Whether this person is taking part (organiser, or a guest who has not declined). */
export function takesPart(ev: CalendarEvent, userId: ID): boolean {
  if (ev.organizerId === userId) return true
  const a = ev.attendees.find((x) => x.userId === userId)
  return !!a && a.responseStatus !== 'declined'
}

/** Busy times of people (freebusy.query): events they take part in that show them as busy. */
export function freeBusy(events: CalendarEvent[], userIds: ID[], from: string, to: string): BusyBlock[] {
  const out: BusyBlock[] = []
  for (const ev of events) {
    if (ev.status === 'cancelled' || ev.transparency === 'transparent') continue
    for (const inst of expand(ev, from, to)) {
      const start = ev.allDay ? zonedToUtc(inst.start, '00:00', ev.timeZone) : inst.start
      const end = ev.allDay ? zonedToUtc(inst.end, '00:00', ev.timeZone) : inst.end
      for (const uid of userIds) if (takesPart(ev, uid)) out.push({ userId: uid, start, end, eventId: ev.id, summary: ev.summary })
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start))
}

/** The busy blocks that clash with [start, end). */
export function clashes(busy: BusyBlock[], start: string, end: string, ignoreEventId?: ID): BusyBlock[] {
  return busy.filter((b) => b.eventId !== ignoreEventId && Date.parse(b.start) < Date.parse(end) && Date.parse(b.end) > Date.parse(start))
}

/**
 * Free times when everyone can meet ("Find a time"): within working hours (BRAC: Sunday to Thursday,
 * 09:00–17:00 in the zone), on 30-minute steps, from `fromIso` on, at most `max` suggestions.
 */
export function suggestTimes(busy: BusyBlock[], fromIso: string, minutes: number, tz = DEFAULT_TZ, max = 5, days = 14): { start: string; end: string }[] {
  const out: { start: string; end: string }[] = []
  const startDay = utcToZoned(fromIso, tz).date
  for (let d = 0; d < days && out.length < max; d++) {
    const date = addDays(startDay, d)
    const wd = new Date(date + 'T00:00:00Z').getUTCDay()
    if (wd === 5 || wd === 6) continue // Friday and Saturday off
    for (let m = 9 * 60; m + minutes <= 17 * 60 && out.length < max; m += 30) {
      const start = zonedToUtc(date, `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`, tz)
      if (Date.parse(start) < Date.parse(fromIso)) continue
      const end = new Date(Date.parse(start) + minutes * 60000).toISOString()
      if (!clashes(busy, start, end).length) {
        out.push({ start, end })
        m += 60 // spread the suggestions out
      }
    }
  }
  return out
}

// ─── Quick add ──────────────────────────────────────────────────────────

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/**
 * events.quickAdd: a sentence → a meeting. Understands "today", "tomorrow", weekday names,
 * "25 Nov" / "Nov 25", "at 3pm" / "15:30", "for 45 minutes" / "for 2 hours", "every week".
 * Defaults: tomorrow if no day, 10:00 if no time, 1 hour.
 */
export function quickAdd(text: string, nowIso: string, tz = DEFAULT_TZ): { summary: string; start: string; end: string; recurrence?: Recurrence } {
  let t = ` ${text.trim()} `
  const take = (re: RegExp) => {
    const m = t.match(re)
    if (m) t = t.replace(m[0], ' ')
    return m
  }
  const today = utcToZoned(nowIso, tz).date
  let date: string | undefined
  if (take(/\s(today)\b/i)) date = today
  else if (take(/\s(tomorrow)\b/i)) date = addDays(today, 1)
  const md = take(/\s(?:on\s+)?(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i) ?? take(/\s(?:on\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})\b/i)
  if (!date && md) {
    const [day, mon] = /\d/.test(md[1]) ? [Number(md[1]), md[2]] : [Number(md[2]), md[1]]
    let y = Number(today.slice(0, 4))
    let cand = new Date(Date.UTC(y, MONTHS.indexOf(mon.toLowerCase().slice(0, 3)), day)).toISOString().slice(0, 10)
    if (cand < today) cand = new Date(Date.UTC(++y, MONTHS.indexOf(mon.toLowerCase().slice(0, 3)), day)).toISOString().slice(0, 10)
    date = cand
  }
  const wd = take(/\s(?:on\s+|next\s+)?(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/i)
  if (!date && wd) {
    const target = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(wd[1].toLowerCase())
    const cur = new Date(today + 'T00:00:00Z').getUTCDay()
    date = addDays(today, ((target - cur + 7) % 7) || 7)
  }
  let time = '10:00'
  const tm = take(/\s(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i) ?? take(/\s(?:at\s+)?(\d{1,2}):(\d{2})\b/)
  if (tm) {
    let h = Number(tm[1]) % (tm[3] ? 12 : 24)
    if (tm[3]?.toLowerCase() === 'pm') h += 12
    time = `${String(h).padStart(2, '0')}:${tm[2] ?? '00'}`
  }
  let minutes = 60
  const dur = take(/\s(?:for\s+)(\d+(?:\.\d+)?)\s*(minutes?|mins?|hours?|hrs?|h)\b/i)
  if (dur) minutes = Math.round(Number(dur[1]) * (/^h/i.test(dur[2]) ? 60 : 1))
  let recurrence: Recurrence | undefined
  const rep = take(/\s(every\s+(day|week|month|year)|daily|weekly|monthly)\b/i)
  if (rep) {
    const w = (rep[2] ?? rep[1]).toLowerCase()
    recurrence = { freq: w.startsWith('day') || w === 'daily' ? 'DAILY' : w.startsWith('week') ? 'WEEKLY' : w.startsWith('month') ? 'MONTHLY' : 'YEARLY', interval: 1 }
  }
  const start = zonedToUtc(date ?? addDays(today, 1), time, tz)
  const summary = t.replace(/\s+(at|on|for)\s*$/i, '').replace(/\s+/g, ' ').trim() || 'Meeting'
  return { summary: summary.charAt(0).toUpperCase() + summary.slice(1), start, end: new Date(Date.parse(start) + minutes * 60000).toISOString(), recurrence }
}

// ─── Sharing outside the app ────────────────────────────────────────────

const icsTime = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const icsText = (t: string) => t.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => `\\${c}`)

/** An .ics file (iCalendar) with the events, for Outlook, Apple Calendar or Google import. */
export function toIcs(events: (CalendarEvent & { organizerEmail?: string })[]): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BRAC//Project Management prototype//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH']
  for (const ev of events) {
    lines.push('BEGIN:VEVENT', `UID:${ev.id}@brac-pm.prototype`, `DTSTAMP:${icsTime(ev.updatedAt)}`)
    if (ev.allDay) lines.push(`DTSTART;VALUE=DATE:${ev.start.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${ev.end.replace(/-/g, '')}`)
    else lines.push(`DTSTART:${icsTime(ev.start)}`, `DTEND:${icsTime(ev.end)}`)
    if (ev.recurrence) lines.push(toRRule(ev.recurrence).replace('RRULE:', 'RRULE:'))
    for (const x of ev.exdates ?? []) lines.push(ev.allDay ? `EXDATE;VALUE=DATE:${x.replace(/-/g, '')}` : `EXDATE:${icsTime(x)}`)
    lines.push(`SUMMARY:${icsText(ev.summary)}`)
    if (ev.description) lines.push(`DESCRIPTION:${icsText(ev.description)}`)
    if (ev.location) lines.push(`LOCATION:${icsText(ev.location)}`)
    lines.push(`STATUS:${ev.status.toUpperCase()}`, `TRANSP:${ev.transparency === 'transparent' ? 'TRANSPARENT' : 'OPAQUE'}`, `CLASS:${ev.visibility === 'private' || ev.visibility === 'confidential' ? 'PRIVATE' : 'PUBLIC'}`)
    if (ev.organizerEmail) lines.push(`ORGANIZER:mailto:${ev.organizerEmail}`)
    for (const a of ev.attendees) lines.push(`ATTENDEE;CN=${icsText(a.name)};ROLE=${a.optional ? 'OPT-PARTICIPANT' : 'REQ-PARTICIPANT'};PARTSTAT=${{ needsAction: 'NEEDS-ACTION', accepted: 'ACCEPTED', declined: 'DECLINED', tentative: 'TENTATIVE' }[a.responseStatus]}:mailto:${a.email}`)
    for (const rm of ev.reminders.useDefault ? [{ method: 'popup' as const, minutes: 10 }] : ev.reminders.overrides) lines.push('BEGIN:VALARM', `ACTION:${rm.method === 'email' ? 'EMAIL' : 'DISPLAY'}`, `TRIGGER:-PT${rm.minutes}M`, `DESCRIPTION:${icsText(ev.summary)}`, 'END:VALARM')
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

/** The "Add to Google Calendar" link: opens Google Calendar with the event filled in (the person saves it). */
export function googleCalendarUrl(ev: Pick<CalendarEvent, 'summary' | 'description' | 'location' | 'start' | 'end' | 'allDay' | 'timeZone' | 'recurrence' | 'attendees'>): string {
  const q = new URLSearchParams({ action: 'TEMPLATE', text: ev.summary })
  q.set('dates', ev.allDay ? `${ev.start.replace(/-/g, '')}/${ev.end.replace(/-/g, '')}` : `${icsTime(ev.start)}/${icsTime(ev.end)}`)
  if (ev.description) q.set('details', ev.description)
  if (ev.location) q.set('location', ev.location)
  q.set('ctz', ev.timeZone)
  if (ev.recurrence) q.set('recur', toRRule(ev.recurrence))
  const emails = ev.attendees.map((a) => a.email).filter(Boolean)
  if (emails.length) q.set('add', emails.join(','))
  return `https://calendar.google.com/calendar/render?${q.toString()}`
}
