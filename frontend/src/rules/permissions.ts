/**
 * Who can do what in a project.
 *
 * Spec: SPEC.md "Roles and permissions" (roles table and permission matrix), deputies
 * ("Project setup" → Deputies), and SPEC_SQA_UAT.md "Who does what".
 *
 * Every check returns { ok, reason, actingFor }. The api layer refuses actions that fail
 * (like a backend would) and the screens use the same checks to hide or disable buttons.
 *
 * One person may hold several roles in a project (for example tech head and stakeholder head).
 * The app warns about it, because that person then approves more than once (see teamWarnings).
 * So a person can have several memberships: use membershipsOf / inTeam rather than memberOf
 * when the team matters.
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

/** The person's first role in the project (enough to know whether they are a member). */
export function memberOf(p: Project, userId: ID | null | undefined): Member | undefined {
  return userId ? p.members.find((m) => m.userId === userId) : undefined
}

/** Every role the person holds in the project. */
export function membershipsOf(p: Project, userId: ID | null | undefined): Member[] {
  return userId ? p.members.filter((m) => m.userId === userId) : []
}

/** The person's role in one team, if they have one. */
export function membershipIn(p: Project, userId: ID | null | undefined, team: Team): Member | undefined {
  return membershipsOf(p, userId).find((m) => m.team === team)
}

export function inTeam(p: Project, userId: ID | null | undefined, team: Team): boolean {
  return !!membershipIn(p, userId, team)
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
  return !!membershipIn(p, userId, 'TECH')?.isSqa
}

/** Tech team members without the SQA tag act as developers (SPEC_SQA_UAT.md). */
export function isDeveloper(p: Project, userId: ID | null | undefined): boolean {
  const m = membershipIn(p, userId, 'TECH')
  return !!m && !m.isSqa
}

/** A short label for someone's role in a project, e.g. "Tech head" or "Deputy · Stakeholder head". */
export function roleLabel(p: Project, userId: ID): string {
  const roles = membershipsOf(p, userId).map(memberLabel)
  if (isOwner(p, userId)) roles.push(roles.length ? 'Owner' : 'Project Owner')
  return roles.length ? roles.join(' · ') : 'Not a member'
}

/** One role in words, e.g. "Tech head", "Deputy stakeholder head", "SQA tester". */
export function memberLabel(m: Member): string {
  if (m.isHead) return HEAD_LABEL[m.team]
  if (m.isDeputy) return `Deputy ${HEAD_LABEL[m.team].toLowerCase()}`
  if (m.team === 'STAKEHOLDER') return 'Stakeholder'
  if (m.team === 'SPONSOR') return 'Sponsor'
  if (m.team === 'TECH') return m.isSqa ? 'SQA tester' : 'Developer'
  return 'PM team member'
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

/**
 * Who receives a head's notifications right now: the deputy while the head is Away.
 * Pass the team when known (a person may head more than one team).
 */
export function headRecipient(p: Project, headUserId: ID, now: Date, team?: Team): { to: ID; forUserId?: ID } {
  const mine = membershipsOf(p, headUserId)
  const m = (team ? mine.find((x) => x.team === team) : undefined) ?? mine.find((x) => x.isHead) ?? mine[0]
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
  /** Replacing and removing people: the Owner. */
  manageTeam(p: Project, userId: ID | null): Check {
    if (p.status === 'archived') return no('This project is archived, so it is read-only.')
    return isOwner(p, userId) ? yes : no('Only the Project Owner can replace or remove people.')
  },
  /** Adding people (and making someone a head, deputy or SQA tester): the Owner or the PM. */
  addPeople(p: Project, userId: ID | null, now: Date): Check {
    if (p.status === 'archived') return no('This project is archived, so it is read-only.')
    return isOwner(p, userId) || actAsHead(p, 'PM', userId, now).ok ? yes : no('Only the Project Owner or the Project Manager can add people.')
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

/**
 * Where "Mark as decision" is offered. SPEC.md "Chat and meetings" allows it on any chat message;
 * we leave out direct messages between two members, because a private chat is not tied to one
 * project, so nobody could tell which project the decision belongs to (see DECISIONS.md).
 * Messages with a member of a similar past project stay: they are started from one project.
 */
export function canMarkDecision(chat: { kind: 'project' | 'document' | 'direct' | 'rag_dm'; projectId: ID | null }): Check {
  if (chat.kind === 'direct') return no('Decisions are marked in the project chat or a document chat, so it is clear which project they belong to.')
  if (!chat.projectId) return no('Decisions belong to a project.')
  return yes
}

/**
 * Real problems with a team (these block saving). A project may start with one person, so empty
 * teams and missing heads are fine here: the app asks for them when a step needs them.
 */
export function teamProblems(members: Member[]): string[] {
  const problems: string[] = []
  const TEAMS: Team[] = ['PM', 'TECH', 'STAKEHOLDER', 'SPONSOR']
  for (const team of TEAMS) {
    const inTeam_ = members.filter((m) => m.team === team)
    if (inTeam_.filter((m) => m.isHead).length > 1) problems.push(`${TEAM_LABEL[team]} can have only one head.`)
    if (inTeam_.filter((m) => m.isDeputy).length > 1) problems.push(`${TEAM_LABEL[team]} can have only one deputy.`)
    if (inTeam_.some((m) => m.isHead && m.isDeputy)) problems.push(`The head of the ${TEAM_LABEL[team]} cannot also be its deputy.`)
    if (new Set(inTeam_.map((m) => m.userId)).size !== inTeam_.length) problems.push(`Someone is listed twice in the ${TEAM_LABEL[team]}.`)
  }
  if (members.some((m) => m.isSqa && m.team !== 'TECH')) problems.push('Only tech team members can be tagged SQA.')
  if (members.some((m) => m.isSqa && m.isHead)) problems.push('The tech head is not tagged SQA.')
  return problems
}

/**
 * People with more than one role. Allowed, but the screens warn, because that person then
 * approves more than once and could approve their own work.
 */
export function teamWarnings(members: Member[]): { userId: ID; roles: string[] }[] {
  const byUser = new Map<ID, Member[]>()
  for (const m of members) byUser.set(m.userId, [...(byUser.get(m.userId) ?? []), m])
  return [...byUser].filter(([, ms]) => ms.length > 1).map(([userId, ms]) => ({ userId, roles: ms.map(memberLabel) }))
}
