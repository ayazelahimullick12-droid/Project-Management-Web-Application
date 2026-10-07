/**
 * Who can do what in a project.
 *
 * Spec: SPEC.md "Roles and permissions" (roles table and permission matrix), deputies
 * ("Project setup" → Deputies), and SPEC_SQA_UAT.md "Who does what".
 *
 * Every check returns { ok, reason, actingFor }. The api layer refuses actions that fail
 * (like a backend would) and the screens use the same checks to hide or disable buttons.
 */
import type { ID, Member, Project, Team, User } from '../types'

export interface Check {
  ok: boolean
  reason?: string
  actingFor?: ID // set when a deputy acts for an Away head
}

export const yes: Check = { ok: true }
export const no = (reason: string): Check => ({ ok: false, reason })

export const TEAM_LABEL: Record<Team, string> = {
  PM: 'PM team',
  TECH: 'Tech team',
  STAKEHOLDER: 'Stakeholders',
  SPONSOR: 'Sponsors',
}

export const HEAD_LABEL: Record<Team, string> = {
  PM: 'Project Manager',
  TECH: 'Tech head',
  STAKEHOLDER: 'Stakeholder head',
  SPONSOR: 'Sponsor head',
}

export function memberOf(p: Project, userId: ID | null | undefined): Member | undefined {
  return userId ? p.members.find((m) => m.userId === userId) : undefined
}

export function teamOf(p: Project, userId: ID | null | undefined): Team | undefined {
  return memberOf(p, userId)?.team
}

export function inTeam(p: Project, userId: ID | null | undefined, team: Team): boolean {
  return teamOf(p, userId) === team
}

export function isOwner(p: Project, userId: ID | null | undefined): boolean {
  return !!userId && p.ownerId === userId
}

export function headOf(p: Project, team: Team): Member | undefined {
  return p.members.find((m) => m.team === team && m.isHead)
}

export function deputyOf(p: Project, team: Team): Member | undefined {
  return p.members.find((m) => m.team === team && m.isDeputy)
}

export function isAway(p: Project, userId: ID, now: Date): boolean {
  return p.away.some((a) => a.userId === userId && new Date(a.from) <= now && now <= new Date(a.to))
}

export function isSqa(p: Project, userId: ID | null | undefined): boolean {
  const m = memberOf(p, userId)
  return !!m && m.team === 'TECH' && !!m.isSqa
}

/** Tech team members without the SQA tag act as developers (SPEC_SQA_UAT.md). */
export function isDeveloper(p: Project, userId: ID | null | undefined): boolean {
  const m = memberOf(p, userId)
  return !!m && m.team === 'TECH' && !m.isSqa
}

/** A short label for someone's role in a project, e.g. "Tech head" or "Deputy · Stakeholder head". */
export function roleLabel(p: Project, userId: ID): string {
  if (isOwner(p, userId) && !memberOf(p, userId)) return 'Project Owner'
  const m = memberOf(p, userId)
  if (!m) return 'Not a member'
  let label = m.isHead ? HEAD_LABEL[m.team] : m.isDeputy ? `Deputy ${HEAD_LABEL[m.team].toLowerCase()}` : TEAM_LABEL[m.team].replace(/s$/, '') + ' member'
  if (m.team === 'STAKEHOLDER' && !m.isHead && !m.isDeputy) label = 'Stakeholder'
  if (m.team === 'SPONSOR' && !m.isHead && !m.isDeputy) label = 'Sponsor'
  if (m.team === 'TECH' && !m.isHead && !m.isDeputy) label = m.isSqa ? 'SQA tester' : 'Developer'
  if (isOwner(p, userId)) label += ' · Owner'
  return label
}

/**
 * Can this user act as the head of `team` right now?
 * The head can, unless they are Away; while the head is Away, their deputy acts for them.
 */
export function actAsHead(p: Project, team: Team, userId: ID | null | undefined, now: Date): Check {
  const head = headOf(p, team)
  if (!head) return no(`This project has no ${HEAD_LABEL[team].toLowerCase()} yet.`)
  if (!userId) return no('Sign in first.')
  if (userId === head.userId) {
    if (isAway(p, head.userId, now)) return no('You are marked Away, so your deputy is acting for you. End your Away period to act yourself.')
    return yes
  }
  const deputy = deputyOf(p, team)
  if (deputy?.userId === userId && isAway(p, head.userId, now)) return { ok: true, actingFor: head.userId }
  return no(`Only the ${HEAD_LABEL[team].toLowerCase()} can do this${deputy ? ' (or their deputy while they are Away)' : ''}.`)
}

/** Who receives a head's notifications right now: the deputy while the head is Away. */
export function headRecipient(p: Project, headUserId: ID, now: Date): { to: ID; forUserId?: ID } {
  const m = memberOf(p, headUserId)
  if (m && (m.isHead || m.isDeputy) && isAway(p, headUserId, now)) {
    const deputy = m.isHead ? deputyOf(p, m.team) : undefined
    if (deputy) return { to: deputy.userId, forUserId: headUserId }
  }
  return { to: headUserId }
}

/** Generic checks used across screens. */
export const can = {
  view(p: Project, user: User | null): Check {
    if (!user) return no('Sign in first.')
    if (user.isAdmin || isOwner(p, user.id) || memberOf(p, user.id)) return yes
    return no('You are not a member of this project.')
  },
  change(p: Project): Check {
    return p.status === 'archived' ? no('This project is archived, so it is read-only.') : yes
  },
  manageTeam(p: Project, userId: ID | null): Check {
    if (p.status === 'archived') return no('This project is archived, so it is read-only.')
    return isOwner(p, userId) ? yes : no('Only the Project Owner can change the team.')
  },
  archive(p: Project, userId: ID | null): Check {
    if (p.status === 'archived') return no('Already archived.')
    return isOwner(p, userId) ? yes : no('Only the Project Owner can archive the project.')
  },
  pmTeam(p: Project, userId: ID | null, what = 'do this'): Check {
    if (p.status === 'archived') return no('This project is archived, so it is read-only.')
    return inTeam(p, userId, 'PM') ? yes : no(`Only PM team members can ${what}.`)
  },
  pm(p: Project, userId: ID | null, now: Date): Check {
    if (p.status === 'archived') return no('This project is archived, so it is read-only.')
    return actAsHead(p, 'PM', userId, now)
  },
  memberOrOwner(p: Project, userId: ID | null): Check {
    if (p.status === 'archived') return no('This project is archived, so it is read-only.')
    return memberOf(p, userId) || isOwner(p, userId) ? yes : no('Only project members can do this.')
  },
}
