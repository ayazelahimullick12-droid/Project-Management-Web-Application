/**
 * "Grill me": the AI questions the PM team, one question at a time, about the weakest, vaguest or
 * riskiest part of a project's plan: the Fact Sheet, or a document (Proposal & Charter, BRD, SRS).
 *
 * - The questions are not stored: the session lives on the screen. Each answer is recorded in the
 *   activity log ("Grill me").
 * - An answer about a fact can improve the Fact Sheet:
 *   · Fact Sheet not confirmed yet → the fact is updated at once;
 *   · on a document → it becomes a proposed Fact Sheet update on that document, which the PM
 *     accepts or rejects on Changes & decisions (scope, budget or timeline → a change request);
 *   · Fact Sheet already confirmed, grilling the Fact Sheet → recorded only (changes to a
 *     confirmed Fact Sheet go through a document edit or a change request).
 */
import type { DocType, Fact, ID } from '../types'
import { newId } from '../demo/ids'
import { grillQuestion } from '../ai/agents'
import { can } from '../rules/permissions'
import { DOC_LABEL, factSheetConfirmed } from '../rules/pipeline'
import { markdownToPlain } from '../rules/text'
import { act, ensure, fail, me, pipelineCtx, projectOf, read } from './core'
import { audit, notify, teamMembers } from './effects'

export type GrillTarget = 'facts' | Extract<DocType, 'PROPOSAL' | 'BRD' | 'SRS'>

/** At most this many questions in one session, so it ends. */
export const GRILL_LIMIT = 8

const targetName = (t: GrillTarget) => (t === 'facts' ? 'the Fact Sheet' : `the ${DOC_LABEL[t]}`)

/** What the panel needs before it starts: whether answers can change the Fact Sheet, and how. */
export async function grillInfo(pid: ID, target: GrillTarget) {
  return read((s) => {
    const user = me(s)
    const p = projectOf(s, pid)
    const check = can.pmTeam(p, user.id, 'use Grill me')
    const confirmed = factSheetConfirmed(pipelineCtx(s, pid))
    const doc = target === 'facts' ? undefined : s.docs.find((d) => d.projectId === pid && d.type === target)
    const saves: 'fact' | 'proposal' | 'none' = target === 'facts' ? (confirmed ? 'none' : 'fact') : doc?.currentVersionId ? 'proposal' : 'none'
    return { allowed: check, saves, targetName: targetName(target), projectName: p.name, hasDocument: target === 'facts' || !!doc?.currentVersionId }
  })
}

/** The next question. \`asked\` is what was asked (and answered) so far in this session. */
export async function nextGrillQuestion(pid: ID, target: GrillTarget, asked: { q: string; a: string }[]) {
  const s = await read((x) => x)
  const user = me(s)
  const p = projectOf(s, pid)
  ensure(can.pmTeam(p, user.id, 'use Grill me'))
  if (asked.length >= GRILL_LIMIT) fail(`That's ${GRILL_LIMIT} questions: finish this round and start a new one if you want more.`)
  let docText = ''
  if (target !== 'facts') {
    const doc = s.docs.find((d) => d.projectId === pid && d.type === target)
    const version = s.versions.find((v) => v.id === doc?.currentVersionId)
    if (!version) fail(`${DOC_LABEL[target]} is not written yet.`)
    // Short on purpose: a small model reads a little well, and a lot badly.
    docText = version.sections.map((x) => `${x.title}: ${markdownToPlain(x.content)}`).join('\n').slice(0, 1800)
  }
  const keys = s.factCatalog.map((d) => ({ key: d.key, label: d.label }))
  const { question, factKey } = await grillQuestion(p, docText, asked, keys)
  const fact = p.facts.find((x) => x.key === factKey)
  const def = s.factCatalog.find((d) => d.key === factKey)
  return { question, factKey, factLabel: fact?.label ?? def?.label, factValue: fact?.value || undefined }
}

/**
 * Saves an answer. With \`save\` and a fact, it also updates the Fact Sheet (or proposes the update,
 * on a document). An empty answer means "I don't know": recorded as an open question.
 */
export async function saveGrillAnswer(pid: ID, target: GrillTarget, input: { question: string; answer: string; factKey?: string; save: boolean }) {
  return act((s, _t, at) => {
    const user = me(s)
    const p = projectOf(s, pid)
    ensure(can.pmTeam(p, user.id, 'use Grill me'))
    const answer = input.answer.trim()
    const def = s.factCatalog.find((d) => d.key === input.factKey)
    const existing = p.facts.find((x) => x.key === input.factKey)
    let outcome = answer ? 'recorded' : 'not known yet'

    if (answer && input.save && input.factKey) {
      if (target === 'facts') {
        if (factSheetConfirmed(pipelineCtx(s, pid))) fail('The Fact Sheet is confirmed. Change it through a document edit or a change request.')
        const fact: Fact = { key: input.factKey, label: def?.label ?? existing?.label ?? input.factKey, category: def?.category ?? existing?.category ?? 'other', value: answer, status: 'filled', source: { type: 'manual', label: `Grill me, answered by ${user.name}` }, credit: existing?.credit }
        p.facts = existing ? p.facts.map((x) => (x.key === input.factKey ? fact : x)) : [...p.facts, fact]
        outcome = `saved to the Fact Sheet (${fact.label})`
      } else {
        const doc = s.docs.find((d) => d.projectId === pid && d.type === target)
        if (!doc?.currentVersionId) fail(`${DOC_LABEL[target]} is not written yet.`)
        const label = def?.label ?? existing?.label ?? input.factKey
        s.factUpdates.push({ id: newId('fu'), projectId: pid, docId: doc.id, versionId: doc.currentVersionId, factKey: input.factKey, factLabel: label, oldValue: existing?.value ?? '', newValue: answer, excerpt: `Grill me: “${input.question}”`, status: 'pending', createdAt: at })
        notify(s, { to: teamMembers(p, 'PM'), type: 'fact-update', title: 'A Fact Sheet update was proposed from Grill me', body: `${p.name}: “${label}” may now be “${answer}”.`, link: `/projects/${pid}/changes`, projectId: pid, at, exclude: user.id, email: false })
        outcome = `proposed as a Fact Sheet update (${label})`
      }
    }
    audit(s, { projectId: pid, actorId: user.id, action: 'Grill me', details: `${targetName(target)}: ${input.question} → ${answer || 'not known yet'}`, at })
    return outcome
  })
}
