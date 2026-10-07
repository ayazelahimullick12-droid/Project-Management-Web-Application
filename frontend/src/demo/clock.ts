/**
 * The demo clock (SIMULATED).
 *
 * The demo always starts at the seed's "now" (a Wednesday morning), shifted by whole weeks so
 * dates look current. It then runs in real time. "Time travel" moves it forward so reminders
 * and the 1-hour edit lock timeout can be shown without waiting.
 *
 * In the real app this is simply the server's clock.
 */
import { getState } from './store'

export function now(): Date {
  const m = getState().meta
  return new Date(new Date(m.seedNow).getTime() + (Date.now() - m.loadedAtReal) + m.timeOffsetMs)
}

export const nowIso = () => now().toISOString()

/** Shift that moves the seed's "now" to the most recent same weekday and time (whole weeks). */
export function weekShiftMs(seedNowIso: string): number {
  const WEEK = 7 * 24 * 60 * 60 * 1000
  const diff = Date.now() - new Date(seedNowIso).getTime()
  return Math.max(0, Math.floor(diff / WEEK)) * WEEK
}
