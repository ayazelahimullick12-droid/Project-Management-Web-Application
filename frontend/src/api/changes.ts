/**
 * Change requests (scope changes) and the PM's decision queue.
 *
 * Spec: SPEC.md "Change scope (change request)", "Restarting the pipeline" and
 * "Chat and meetings" → decisions (the PM confirms each one into the Fact Sheet, or starts a
 * change request when it changes scope).
 */
import type { DemoState, DocVersion, ID, Project } from '../types'
import { MAIN_DOCS } from '../types'
import { now, nowIso } from '../demo/clock'
import { newId } from '../demo/ids'
import { runJob } from '../demo/jobs'
import { updateForFacts } from '../demo/ai/agents'
import { actAsHead, can, headOf, TEAM_LABEL } from '../rules/permissions'
import { DOC_LABEL, PIPELINE } from '../rules/pipeline'
import { routeTeam } from '../rules/qa'
import { act, ensure, fail, me, nameOf, projectOf, read } from './core'
import { audit, notify, teamMembers } from './effects'
import { afterNewVersion } from './documents'

const STATUS_LABEL = {
  questions: 'Asking about what changed',
  impact_review: 'Impact analysis',
  regenerating: 'Reviewing regenerated sections',
  reapproval: 'Re-approval in order',
  closed: 'Closed',
} as const

export async function listChanges(pid: ID) {
  return read((s, t) => {
    const user = me(s)
    const p = projectOf(s, pid)
    ensure(can.view(p, user))
    return {
      project: p,
      pm: actAsHead(p, 'PM', user.id, t).ok,
      pmTeam: p.members.some((m) => m.userId === user.id && m.team === 'PM'),
      catalog: s.factCatalog,
      changeRequests: s.changeRequests
        .filter((c) => c.projectId === pid)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((c) => ({
          ...c,
          statusLabel: STATUS_LABEL[c.status],
          createdByName: nameOf(s, c.createdBy),
          questions: s.questions.filter((q) => q.roundId === c.roundId).map((q) => ({ ...q, teamLabel: TEAM_LABEL[q.team], answeredByName: q.answeredBy ? nameOf(s, q.answeredBy) : undefined })),
          impactDocs: c.impact.map((i) => {
            const v = s.versions.find((x) => x.id === s.docs.find((d) => d.id === i.docId)?.currentVersionId)
            return { ...i, label: DOC_LABEL[i.docType], sections: v?.sections.filter((x) => i.sectionIds.includes(x.id)).map((x) => x.title) ?? [] }
          }),
        })),
      factUpdates: s.factUpdates
        .filter((f) => f.projectId === pid)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((f) => ({ ...f, docLabel: DOC_LABEL[s.docs.find((d) => d.id === f.docId)?.type ?? 'PROPOSAL'], versionNumber: s.versions.find((v) => v.id === f.versionId)?.number, decidedByName: f.decidedBy ? nameOf(s, f.decidedBy) : undefined })),
    }
  })
}

/** Starts a change request: the Q/A agent asks only about what changed (routed as usual). */
export function createChangeRequestIn(s: DemoState, p: Project, input: { title: string; description: string; trigger: 'edit' | 'decision' | 'defect'; sourceLabel: string; factKeys: string[] }, userId: ID, at: string): ID {
  const id = newId('cr')
  const roundId = newId('round')
  s.changeRequests.push({ id, projectId: p.id, title: input.title, description: input.description, trigger: input.trigger, sourceLabel: input.sourceLabel, status: 'questions', roundId, changedFactKeys: input.factKeys, impact: [], createdAt: at, createdBy: userId })
  s.rounds.push({ id: roundId, projectId: p.id, purpose: 'change_request', number: 1, status: 'open', startedAt: at, changeRequestId: id })
  const keys = input.factKeys.length ? input.factKeys : ['scope_in']
  for (const key of keys) {
    const def = s.factCatalog.find((d) => d.key === key)
    const team = def ? routeTeam(def) : 'STAKEHOLDER'
    const current = p.facts.find((f) => f.key === key)?.value
    s.questions.push({
      id: newId('q'), projectId: p.id, roundId, factKey: key, team,
      text: `Change request “${input.title}”: what is the new ${def?.label.toLowerCase() ?? key}?${current ? ` (Today: ${current})` : ''}`,
      assigneeIds: p.members.filter((m) => m.team === team && !m.isSqa).map((m) => m.userId), createdAt: at, sampleAnswer: input.description,
    })
    notify(s, { to: p.members.filter((m) => m.team === team && !m.isSqa).map((m) => m.userId), type: 'question', title: 'A change-request question is assigned to you', body: `${p.name}: ${input.title}`, link: '/inbox/questions', projectId: p.id, at })
  }
  audit(s, { projectId: p.id, actorId: userId, action: 'Change request', details: `${input.title} (${input.sourceLabel})`, at })
  return id
}

export async function createChangeRequest(pid: ID, input: { title: string; description: string; factKeys: string[] }) {
  return act((s, t, at) => {
    const user = me(s)
    const p = projectOf(s, pid)
    ensure(can.change(p))
    ensure(actAsHead(p, 'PM', user.id, t))
    if (!input.title.trim()) fail('Give the change request a title.')
    return createChangeRequestIn(s, p, { ...input, trigger: 'edit', sourceLabel: 'Started by the PM' }, user.id, at)
  })
}

/** After the questions are answered: new Fact Sheet version, then the impact analysis. */
export async function runImpactAnalysis(crId: ID) {
  const s0 = await read((s) => s)
  const user = me(s0)
  const cr = s0.changeRequests.find((c) => c.id === crId)
  if (!cr) fail('Change request not found.')
  const p = projectOf(s0, cr.projectId)
  ensure(actAsHead(p, 'PM', user.id, now()))
  const unanswered = s0.questions.filter((q) => q.roundId === cr.roundId && !q.answeredAt)
  if (unanswered.length) fail(`${unanswered.length} question${unanswered.length > 1 ? 's are' : ' is'} still unanswered.`)
  return runJob({
    agent: 'impact',
    title: `Impact analysis: ${cr.title}`,
    projectId: p.id,
    byUserId: user.id,
    link: `/projects/${p.id}/changes`,
    promptTokens: 2000,
    steps: ['Saving the updated Fact Sheet as a new version', 'Finding sections written from the changed facts', 'Listing affected documents and sections'],
    apply: (s) => {
      const at = nowIso()
      const c = s.changeRequests.find((x) => x.id === crId)!
      const proj = projectOf(s, c.projectId)
      const round = s.rounds.find((r) => r.id === c.roundId)
      if (round && round.status === 'open') Object.assign(round, { status: 'closed', closedAt: at })
      const n = s.factSheets.filter((f) => f.projectId === proj.id).length + 1
      s.factSheets.push({ id: newId('fs'), projectId: proj.id, number: n, facts: structuredClone(proj.facts), createdAt: at, createdBy: user.id, note: `Change request: ${c.title}` })
      c.impact = []
      for (const type of MAIN_DOCS) {
        const doc = s.docs.find((d) => d.projectId === proj.id && d.type === type && d.currentVersionId)
        if (!doc) continue
        const v = s.versions.find((x) => x.id === doc.currentVersionId)!
        const ids = v.sections.filter((x) => x.factKeys.some((k) => c.changedFactKeys.includes(k))).map((x) => x.id)
        if (ids.length) c.impact.push({ docId: doc.id, docType: type, sectionIds: ids, reason: `Written from ${c.changedFactKeys.map((k) => s.factCatalog.find((d) => d.key === k)?.label ?? k).join(', ')}` })
      }
      c.status = 'impact_review'
      return c.impact.length ? `${c.impact.length} document${c.impact.length > 1 ? 's' : ''} affected. Unaffected documents keep their approvals.` : 'No document is affected.'
    },
  })
}

/** The AI regenerates the affected sections; the PM team reviews each diff. */
export async function regenerateAffected(crId: ID) {
  const s0 = await read((s) => s)
  const user = me(s0)
  const cr = s0.changeRequests.find((c) => c.id === crId)!
  const p = projectOf(s0, cr.projectId)
  ensure(actAsHead(p, 'PM', user.id, now()))
  if (!cr.impact.length) fail('Run the impact analysis first.')
  const fsList = s0.factSheets.filter((f) => f.projectId === p.id).sort((a, b) => a.number - b.number)
  const before = fsList.at(-2)?.facts ?? []
  const changes = cr.changedFactKeys.map((k) => ({ label: s0.factCatalog.find((d) => d.key === k)?.label ?? k, oldValue: before.find((f) => f.key === k)?.value ?? '', newValue: p.facts.find((f) => f.key === k)?.value ?? '' }))
  const count = cr.impact.reduce((n, i) => n + i.sectionIds.length, 0)
  return runJob({
    agent: 'docgen',
    title: `Regenerating ${count} affected section${count > 1 ? 's' : ''}`,
    projectId: p.id,
    byUserId: user.id,
    link: `/projects/${p.id}/changes`,
    promptTokens: 900 * count,
    steps: cr.impact.map((i) => `Regenerating ${i.sectionIds.length} section${i.sectionIds.length > 1 ? 's' : ''} of the ${DOC_LABEL[i.docType]}`),
    apply: (s) => {
      const c = s.changeRequests.find((x) => x.id === crId)!
      c.proposals = []
      for (const i of c.impact) {
        const v = s.versions.find((x) => x.id === s.docs.find((d) => d.id === i.docId)?.currentVersionId)!
        for (const id of i.sectionIds) {
          const sec = v.sections.find((x) => x.id === id)!
          c.proposals.push({ docId: i.docId, sectionId: id, title: `${DOC_LABEL[i.docType]} · ${sec.title}`, before: sec.content, after: updateForFacts(sec, changes), status: 'pending' })
        }
      }
      c.status = 'regenerating'
      return 'Review each diff and accept or reject it.'
    },
  })
}

export async function decideCrProposal(crId: ID, sectionId: ID, accept: boolean) {
  return act((s) => {
    const user = me(s)
    const c = s.changeRequests.find((x) => x.id === crId)!
    ensure(can.pmTeam(projectOf(s, c.projectId), user.id, 'review regenerated sections'))
    const prop = c.proposals?.find((x) => x.sectionId === sectionId)
    if (!prop) fail('Not found.')
    prop.status = accept ? 'accepted' : 'rejected'
  })
}

/** Accepted sections become new versions; the pipeline restarts from the Proposal. */
export async function applyChangeRequest(crId: ID) {
  return act((s, t, at) => {
    const user = me(s)
    const c = s.changeRequests.find((x) => x.id === crId)!
    const p = projectOf(s, c.projectId)
    ensure(can.pmTeam(p, user.id, 'apply change requests'))
    if (c.proposals?.some((x) => x.status === 'pending')) fail('Accept or reject every regenerated section first.')
    if (s.locks.some((l) => c.impact.some((i) => i.docId === l.docId))) fail('Someone is editing an affected document. Wait until they finish.')
    for (const i of c.impact) {
      const accepted = (c.proposals ?? []).filter((x) => x.docId === i.docId && x.status === 'accepted')
      if (!accepted.length) continue
      const doc = s.docs.find((d) => d.id === i.docId)!
      const prev = s.versions.find((x) => x.id === doc.currentVersionId)!
      const v: DocVersion = {
        ...structuredClone(prev), id: newId('ver'), number: prev.number + 1, authorId: user.id, message: `Change request: ${c.title}`, kind: 'change_request',
        sections: prev.sections.map((x) => ({ ...x, content: accepted.find((a) => a.sectionId === x.id)?.after ?? x.content })), regeneratedSectionIds: accepted.map((a) => a.sectionId),
        frozen: false, createdAt: at, minorCorrection: undefined, scopeCheck: { flagged: true, sectionTitles: [], reason: 'Part of a change request.', decision: 'scope_change', decidedBy: user.id, decidedAt: at },
        factSheetVersion: s.factSheets.filter((f) => f.projectId === p.id).length,
      }
      s.versions.push(v)
      doc.currentVersionId = v.id
      s.drafts = s.drafts.filter((d) => d.docId !== doc.id)
      afterNewVersion(s, doc, prev, v, user, at, t, false)
    }
    // Restart from the Proposal: it must be re-approved (unchanged if it needs no edit), then every later document in order.
    for (const type of PIPELINE) {
      const doc = s.docs.find((d) => d.projectId === p.id && d.type === type && d.currentVersionId)
      if (doc) doc.outOfSync = { since: at, cause: `Change request: ${c.title}`, suggestedSectionIds: [] }
    }
    c.status = 'reapproval'
    notify(s, { to: teamMembers(p, 'PM'), type: 'out-of-sync', title: 'Pipeline restarted from the Proposal', body: `${p.name}: change request “${c.title}” applied. Re-approve the Proposal (unchanged if it needs no edit), then each later document in order.`, link: `/projects/${p.id}/docs/PROPOSAL`, projectId: p.id, at })
    audit(s, { projectId: p.id, actorId: user.id, action: 'Change request applied', details: `${c.title}: pipeline restarts from the Proposal`, at })
  })
}

// ─── Decision queue ─────────────────────────────────────────────────────

export async function listDecisions(pid: ID) {
  return read((s, t) => {
    const user = me(s)
    const p = projectOf(s, pid)
    ensure(can.view(p, user))
    return {
      project: p,
      pm: actAsHead(p, 'PM', user.id, t).ok,
      catalog: s.factCatalog,
      facts: p.facts,
      decisions: s.decisions
        .filter((d) => d.projectId === pid)
        .sort((a, b) => Number(a.status !== 'pending') - Number(b.status !== 'pending') || b.createdAt.localeCompare(a.createdAt))
        .map((d) => ({ ...d, markedByName: d.markedBy ? nameOf(s, d.markedBy) : undefined, decidedByName: d.decidedBy ? nameOf(s, d.decidedBy) : undefined, chatTitle: s.chats.find((c) => c.id === d.chatId)?.title ?? 'Chat' })),
    }
  })
}

export async function confirmDecision(id: ID, outcome: { kind: 'fact'; factKey: string; value: string } | { kind: 'change_request' }) {
  return act((s, t, at) => {
    const user = me(s)
    const d = s.decisions.find((x) => x.id === id)
    if (!d || d.status !== 'pending') fail('Already decided.')
    const p = projectOf(s, d.projectId)
    const pm = ensure(actAsHead(p, 'PM', user.id, t))
    Object.assign(d, { status: 'confirmed', decidedBy: user.id, decidedAt: at })
    if (outcome.kind === 'fact') {
      if (!outcome.value.trim()) fail('Write the value for the Fact Sheet.')
      const def = s.factCatalog.find((x) => x.key === outcome.factKey)
      const existing = p.facts.find((f) => f.key === outcome.factKey)
      const fact = { key: outcome.factKey, label: def?.label ?? existing?.label ?? outcome.factKey, category: def?.category ?? existing?.category ?? 'other', value: outcome.value.trim(), status: 'filled' as const, source: { type: 'decision' as const, ref: d.id, label: d.source === 'transcript' ? 'Meeting decision (transcript)' : 'Chat decision' } }
      p.facts = existing ? p.facts.map((f) => (f.key === fact.key ? fact : f)) : [...p.facts, fact]
      const n = s.factSheets.filter((f) => f.projectId === p.id).length + 1
      s.factSheets.push({ id: newId('fs'), projectId: p.id, number: n, facts: structuredClone(p.facts), createdAt: at, createdBy: user.id, note: `Decision confirmed: ${d.text.slice(0, 60)}` })
      Object.assign(d, { outcome: 'fact', factKey: outcome.factKey })
    } else {
      const crId = createChangeRequestIn(s, p, { title: d.text.slice(0, 70), description: d.text, trigger: 'decision', sourceLabel: d.source === 'transcript' ? 'Meeting decision' : 'Chat decision', factKeys: d.factKey ? [d.factKey] : [] }, user.id, at)
      Object.assign(d, { outcome: 'change_request', changeRequestId: crId })
    }
    audit(s, { projectId: p.id, actorId: user.id, actingFor: pm.actingFor, action: 'Decision confirmed', details: `${d.text.slice(0, 80)} → ${outcome.kind === 'fact' ? 'Fact Sheet' : 'change request'}`, at })
  })
}

export async function dismissDecision(id: ID) {
  return act((s, t, at) => {
    const user = me(s)
    const d = s.decisions.find((x) => x.id === id)
    if (!d || d.status !== 'pending') fail('Already decided.')
    const p = projectOf(s, d.projectId)
    ensure(actAsHead(p, 'PM', user.id, t))
    Object.assign(d, { status: 'dismissed', decidedBy: user.id, decidedAt: at })
    audit(s, { projectId: p.id, actorId: user.id, action: 'Decision dismissed', details: d.text.slice(0, 80), at })
  })
}

export { headOf }
