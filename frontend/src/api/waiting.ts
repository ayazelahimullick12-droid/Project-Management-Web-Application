/**
 * Everything that is waiting on a person, with since when.
 *
 * Used for reminders every 4 working hours (SPEC.md "Notifications"; SPEC_SQA_UAT.md
 * "Notifications") and for the "stalled items" lists on the dashboards.
 */
import type { DemoState, ID, TestStage } from '../types'
import { CHAIN_CONFIG, ROLE_LABEL, currentStep } from '../rules/approval'
import { coverers, headOf, headRecipient } from '../rules/permissions'
import { DOC_LABEL } from '../rules/pipeline'
import { developersOf, latestCheck, sortVersions, stageOpen, testersOf, versionCounts } from '../rules/testing'
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
  ownerLink?: string // where the Project Owner does it, when `link` is the person's own inbox
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
        body: `${p.name}: the ${DOC_LABEL[doc.type]} is waiting for ${step.role === 'PERSON' ? 'you' : `the ${ROLE_LABEL[step.role].toLowerCase()}`} to ${verb}.${CHAIN_CONFIG[doc.type].signs && step.sign ? ' Signing needs your password or an email code.' : ''}`,
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
          ownerLink: `${base}/intake?tab=questions`,
          recipients: [headRecipient(p, uid, now)],
          waitingOn: uid,
          reminders: true,
        })
      }
    }

    // Fact Sheet confirmation
    const confirmed = s.factSheets.some((f) => f.projectId === p.id && f.confirmedBy)
    const sh = headOf(p, 'STAKEHOLDER')
    if (p.intake.confirmRequestedAt && !confirmed) {
      items.push({
        key: `fs-confirm:${p.id}`,
        projectId: p.id,
        type: 'factsheet',
        since: p.intake.confirmRequestedAt,
        title: 'Please confirm the Fact Sheet',
        body: `${p.name}: the Fact Sheet is ready. Confirm it, or comment on what is wrong.`,
        link: `${base}/intake?tab=facts`,
        recipients: sh ? [headRecipient(p, sh.userId, now)] : coverers(p).map((to) => ({ to })),
        waitingOn: sh?.userId ?? coverers(p).at(-1)!,
        reminders: true,
      })
    }

    // Testing: points to check on the newest version, and failed points for the developers to fix
    const mine = <T extends { projectId: ID }>(list: T[]) => list.filter((x) => x.projectId === p.id)
    const ctx = { project: p, docs: mine(s.docs), versions: mine(s.versions), chains: mine(s.chains), factSheets: mine(s.factSheets), rounds: mine(s.rounds) }
    const newest = sortVersions(s.productVersions.filter((v) => v.projectId === p.id)).at(-1)
    for (const stage of ['SQA', 'UAT'] as TestStage[]) {
      if (!newest || !stageOpen(ctx, stage)) continue
      const points = s.testPoints.filter((x) => x.projectId === p.id && x.stage === stage)
      const checks = s.pointChecks.filter((c) => c.projectId === p.id && c.stage === stage)
      const n = versionCounts(points, newest.id, checks)
      const link = `${base}/testing/${stage}?version=${newest.id}`
      const testers = testersOf(p, stage)
      if (n.toCheck && testers.length)
        items.push({
          key: `check:${p.id}:${stage}:${newest.id}`,
          projectId: p.id,
          type: 'tests',
          since: [newest.addedAt, ...points.map((x) => x.changedAt)].sort().at(-1)!,
          title: `Check ${n.toCheck} ${stage} point${n.toCheck > 1 ? 's' : ''} on version ${newest.version}`,
          body: `${p.name}: ${n.toCheck} of ${n.total} ${stage} points still to check on version ${newest.version}.`,
          link,
          recipients: testers.map((to) => ({ to })),
          waitingOn: testers[0],
          reminders: true,
        })
      const devs = developersOf(p)
      const fixers = devs.length ? devs : headOf(p, 'TECH') ? [headOf(p, 'TECH')!.userId] : []
      if (n.fail && fixers.length) {
        const failedAt = points.map((x) => latestCheck(x, newest.id, checks)).filter((c) => c?.result === 'fail').map((c) => c!.at).sort()
        items.push({
          key: `fix:${p.id}:${stage}:${newest.id}`,
          projectId: p.id,
          type: 'fix',
          since: failedAt[0],
          title: `Fix ${n.fail} failed ${stage} point${n.fail > 1 ? 's' : ''} from version ${newest.version}`,
          body: `${p.name}: ${n.fail} ${stage} point${n.fail > 1 ? 's' : ''} failed on version ${newest.version}. Fix them and add a new version.`,
          link,
          recipients: fixers.map((to) => ({ to })),
          waitingOn: fixers[0],
          reminders: true,
        })
      }
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

