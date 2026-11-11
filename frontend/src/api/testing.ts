/**
 * SQA and UAT: testing points, product versions, PASS / FAIL checks and the sign-off report.
 *
 * The rules (who may do what, a point's result on a version, the exit criteria) live in
 * src/rules/testing.ts. Sign-off approval and signing reuse the document approval engine
 * (api/documents.ts) with the SQA_SIGNOFF / UAT_SIGNOFF types.
 */
import type { CheckResult, DemoState, DocVersion, ID, TestPoint, TestStage } from '../types'
import { now, nowIso } from '../demo/clock'
import { newId } from '../demo/ids'
import { runAiJob } from '../demo/jobs'
import { draftTestPoints, rewriteTestPoint, signoffParagraph } from '../ai/agents'
import { CHAIN_CONFIG, ROLE_LABEL } from '../rules/approval'
import { missingPeople, testingNeeds } from '../rules/people'
import { actAsHead, can, headOf, headRecipient } from '../rules/permissions'
import { activeChain, chainsOf, DOC_LABEL, docStatus, previousComplete } from '../rules/pipeline'
import { buildReportSections, reportStats } from '../rules/signoffReport'
import { canAddVersion, canMakeReport, canTest, coverage, developersOf, exitCriteria, latestCheck, pointStatus, requirementsFor, signoffType, sortVersions, stageOpen, testersOf, versionCounts, versionToShow } from '../rules/testing'
import { act, ApiError, ensure, fail, me, nameOf, pipelineCtx, projectOf, read } from './core'
import { audit, notify } from './effects'

const testingLink = (pid: ID, stage: TestStage, extra = '') => `/projects/${pid}/testing/${stage}${extra}`

function nextKey(s: DemoState, pid: ID, stage: TestStage): string {
  const nums = s.testPoints.filter((x) => x.projectId === pid && x.stage === stage).map((x) => Number(x.key.split('-').pop()) || 0)
  return `${stage}-${Math.max(0, ...nums) + 1}`
}

const pointsOf = (s: DemoState, pid: ID, stage: TestStage) =>
  s.testPoints.filter((x) => x.projectId === pid && x.stage === stage).sort((a, b) => Number(a.key.split('-').pop()) - Number(b.key.split('-').pop()))

const versionsOf = (s: DemoState, pid: ID) => sortVersions(s.productVersions.filter((v) => v.projectId === pid))

function pointById(s: DemoState, pointId: ID): TestPoint {
  const pt = s.testPoints.find((x) => x.id === pointId)
  if (!pt) throw new ApiError(404, 'Testing point not found.')
  return pt
}

// ─── Reading ────────────────────────────────────────────────────────────

/** Everything the testing page shows. `versionId` is the version being checked (default: the newest). */
export async function getTesting(pid: ID, stage: TestStage, versionId?: ID) {
  return read((s, t) => {
    const user = me(s)
    const p = projectOf(s, pid)
    ensure(can.view(p, user))
    const ctx = pipelineCtx(s, pid)
    const reqs = s.requirements.filter((r) => r.projectId === pid)
    const points = pointsOf(s, pid, stage)
    const checks = s.pointChecks.filter((c) => c.projectId === pid && c.stage === stage)
    const versions = versionsOf(s, pid)
    const sqaPoints = pointsOf(s, pid, 'SQA')
    const sqaChecks = s.pointChecks.filter((c) => c.projectId === pid && c.stage === 'SQA')
    const version = versions.find((v) => v.id === versionId) ?? versionToShow(ctx, stage, versions)
    const doc = s.docs.find((d) => d.projectId === pid && d.type === signoffType(stage))
    const report = doc ? s.versions.find((v) => v.id === doc.currentVersionId) : undefined
    const reportVersion = versions.find((v) => v.id === report?.testedVersionId)
    const testCheck = canTest(p, user.id, stage)
    return {
      project: p,
      stage,
      stageReady: previousComplete(ctx, signoffType(stage)),
      open: stageOpen(ctx, stage),
      requirements: requirementsFor(stage, reqs),
      coverage: coverage(stage, reqs, points).map((c) => ({ requirement: c.requirement, points: c.points.map((pt) => pt.key) })),
      versions: versions.map((v) => {
        const n = versionCounts(points, v.id, checks)
        const sqa = versionCounts(sqaPoints, v.id, sqaChecks)
        return { ...v, addedByName: nameOf(s, v.addedBy), counts: n, passedSqa: sqa.total > 0 && sqa.pass === sqa.total }
      }),
      version: version ? { ...version, addedByName: nameOf(s, version.addedBy) } : undefined,
      points: points.map((pt) => {
        const last = latestCheck(pt, version?.id, checks)
        // Every check of this point, newest first, across versions (its history).
        const history = checks
          .filter((c) => c.pointId === pt.id)
          .sort((a, b) => b.at.localeCompare(a.at))
          .map((c) => ({ ...c, byName: nameOf(s, c.by), versionLabel: versions.find((v) => v.id === c.versionId)?.version ?? '?', stale: c.at < pt.changedAt }))
        return {
          ...pt,
          status: pointStatus(pt, version?.id, checks),
          last: last ? { ...last, byName: nameOf(s, last.by) } : undefined,
          history,
          createdByName: pt.createdBy ? nameOf(s, pt.createdBy) : 'AI',
        }
      }),
      counts: versionCounts(points, version?.id, checks),
      criteria: exitCriteria({ stage, previousDone: previousComplete(ctx, signoffType(stage)), requirements: reqs, points, checks, versionId: version?.id, versionLabel: version?.version }),
      signoff: doc
        ? {
            doc,
            status: docStatus(ctx, doc),
            current: report,
            reportVersionLabel: reportVersion?.version,
            chains: chainsOf(ctx, doc.id).map((c) => ({ ...c, steps: c.steps.map((x) => ({ ...x, roleLabel: ROLE_LABEL[x.role], assigneeName: nameOf(s, x.assigneeId), actedByName: x.actedBy ? nameOf(s, x.actedBy) : undefined })) })),
            active: activeChain(ctx, doc),
          }
        : undefined,
      chainSteps: CHAIN_CONFIG[signoffType(stage)].steps.map((r) => ROLE_LABEL[r]),
      // Who testing needs (testers, developers, heads); shown with "Add" until they are on the team.
      missing: missingPeople(p, testingNeeds(stage)),
      perms: {
        canAddPeople: can.addPeople(p, user.id, t).ok,
        test: testCheck,
        asOwner: testCheck.coveredAs === 'OWNER',
        addVersion: canAddVersion(p, user.id),
        pm: actAsHead(p, 'PM', user.id, t).ok,
        report: canMakeReport(p, user.id, stage, t),
      },
      me: user.id,
    }
  })
}

/** "My tests": stages where this person checks points and something is waiting on the newest version. */
export async function myTests() {
  return read((s) => {
    const user = me(s)
    const out = []
    for (const p of s.projects.filter((x) => x.status === 'active' && !x.finished)) {
      const ctx = pipelineCtx(s, p.id)
      const latest = versionsOf(s, p.id).at(-1)
      for (const stage of ['SQA', 'UAT'] as TestStage[]) {
        if (!testersOf(p, stage).includes(user.id) || !stageOpen(ctx, stage)) continue
        const points = pointsOf(s, p.id, stage)
        const n = versionCounts(points, latest?.id, s.pointChecks.filter((c) => c.projectId === p.id && c.stage === stage))
        out.push({ projectId: p.id, projectName: p.name, stage, version: latest?.version, versionId: latest?.id, ...n })
      }
    }
    return out
  })
}

// ─── Testing points ─────────────────────────────────────────────────────

/** The AI writes points for every requirement that has none yet (up to 3 each). */
export async function generatePoints(pid: ID, stage: TestStage) {
  const s0 = await read((s) => s)
  const user = me(s0)
  const p = projectOf(s0, pid)
  ensure(canTest(p, user.id, stage))
  const reqs = s0.requirements.filter((r) => r.projectId === pid)
  const uncovered = coverage(stage, reqs, pointsOf(s0, pid, stage)).filter((c) => !c.points.length && !c.requirement.notTestable).map((c) => c.requirement)
  if (!requirementsFor(stage, reqs).length) fail(`There are no ${stage === 'SQA' ? 'SRS' : 'BRD'} requirements yet. They come from the signed ${stage === 'SQA' ? 'SRS' : 'BRD'}.`)
  if (!uncovered.length) fail(`Every ${stage === 'SQA' ? 'SRS' : 'BRD'} requirement already has testing points (or is Not testable). Add more by hand, or regenerate a point.`)
  return runAiJob({
    agent: 'testpoints',
    title: `Writing ${stage} testing points`,
    projectId: pid,
    byUserId: user.id,
    link: testingLink(pid, stage),
    steps: uncovered.map((r) => `Writing points for ${r.id}`),
    work: async (step) => {
      const out: { reqId: string; texts: string[] }[] = []
      for (const [i, r] of uncovered.entries()) {
        step(i)
        out.push({ reqId: r.id, texts: await draftTestPoints(stage, r) })
      }
      return out
    },
    apply: (s, drafts) => {
      const at = nowIso()
      let n = 0
      for (const d of drafts)
        for (const text of d.texts) {
          s.testPoints.push({ id: newId('pt'), projectId: pid, stage, key: nextKey(s, pid, stage), text, requirementIds: [d.reqId], ai: true, changedAt: at, createdBy: null, createdAt: at, history: [{ by: null, at, text: `Written by AI from ${d.reqId}` }] })
          n += 1
        }
      audit(s, { projectId: pid, actorId: user.id, action: 'Testing points generated', details: `${stage}: ${n} points`, at })
      return `${n} testing point${n === 1 ? '' : 's'} written. They are labelled AI until someone edits them.`
    },
  })
}

/** Add a point by hand, or edit one. Editing a point means its earlier checks no longer count. */
export async function savePoint(pid: ID, stage: TestStage, input: { id?: ID; text: string; requirementIds: string[] }) {
  return act((s, _t, at) => {
    const user = me(s)
    const p = projectOf(s, pid)
    ensure(canTest(p, user.id, stage))
    const text = input.text.replace(/\s+/g, ' ').trim()
    if (!text) fail('Write the testing point.')
    if (input.id) {
      const pt = pointById(s, input.id)
      if (pt.text === text && pt.requirementIds.join() === input.requirementIds.join()) return
      const wordingChanged = pt.text !== text
      Object.assign(pt, { text, requirementIds: input.requirementIds, ai: false, needsReview: false })
      if (wordingChanged) pt.changedAt = at // what is being checked changed: check it again
      pt.history.push({ by: user.id, at, text: wordingChanged ? 'Edited (check it again)' : 'Requirement link changed' })
    } else {
      s.testPoints.push({ id: newId('pt'), projectId: pid, stage, key: nextKey(s, pid, stage), text, requirementIds: input.requirementIds, ai: false, changedAt: at, createdBy: user.id, createdAt: at, history: [{ by: user.id, at, text: 'Added' }] })
    }
  })
}

export async function deletePoint(pointId: ID) {
  return act((s, _t, at) => {
    const user = me(s)
    const pt = pointById(s, pointId)
    const p = projectOf(s, pt.projectId)
    ensure(canTest(p, user.id, pt.stage))
    s.testPoints = s.testPoints.filter((x) => x.id !== pointId)
    s.pointChecks = s.pointChecks.filter((c) => c.pointId !== pointId)
    audit(s, { projectId: p.id, actorId: user.id, action: 'Testing point deleted', details: `${pt.key}: ${pt.text}`, at })
  })
}

/** The AI writes one point again. Its earlier checks no longer count. */
export async function regeneratePoint(pointId: ID) {
  const s0 = await read((s) => s)
  const user = me(s0)
  const pt = pointById(s0, pointId)
  const p = projectOf(s0, pt.projectId)
  ensure(canTest(p, user.id, pt.stage))
  const req = s0.requirements.find((r) => r.projectId === p.id && r.id === pt.requirementIds[0])
  const text = await rewriteTestPoint(pt.stage, req?.text ?? p.name, pt.text, { projectId: p.id })
  return act((s, _t, at) => {
    const x = pointById(s, pointId)
    x.history.push({ by: user.id, at, text: `Regenerated by AI (was: “${x.text}”)` })
    Object.assign(x, { text, ai: true, needsReview: false, changedAt: at })
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

// ─── Versions ───────────────────────────────────────────────────────────

export async function addVersion(pid: ID, input: { version: string; notes: string; link: string }) {
  return act((s, _t, at) => {
    const user = me(s)
    const p = projectOf(s, pid)
    ensure(canAddVersion(p, user.id))
    const label = input.version.trim()
    if (!label) fail('Give the version a number, for example 1.2.')
    if (s.productVersions.some((v) => v.projectId === pid && v.version.toLowerCase() === label.toLowerCase())) fail(`Version ${label} already exists.`)
    const v = { id: newId('pv'), projectId: pid, version: label, notes: input.notes.trim(), link: input.link.trim(), addedBy: user.id, addedAt: at }
    s.productVersions.push(v)
    const ctx = pipelineCtx(s, pid)
    for (const stage of ['SQA', 'UAT'] as TestStage[]) {
      if (!stageOpen(ctx, stage)) continue
      const n = pointsOf(s, pid, stage).length
      notify(s, { to: testersOf(p, stage), type: 'version', title: `Version ${label} is ready for ${stage}`, body: `${p.name}: ${n ? `check all ${n} ${stage} points again on version ${label}.` : 'it is ready to test.'}${v.notes ? ` Notes: ${v.notes}` : ''}`, link: testingLink(pid, stage, `?version=${v.id}`), projectId: pid, at, exclude: user.id })
    }
    audit(s, { projectId: pid, actorId: user.id, action: 'Version added', details: label, at })
  })
}

// ─── Checking ───────────────────────────────────────────────────────────

/** Mark a point PASS or FAIL on a version, with an optional comment. A FAIL tells the developers. */
export async function checkPoint(pointId: ID, versionId: ID, result: CheckResult, comment?: string) {
  return act((s, t, at) => {
    const user = me(s)
    const pt = pointById(s, pointId)
    const p = projectOf(s, pt.projectId)
    const check = ensure(canTest(p, user.id, pt.stage))
    if (!stageOpen(pipelineCtx(s, p.id), pt.stage)) fail(pt.stage === 'SQA' ? 'SQA checks start after the SRS is signed, and stop once the SQA sign-off is approved.' : 'UAT checks start after the SQA sign-off is approved, and stop once the UAT sign-off is approved.')
    const v = s.productVersions.find((x) => x.id === versionId && x.projectId === p.id)
    if (!v) fail('Choose the version you are testing first.')
    const text = comment?.trim() || undefined
    s.pointChecks.push({ id: newId('chk'), projectId: p.id, stage: pt.stage, pointId, versionId, result, comment: text, by: user.id, coveredAs: check.coveredAs, at })
    if (pt.needsReview) {
      pt.needsReview = false
      pt.history.push({ by: user.id, at, text: 'Checked again after its requirement changed' })
    }
    if (result === 'fail') {
      const head = headOf(p, 'TECH')
      const devs = developersOf(p)
      const to = [...devs.map((id) => ({ to: id })), ...(head && !devs.includes(head.userId) ? [headRecipient(p, head.userId, t)] : [])]
      notify(s, { to, type: 'fail', title: `${pt.key} failed on version ${v.version}`, body: `${p.name}: “${pt.text}”${text ? ` — ${text}` : ''}. Fix it in a new version.`, link: testingLink(p.id, pt.stage, `?version=${v.id}`), projectId: p.id, at, exclude: user.id })
    }
    audit(s, { projectId: p.id, actorId: user.id, action: 'Point checked', details: `${pt.key} on ${v.version}: ${result === 'pass' ? 'PASS' : 'FAIL'}${text ? ` (${text})` : ''}${check.coveredAs === 'OWNER' ? ' (Project Owner)' : ''}`, at })
  })
}

// ─── Sign-off report ────────────────────────────────────────────────────

export async function generateReport(pid: ID, stage: TestStage, versionId: ID) {
  const s0 = await read((s) => s)
  const user = me(s0)
  const p = projectOf(s0, pid)
  ensure(canMakeReport(p, user.id, stage, now()))
  const version = s0.productVersions.find((v) => v.id === versionId && v.projectId === pid)
  if (!version) fail('Choose the version to sign off.')
  const reportInput = (s: DemoState) => ({ stage, version, requirements: s.requirements.filter((r) => r.projectId === pid), points: pointsOf(s, pid, stage), checks: s.pointChecks.filter((c) => c.projectId === pid && c.stage === stage) })
  return runAiJob({
    agent: 'signoff',
    title: `Making the ${stage} sign-off report`,
    projectId: pid,
    byUserId: user.id,
    link: testingLink(pid, stage, '?tab=signoff'),
    steps: ['Writing the summary paragraph'],
    work: () => signoffParagraph(stage, reportStats(reportInput(s0)), version.version, { projectId: pid }),
    apply: (s, summary) => {
      const at = nowIso()
      const type = signoffType(stage)
      let doc = s.docs.find((d) => d.projectId === pid && d.type === type)
      if (!doc) {
        doc = { id: `${pid}-${type}`, projectId: pid, type, title: DOC_LABEL[type] }
        s.docs.push(doc)
      }
      const sections = buildReportSections({ ...reportInput(s), versions: versionsOf(s, pid), users: s.users, summary }).map((x) => ({ id: `${doc!.id}:${x.key}`, key: x.key, title: x.title, content: x.content, factKeys: [] }))
      const prev = s.versions.filter((v) => v.docId === doc!.id).sort((a, b) => b.number - a.number)[0]
      const v: DocVersion = { id: newId('ver'), docId: doc.id, projectId: pid, number: (prev?.number ?? 0) + 1, authorId: user.id, message: `Report made for version ${version.version}`, kind: 'report', sections, testedVersionId: version.id, regeneratedSectionIds: [], factSheetVersion: 0, templateVersion: 0, frozen: false, createdAt: at }
      s.versions.push(v)
      doc.currentVersionId = v.id
      doc.outOfSync = undefined
      for (const c of s.chains.filter((x) => x.docId === doc!.id && x.status === 'in_progress')) Object.assign(c, { status: 'cancelled', cancelReason: `Replaced by report v${v.number}`, endedAt: at })
      audit(s, { projectId: pid, actorId: user.id, action: 'Sign-off report made', details: `${stage} v${v.number} (version ${version.version})`, at })
      return 'Report ready. Check the list above it, then send it for approval.'
    },
  })
}

export { chainsOf }
