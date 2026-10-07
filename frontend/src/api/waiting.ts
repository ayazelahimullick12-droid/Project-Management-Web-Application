/**
 * Everything that is waiting on a person, with since when.
 *
 * Used for reminders every 4 working hours (SPEC.md "Notifications"; SPEC_SQA_UAT.md
 * "Notifications") and for the "stalled items" lists on the dashboards.
 */
import type { DemoState, ID, TestStage } from '../types'
import { CHAIN_CONFIG, ROLE_LABEL, currentStep } from '../rules/approval'
import { headOf, headRecipient } from '../rules/permissions'
import { DOC_LABEL } from '../rules/pipeline'
import { UNRESOLVED } from '../rules/testing'
import type { Recipient } from './effects'

export interface WaitingItem {
  key: string
  projectId: ID
  type: string
  since: string
  title: string
  body: string
  link: string
  recipients: Recipient[]
  waitingOn: ID // the person responsible (the head, even when a deputy covers)
  reminders: boolean
}

export function waitingItems(s: DemoState, now: Date): WaitingItem[] {
  const items: WaitingItem[] = []
  const active = s.projects.filter((p) => p.status === 'active' && !p.finished)
  for (const p of active) {
    const base = `/projects/${p.id}`

    // Approvals and signatures
    for (const ch of s.chains.filter((c) => c.projectId === p.id && c.status === 'in_progress')) {
      const step = currentStep(ch)
      const doc = s.docs.find((d) => d.id === ch.docId)
      const v = s.versions.find((x) => x.id === ch.versionId)
      if (!step || !doc) continue
      const verb = step.sign ? 'approve and sign' : 'approve'
      items.push({
        key: `chain:${ch.id}:${step.role}`,
        projectId: p.id,
        type: 'approval',
        since: step.pendingSince ?? ch.startedAt,
        title: `Your turn to ${verb}: ${DOC_LABEL[doc.type]} v${v?.number ?? '?'}`,
        body: `${p.name}: the ${DOC_LABEL[doc.type]} is waiting for the ${ROLE_LABEL[step.role].toLowerCase()} to ${verb}.${CHAIN_CONFIG[doc.type].signs && step.sign ? ' Signing needs your password or an email code.' : ''}`,
        link: doc.type.endsWith('SIGNOFF') ? `${base}/testing/${doc.type === 'SQA_SIGNOFF' ? 'SQA' : 'UAT'}?tab=signoff` : `${base}/docs/${doc.type}`,
        recipients: [headRecipient(p, step.assigneeId, now)],
        waitingOn: step.assigneeId,
        reminders: true,
      })
    }

    // Q/A questions
    const openRounds = new Set(s.rounds.filter((r) => r.projectId === p.id && r.status === 'open').map((r) => r.id))
    for (const q of s.questions.filter((q) => q.projectId === p.id && !q.answeredAt && openRounds.has(q.roundId))) {
      for (const uid of q.assigneeIds) {
        items.push({
          key: `q:${q.id}:${uid}`,
          projectId: p.id,
          type: 'question',
          since: q.createdAt,
          title: 'A Q/A question is waiting for your answer',
          body: `${p.name}: ${q.text}`,
          link: `/inbox/questions`,
          recipients: [headRecipient(p, uid, now)],
          waitingOn: uid,
          reminders: true,
        })
      }
    }

    // Fact Sheet confirmation
    const confirmed = s.factSheets.some((f) => f.projectId === p.id && f.confirmedBy)
    const sh = headOf(p, 'STAKEHOLDER')
    if (p.intake.confirmRequestedAt && !confirmed && sh) {
      items.push({
        key: `fs-confirm:${p.id}`,
        projectId: p.id,
        type: 'factsheet',
        since: p.intake.confirmRequestedAt,
        title: 'Please confirm the Fact Sheet',
        body: `${p.name}: the Fact Sheet is ready. Confirm it, or comment on what is wrong.`,
        link: `${base}/intake?tab=facts`,
        recipients: [headRecipient(p, sh.userId, now)],
        waitingOn: sh.userId,
        reminders: true,
      })
    }

    // Testing: assigned tests, untriaged defects, Critical fixes, retests, list confirmations
    const runsById = new Map(s.testRuns.filter((r) => r.projectId === p.id).map((r) => [r.id, r]))
    const pendingByRunUser = new Map<string, { runId: ID; userId: ID; count: number }>()
    for (const e of s.executions.filter((e) => e.projectId === p.id && e.result === 'not_run')) {
      const k = `${e.runId}:${e.assigneeId}`
      const cur = pendingByRunUser.get(k) ?? { runId: e.runId, userId: e.assigneeId, count: 0 }
      cur.count += 1
      pendingByRunUser.set(k, cur)
    }
    for (const { runId, userId, count } of pendingByRunUser.values()) {
      const run = runsById.get(runId)
      if (!run) continue
      items.push({
        key: `run:${runId}:${userId}`,
        projectId: p.id,
        type: 'tests',
        since: run.createdAt,
        title: `${count} test case${count > 1 ? 's' : ''} assigned to you`,
        body: `${p.name}: ${run.name} (${run.stage}).`,
        link: `/inbox/tests`,
        recipients: [{ to: userId }],
        waitingOn: userId,
        reminders: true,
      })
    }
    const triagers = [headOf(p, 'PM')?.userId, headOf(p, 'TECH')?.userId].filter(Boolean) as ID[]
    for (const d of s.defects.filter((d) => d.projectId === p.id)) {
      const link = `${base}/defects/${d.id}`
      if (d.status === 'New')
        items.push({ key: `def-new:${d.id}`, projectId: p.id, type: 'defect', since: d.createdAt, title: `New defect to triage: ${d.key}`, body: `${p.name}: ${d.title} (${d.severity}).`, link, recipients: triagers.map((t) => headRecipient(p, t, now)), waitingOn: triagers[0], reminders: true })
      if (d.severity === 'Critical' && d.assigneeId && ['Open', 'In progress', 'Reopened'].includes(d.status))
        items.push({ key: `def-crit:${d.id}`, projectId: p.id, type: 'defect', since: d.updatedAt, title: `Critical defect assigned to you: ${d.key}`, body: `${p.name}: ${d.title}.`, link, recipients: [{ to: d.assigneeId }], waitingOn: d.assigneeId, reminders: true })
      if (d.status === 'Ready for retest')
        items.push({ key: `def-retest:${d.id}:${d.fixedInBuildId}`, projectId: p.id, type: 'retest', since: d.updatedAt, title: `Ready for your retest: ${d.key}`, body: `${p.name}: ${d.title}.`, link, recipients: [{ to: d.reporterId }], waitingOn: d.reporterId, reminders: true })
    }
    for (const stage of ['SQA', 'UAT'] as TestStage[]) {
      const tests = s.testCases.filter((t) => t.projectId === p.id && t.stage === stage)
      const confirmedList = s.testConfirmations.some((c) => c.projectId === p.id && c.stage === stage)
      const head = headOf(p, stage === 'SQA' ? 'TECH' : 'STAKEHOLDER')
      if (tests.length && !confirmedList && head)
        items.push({
          key: `confirm:${p.id}:${stage}`,
          projectId: p.id,
          type: 'test-list',
          since: tests.map((t) => t.createdAt).sort()[0],
          title: `Please confirm the ${stage} test case list`,
          body: `${p.name}: ${tests.length} ${stage} test cases are ready for your confirmation.`,
          link: `${base}/testing/${stage}?tab=cases`,
          recipients: [headRecipient(p, head.userId, now)],
          waitingOn: head.userId,
          reminders: true,
        })
    }

    // Decisions and Fact Sheet updates waiting for the PM (notified once; no reminders in the spec)
    const pm = headOf(p, 'PM')
    if (pm) {
      for (const d of s.decisions.filter((d) => d.projectId === p.id && d.status === 'pending'))
        items.push({ key: `dec:${d.id}`, projectId: p.id, type: 'decision', since: d.createdAt, title: 'A decision is waiting for your confirmation', body: `${p.name}: “${d.text}”`, link: `${base}/decisions`, recipients: [headRecipient(p, pm.userId, now)], waitingOn: pm.userId, reminders: false })
      for (const f of s.factUpdates.filter((f) => f.projectId === p.id && f.status === 'pending'))
        items.push({ key: `fu:${f.id}`, projectId: p.id, type: 'fact-update', since: f.createdAt, title: 'A Fact Sheet update was proposed from an edit', body: `${p.name}: ${f.factLabel} may have changed.`, link: `${base}/changes`, recipients: p.members.filter((m) => m.team === 'PM').map((m) => ({ to: m.userId })), waitingOn: pm.userId, reminders: false })
    }
  }
  return items.sort((a, b) => a.since.localeCompare(b.since))
}

export function isUnresolvedStatus(status: string) {
  return (UNRESOLVED as string[]).includes(status)
}
