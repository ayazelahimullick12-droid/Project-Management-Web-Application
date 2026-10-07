/**
 * Working hours and reminder timing.
 *
 * Spec: SPEC.md "Notifications, dashboard and archive" — anything waiting on a person is
 * re-sent every 4 working hours; working hours are Sunday to Thursday, 9:00–17:00
 * Bangladesh time, set by the Admin. No reminders outside working hours.
 *
 * Decision (DECISIONS.md): "4 working hours" counts only time inside working hours.
 * Example: a request on Thursday 15:00 → 2 hours on Thursday + 2 hours on Sunday → Sunday 11:00.
 *
 * Bangladesh time is UTC+6 all year (no daylight saving), so a fixed offset is enough.
 */
import type { Settings } from '../types'

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

type WorkSettings = Pick<Settings, 'workDays' | 'workStart' | 'workEnd' | 'holidays'>

/** Shifts a moment so that its getUTC* parts read as Bangladesh wall-clock time. */
function dhakaParts(d: Date) {
  const w = new Date(d.getTime() + DHAKA_OFFSET_MS)
  return { y: w.getUTCFullYear(), m: w.getUTCMonth(), day: w.getUTCDate(), weekday: w.getUTCDay(), ymd: w.toISOString().slice(0, 10) }
}

/** The real moment for a Bangladesh date and hour. */
function dhakaMoment(y: number, m: number, day: number, hour: number): Date {
  return new Date(Date.UTC(y, m, day, hour) - DHAKA_OFFSET_MS)
}

export function isWorkingDay(d: Date, s: WorkSettings): boolean {
  const p = dhakaParts(d)
  return s.workDays.includes(p.weekday) && !s.holidays.includes(p.ymd)
}

export function isWorkingTime(d: Date, s: WorkSettings): boolean {
  if (!isWorkingDay(d, s)) return false
  const p = dhakaParts(d)
  const start = dhakaMoment(p.y, p.m, p.day, s.workStart)
  const end = dhakaMoment(p.y, p.m, p.day, s.workEnd)
  return d >= start && d < end
}

/** The earliest working moment at or after `d`. */
export function nextWorkingStart(d: Date, s: WorkSettings): Date {
  let cursor = d
  for (let i = 0; i < 60; i++) {
    const p = dhakaParts(cursor)
    const start = dhakaMoment(p.y, p.m, p.day, s.workStart)
    const end = dhakaMoment(p.y, p.m, p.day, s.workEnd)
    if (isWorkingDay(start, s) && cursor < end) return cursor > start ? cursor : start
    cursor = dhakaMoment(p.y, p.m, p.day + 1, 0) // midnight of the next day
  }
  return d // no working days configured; fall back to the same moment
}

/** Adds working hours to a moment, skipping nights, weekends and holidays. */
export function addWorkingHours(start: Date, hours: number, s: WorkSettings): Date {
  let remaining = hours * HOUR_MS
  let cursor = nextWorkingStart(start, s)
  for (let i = 0; i < 200; i++) {
    const p = dhakaParts(cursor)
    const end = dhakaMoment(p.y, p.m, p.day, s.workEnd)
    const available = end.getTime() - cursor.getTime()
    if (remaining <= available) return new Date(cursor.getTime() + remaining)
    remaining -= available
    cursor = nextWorkingStart(end, s)
  }
  return cursor
}

/** When the n-th reminder (1, 2, 3…) for an item waiting since `since` is due. */
export function reminderDueAt(since: Date, n: number, s: WorkSettings & { reminderHours: number }): Date {
  return addWorkingHours(since, s.reminderHours * n, s)
}
