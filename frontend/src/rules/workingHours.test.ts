import { describe, expect, it } from 'vitest'
import { SETTINGS } from './fixtures.test-helpers'
import { addWorkingHours, isWorkingTime, nextWorkingStart, reminderDueAt } from './workingHours'

const dhaka = (s: string) => new Date(`${s}+06:00`)

describe('working-hours reminder scheduling', () => {
  it('adds hours within the same day', () => {
    expect(addWorkingHours(dhaka('2026-10-07T10:00:00'), 4, SETTINGS)).toEqual(dhaka('2026-10-07T14:00:00'))
  })
  it('carries over the Friday–Saturday weekend (Thursday 15:00 + 4h → Sunday 11:00)', () => {
    expect(addWorkingHours(dhaka('2026-10-08T15:00:00'), 4, SETTINGS)).toEqual(dhaka('2026-10-11T11:00:00'))
  })
  it('starts counting at the next working morning when started at night', () => {
    expect(addWorkingHours(dhaka('2026-10-07T21:30:00'), 4, SETTINGS)).toEqual(dhaka('2026-10-08T13:00:00'))
  })
  it('skips holidays', () => {
    const s = { ...SETTINGS, holidays: ['2026-10-08'] }
    expect(nextWorkingStart(dhaka('2026-10-07T18:00:00'), s)).toEqual(dhaka('2026-10-11T09:00:00'))
  })
  it('never schedules a reminder outside working hours', () => {
    for (let n = 1; n <= 6; n++) {
      const due = reminderDueAt(dhaka('2026-10-07T16:30:00'), n, SETTINGS)
      expect(isWorkingTime(new Date(due.getTime() - 1), SETTINGS)).toBe(true)
    }
  })
  it('knows Friday is not a working day', () => expect(isWorkingTime(dhaka('2026-10-09T11:00:00'), SETTINGS)).toBe(false))
})
