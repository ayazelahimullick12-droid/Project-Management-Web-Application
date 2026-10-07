/**
 * Notifications, the simulated mailbox and the AI job tray.
 *
 * Spec: SPEC.md "Notifications, dashboard and archive". Emails are shown in an in-app
 * Mailbox instead of Mailpit.
 */
import type { ID } from '../types'
import { act, me, nameOf, read } from './core'

export async function myNotifications() {
  return read((s) => {
    const user = me(s)
    return s.notifications.filter((n) => n.userId === user.id).map((n) => ({ ...n, forUserName: n.forUserId ? nameOf(s, n.forUserId) : undefined }))
  })
}

export async function markRead(id: ID) {
  return act((s, _t, at) => {
    const user = me(s)
    const n = s.notifications.find((x) => x.id === id && x.userId === user.id)
    if (n && !n.readAt) n.readAt = at
  })
}

export async function markAllRead() {
  return act((s, _t, at) => {
    const user = me(s)
    for (const n of s.notifications) if (n.userId === user.id && !n.readAt) n.readAt = at
  })
}

/** All emails, like Mailpit's inbox (a development tool that catches every email). */
export async function mailbox() {
  return read((s) => s.emails.map((e) => ({ ...e, toName: nameOf(s, e.to), toEmail: s.users.find((u) => u.id === e.to)?.email ?? '' })))
}

export async function myJobs() {
  return read((s) => {
    const user = me(s)
    return s.jobs.filter((j) => j.byUserId === user.id)
  })
}
