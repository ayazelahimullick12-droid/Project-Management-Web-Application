/**
 * SQA and UAT rules: defect status flow, builds, coverage and exit criteria.
 *
 * Spec: SPEC_SQA_UAT.md — "Who does what", "Builds", "Defects" (status flow and other
 * outcomes), "Sign-off" (exit criteria) and "Changes during testing".
 */
import type { Build, Defect, DefectStatus, Execution, ID, Project, Requirement, Severity, TestCase, TestListConfirmation, TestRun, TestStage } from '../types'
import { actAsHead, isSqa, memberOf, no, yes, type Check, inTeam, membershipIn } from './permissions'

/** Statuses where the defect still needs work. */
export const UNRESOLVED: DefectStatus[] = ['New', 'Open', 'In progress', 'Fixed', 'Ready for retest', 'Reopened']
export const BOARD_COLUMNS: DefectStatus[] = ['New', 'Open', 'In progress', 'Fixed', 'Ready for retest', 'Reopened', 'Closed']
export const OUTCOMES: DefectStatus[] = ['Rejected', 'Duplicate', 'Deferred', 'Change request']

export type Actor = 'triager' | 'assignee' | 'reporter_team' | 'pm' | 'sqa'
export type Need = 'build' | 'reason' | 'original' | 'assignee'

export interface Transition {
  from: DefectStatus[]
  to: DefectStatus
  who: Actor[]
  needs: Need[]
  label: string
}

/** The defect status flow (SPEC_SQA_UAT.md "Status flow" and "Other outcomes"). */
export const TRANSITIONS: Transition[] = [
  { from: ['New'], to: 'Open', who: ['triager'], needs: ['assignee'], label: 'Triage and assign' },
  { from: ['Open', 'Reopened'], to: 'In progress', who: ['assignee'], needs: [], label: 'Start work' },
  { from: ['Open', 'Reopened', 'In progress'], to: 'Fixed', who: ['assignee'], needs: ['build'], label: 'Mark fixed' },
  { from: ['Ready for retest'], to: 'Closed', who: ['reporter_team'], needs: [], label: 'Retest passed: close' },
  { from: ['Ready for retest'], to: 'Reopened', who: ['reporter_team'], needs: ['reason'], label: 'Retest failed: reopen' },
  { from: ['Fixed'], to: 'Reopened', who: ['sqa'], needs: ['reason'], label: 'Fix failed SQA check: reopen' },
  { from: UNRESOLVED, to: 'Rejected', who: ['pm'], needs: ['reason'], label: 'Reject (not a defect)' },
  { from: UNRESOLVED, to: 'Duplicate', who: ['pm'], needs: ['reason', 'original'], label: 'Mark duplicate' },
  { from: UNRESOLVED, to: 'Deferred', who: ['pm'], needs: ['reason'], label: 'Defer to after go-live' },
  { from: UNRESOLVED, to: 'Change request', who: ['pm'], needs: ['reason'], label: 'Turn into a change request' },
  { from: ['Rejected', 'Deferred'], to: 'Open', who: ['pm'], needs: [], label: 'Move back to Open' },
]

export interface DefectCtx {
  project: Project
  userId: ID | null
  now: Date
  blocking: Severity[]
  fixBuildReleased?: boolean // for SQA reopening a UAT fix: only before the build reaches UAT
}

/** Which roles the user has for this defect. */
function actorsFor(d: Defect, ctx: DefectCtx): { actors: Actor[]; actingFor?: ID } {
  const out: Actor[] = []
  let actingFor: ID | undefined
  const pm = actAsHead(ctx.project, 'PM', ctx.userId, ctx.now)
  const tech = actAsHead(ctx.project, 'TECH', ctx.userId, ctx.now)
  if (pm.ok) {
    out.push('pm', 'triager')
    actingFor = pm.actingFor
  }
  if (tech.ok) {
    out.push('triager')
    actingFor = actingFor ?? tech.actingFor
  }
  if (ctx.userId && d.assigneeId === ctx.userId) out.push('assignee')
  if (memberOf(ctx.project, ctx.userId)) {
    // "The reporter's team": SQA defects → SQA-tagged members; UAT defects → the reporter's team.
    if (d.stage === 'SQA' && isSqa(ctx.project, ctx.userId)) out.push('reporter_team')
    if (d.stage === 'UAT' && d.reporterTeam !== 'SQA' && d.reporterTeam !== 'TECH' && inTeam(ctx.project, ctx.userId, d.reporterTeam)) out.push('reporter_team')
    if (isSqa(ctx.project, ctx.userId)) out.push('sqa')
  }
  return { actors: out, actingFor }
}

export function checkTransition(d: Defect, to: DefectStatus, ctx: DefectCtx): Check {
  if (ctx.project.status === 'archived') return no('This project is archived, so it is read-only.')
  const t = TRANSITIONS.find((x) => x.to === to && x.from.includes(d.status))
  if (!t) return no(`A defect cannot move from ${d.status} to ${to}.`)
  if (to === 'Deferred' && ctx.blocking.includes(d.severity)) return no(`${d.severity} defects cannot be deferred. They must be fixed, rejected or turned into a change request.`)
  if (t.who.includes('sqa') && d.stage !== 'UAT') return no('Only UAT fixes are checked by SQA before release.')
  if (t.who.includes('sqa') && ctx.fixBuildReleased) return no('This fix has already been released to UAT.')
  const { actors, actingFor } = actorsFor(d, ctx)
  if (!t.who.some((w) => actors.includes(w))) {
    const who: Record<Actor, string> = {
      triager: 'the PM or the tech head',
      assignee: 'the assigned developer',
      reporter_team: d.stage === 'SQA' ? 'an SQA tester' : 'the reporter’s team',
      pm: 'the PM',
      sqa: 'an SQA tester',
    }
    return no(`Only ${t.who.map((w) => who[w]).join(' or ')} can do this.`)
  }
  return { ok: true, actingFor }
}

/** The moves this user can make now (used for buttons and for the board). */
export function allowedTransitions(d: Defect, ctx: DefectCtx): Transition[] {
  return TRANSITIONS.filter((t) => t.from.includes(d.status) && checkTransition(d, t.to, ctx).ok)
}

export function transitionFor(d: Defect, to: DefectStatus): Transition | undefined {
  return TRANSITIONS.find((x) => x.to === to && x.from.includes(d.status))
}

/** Who may be assigned to fix defects: developers only (not SQA testers). */
export function canBeAssigned(p: Project, userId: ID): Check {
  const m = membershipIn(p, userId, 'TECH')
  if (!m) return no('Defects are assigned to developers in the tech team.')
  if (m.isSqa) return no('SQA testers cannot be assigned defects to fix. Testers and developers stay separate.')
  return yes
}

// ─── Builds ─────────────────────────────────────────────────────────────

/** A build is in SQA as soon as it is registered; it reaches UAT only when released. */
export function buildAvailable(b: Build, stage: TestStage): boolean {
  return stage === 'SQA' ? true : !!b.releasedToUatAt
}

/** Has the SQA team completed a run on this build (every test in it has a result)? */
export function sqaRunCompleted(buildId: ID, runs: TestRun[], executions: Execution[]): boolean {
  return runs
    .filter((r) => r.stage === 'SQA' && r.buildId === buildId)
    .some((r) => {
      const ex = executions.filter((e) => e.runId === r.id)
      return ex.length > 0 && ex.every((e) => e.result !== 'not_run')
    })
}

/** Release to UAT is allowed only after SQA has checked the build (SPEC_SQA_UAT.md "Builds"). */
export function releaseCheck(args: { build: Build; project: Project; userId: ID | null; runs: TestRun[]; executions: Execution[]; defects: Defect[]; blocking: Severity[] }): Check {
  const { build } = args
  if (!isSqa(args.project, args.userId)) return no('Only SQA testers can release a build to UAT.')
  if (build.releasedToUatAt) return no('Already released to UAT.')
  if (!sqaRunCompleted(build.id, args.runs, args.executions)) return no('The SQA team must first complete a test run on this build.')
  const claimed = args.defects.filter((d) => build.fixesDefectIds.includes(d.id))
  const unverifiedUat = claimed.filter((d) => d.stage === 'UAT' && d.status === 'Fixed' && d.sqaVerified?.buildId !== build.id)
  if (unverifiedUat.length) return no(`SQA must check the UAT fixes in this build first: ${unverifiedUat.map((d) => d.key).join(', ')}.`)
  const reopened = claimed.filter((d) => d.status === 'Reopened')
  if (reopened.length) return no(`Some fixes in this build failed: ${reopened.map((d) => d.key).join(', ')}.`)
  const blockers = args.defects.filter((d) => d.stage === 'SQA' && UNRESOLVED.includes(d.status) && args.blocking.includes(d.severity))
  if (blockers.length) return no(`Unresolved ${args.blocking.join(' or ')} SQA defects: ${blockers.map((d) => d.key).join(', ')}.`)
  return yes
}

/** When a fix build becomes available to the defect's stage, the defect is ready for retest. */
export function markReadyForRetest(defects: Defect[], build: Build, stage: TestStage, now: Date): Defect[] {
  return defects.map((d) =>
    d.stage === stage && d.status === 'Fixed' && d.fixedInBuildId === build.id
      ? { ...d, status: 'Ready for retest', updatedAt: now.toISOString(), history: [...d.history, { by: null, at: now.toISOString(), text: `Ready for retest: build ${build.version} is available to ${stage}.` }] }
      : d,
  )
}

// ─── Coverage and exit criteria ─────────────────────────────────────────

/** SQA tests the SRS requirements; UAT tests the BRD requirements. */
export function requirementsFor(stage: TestStage, reqs: Requirement[]): Requirement[] {
  return reqs.filter((r) => r.docType === (stage === 'SQA' ? 'SRS' : 'BRD'))
}

export function coverage(stage: TestStage, reqs: Requirement[], tests: TestCase[]) {
  return requirementsFor(stage, reqs).map((r) => ({
    requirement: r,
    tests: tests.filter((t) => t.stage === stage && t.requirementIds.includes(r.id)),
  }))
}

/** The latest result of each test case in a stage. */
export function latestResults(stage: TestStage, tests: TestCase[], executions: Execution[]) {
  return tests
    .filter((t) => t.stage === stage)
    .map((t) => {
      // A test marked Needs review (its requirement changed) counts as not run until run again.
      const runs = executions.filter((e) => e.testCaseId === t.id && e.result !== 'not_run' && (!t.needsReview || (e.executedAt ?? '') > (t.history.at(-1)?.at ?? ''))).sort((a, b) => (a.executedAt ?? '').localeCompare(b.executedAt ?? ''))
      return { test: t, latest: runs.at(-1) }
    })
}

export interface CriteriaItem {
  label: string
  ok: boolean
  detail?: string
}

/** Exit criteria for a sign-off (SPEC_SQA_UAT.md "Sign-off"). All must pass before sending. */
export function exitCriteria(args: {
  stage: TestStage
  previousDone: Check
  confirmations: TestListConfirmation[]
  projectId: ID
  requirements: Requirement[]
  tests: TestCase[]
  executions: Execution[]
  defects: Defect[]
  blocking: Severity[]
}): { ok: boolean; items: CriteriaItem[] } {
  const { stage, blocking } = args
  const items: CriteriaItem[] = []
  items.push({ label: stage === 'SQA' ? 'The SRS is signed' : 'The SQA sign-off is approved', ok: args.previousDone.ok, detail: args.previousDone.ok ? undefined : args.previousDone.reason })
  const confirmed = args.confirmations.some((c) => c.projectId === args.projectId && c.stage === stage)
  items.push({ label: 'The test case list is confirmed', ok: confirmed, detail: confirmed ? undefined : stage === 'SQA' ? 'The tech head confirms the SQA list.' : 'The stakeholder head confirms the UAT list.' })

  const cov = coverage(stage, args.requirements, args.tests)
  const uncovered = cov.filter((c) => c.tests.length === 0 && !c.requirement.notTestable)
  items.push({ label: 'Every requirement has a test case (or is marked Not testable)', ok: uncovered.length === 0, detail: uncovered.length ? `No test yet: ${uncovered.map((c) => c.requirement.id).join(', ')}` : undefined })

  const stageDefects = args.defects.filter((d) => d.stage === stage)
  const problems: string[] = []
  for (const { test, latest } of latestResults(stage, args.tests, args.executions)) {
    if (!latest) problems.push(`${test.key} not run`)
    else if (latest.result === 'fail' || latest.result === 'blocked') {
      const linked = stageDefects.filter((d) => latest.defectIds.includes(d.id))
      // A failure caused by a Critical/High defect counts until the test is run again and passes.
      const onlyMinor = linked.length > 0 && linked.every((d) => !blocking.includes(d.severity))
      if (!onlyMinor) problems.push(`${test.key} ${latest.result === 'fail' ? 'failed' : 'blocked'}`)
    }
  }
  items.push({ label: 'Every test case has been run; any failure is only because of Medium or Low defects', ok: problems.length === 0, detail: problems.length ? problems.join(', ') : undefined })

  const blockers = stageDefects.filter((d) => UNRESOLVED.includes(d.status) && blocking.includes(d.severity))
  items.push({ label: `No ${blocking.join(' or ')} defect is unresolved`, ok: blockers.length === 0, detail: blockers.length ? blockers.map((d) => `${d.key} (${d.severity}, ${d.status})`).join(', ') : undefined })

  return { ok: items.every((i) => i.ok), items }
}

/** Known issues listed in the sign-off report: unresolved Medium/Low defects and every Deferred defect. */
export function knownIssues(stage: TestStage, defects: Defect[], blocking: Severity[]): Defect[] {
  return defects.filter((d) => d.stage === stage && (d.status === 'Deferred' || (UNRESOLVED.includes(d.status) && !blocking.includes(d.severity))))
}
