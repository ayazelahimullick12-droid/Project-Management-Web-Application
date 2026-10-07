/**
 * Side effects every action needs: notifications (in-app + email) and the audit log.
 *
 * Spec: SPEC.md "Notifications, dashboard and archive" (in-app and email for every event) and
 * BUILD_SPEC "Audit log". These functions change a state draft passed in, so they work both in
 * api actions and in the seed loader.
 */
import type { DemoState, ID, Project } from '../types'
import { newId } from '../demo/ids'
import { headRecipient } from '../rules/permissions'

export interface Recipient {
  to: ID
  forUserId?: ID // the Away head this deputy is covering for
}

/** Sends each user's notification to their deputy while they are an Away head. */
export function recipientsFor(project: Project | undefined, userIds: ID[], now: Date): Recipient[] {
  const out: Recipient[] = []
  for (const id of new Set(userIds)) out.push(project ? headRecipient(project, id, now) : { to: id })
  return out
}

export function userName(s: DemoState, id: ID | null | undefined): string {
  if (!id) return 'AI'
  return s.users.find((u) => u.id === id)?.name ?? 'Unknown user'
}

export function notify(
  s: DemoState,
  args: {
    to: Recipient[] | ID[]
    type: string
    title: string
    body: string
    link: string
    projectId?: ID
    at: string
    email?: boolean
    reminder?: boolean
    exclude?: ID // usually the person who did the action
  },
) {
  const recipients: Recipient[] = args.to.map((r) => (typeof r === 'string' ? { to: r } : r))
  const seen = new Set<ID>()
  for (const r of recipients) {
    if (seen.has(r.to) || r.to === args.exclude) continue
    seen.add(r.to)
    const user = s.users.find((u) => u.id === r.to)
    if (!user || user.deactivated) continue
    const forNote = r.forUserId ? ` (covering for ${userName(s, r.forUserId)}, who is Away)` : ''
    let emailId: ID | undefined
    if (args.email !== false) {
      emailId = newId('mail')
      s.emails.unshift({
        id: emailId,
        to: r.to,
        subject: `${args.reminder ? 'Reminder: ' : ''}${args.title}`,
        body: `Hello ${user.name.split(' ')[0]},\n\n${args.body}${forNote}\n\nOpen in the app: ${args.link}\n\n— BRAC Project Management (prototype; this email was not really sent)`,
        createdAt: args.at,
      })
    }
    s.notifications.unshift({
      id: newId('ntf'),
      userId: r.to,
      type: args.type,
      title: `${args.reminder ? 'Reminder: ' : ''}${args.title}`,
      body: args.body + forNote,
      link: args.link,
      projectId: args.projectId,
      createdAt: args.at,
      emailId,
      reminder: args.reminder,
      forUserId: r.forUserId,
    })
  }
}

export function audit(s: DemoState, args: { projectId?: ID; actorId?: ID | null; actingFor?: ID; action: string; details: string; at: string }) {
  const { at, ...rest } = args
  s.audit.unshift({ id: newId('aud'), ...rest, createdAt: at })
}

/** Everyone in a project (all four teams). */
export function allMembers(p: Project): ID[] {
  return p.members.map((m) => m.userId)
}

export function teamMembers(p: Project, team: string): ID[] {
  return p.members.filter((m) => m.team === team).map((m) => m.userId)
}
