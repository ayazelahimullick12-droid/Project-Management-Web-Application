/**
 * Comment rules.
 *
 * Spec: SPEC.md "Comments and suggestions" (carrying forward, resolving, Pending check,
 * effect on approval) and "Approval and signing" → Comments during review.
 * BUILD_PROMPT.md 3.3: anchor = section id + quoted text + a little text before and after.
 */
import type { ApprovalChain, Comment, ID, Project, Section, Team } from '../types'
import { ROLE_TEAM } from './approval'
import { isOwner, memberOf, no, yes, type Check, inTeam, membershipsOf } from './permissions'
import { markdownToPlain, normalize } from './text'

/**
 * After a new version is saved: each open comment carries forward if its section was not
 * regenerated and its quoted text is still there unchanged. Otherwise it becomes Pending check.
 */
export function carryForward(
  comments: Comment[],
  docId: ID,
  newVersion: { id: ID; sections: Section[]; regeneratedSectionIds: ID[] },
): { comments: Comment[]; nowPending: Comment[] } {
  const nowPending: Comment[] = []
  const updated = comments.map((c) => {
    if (c.docId !== docId || c.status !== 'open') return c
    if (!c.sectionId) return { ...c, versionId: newVersion.id }
    if (newVersion.regeneratedSectionIds.includes(c.sectionId)) {
      const next: Comment = { ...c, status: 'pending_check', pendingReason: 'regenerated', resolvedOnVersionId: newVersion.id }
      nowPending.push(next)
      return next
    }
    const section = newVersion.sections.find((s) => s.id === c.sectionId)
    const stillThere = !!section && (!c.quote || markdownToPlain(section.content).includes(normalize(c.quote)))
    if (stillThere) return { ...c, versionId: newVersion.id }
    const next: Comment = { ...c, status: 'pending_check', pendingReason: 'text_edited', resolvedOnVersionId: newVersion.id }
    nowPending.push(next)
    return next
  })
  return { comments: updated, nowPending }
}

/** The team a user belongs to, for comment rules. The Owner without a team counts as 'OWNER'. */
export function commentTeam(p: Project, userId: ID): Team | 'OWNER' | undefined {
  return memberOf(p, userId)?.team ?? (isOwner(p, userId) ? 'OWNER' : undefined)
}

/**
 * Can this user comment on (or suggest wording for) a version?
 * Members of a team whose head has already approved this version cannot. Someone with roles in
 * several teams may comment while any of their teams still may.
 */
export function canComment(p: Project, userId: ID | null, chainsForVersion: ApprovalChain[]): Check {
  if (!userId) return no('Sign in first.')
  if (p.status === 'archived') return no('This project is archived, so it is read-only.')
  const teams = membershipsOf(p, userId).map((m) => m.team)
  if (!teams.length) return isOwner(p, userId) ? yes : no('Only project members can comment.')
  if (teams.includes('PM')) return yes
  const approvedByHeadOf = (team: string) =>
    chainsForVersion.some((ch) => ch.status !== 'cancelled' && ch.steps.some((s) => ROLE_TEAM[s.role] === team && (s.status === 'approved' || s.status === 'carried_over')))
  if (teams.every(approvedByHeadOf)) return no('Your team’s head has already approved this version, so your team can no longer comment on it. Your head can use Request changes if something needs action.')
  return yes
}

/** Ticking a comment resolved: PM team only. */
export function canTick(p: Project, userId: ID | null): Check {
  if (p.status === 'archived') return no('This project is archived, so it is read-only.')
  return inTeam(p, userId, 'PM') ? yes : no('Only PM team members can resolve comments.')
}

/** Confirming or reopening a Pending check comment: any member of the author's team. */
export function canCheckPending(p: Project, userId: ID | null, comment: Comment): Check {
  if (p.status === 'archived') return no('This project is archived, so it is read-only.')
  if (comment.status !== 'pending_check') return no('This comment is not pending check.')
  if (!userId) return no('Sign in first.')
  const teams: string[] = membershipsOf(p, userId).map((m) => m.team)
  if (userId === comment.authorId || teams.includes(comment.authorTeam) || (comment.authorTeam === 'OWNER' && isOwner(p, userId))) return yes
  return no('Only members of the comment author’s team can confirm or reopen it.')
}

/** Comments that block "Send for approval": open and pending check. */
export function blockingCounts(comments: Comment[], docId: ID) {
  const forDoc = comments.filter((c) => c.docId === docId)
  return {
    open: forDoc.filter((c) => c.status === 'open').length,
    pending: forDoc.filter((c) => c.status === 'pending_check').length,
  }
}
