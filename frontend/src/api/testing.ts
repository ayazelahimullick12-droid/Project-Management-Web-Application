/**
 * SQA and UAT: test cases, builds, runs, results, defects and sign-off reports.
 *
 * Spec: SPEC_SQA_UAT.md. The rules live in src/rules/testing.ts; sign-off approval and signing
 * reuse the document approval engine (api/documents.ts) with the SQA_SIGNOFF / UAT_SIGNOFF types.
 */
import type { DemoState, Defect, DefectStatus, DocVersion, ID, Project, Severity, TestCase, TestStage } from '../types'
import { now, nowIso } from '../demo/clock'
import { newId } from '../demo/ids'
import { runAiJob } from '../demo/jobs'
import { draftTestCase, signoffParagraph, similarDefects, writeDefect as aiWriteDefect } from '../ai/agents'
import { CHAIN_CONFIG, ROLE_LABEL } from '../rules/approval'
import { missingPeople, testingNeeds } from '../rules/people'
import { actAsHead, can, headOf, headRecipient, inTeam, isDeveloper, isSqa, type Check } from '../rules/permissions'
import { activeChain, chainsOf, DOC_LABEL, docStatus, previousComplete } from '../rules/pipeline'
import { buildReportSections, reportStats } from '../rules/signoffReport'
import { allowedTransitions, buildAvailable, canBeAssigned, checkTransition, coverage, exitCriteria, knownIssues, latestResults, markReadyForRetest, releaseCheck, requirementsFor, transitionFor, UNRESOLVED } from '../rules/testing'
import { act, ApiError, ensure, fail, me, nameOf, pipelineCtx, projectOf, read } from './core'
import { audit, notify, teamMembers } from './effects'
import { createChangeRequestIn } from './changes'

const SEVERITIES: Severity[] = ['Critical', 'High', 'Medium', 'Low']
const signoffType = (stage: TestStage) => (stage === 'SQA' ? 'SQA_SIGNOFF' : 'UAT_SIGNOFF')

/** Who writes and runs tests in each stage. */
function canWriteTests(p: Project, userId: ID, stage: TestStage): Check {
  if (p.status === 'archived') return { ok: false, reason: 'This project is archived, so it is read-only.' }
  if (stage === 'SQA') return isSqa(p, userId) ? { ok: true } : { ok: false, reason: 'Only SQA testers write SQA test cases.' }
  return inTeam(p, userId, 'PM') ? { ok: true } : { ok: false, reason: 'The PM team writes UAT test cases.' }
}

function canRaise(p: Project, userId: ID, stage: TestStage): Check {
  if (p.status === 'archived') return { ok: false, reason: 'This project is archived, so it is read-only.' }
  if (stage === 'SQA') return isSqa(p, userId) ? { ok: true } : { ok: false, reason: 'Only SQA testers raise SQA defects.' }
  return inTeam(p, userId, 'STAKEHOLDER') || inTeam(p, userId, 'PM') ? { ok: true } : { ok: false, reason: 'UAT defects are raised by stakeholders and the PM team.' }
}

function nextKey(s: DemoState, pid: ID, prefix: string, list: { key: string; projectId: ID }[]): string {
  const nums = list.filter((x) => x.projectId === pid && x.key.startsWith(prefix + '-')).map((x) => Number(x.key.slice(prefix.length + 1)) || 0)
  void s
  return `${prefix}-${Math.max(0, ...nums) + 1}`
}

const defectLink = (d: Defect) => `/projects/${d.projectId}/defects/${d.id}`

// ─── Reading ────────────────────────────────────────────────────────────

export async function getTesting(pid: ID, stage: TestStage) {
  return read((s, t) => {
    const user = me(s)
    const p = projectOf(s, pid)
    ensure(can.view(p, user))
    const ctx = pipelineCtx(s, pid)
    const tests = s.testCases.filter((x) => x.projectId === pid && x.stage === stage).sort((a, b) => Number(a.key.split('-').pop()) - Number(b.key.split('-').pop()))
    const reqs = s.requirements.filter((r) => r.projectId === pid)
    const defects = s.defects.filter((d) => d.projectId === pid && d.stage === stage)
    const builds = s.builds.filter((b) => b.projectId === pid).sort((a, b) => a.registeredAt.localeCompare(b.registeredAt))
    const runs = s.testRuns.filter((r) => r.projectId === pid && r.stage === stage).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const executions = s.executions.filter((e) => e.projectId === pid)
    const blocking = s.settings.signoffBlocking
    const criteria = exitCriteria({ stage, previousDone: previousComplete(ctx, signoffType(stage)), confirmations: s.testConfirmations, projectId: pid, requirements: reqs, tests: s.testCases.filter((x) => x.projectId === pid), executions, defects: s.defects.filter((d) => d.projectId === pid), blocking })
    const confirmation = s.testConfirmations.find((c) => c.projectId === pid && c.stage === stage)
    const doc = s.docs.find((d) => d.projectId === pid && d.type === signoffType(stage))
    const headTeam = stage === 'SQA' ? 'TECH' : 'STAKEHOLDER'
    const latest = latestResults(stage, s.testCases.filter((x) => x.projectId === pid), executions)
    const ctxD = { project: p, userId: user.id, now: t, blocking }
    const stageStarted = previousComplete(ctx, stage === 'SQA' ? 'SQA_SIGNOFF' : 'SQA_SIGNOFF').ok || stage === 'UAT'
    return {
      project: p,
      stage,
      stageReady: stage === 'SQA' ? previousComplete(ctx, 'SQA_SIGNOFF') : previousComplete(ctx, 'UAT_SIGNOFF'),
      stageStarted,
      requirements: requirementsFor(stage, reqs),
      allRequirements: reqs,
      coverage: coverage(stage, reqs, s.testCases.filter((x) => x.projectId === pid)),
      tests: tests.map((tc) => ({ ...tc, latest: latest.find((l) => l.test.id === tc.id)?.latest, createdByName: tc.createdBy ? nameOf(s, tc.createdBy) : 'AI' })),
      confirmation: confirmation ? { ...confirmation, byName: nameOf(s, confirmation.by), actingForName: confirmation.actingFor ? nameOf(s, confirmation.actingFor) : undefined } : undefined,
      builds: builds.map((b) => ({
        ...b,
        registeredByName: nameOf(s, b.registeredBy),
        releasedByName: b.releasedToUatAt ? (b.releasedBy ? nameOf(s, b.releasedBy) : 'Automatically on SQA sign-off') : undefined,
        available: buildAvailable(b, stage),
        fixes: s.defects.filter((d) => b.fixesDefectIds.includes(d.id)).map((d) => ({ id: d.id, key: d.key, status: d.status, stage: d.stage, verified: d.sqaVerified?.buildId === b.id })),
        release: releaseCheck({ build: b, project: p, userId: user.id, runs: s.testRuns.filter((r) => r.projectId === pid), executions, defects: s.defects.filter((d) => d.projectId === pid), blocking }),
      })),
      runs: runs.map((r) => {
        const ex = executions.filter((e) => e.runId === r.id)
        return { ...r, buildVersion: s.builds.find((b) => b.id === r.buildId)?.version, createdByName: nameOf(s, r.createdBy), total: ex.length, done: ex.filter((e) => e.result !== 'not_run').length, pass: ex.filter((e) => e.result === 'pass').length, fail: ex.filter((e) => e.result === 'fail').length, blocked: ex.filter((e) => e.result === 'blocked').length, executions: ex.map((e) => ({ ...e, testKey: s.testCases.find((x) => x.id === e.testCaseId)?.key, testTitle: s.testCases.find((x) => x.id === e.testCaseId)?.title, assigneeName: nameOf(s, e.assigneeId), defectKeys: s.defects.filter((d) => e.defectIds.includes(d.id)).map((d) => d.key) })) }
      }),
      defects: defects.map((d) => ({ ...d, reporterName: nameOf(s, d.reporterId), assigneeName: d.assigneeId ? nameOf(s, d.assigneeId) : undefined, moves: allowedTransitions(d, { ...ctxD, fixBuildReleased: !!s.builds.find((b) => b.id === d.fixedInBuildId)?.releasedToUatAt }).map((x) => ({ to: x.to, label: x.label, needs: x.needs })) })),
      criteria,
      known: knownIssues(stage, s.defects.filter((d) => d.projectId === pid), blocking),
      stats: reportStats({ stage, requirements: reqs, tests: s.testCases.filter((x) => x.projectId === pid), executions, defects: s.defects.filter((d) => d.projectId === pid), blocking }),
      signoff: doc ? { doc, status: docStatus(ctx, doc), current: s.versions.find((v) => v.id === doc.currentVersionId), chains: chainsOf(ctx, doc.id).map((c) => ({ ...c, steps: c.steps.map((x) => ({ ...x, roleLabel: ROLE_LABEL[x.role], assigneeName: nameOf(s, x.assigneeId), actedByName: x.actedBy ? nameOf(s, x.actedBy) : undefined })) })), active: activeChain(ctx, doc) } : undefined,
      chainSteps: CHAIN_CONFIG[signoffType(stage)].steps.map((r) => ROLE_LABEL[r]),
      members: p.members.map((m) => ({ ...m, name: nameOf(s, m.userId) })),
      severities: SEVERITIES,
      blocking,
      // Who testing needs (testers, developers, heads); shown with "Add" until they are on the team.
      missing: missingPeople(p, testingNeeds(stage)),
      perms: {
        canAddPeople: can.addPeople(p, user.id, t).ok,
        writeTests: canWriteTests(p, user.id, stage),
        confirmList: actAsHead(p, headTeam, user.id, t),
        registerBuild: p.status === 'active' && (isDeveloper(p, user.id) || actAsHead(p, 'TECH', user.id, t).ok),
        createRun: stage === 'SQA' ? isSqa(p, user.id) : inTeam(p, user.id, 'PM'),
        raise: canRaise(p, user.id, stage),
        pm: actAsHead(p, 'PM', user.id, t).ok,
        sqa: isSqa(p, user.id),
        generateReport: stage === 'SQA' ? isSqa(p, user.id) : actAsHead(p, 'PM', user.id, t).ok,
      },
      me: user.id,
    }
  })
}

export async function getDefect(pid: ID, defectId: ID) {
  return read((s, t) => {
    const user = me(s)
    const p = projectOf(s, pid)
    ensure(can.view(p, user))
    const d = s.defects.find((x) => x.id === defectId && x.projectId === pid)
    if (!d) throw new ApiError(404, 'Defect not found.')
    const fixBuild = s.builds.find((b) => b.id === d.fixedInBuildId)
    const ctxD = { project: p, userId: user.id, now: t, blocking: s.settings.signoffBlocking, fixBuildReleased: !!fixBuild?.releasedToUatAt }
    return {
      project: p,
      defect: d,
      reporterName: nameOf(s, d.reporterId),
      assigneeName: d.assigneeId ? nameOf(s, d.assigneeId) : undefined,
      testCase: s.testCases.find((x) => x.id === d.testCaseId),
      requirement: s.requirements.find((r) => r.projectId === pid && r.id === d.requirementId),
      foundIn: s.builds.find((b) => b.id === d.foundInBuildId),
      fixedIn: fixBuild,
      duplicateOf: s.defects.find((x) => x.id === d.duplicateOfId),
      changeRequest: s.changeRequests.find((c) => c.id === d.changeRequestId),
      history: d.history.map((h) => ({ ...h, byName: h.by ? nameOf(s, h.by) : 'System' })),
      comments: d.comments.map((c) => ({ ...c, authorName: nameOf(s, c.authorId) })),
      watchers: d.watchers.map((id) => ({ id, name: nameOf(s, id) })),
      moves: allowedTransitions(d, ctxD).map((x) => ({ to: x.to, label: x.label, needs: x.needs })),
      developers: p.members.filter((m) => m.team === 'TECH' && !m.isSqa).map((m) => ({ id: m.userId, name: nameOf(s, m.userId) })),
      builds: s.builds.filter((b) => b.projectId === pid).map((b) => ({ id: b.id, version: b.version })),
      otherDefects: s.defects.filter((x) => x.projectId === pid && x.id !== d.id).map((x) => ({ id: x.id, key: x.key, title: x.title })),
      canTriage: actAsHead(p, 'PM', user.id, t).ok || actAsHead(p, 'TECH', user.id, t).ok,
      canVerify: d.stage === 'UAT' && d.status === 'Fixed' && isSqa(p, user.id) && !fixBuild?.releasedToUatAt && d.sqaVerified?.buildId !== d.fixedInBuildId,
      canComment: can.memberOrOwner(p, user.id).ok,
      members: p.members.map((m) => ({ id: m.userId, name: nameOf(s, m.userId) })),
      severities: SEVERITIES,
      blocking: s.settings.signoffBlocking,
      watching: d.watchers.includes(user.id),
    }
  })
}

export async function myTests() {
  return read((s) => {
    const user = me(s)
    return s.executions
      .filter((e) => e.assigneeId === user.id && projectOf(s, e.projectId).status === 'active')
      .map((e) => ({ ...e, projectName: projectOf(s, e.projectId).name, run: s.testRuns.find((r) => r.id === e.runId), test: s.testCases.find((x) => x.id === e.testCaseId), buildVersion: s.builds.find((b) => b.id === e.buildId)?.version }))
      .sort((a, b) => Number(a.result !== 'not_run') - Number(b.result !== 'not_run') || (b.run?.createdAt ?? '').localeCompare(a.run?.createdAt ?? ''))
  })
}

// ─── Test cases ─────────────────────────────────────────────────────────

export async function draftTests(pid: ID, stage: TestStage) {
  const s0 = await read((s) => s)
  const user = me(s0)
  const p = projectOf(s0, pid)
  ensure(canWriteTests(p, user.id, stage))
  const uncovered = coverage(stage, s0.requirements.filter((r) => r.projectId === pid), s0.testCases.filter((x) => x.projectId === pid)).filter((c) => !c.tests.length && !c.requirement.notTestable).map((c) => c.requirement)
  if (!uncovered.length) fail(`Every ${stage === 'SQA' ? 'SRS' : 'BRD'} requirement already has a test case (or is Not testable).`)
  return runAiJob({
    agent: 'testcases',
    title: `Drafting ${stage} test cases`,
    projectId: pid,
    byUserId: user.id,
    link: `/projects/${pid}/testing/${stage}?tab=cases`,
    steps: uncovered.map((r) => `Drafting a test case for ${r.id}`),
    work: async (step) => {
      const drafts = []
      for (const [i, r] of uncovered.entries()) {
        step(i)
        drafts.push(await draftTestCase(stage, r))
      }
      return drafts
    },
    apply: (s, drafts) => {
      const at = nowIso()
      for (const draft of drafts) {
        const key = nextKey(s, pid, `${stage}-TC`, s.testCases)
        s.testCases.push({ ...draft, id: newId('tc'), projectId: pid, key, createdBy: null, createdAt: at, history: [{ by: null, at, text: `Drafted by AI from ${draft.requirementIds[0]}` }] })
      }
      const proj = projectOf(s, pid)
      const head = headOf(proj, stage === 'SQA' ? 'TECH' : 'STAKEHOLDER')
      if (head && !s.testConfirmations.some((c) => c.projectId === pid && c.stage === stage))
        notify(s, { to: [headRecipient(proj, head.userId, now())], type: 'test-list', title: `Please confirm the ${stage} test case list`, body: `${proj.name}: ${uncovered.length} ${stage} test cases were drafted. Testing starts after you confirm the list.`, link: `/projects/${pid}/testing/${stage}?tab=cases`, projectId: pid, at: nowIso() })
      return `${uncovered.length} test case${uncovered.length > 1 ? 's' : ''} drafted. They are labelled AI-generated until a person accepts or edits them.`
    },
  })
}

export async function saveTestCase(pid: ID, stage: TestStage, input: Partial<TestCase> & { id?: ID }) {
  return act((s, _t, at) => {
    const user = me(s)
    const p = projectOf(s, pid)
    ensure(canWriteTests(p, user.id, stage))
    if (!input.title?.trim()) fail('Give the test case a title.')
    if (input.id) {
      const tc = s.testCases.find((x) => x.id === input.id)!
      Object.assign(tc, { title: input.title, preconditions: input.preconditions ?? tc.preconditions, steps: input.steps ?? tc.steps, expected: input.expected ?? tc.expected, requirementIds: input.requirementIds ?? tc.requirementIds, priority: input.priority ?? tc.priority, type: input.type ?? tc.type, acceptedBy: user.id, needsReview: false })
      tc.history.push({ by: user.id, at, text: tc.ai && !tc.history.some((h) => h.by) ? 'Reviewed and accepted' : 'Edited' })
    } else {
      s.testCases.push({ id: newId('tc'), projectId: pid, stage, key: nextKey(s, pid, `${stage}-TC`, s.testCases), title: input.title.trim(), preconditions: input.preconditions ?? '', steps: input.steps ?? [], expected: input.expected ?? '', requirementIds: input.requirementIds ?? [], priority: input.priority ?? 'Medium', type: input.type ?? (stage === 'SQA' ? 'Functional' : 'Business scenario'), ai: false, acceptedBy: user.id, createdBy: user.id, createdAt: at, history: [{ by: user.id, at, text: 'Created' }] })
    }
  })
}

export async function acceptTestCases(pid: ID, stage: TestStage) {
  return act((s, _t, at) => {
    const user = me(s)
    ensure(canWriteTests(projectOf(s, pid), user.id, stage))
    for (const tc of s.testCases.filter((x) => x.projectId === pid && x.stage === stage && x.ai && !x.acceptedBy)) {
      tc.acceptedBy = user.id
      tc.history.push({ by: user.id, at, text: 'Reviewed and accepted' })
    }
  })
}

export async function setNotTestable(pid: ID, reqId: string, reason: string | null) {
  return act((s, t, at) => {
    const user = me(s)
    const p = projectOf(s, pid)
    ensure(actAsHead(p, 'PM', user.id, t))
    const r = s.requirements.find((x) => x.projectId === pid && x.id === reqId)
    if (!r) fail('Requirement not found.')
    if (reason !== null && !reason.trim()) fail('Give the reason it cannot be tested.')
    r.notTestable = reason ? { reason: reason.trim(), by: user.id, at } : undefined
    audit(s, { projectId: pid, actorId: user.id, action: reason ? 'Marked Not testable' : 'Not testable removed', details: `${reqId}${reason ? `: ${reason}` : ''}`, at })
  })
}

export async function confirmList(pid: ID, stage: TestStage) {
  return act((s, t, at) => {
    const user = me(s)
    const p = projectOf(s, pid)
    const check = ensure(actAsHead(p, stage === 'SQA' ? 'TECH' : 'STAKEHOLDER', user.id, t))
    if (!s.testCases.some((x) => x.projectId === pid && x.stage === stage)) fail('There are no test cases to confirm yet.')
    if (s.testConfirmations.some((c) => c.projectId === pid && c.stage === stage)) fail('Already confirmed.')
    s.testConfirmations.push({ projectId: pid, stage, by: user.id, actingFor: check.actingFor, at })
    notify(s, { to: stage === 'SQA' ? p.members.filter((m) => m.isSqa).map((m) => m.userId) : teamMembers(p, 'PM'), type: 'test-list', title: `${stage} test case list confirmed`, body: `${p.name}: testing can start.`, link: `/projects/${pid}/testing/${stage}`, projectId: pid, at, exclude: user.id })
    audit(s, { projectId: pid, actorId: user.id, actingFor: check.actingFor, action: 'Test case list confirmed', details: stage, at })
  })
}

// ─── Builds ─────────────────────────────────────────────────────────────

export async function registerBuild(pid: ID, input: { version: string; envUrl: string; notes: string; fixesDefectIds: ID[] }) {
  return act((s, t, at) => {
    const user = me(s)
    const p = projectOf(s, pid)
    ensure(can.change(p))
    if (!(isDeveloper(p, user.id) || actAsHead(p, 'TECH', user.id, t).ok)) throw new ApiError(403, 'Developers register builds.')
    if (!input.version.trim()) fail('Give the build a version number.')
    if (s.builds.some((b) => b.projectId === pid && b.version === input.version.trim())) fail('A build with this version already exists.')
    const build = { id: newId('build'), projectId: pid, version: input.version.trim(), envUrl: input.envUrl.trim(), notes: input.notes.trim(), fixesDefectIds: input.fixesDefectIds, registeredBy: user.id, registeredAt: at }
    s.builds.push(build)
    for (const id of input.fixesDefectIds) {
      const d = s.defects.find((x) => x.id === id)!
      if (['Open', 'In progress', 'Reopened'].includes(d.status)) {
        Object.assign(d, { status: 'Fixed', fixedInBuildId: build.id, sqaVerified: undefined, updatedAt: at })
        d.history.push({ by: user.id, at, text: `Marked fixed in build ${build.version}` })
      }
    }
    s.defects = markReadyForRetest(s.defects, build, 'SQA', t)
    notify(s, { to: p.members.filter((m) => m.isSqa).map((m) => m.userId), type: 'build', title: `Build ${build.version} is ready for SQA`, body: `${p.name}: ${build.notes || 'New build registered.'}${input.fixesDefectIds.length ? ` Claims to fix ${input.fixesDefectIds.length} defect${input.fixesDefectIds.length > 1 ? 's' : ''}.` : ''}`, link: `/projects/${pid}/testing/SQA?tab=builds`, projectId: pid, at })
    for (const d of s.defects.filter((x) => x.fixedInBuildId === build.id && x.status === 'Ready for retest'))
      notify(s, { to: [d.reporterId], type: 'retest', title: `Ready for your retest: ${d.key}`, body: `${p.name}: ${d.title} (build ${build.version}).`, link: defectLink(d), projectId: pid, at })
    audit(s, { projectId: pid, actorId: user.id, action: 'Build registered', details: `${build.version}${input.fixesDefectIds.length ? `, fixes ${input.fixesDefectIds.length}` : ''}`, at })
  })
}

export async function verifyFix(defectId: ID, works: boolean, reason?: string) {
  return act((s, t, at) => {
    const user = me(s)
    const d = s.defects.find((x) => x.id === defectId)!
    const p = projectOf(s, d.projectId)
    if (!isSqa(p, user.id)) throw new ApiError(403, 'Only SQA testers check UAT fixes before release.')
    if (d.stage !== 'UAT' || d.status !== 'Fixed') fail('Only UAT defects marked Fixed are checked by SQA.')
    const b = s.builds.find((x) => x.id === d.fixedInBuildId)
    if (b?.releasedToUatAt) fail('This build is already in UAT.')
    if (works) {
      d.sqaVerified = { buildId: d.fixedInBuildId!, by: user.id, at }
      d.history.push({ by: user.id, at, text: `Fix checked by SQA (${user.name}) in build ${b?.version}` })
    } else {
      ensure(checkTransition(d, 'Reopened', { project: p, userId: user.id, now: t, blocking: s.settings.signoffBlocking, fixBuildReleased: false }))
      if (!reason?.trim()) fail('Say what still fails.')
      Object.assign(d, { status: 'Reopened', reopenCount: d.reopenCount + 1, sqaVerified: undefined })
      d.history.push({ by: user.id, at, text: `Fix failed SQA check: ${reason}` })
      if (d.assigneeId) notify(s, { to: [d.assigneeId], type: 'defect', title: `${d.key} reopened by SQA`, body: `${p.name}: ${reason}`, link: defectLink(d), projectId: p.id, at })
    }
    d.updatedAt = at
  })
}

export async function releaseToUat(buildId: ID) {
  return act((s, t, at) => {
    const user = me(s)
    const b = s.builds.find((x) => x.id === buildId)!
    const p = projectOf(s, b.projectId)
    ensure(releaseCheck({ build: b, project: p, userId: user.id, runs: s.testRuns.filter((r) => r.projectId === p.id), executions: s.executions.filter((e) => e.projectId === p.id), defects: s.defects.filter((d) => d.projectId === p.id), blocking: s.settings.signoffBlocking }))
    b.releasedToUatAt = at
    b.releasedBy = user.id
    s.defects = markReadyForRetest(s.defects, b, 'UAT', t)
    notify(s, { to: [...teamMembers(p, 'STAKEHOLDER'), ...teamMembers(p, 'PM')], type: 'build', title: `Build ${b.version} is ready for UAT`, body: `${p.name}: SQA checked build ${b.version} and released it to UAT.`, link: `/projects/${p.id}/testing/UAT?tab=builds`, projectId: p.id, at, exclude: user.id })
    for (const d of s.defects.filter((x) => x.fixedInBuildId === b.id && x.status === 'Ready for retest' && x.stage === 'UAT'))
      notify(s, { to: [d.reporterId], type: 'retest', title: `Ready for your retest: ${d.key}`, body: `${p.name}: ${d.title} (build ${b.version}).`, link: defectLink(d), projectId: p.id, at })
    audit(s, { projectId: p.id, actorId: user.id, action: 'Build released to UAT', details: b.version, at })
  })
}

// ─── Runs and results ───────────────────────────────────────────────────

export async function createRun(pid: ID, stage: TestStage, input: { buildId: ID; name: string; assignments: { testCaseId: ID; userId: ID }[] }) {
  return act((s, _t, at) => {
    const user = me(s)
    const p = projectOf(s, pid)
    ensure(can.change(p))
    if (stage === 'SQA' ? !isSqa(p, user.id) : !inTeam(p, user.id, 'PM')) throw new ApiError(403, stage === 'SQA' ? 'SQA testers create SQA runs.' : 'The PM team creates UAT runs.')
    if (!s.testConfirmations.some((c) => c.projectId === pid && c.stage === stage)) fail(`The ${stage} test case list must be confirmed before testing starts.`)
    const b = s.builds.find((x) => x.id === input.buildId)
    if (!b || !buildAvailable(b, stage)) fail(stage === 'UAT' ? 'This build has not been released to UAT yet.' : 'Choose a build.')
    if (!input.assignments.length) fail('Choose at least one test case.')
    for (const a of input.assignments) {
      const ok = stage === 'SQA' ? isSqa(p, a.userId) : inTeam(p, a.userId, 'STAKEHOLDER') || inTeam(p, a.userId, 'PM')
      if (!ok) fail(`${nameOf(s, a.userId)} cannot run ${stage} tests.`)
    }
    const run = { id: newId('run'), projectId: pid, stage, buildId: b.id, name: input.name.trim() || `${stage} run on build ${b.version}`, createdBy: user.id, createdAt: at }
    s.testRuns.push(run)
    for (const a of input.assignments) s.executions.push({ id: newId('ex'), runId: run.id, projectId: pid, stage, testCaseId: a.testCaseId, buildId: b.id, assigneeId: a.userId, result: 'not_run', defectIds: [], files: [] })
    const byUser = new Map<ID, number>()
    for (const a of input.assignments) byUser.set(a.userId, (byUser.get(a.userId) ?? 0) + 1)
    for (const [uid, n] of byUser) notify(s, { to: [uid], type: 'tests', title: `${n} test case${n > 1 ? 's' : ''} assigned to you`, body: `${p.name}: ${run.name} (build ${b.version}).`, link: '/inbox/tests', projectId: pid, at })
    audit(s, { projectId: pid, actorId: user.id, action: 'Test run created', details: `${run.name}: ${input.assignments.length} tests`, at })
  })
}

export async function recordResult(executionId: ID, input: { result: 'pass' | 'fail' | 'blocked'; actual?: string; notes?: string; blockedReason?: string; defectIds?: ID[]; newDefect?: NewDefect; files?: string[] }) {
  return act((s, t, at) => {
    const user = me(s)
    const e = s.executions.find((x) => x.id === executionId)
    if (!e) fail('Not found.')
    const p = projectOf(s, e.projectId)
    ensure(can.change(p))
    if (e.assigneeId !== user.id) throw new ApiError(403, 'This test is assigned to someone else.')
    const b = s.builds.find((x) => x.id === e.buildId)!
    if (!buildAvailable(b, e.stage)) fail('This build is not available to UAT yet.')
    let defectIds = input.defectIds ?? []
    if (input.result === 'fail') {
      if (input.newDefect) defectIds = [...defectIds, createDefectIn(s, p, e.stage, { ...input.newDefect, buildId: e.buildId, testCaseId: e.testCaseId }, user.id, at, t)]
      if (!defectIds.length) fail('A failed test must link to a defect: raise a new one or pick an existing one.')
    }
    if (input.result === 'blocked' && !input.blockedReason?.trim()) fail('Say why the test is blocked (for example “blocked by UAT-4”).')
    Object.assign(e, { result: input.result, actual: input.actual, notes: input.notes, blockedReason: input.blockedReason, defectIds, files: [...e.files, ...(input.files ?? [])], executedBy: user.id, executedAt: at })
    const tc = s.testCases.find((x) => x.id === e.testCaseId)
    if (tc?.needsReview) {
      tc.needsReview = false
      tc.history.push({ by: user.id, at, text: 'Run again after the requirement changed' })
    }
    audit(s, { projectId: p.id, actorId: user.id, action: 'Test result', details: `${tc?.key}: ${input.result}`, at })
  })
}

// ─── Defects ────────────────────────────────────────────────────────────

export interface NewDefect {
  title: string
  steps: string
  expected: string
  actual: string
  severity: Severity
  testCaseId?: ID
  requirementId?: string
  buildId?: ID
  ai?: boolean
  files?: string[]
}

function createDefectIn(s: DemoState, p: Project, stage: TestStage, input: NewDefect, userId: ID, at: string, t: Date): ID {
  ensure(canRaise(p, userId, stage))
  if (!input.title.trim()) fail('Give the defect a title.')
  const build = s.builds.find((b) => b.id === input.buildId) ?? s.builds.filter((b) => b.projectId === p.id && buildAvailable(b, stage)).at(-1)
  if (!build) fail('There is no build to test yet.')
  const tc = s.testCases.find((x) => x.id === input.testCaseId)
  const reporterTeam = stage === 'SQA' ? 'SQA' : inTeam(p, userId, 'STAKEHOLDER') ? 'STAKEHOLDER' : 'PM'
  const d: Defect = {
    id: newId('def'), projectId: p.id, stage, key: nextKey(s, p.id, stage, s.defects), title: input.title.trim(), steps: input.steps, expected: input.expected, actual: input.actual, severity: input.severity, status: 'New',
    reporterId: userId, reporterTeam, testCaseId: input.testCaseId, requirementId: input.requirementId ?? tc?.requirementIds[0], foundInBuildId: build.id,
    reopenCount: 0, ai: !!input.ai, watchers: [userId], files: input.files ?? [], comments: [], history: [{ by: userId, at, text: `Raised by ${nameOf(s, userId)} in build ${build.version} (${input.severity})${input.ai ? ' — written with the AI defect writer' : ''}` }], createdAt: at, updatedAt: at,
  }
  s.defects.push(d)
  const triagers = (['PM', 'TECH'] as const).flatMap((team) => {
    const head = headOf(p, team)
    return head ? [headRecipient(p, head.userId, t, team)] : []
  })
  notify(s, { to: triagers, type: 'defect', title: `New defect to triage: ${d.key}`, body: `${p.name}: ${d.title} (${d.severity}).`, link: defectLink(d), projectId: p.id, at, exclude: userId })
  audit(s, { projectId: p.id, actorId: userId, action: 'Defect raised', details: `${d.key} (${d.severity}): ${d.title}`, at })
  return d.id
}

export async function createDefect(pid: ID, stage: TestStage, input: NewDefect) {
  return act((s, t, at) => createDefectIn(s, projectOf(s, pid), stage, input, me(s).id, at, t))
}

/** AI defect writer (inline, quick): rough note → structured defect for the tester to check. */
export async function writeDefect(pid: ID, note: string, testCaseId?: ID) {
  if (!note.trim()) fail('Type a short note first.')
  const tc = await read((s) => s.testCases.find((x) => x.id === testCaseId))
  return aiWriteDefect(note, tc, { projectId: pid })
}

/** Open defects that mean the same thing (compared by the AI's embedding model). */
export async function possibleDuplicates(pid: ID, stage: TestStage, text: string) {
  const s = await read((x) => x)
  const open = s.defects.filter((d) => d.projectId === pid && d.stage === stage && UNRESOLVED.includes(d.status))
  const found = await similarDefects(text, open, s.settings.defectDuplicateThreshold, { projectId: pid })
  return found.map((x) => ({ id: x.defect.id, key: x.defect.key, title: x.defect.title, status: x.defect.status, score: x.score }))
}

export async function moveDefect(defectId: ID, to: DefectStatus, input: { assigneeId?: ID; buildId?: ID; reason?: string; duplicateOfId?: ID; severity?: Severity } = {}) {
  return act((s, t, at) => {
    const user = me(s)
    const d = s.defects.find((x) => x.id === defectId)
    if (!d) fail('Defect not found.')
    const p = projectOf(s, d.projectId)
    const fixBuild = s.builds.find((b) => b.id === d.fixedInBuildId)
    const check = ensure(checkTransition(d, to, { project: p, userId: user.id, now: t, blocking: s.settings.signoffBlocking, fixBuildReleased: !!fixBuild?.releasedToUatAt }))
    const tr = transitionFor(d, to)!
    if (tr.needs.includes('assignee')) {
      if (!input.assigneeId) fail('Choose a developer to assign.')
      ensure(canBeAssigned(p, input.assigneeId))
    }
    if (tr.needs.includes('build') && !input.buildId) fail('Choose the build that contains the fix (register the build first if needed).')
    if (tr.needs.includes('reason') && !input.reason?.trim()) fail('A reason is required.')
    if (tr.needs.includes('original') && !input.duplicateOfId) fail('Choose the original defect.')
    const from = d.status
    let text = `${from} → ${to} by ${user.name}${check.actingFor ? ` (for ${nameOf(s, check.actingFor)})` : ''}`
    d.status = to
    d.updatedAt = at
    if (to === 'Open' && input.assigneeId) {
      if (input.severity && input.severity !== d.severity) text += `; severity ${d.severity} → ${input.severity}`
      d.severity = input.severity ?? d.severity
      d.assigneeId = input.assigneeId
      if (!d.watchers.includes(input.assigneeId)) d.watchers.push(input.assigneeId)
      text += `; assigned to ${nameOf(s, input.assigneeId)}`
      notify(s, { to: [input.assigneeId], type: 'defect', title: `Defect assigned to you: ${d.key}`, body: `${p.name}: ${d.title} (${d.severity}).`, link: defectLink(d), projectId: p.id, at })
    }
    if (to === 'Fixed') {
      const b = s.builds.find((x) => x.id === input.buildId)!
      d.fixedInBuildId = b.id
      d.sqaVerified = undefined
      if (!b.fixesDefectIds.includes(d.id)) b.fixesDefectIds.push(d.id)
      text += ` in build ${b.version}`
      if (buildAvailable(b, d.stage)) {
        d.status = 'Ready for retest'
        text += '; ready for retest'
        notify(s, { to: [d.reporterId], type: 'retest', title: `Ready for your retest: ${d.key}`, body: `${p.name}: ${d.title} (build ${b.version}).`, link: defectLink(d), projectId: p.id, at })
      } else notify(s, { to: p.members.filter((m) => m.isSqa).map((m) => m.userId), type: 'defect', title: `UAT fix to check: ${d.key}`, body: `${p.name}: fixed in build ${b.version}. SQA checks it before the build reaches UAT.`, link: defectLink(d), projectId: p.id, at })
    }
    if (to === 'Closed' && d.testCaseId) {
      // The retest counts as a passed run of the linked test case on the fix build.
      const buildId = d.fixedInBuildId ?? d.foundInBuildId
      let run = s.testRuns.find((r) => r.projectId === p.id && r.stage === d.stage && r.buildId === buildId && r.name.startsWith('Retests'))
      if (!run) {
        run = { id: newId('run'), projectId: p.id, stage: d.stage, buildId, name: `Retests on build ${s.builds.find((b) => b.id === buildId)?.version}`, createdBy: user.id, createdAt: at }
        s.testRuns.push(run)
      }
      s.executions.push({ id: newId('ex'), runId: run.id, projectId: p.id, stage: d.stage, testCaseId: d.testCaseId, buildId, assigneeId: user.id, result: 'pass', notes: `Retest of ${d.key}`, defectIds: [d.id], files: [], executedBy: user.id, executedAt: at })
    }
    if (to === 'Reopened') {
      d.reopenCount += 1
      d.sqaVerified = undefined
      text += `: ${input.reason}`
      if (d.assigneeId) notify(s, { to: [d.assigneeId], type: 'defect', title: `${d.key} reopened`, body: `${p.name}: retest failed — ${input.reason}`, link: defectLink(d), projectId: p.id, at })
    }
    if (['Rejected', 'Duplicate', 'Deferred', 'Change request'].includes(to)) {
      d.outcomeReason = input.reason
      if (to === 'Duplicate') d.duplicateOfId = input.duplicateOfId
      if (to === 'Change request') d.changeRequestId = createChangeRequestIn(s, p, { title: d.title, description: input.reason ?? d.title, trigger: 'defect', sourceLabel: `From defect ${d.key}`, factKeys: ['scope_in'] }, user.id, at)
      text += `: ${input.reason}`
      notify(s, { to: [d.reporterId], type: 'defect', title: `Your defect ${d.key} was ${to === 'Change request' ? 'turned into a change request' : to.toLowerCase()}`, body: `${p.name}: ${input.reason}`, link: defectLink(d), projectId: p.id, at, exclude: user.id })
    }
    if (to === 'Open' && (from === 'Rejected' || from === 'Deferred')) d.outcomeReason = undefined
    d.history.push({ by: user.id, actingFor: check.actingFor, at, text })
    notify(s, { to: d.watchers.filter((w) => w !== d.reporterId && w !== d.assigneeId), type: 'watch', title: `${d.key} is now ${d.status}`, body: `${p.name}: ${d.title}`, link: defectLink(d), projectId: p.id, at, exclude: user.id, email: false })
    audit(s, { projectId: p.id, actorId: user.id, actingFor: check.actingFor, action: 'Defect status', details: `${d.key}: ${text}`, at })
  })
}

export async function updateDefect(defectId: ID, input: { severity?: Severity; assigneeId?: ID }) {
  return act((s, t, at) => {
    const user = me(s)
    const d = s.defects.find((x) => x.id === defectId)!
    const p = projectOf(s, d.projectId)
    if (!(actAsHead(p, 'PM', user.id, t).ok || actAsHead(p, 'TECH', user.id, t).ok)) throw new ApiError(403, 'Only the PM or the tech head change severity or the assignee.')
    if (input.severity && input.severity !== d.severity) {
      d.history.push({ by: user.id, at, text: `Severity ${d.severity} → ${input.severity}` })
      d.severity = input.severity
    }
    if (input.assigneeId && input.assigneeId !== d.assigneeId) {
      ensure(canBeAssigned(p, input.assigneeId))
      d.history.push({ by: user.id, at, text: `Assignee ${nameOf(s, d.assigneeId)} → ${nameOf(s, input.assigneeId)}` })
      d.assigneeId = input.assigneeId
      if (!d.watchers.includes(input.assigneeId)) d.watchers.push(input.assigneeId)
      notify(s, { to: [input.assigneeId], type: 'defect', title: `Defect assigned to you: ${d.key}`, body: `${p.name}: ${d.title}`, link: defectLink(d), projectId: p.id, at })
    }
    d.updatedAt = at
  })
}

export async function commentOnDefect(defectId: ID, body: string, mentions: ID[]) {
  return act((s, _t, at) => {
    const user = me(s)
    const d = s.defects.find((x) => x.id === defectId)!
    const p = projectOf(s, d.projectId)
    ensure(can.memberOrOwner(p, user.id))
    if (!body.trim()) fail('Write a comment.')
    d.comments.push({ id: newId('dc'), authorId: user.id, body: body.trim(), mentions, createdAt: at })
    if (!d.watchers.includes(user.id)) d.watchers.push(user.id)
    if (mentions.length) notify(s, { to: mentions, type: 'mention', title: `${user.name} tagged you on ${d.key}`, body: `${p.name}: “${body.trim()}”`, link: defectLink(d), projectId: p.id, at, exclude: user.id })
  })
}

export async function toggleWatch(defectId: ID) {
  return act((s) => {
    const user = me(s)
    const d = s.defects.find((x) => x.id === defectId)!
    d.watchers = d.watchers.includes(user.id) ? d.watchers.filter((w) => w !== user.id) : [...d.watchers, user.id]
  })
}

export async function attachToDefect(defectId: ID, fileName: string) {
  return act((s, _t, at) => {
    const user = me(s)
    const d = s.defects.find((x) => x.id === defectId)!
    ensure(can.memberOrOwner(projectOf(s, d.projectId), user.id))
    d.files.push(fileName)
    d.history.push({ by: user.id, at, text: `Attached ${fileName}` })
  })
}

// ─── Sign-off report ────────────────────────────────────────────────────

export async function generateReport(pid: ID, stage: TestStage) {
  const s0 = await read((s) => s)
  const user = me(s0)
  const p = projectOf(s0, pid)
  if (stage === 'SQA' ? !isSqa(p, user.id) : !actAsHead(p, 'PM', user.id, now()).ok) throw new ApiError(403, stage === 'SQA' ? 'An SQA tester generates the SQA sign-off report.' : 'The PM generates the UAT sign-off report.')
  const builds = s0.builds.filter((b) => b.projectId === pid && buildAvailable(b, stage))
  const build = builds.at(-1)
  if (!build) fail('There is no build in this stage yet.')
  const reportInput = (s: DemoState) => ({ stage, requirements: s.requirements.filter((r) => r.projectId === pid), tests: s.testCases.filter((x) => x.projectId === pid), executions: s.executions.filter((e) => e.projectId === pid), defects: s.defects.filter((d) => d.projectId === pid), blocking: s.settings.signoffBlocking })
  return runAiJob({
    agent: 'signoff',
    title: `Generating the ${stage} sign-off report`,
    projectId: pid,
    byUserId: user.id,
    link: `/projects/${pid}/testing/${stage}?tab=signoff`,
    steps: ['Writing the summary paragraph'],
    work: () => signoffParagraph(stage, reportStats(reportInput(s0)), build.version, { projectId: pid }),
    apply: (s, summary) => {
      const at = nowIso()
      const type = signoffType(stage)
      let doc = s.docs.find((d) => d.projectId === pid && d.type === type)
      if (!doc) {
        doc = { id: `${pid}-${type}`, projectId: pid, type, title: DOC_LABEL[type] }
        s.docs.push(doc)
      }
      const sections = buildReportSections({ ...reportInput(s), build, users: s.users, summary }).map((x) => ({ id: `${doc!.id}:${x.key}`, key: x.key, title: x.title, content: x.content, factKeys: [] }))
      const prev = s.versions.filter((v) => v.docId === doc!.id).sort((a, b) => b.number - a.number)[0]
      const v: DocVersion = { id: newId('ver'), docId: doc.id, projectId: pid, number: (prev?.number ?? 0) + 1, authorId: user.id, message: `Report generated for build ${build.version}`, kind: 'report', sections, buildId: build.id, regeneratedSectionIds: [], factSheetVersion: 0, templateVersion: 0, frozen: false, createdAt: at }
      s.versions.push(v)
      doc.currentVersionId = v.id
      doc.outOfSync = undefined
      for (const c of s.chains.filter((x) => x.docId === doc!.id && x.status === 'in_progress')) Object.assign(c, { status: 'cancelled', cancelReason: `Replaced by report v${v.number}`, endedAt: at })
      audit(s, { projectId: pid, actorId: user.id, action: 'Sign-off report generated', details: `${stage} v${v.number} (build ${build.version})`, at })
      return 'Report ready. Check the exit criteria, then send it for approval.'
    },
  })
}

export { chainsOf }
