import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from '../types'
import { describeRecurrence, expand, freeBusy, googleCalendarUrl, quickAdd, suggestTimes, toIcs, toRRule, utcToZoned, zonedToUtc } from './calendar'

const TZ = 'Asia/Dhaka'
const ev = (over: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 'e1', calendarId: 'project:p1', eventType: 'default', summary: 'Weekly review', allDay: false,
  start: zonedToUtc('2026-11-24', '10:00', TZ), end: zonedToUtc('2026-11-24', '11:00', TZ), timeZone: TZ,
  organizerId: 'pm', attendees: [{ userId: 'sh', email: 'sh@x', name: 'Rokeya', responseStatus: 'accepted' }],
  guestsCanModify: false, guestsCanInviteOthers: true, guestsCanSeeOtherGuests: true,
  reminders: { useDefault: true, overrides: [] }, transparency: 'opaque', visibility: 'default', status: 'confirmed',
  attachments: [], sequence: 0, createdAt: '2026-11-20T00:00:00Z', updatedAt: '2026-11-20T00:00:00Z', createdBy: 'pm', ...over,
})

describe('time zones', () => {
  it('turns Dhaka wall time into UTC and back', () => {
    expect(zonedToUtc('2026-11-24', '10:00', TZ)).toBe('2026-11-24T04:00:00.000Z')
    expect(utcToZoned('2026-11-24T04:00:00.000Z', TZ)).toEqual({ date: '2026-11-24', time: '10:00', weekday: 'TU' })
  })
})

describe('repeating events', () => {
  it('repeats weekly on chosen days, a set number of times, skipping removed occurrences', () => {
    const e = ev({ recurrence: { freq: 'WEEKLY', interval: 1, byDay: ['TU', 'TH'], count: 4 }, exdates: [zonedToUtc('2026-11-26', '10:00', TZ)] })
    const days = expand(e, '2026-11-01T00:00:00Z', '2027-01-01T00:00:00Z').map((i) => utcToZoned(i.start, TZ).date)
    expect(days).toEqual(['2026-11-24', '2026-12-01', '2026-12-03']) // 4 slots, the 26th removed
  })

  it('repeats monthly on the same weekday ("the 4th Tuesday") until a date', () => {
    const e = ev({ recurrence: { freq: 'MONTHLY', interval: 1, monthlyBy: 'weekday', until: '2027-01-31' } })
    expect(expand(e, '2026-11-01T00:00:00Z', '2027-06-01T00:00:00Z').map((i) => utcToZoned(i.start, TZ).date)).toEqual(['2026-11-24', '2026-12-22', '2027-01-26'])
  })

  it('writes the RRULE and describes it in words', () => {
    const r = { freq: 'WEEKLY' as const, interval: 2, byDay: ['SU' as const, 'WE' as const], count: 6 }
    expect(toRRule(r)).toBe('RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=SU,WE;COUNT=6')
    expect(describeRecurrence(r)).toBe('Every 2 weeks on Sunday and Wednesday, 6 times')
  })
})

describe('free / busy and finding a time', () => {
  it('counts only people taking part, not declined guests or "free" events', () => {
    const declined = ev({ id: 'e2', attendees: [{ userId: 'sh', email: '', name: '', responseStatus: 'declined' }] })
    const free = ev({ id: 'e3', transparency: 'transparent' })
    const busy = freeBusy([ev(), declined, free], ['sh'], '2026-11-24T00:00:00Z', '2026-11-25T00:00:00Z')
    expect(busy.map((b) => b.eventId)).toEqual(['e1'])
  })

  it('suggests working-hour times when everyone is free (Sunday–Thursday, 9 to 5)', () => {
    const busy = freeBusy([ev()], ['sh'], '2026-11-24T00:00:00Z', '2026-11-25T00:00:00Z')
    const first = suggestTimes(busy, zonedToUtc('2026-11-24', '09:30', TZ), 60, TZ, 3)
    expect(first.map((x) => utcToZoned(x.start, TZ).time)).toEqual(['11:00', '12:30', '14:00'])
  })
})

describe('quick add', () => {
  const now = zonedToUtc('2026-11-23', '12:00', TZ) // a Monday
  it('reads a day, a time, a length and a repeat from a sentence', () => {
    const q = quickAdd('Sprint review Wednesday at 3pm for 90 minutes every week', now, TZ)
    expect(q.summary).toBe('Sprint review')
    expect(utcToZoned(q.start, TZ)).toMatchObject({ date: '2026-11-25', time: '15:00' })
    expect((Date.parse(q.end) - Date.parse(q.start)) / 60000).toBe(90)
    expect(q.recurrence?.freq).toBe('WEEKLY')
  })
  it('defaults to tomorrow at 10:00 for an hour', () => {
    const q = quickAdd('Budget call', now, TZ)
    expect(utcToZoned(q.start, TZ)).toMatchObject({ date: '2026-11-24', time: '10:00' })
  })
})

describe('sharing', () => {
  it('writes an .ics file and a Google Calendar link', () => {
    const e = ev({ recurrence: { freq: 'DAILY', interval: 1, count: 3 } })
    const ics = toIcs([e])
    expect(ics).toContain('DTSTART:20261124T040000Z')
    expect(ics).toContain('RRULE:FREQ=DAILY;COUNT=3')
    expect(ics).toContain('PARTSTAT=ACCEPTED')
    const url = new URL(googleCalendarUrl(e))
    expect(url.searchParams.get('dates')).toBe('20261124T040000Z/20261124T050000Z')
    expect(url.searchParams.get('recur')).toBe('RRULE:FREQ=DAILY;COUNT=3')
  })
})
