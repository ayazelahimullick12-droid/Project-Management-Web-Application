/**
 * The background worker (SIMULATED).
 *
 * Every 30 seconds, and right after time travel, it:
 *  - sends reminders for anything waiting on a person, every 4 working hours
 *    (SPEC.md "Notifications"; working hours in rules/workingHours.ts);
 *  - releases edit locks idle for more than 1 hour (SPEC.md "Editing lock"; the draft is
 *    already autosaved).
 *
 * In the real app this is APScheduler inside `python -m app.worker`.
 */
import { audit, notify, userName } from '../api/effects'
import { waitingItems } from '../api/waiting'
import { reminderDueAt } from '../rules/workingHours'
import { now } from './clock'
import { failInterruptedJobs } from './jobs'
import { getState, mutate } from './store'

export function tick(): { reminders: number; locksReleased: number } {
  const s = getState()
  const t = now()
  const due: { key: string; count: number }[] = []
  for (const item of waitingItems(s, t)) {
    if (!item.reminders) continue
    const done = s.reminders[item.key]?.count ?? 0
    let n = done
    while (n < 60 && reminderDueAt(new Date(item.since), n + 1, s.settings) <= t) n++
    if (n > done) due.push({ key: item.key, count: n })
  }
  const idleMs = s.settings.lockIdleMinutes * 60 * 1000
  const expired = s.locks.filter((l) => t.getTime() - new Date(l.heartbeatAt).getTime() > idleMs)
  if (!due.length && !expired.length) return { reminders: 0, locksReleased: 0 }

  let sent = 0
  mutate((draft) => {
    const at = t.toISOString()
    const items = waitingItems(draft, t)
    for (const d of due) {
      const item = items.find((i) => i.key === d.key)
      if (!item) continue
      notify(draft, { to: item.recipients, type: item.type, title: item.title, body: item.body, link: item.link, projectId: item.projectId, at, reminder: true })
      draft.reminders[d.key] = { count: d.count, lastAt: at }
      sent += item.recipients.length
    }
    for (const lock of expired) {
      draft.locks = draft.locks.filter((l) => l.docId !== lock.docId)
      const doc = draft.docs.find((x) => x.id === lock.docId)
      audit(draft, { projectId: doc?.projectId, actorId: null, action: 'Lock released', details: `Released after ${draft.settings.lockIdleMinutes} minutes idle (${userName(draft, lock.userId)}'s work was autosaved as a draft)`, at })
      notify(draft, { to: [lock.userId], type: 'lock', title: 'Your editing lock was released', body: `You were idle for ${draft.settings.lockIdleMinutes} minutes, so the lock on ${doc?.title ?? 'a document'} was released. Your work is saved as a draft.`, link: doc ? `/projects/${doc.projectId}/docs/${doc.type}` : '/', projectId: doc?.projectId, at, email: false })
    }
  })
  return { reminders: sent, locksReleased: expired.length }
}

let started = false
export function startWorker() {
  if (started) return
  started = true
  failInterruptedJobs()
  tick()
  setInterval(tick, 30_000)
}
