/**
 * SQA and UAT rules: who writes and checks the testing points, each point's result on a version,
 * coverage of the requirements, and what must be true before a sign-off can be sent.
 *
 * How testing works (simplified from SPEC_SQA_UAT.md, see DECISIONS.md):
 * 1. The AI writes testing points from the requirements (SRS for SQA, BRD for UAT); testers add,
 *    edit, regenerate and delete them.
 * 2. Someone adds the product version to test (for example 1.2) and the tester picks it.
 * 3. Each point is marked PASS or FAIL on that version, with an optional comment.
 * 4. A failed point is fixed in a new version; on the new version every point is checked again.
 * 5. When every point passes on one version, the sign-off report is made for that version.
 */
import type { CheckResult, ID, PointCheck, Project, Requirement, TestPoint, TestStage } from '../types'
import { actAsHead, inTeam, isDeveloper, isOwner, isSqa, no, yes, type Check } from './permissions'
import { isComplete, previousComplete, type PipelineCtx } from './pipeline'

const archived = (p: Project): Check | undefined => (p.status === 'archived' ? no('This project is archived, so it is read-only.') : undefined)

/**
 * Who writes and checks the points.
 * SQA: SQA testers. UAT: developers, stakeholders and the PM team.
 * The Project Owner can do both (master key).
 */
export function canTest(p: Project, userId: ID | null, stage: TestStage): Check {
  const a = archived(p)
  if (a) return a
  if (isOwner(p, userId)) return { ok: true, coveredAs: 'OWNER' }
  if (stage === 'SQA') return isSqa(p, userId) ? yes : no('Only SQA testers write and check SQA points.')
  return isDeveloper(p, userId) || inTeam(p, userId, 'STAKEHOLDER') || inTeam(p, userId, 'PM') ? yes : no('UAT points are written and checked by developers, stakeholders and the PM team.')
}

/** Adding a product version: the tech team (developers and SQA), the PM team and the Owner. */
export function canAddVersion(p: Project, userId: ID | null): Check {
  const a = archived(p)
  if (a) return a
  return isOwner(p, userId) || inTeam(p, userId, 'TECH') || inTeam(p, userId, 'PM') ? yes : no('The tech team or the PM team adds versions.')
}

/** Who makes the sign-off report: an SQA tester for SQA, the PM for UAT (the Owner for both). */
export function canMakeReport(p: Project, userId: ID | null, stage: TestStage, now: Date): Check {
  const a = archived(p)
  if (a) return a
  if (isOwner(p, userId)) return yes
  if (stage === 'SQA') return isSqa(p, userId) ? yes : no('An SQA tester makes the SQA sign-off report.')
  return actAsHead(p, 'PM', userId, now).ok ? yes : no('The PM makes the UAT sign-off report.')
}

// ─── Results ────────────────────────────────────────────────────────────

export type PointStatus = CheckResult | 'to_check'

/** The check that counts for a point on a version: the latest one made after the point last changed. */
export function latestCheck(point: TestPoint, versionId: ID | undefined, checks: PointCheck[]): PointCheck | undefined {
  if (!versionId) return undefined
  return checks
    .filter((c) => c.pointId === point.id && c.versionId === versionId && c.at >= point.changedAt)
    .sort((a, b) => a.at.localeCompare(b.at))
    .at(-1)
}

export function pointStatus(point: TestPoint, versionId: ID | undefined, checks: PointCheck[]): PointStatus {
  return latestCheck(point, versionId, checks)?.result ?? 'to_check'
}

/** Counts for one stage on one version. */
export function versionCounts(points: TestPoint[], versionId: ID | undefined, checks: PointCheck[]) {
  const statuses = points.map((pt) => pointStatus(pt, versionId, checks))
  return {
    total: points.length,
    pass: statuses.filter((x) => x === 'pass').length,
    fail: statuses.filter((x) => x === 'fail').length,
    toCheck: statuses.filter((x) => x === 'to_check').length,
  }
}

// ─── Coverage and exit criteria ─────────────────────────────────────────

/** SQA checks the SRS requirements; UAT checks the BRD requirements. */
export function requirementsFor(stage: TestStage, reqs: Requirement[]): Requirement[] {
  return reqs.filter((r) => r.docType === (stage === 'SQA' ? 'SRS' : 'BRD'))
}

export function coverage(stage: TestStage, reqs: Requirement[], points: TestPoint[]) {
  return requirementsFor(stage, reqs).map((r) => ({
    requirement: r,
    points: points.filter((pt) => pt.stage === stage && pt.requirementIds.includes(r.id)),
  }))
}

export interface CriteriaItem {
  label: string
  ok: boolean
  detail?: string
}

/** What must be true before a sign-off is sent. All items must be met. */
export function exitCriteria(args: {
  stage: TestStage
  previousDone: Check
  requirements: Requirement[]
  points: TestPoint[] // this stage's points
  checks: PointCheck[]
  versionId?: ID // the version being signed off
  versionLabel?: string
}): { ok: boolean; items: CriteriaItem[] } {
  const { stage, points, checks, versionId } = args
  const items: CriteriaItem[] = []
  items.push({ label: stage === 'SQA' ? 'The SRS is signed' : 'The SQA sign-off is approved', ok: args.previousDone.ok, detail: args.previousDone.ok ? undefined : args.previousDone.reason })

  const uncovered = coverage(stage, args.requirements, points).filter((c) => !c.points.length && !c.requirement.notTestable)
  items.push({
    label: 'There are testing points, and every requirement has at least one (or is marked Not testable)',
    ok: points.length > 0 && uncovered.length === 0,
    detail: !points.length ? 'No testing points yet.' : uncovered.length ? `No point yet: ${uncovered.map((c) => c.requirement.id).join(', ')}` : undefined,
  })

  const toCheck = points.filter((pt) => pointStatus(pt, versionId, checks) === 'to_check')
  const failed = points.filter((pt) => pointStatus(pt, versionId, checks) === 'fail')
  const on = args.versionLabel ? ` on version ${args.versionLabel}` : ''
  items.push({ label: `Every point has been checked${on}`, ok: !!versionId && toCheck.length === 0, detail: !versionId ? 'Choose a version first.' : toCheck.length ? `Not checked yet: ${toCheck.map((pt) => pt.key).join(', ')}` : undefined })
  items.push({ label: `Every point passed${on}`, ok: !!versionId && failed.length === 0, detail: failed.length ? `Failed: ${failed.map((pt) => pt.key).join(', ')}. Fix them in a new version and check again.` : undefined })

  return { ok: items.every((i) => i.ok), items }
}

// ─── Stage and people ───────────────────────────────────────────────────

export const signoffType = (stage: TestStage) => (stage === 'SQA' ? 'SQA_SIGNOFF' : 'UAT_SIGNOFF') as 'SQA_SIGNOFF' | 'UAT_SIGNOFF'

/** Testing is open in a stage once the document before it is done, until its sign-off is approved. */
export function stageOpen(ctx: PipelineCtx, stage: TestStage): boolean {
  return previousComplete(ctx, signoffType(stage)).ok && !isComplete(ctx, signoffType(stage))
}

/** The team members who write and check points in a stage (not counting the Owner's master key). */
export function testersOf(p: Project, stage: TestStage): ID[] {
  const ids = p.members.filter((m) => (stage === 'SQA' ? m.team === 'TECH' && m.isSqa : (m.team === 'TECH' && !m.isSqa) || m.team === 'STAKEHOLDER' || m.team === 'PM')).map((m) => m.userId)
  return [...new Set(ids)]
}

/** The developers (tech team without the SQA tag), who fix failed points. */
export function developersOf(p: Project): ID[] {
  return [...new Set(p.members.filter((m) => m.team === 'TECH' && !m.isSqa).map((m) => m.userId))]
}

/** Versions oldest first; the last one is the newest. */
export function sortVersions<V extends { addedAt: string }>(versions: V[]): V[] {
  return [...versions].sort((a, b) => a.addedAt.localeCompare(b.addedAt))
}

/**
 * The version to show by default: the newest one while testing is going on; once the stage is
 * signed off, the version that was signed off (newer versions are not checked in that stage).
 */
export function versionToShow<V extends { id: ID; addedAt: string }>(ctx: PipelineCtx, stage: TestStage, versions: V[]): V | undefined {
  const sorted = sortVersions(versions)
  if (!isComplete(ctx, signoffType(stage))) return sorted.at(-1)
  const doc = ctx.docs.find((d) => d.type === signoffType(stage))
  const report = ctx.versions.find((v) => v.id === doc?.currentVersionId)
  return sorted.find((v) => v.id === report?.testedVersionId) ?? sorted.at(-1)
}
