/**
 * Intake: uploads, the Q/A agent, the Fact Sheet and the RAG agent.
 *
 * Spec: SPEC.md "Q/A agent and the Project Fact Sheet" and "RAG agent: reuse from past projects".
 */
import type { DemoState, Fact, FactDef, FactSource, ID, Project, Question, RoundPurpose } from '../types'
import { now, nowIso } from '../demo/clock'
import { runAiJob, runJob } from '../demo/jobs'
import { newId } from '../demo/ids'
import { questionFor, readUpload } from '../demo/ai/agents'
import { extractFacts, findSimilarProjects, writeQuestions, type PastProject } from '../ai/agents'
import { actAsHead, can, headOf, inTeam, membershipsOf, TEAM_LABEL } from '../rules/permissions'
import { FACT_CONFIRMATION_NEEDS, missingPeople, peopleCheck, questionNeeds } from '../rules/people'
import { factSheetConfirmed, isComplete, roundClosed } from '../rules/pipeline'
import { atRoundLimit, conflicts, factFromAnswer, factRows, mergeValue, missingFor, requiredBy, roundsOf, routeTeam, settleConflict } from '../rules/qa'
import { act, ApiError, ensure, fail, me, nameOf, pipelineCtx, projectOf, read } from './core'
import { audit, notify, teamMembers } from './effects'

export type ExtraRound = 'brd_business' | 'srs_technical'
export const ROUND_LABEL: Record<RoundPurpose, string> = {
  intake: 'Intake',
  brd_business: 'Business processes (before the BRD)',
  srs_technical: 'Technical (before the SRS)',
  change_request: 'Change request',
}

function isPmTeam(p: Project, userId: ID) {
  return inTeam(p, userId, 'PM')
}

export async function getIntake(pid: ID) {
  return read((s, t) => {
    const user = me(s)
    const p = projectOf(s, pid)
    ensure(can.view(p, user))
    const ctx = pipelineCtx(s, pid)
    const pmTeam = isPmTeam(p, user.id)
    const pm = actAsHead(p, 'PM', user.id, t)
    const shHead = actAsHead(p, 'STAKEHOLDER', user.id, t)
    const rows = factRows(p.facts, s.factCatalog).map((f) => ({ ...f, requiredBy: requiredBy(s.templates, f.key), round: s.factCatalog.find((d) => d.key === f.key)?.round }))
    const rounds = s.rounds.filter((r) => r.projectId === pid).sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    const questions = s.questions
      .filter((q) => q.projectId === pid)
      .map((q) => ({ ...q, teamLabel: TEAM_LABEL[q.team], assigneeNames: q.assigneeIds.map((id) => nameOf(s, id)), answeredByName: q.answeredBy ? nameOf(s, q.answeredBy) : undefined, mine: q.assigneeIds.includes(user.id) || q.assigneeIds.some((id) => membershipsOf(p, id).some((m) => m.isHead && actAsHead(p, m.team, user.id, t).actingFor === id)) }))
    const run = p.intake.ragRunId ? s.ragRuns.find((r) => r.id === p.intake.ragRunId) : undefined
    const rag = pmTeam && run
      ? {
          run,
          matches: run.matches.map((m) => {
            const past = projectOf(s, m.projectId)
            return {
              ...m,
              project: { id: past.id, name: past.name, year: past.finishedYear ?? past.legacy?.year, summary: past.summary ?? past.description, department: past.department ?? past.legacy?.department },
              members: past.members.map((mm) => {
                const u = s.users.find((x) => x.id === mm.userId)
                return { userId: mm.userId, name: u?.name ?? mm.userId, role: mm.isHead ? `${TEAM_LABEL[mm.team]} head` : TEAM_LABEL[mm.team], deactivated: !!u?.deactivated, isPm: mm.team === 'PM' && mm.isHead }
              }),
              docs: s.docs.filter((d) => d.projectId === past.id).map((d) => ({ type: d.type, id: d.id })),
            }
          }),
          suggestions: s.ragSuggestions.filter((x) => x.runId === run.id).map((x) => ({ ...x, sourceName: projectOf(s, x.sourceProjectId).name, sourcePm: nameOf(s, headOf(projectOf(s, x.sourceProjectId), 'PM')?.userId) })),
        }
      : undefined
    const open = rounds.filter((r) => r.status === 'open')
    const intakeRounds = roundsOf(s.rounds, pid, 'intake')
    const charterSigned = isComplete(ctx, 'PROPOSAL') // the Proposal & Charter, signed by the sponsor head
    const brdSigned = isComplete(ctx, 'BRD')
    const nextExtra: ExtraRound | undefined = charterSigned && !roundClosed(ctx, 'brd_business') ? 'brd_business' : brdSigned && !roundClosed(ctx, 'srs_technical') ? 'srs_technical' : undefined
    return {
      project: p,
      catalog: s.factCatalog,
      uploads: s.uploads.filter((u) => u.projectId === pid && u.context === 'intake').map((u) => ({ ...u, byName: nameOf(s, u.uploadedBy) })),
      descriptionByName: p.intake.descriptionBy ? nameOf(s, p.intake.descriptionBy) : undefined,
      facts: rows,
      conflicts: conflicts(p.facts),
      factSheets: s.factSheets.filter((f) => f.projectId === pid).sort((a, b) => b.number - a.number).map((f) => ({ ...f, createdByName: nameOf(s, f.createdBy), confirmedByName: f.confirmedBy ? nameOf(s, f.confirmedBy) : undefined })),
      rounds,
      questions,
      rag,
      intakeMissing: missingFor(p.facts, s.factCatalog, 'intake').length,
      roundLimit: s.settings.qaRoundLimit,
      atLimit: atRoundLimit(s.rounds, pid, 'intake', s.settings.qaRoundLimit),
      intakeRoundCount: intakeRounds.length,
      openRounds: open,
      nextExtra,
      feedback: (p.intake.feedback ?? []).map((f) => ({ ...f, byName: nameOf(s, f.by) })),
      confirmed: factSheetConfirmed(ctx),
      // Who is missing before the next questions or the confirmation can go out (shown with "Add").
      missingForQuestions: missingPeople(p, questionNeeds([...new Set(missingFor(p.facts, s.factCatalog, nextExtra ?? 'intake').map(routeTeam))])),
      missingForConfirmation: missingPeople(p, FACT_CONFIRMATION_NEEDS),
      perms: {
        canAddPeople: can.addPeople(p, user.id, t).ok,
        editDescription: can.change(p).ok && (inTeam(p, user.id, 'STAKEHOLDER') || pmTeam),
        upload: can.memberOrOwner(p, user.id).ok,
        pmTeam,
        pm: pm.ok,
        pmReason: pm.reason,
        confirm: shHead.ok,
        confirmReason: shHead.reason,
        actingFor: shHead.actingFor,
      },
    }
  })
}

export async function saveDescription(pid: ID, text: string) {
  return act((s, _t, at) => {
    const user = me(s)
    const p = projectOf(s, pid)
    ensure(can.change(p))
    if (!(inTeam(p, user.id, 'STAKEHOLDER') || isPmTeam(p, user.id))) throw new ApiError(403, 'Stakeholders (and the PM team) write the description.')
    p.intake.description = text
    p.intake.descriptionBy = user.id
    audit(s, { projectId: pid, actorId: user.id, action: 'Description updated', details: `${text.length} characters`, at })
  })
}

export async function upload(pid: ID, file: { name: string; size: number; type: string; dataUrl?: string; text?: string }, context: 'intake' | 'audio' = 'intake') {
  const s0 = await read((s) => s)
  const user = me(s0)
  const p = projectOf(s0, pid)
  ensure(can.memberOrOwner(p, user.id))
  // Plain-text files are really read; reading PDFs, Word files and scans (OCR) is simulated.
  const result = file.text?.trim() ? { text: file.text.slice(0, 20_000), pages: 1, ocrUsed: false } : readUpload(p, file.name)
  return runJob({
    agent: 'ocr',
    title: `Reading ${file.name}`,
    projectId: pid,
    byUserId: user.id,
    link: `/projects/${pid}/intake`,
    steps: ['Saving the file', 'Reading the text layer', result.ocrUsed ? 'Running OCR on scanned pages (English + Bangla)' : 'Reading the document', 'Saving the extracted text'],
    promptTokens: 0,
    apply: (s) => {
      const at = nowIso()
      s.uploads.push({ id: newId('up'), projectId: pid, name: file.name, size: file.size, mime: file.type, uploadedBy: user.id, uploadedAt: at, extractedText: result.text, ocrUsed: result.ocrUsed, pages: result.pages, context, dataUrl: file.dataUrl })
      audit(s, { projectId: pid, actorId: user.id, action: 'Upload', details: `${file.name}${result.ocrUsed ? ' (OCR used)' : ''}`, at })
      return `${result.pages} page${result.pages > 1 ? 's' : ''} read${result.ocrUsed ? ' with OCR' : ''}.`
    },
  })
}

/** Q/A agent step 1–2: extract facts. Then the RAG agent runs once (SPEC.md 7.1 step 2b). */
export async function runAnalysis(pid: ID) {
  const s0 = await read((s) => s)
  const user = me(s0)
  const p = projectOf(s0, pid)
  ensure(can.pmTeam(p, user.id, 'run the intake analysis'))
  if (!p.intake.description.trim()) fail('The stakeholders have not written a description yet.')
  const uploads = s0.uploads.filter((u) => u.projectId === pid && u.context === 'intake').slice(0, 3)
  const catalog = s0.factCatalog.filter((d) => d.round === 'intake') // later rounds ask for the rest
  const steps = ['Reading the stakeholder description', ...uploads.map((u) => `Reading ${u.name}`), 'Checking for conflicting answers']
  return runAiJob({
    agent: 'qa_extract',
    title: 'Extracting facts from the stakeholders’ information',
    projectId: pid,
    byUserId: user.id,
    link: `/projects/${pid}/intake?tab=facts`,
    steps,
    work: async (step) => {
      const found = new Map<string, Fact>()
      const description: FactSource = { type: 'description', label: 'Stakeholder description' }
      for (const f of await extractFacts(p, catalog, p.intake.description, 'Facts from the description')) found.set(f.key, newFact(catalog, f, description))
      for (const [i, u] of uploads.entries()) {
        step(i + 1)
        const source: FactSource = { type: 'upload', ref: u.id, label: `Upload: ${u.name}` }
        for (const f of await extractFacts(p, catalog, u.extractedText, `Facts from ${u.name}`)) {
          const had = found.get(f.key)
          if (!had) found.set(f.key, newFact(catalog, f, source))
          // Two sources give different numbers or dates for the same fact: the PM decides.
          else if (numbersDiffer(had.value, f.value)) found.set(f.key, { ...had, status: 'conflicting', conflict: [...(had.conflict ?? [{ value: had.value, source: had.source! }]), { value: f.value, source }] })
        }
      }
      step(steps.length - 1)
      return [...found.values()]
    },
    apply: (s, extracted) => {
      const proj = projectOf(s, pid)
      const at = nowIso()
      for (const f of extracted) {
        const i = proj.facts.findIndex((x) => x.key === f.key)
        const old = proj.facts[i]
        if (i === -1) proj.facts.push(f)
        // Empty, assumed, or an earlier AI reading nobody confirmed: the new reading replaces it.
        else if (!old.value || old.status === 'missing' || old.status === 'assumed' || (old.ai && (old.source?.type === 'description' || old.source?.type === 'upload'))) proj.facts[i] = f
        // A person's value stays, unless the new reading gives different numbers or dates.
        else if (f.status !== 'conflicting' && numbersDiffer(old.value, f.value)) proj.facts[i] = mergeValue(old, f)
      }
      proj.intake.analysed = true
      audit(s, { projectId: pid, actorId: null, action: 'AI generation', details: `Q/A agent extracted ${extracted.length} facts`, at })
      const nConflicts = proj.facts.filter((x) => x.status === 'conflicting').length
      if (nConflicts) notify(s, { to: teamMembers(proj, 'PM').filter((id) => headOf(proj, 'PM')?.userId === id), type: 'conflict', title: 'Conflicting answers need your decision', body: `${proj.name}: ${nConflicts} fact${nConflicts > 1 ? 's have' : ' has'} conflicting values.`, link: `/projects/${pid}/intake?tab=facts`, projectId: pid, at })
      return `${extracted.length} facts found${nConflicts ? `, ${nConflicts} conflicting` : ''}. Now searching similar past projects.`
    },
    // RAG runs once, right after the first analysis (SPEC.md 7.1 step 2b).
    onDone: () => void read((s) => s).then((s) => (projectOf(s, pid).intake.ragRunId ? undefined : runRag(pid, user.id))),
  })
}

function newFact(catalog: FactDef[], f: { key: string; value: string }, source: FactSource): Fact {
  const def = catalog.find((d) => d.key === f.key)
  return { key: f.key, label: def?.label ?? f.key, category: def?.category ?? 'other', value: f.value, status: 'filled', source, ai: true }
}

/** The numbers and month names in a value ("BDT 1.2 crore, June 2027" → 1.2, june, 2027). */
const numbersOf = (v: string) =>
  new Set(
    (v.toLowerCase().match(/\d[\d,.]*|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/g) ?? []).map((n) =>
      /^\d/.test(n) ? n.replace(/[,.]+$/, '').replace(/,/g, '') : n.slice(0, 3), // "September" and "Sep" are the same month
    ),
  )
/** Both values contain numbers or dates (amounts, dates, counts), and they are not the same ones. */
function numbersDiffer(a: string, b: string) {
  const A = numbersOf(a)
  const B = numbersOf(b)
  return A.size > 0 && B.size > 0 && (A.size !== B.size || [...A].some((n) => !B.has(n)))
}

/** Finished projects with the text of their documents (latest version of each). */
function pastProjects(s: DemoState): PastProject[] {
  return s.projects
    .filter((x) => x.finished || x.legacy)
    .map((project) => ({
      project,
      sections: s.docs
        .filter((d) => d.projectId === project.id && d.currentVersionId)
        .flatMap((d) => (s.versions.find((v) => v.id === d.currentVersionId)?.sections ?? []).map((x) => ({ docType: d.type, key: x.key, title: x.title, content: x.content }))),
    }))
}

function runRag(pid: ID, byUserId: ID) {
  return read((s0) => {
    const p = projectOf(s0, pid)
    const past = pastProjects(s0)
    const topK = s0.settings.ragTopK
    return runAiJob({
      agent: 'rag',
      title: 'Searching similar finished projects',
      projectId: pid,
      byUserId,
      link: `/projects/${pid}/intake?tab=rag`,
      steps: [`Comparing with ${past.length} finished project${past.length === 1 ? '' : 's'}`, 'Reading the closest documents', 'Highlighting old-project details'],
      work: async (step) => {
        const r = await findSimilarProjects(p, past, topK)
        step(2)
        return r
      },
      apply: (s, { matches, suggestions }) => {
        const proj = projectOf(s, pid)
        const at = nowIso()
        const runId = newId('rag')
        const top = matches[0]
        s.ragRuns.push({ id: runId, projectId: pid, createdAt: at, matches, duplicate: top && top.score >= s.settings.ragDuplicateThreshold ? { projectId: top.projectId, score: top.score } : undefined })
        proj.intake.ragRunId = runId
        for (const g of suggestions)
          s.ragSuggestions.push({ id: newId('sug'), projectId: pid, runId, kind: g.kind as never, text: g.text, factKey: g.factKey, factLabel: g.factLabel, sourceProjectId: g.sourceProjectId, sourceDocType: g.sourceDocType, sectionTitle: g.sectionTitle, highlights: g.highlights.map((h) => ({ text: h, status: 'pending' })), status: 'pending' })
        notify(s, { to: teamMembers(proj, 'PM'), type: 'rag', title: 'Similar past projects found', body: `${proj.name}: ${matches.length} similar finished project${matches.length === 1 ? '' : 's'} and ${suggestions.length} suggestions (visible to the PM team only).`, link: `/projects/${pid}/intake?tab=rag`, projectId: pid, at, email: false })
        audit(s, { projectId: pid, actorId: null, action: 'AI generation', details: `RAG agent: ${matches.length} matches${top && top.score >= s.settings.ragDuplicateThreshold ? ', duplicate warning' : ''}`, at })
        return `${matches.length} similar projects, ${suggestions.length} suggestions.`
      },
    })
  })
}

function pmTeamOnly(s: DemoState, pid: ID) {
  const user = me(s)
  const p = projectOf(s, pid)
  if (!isPmTeam(p, user.id)) throw new ApiError(403, 'RAG results are visible to the PM team only.')
  ensure(can.change(p))
  return { user, p }
}

export async function acknowledgeDuplicate(pid: ID) {
  return act((s, t, at) => {
    const user = me(s)
    const p = projectOf(s, pid)
    const pm = ensure(actAsHead(p, 'PM', user.id, t))
    p.intake.duplicateAck = { by: user.id, at }
    const run = s.ragRuns.find((r) => r.id === p.intake.ragRunId)
    audit(s, { projectId: pid, actorId: user.id, actingFor: pm.actingFor, action: 'Duplicate warning acknowledged', details: run?.duplicate ? `Close match: ${projectOf(s, run.duplicate.projectId).name} (${Math.round(run.duplicate.score * 100)}%)` : '', at })
  })
}

export async function decideHighlight(pid: ID, sugId: ID, index: number, action: 'confirm' | 'replace', replacement?: string) {
  return act((s) => {
    pmTeamOnly(s, pid)
    const g = s.ragSuggestions.find((x) => x.id === sugId)
    if (!g) fail('Suggestion not found.')
    const h = g.highlights[index]
    if (action === 'replace' && !replacement?.trim()) fail('Type the value for this project.')
    Object.assign(h, action === 'confirm' ? { status: 'confirmed', replacement: undefined } : { status: 'replaced', replacement: replacement!.trim() })
  })
}

export async function decideSuggestion(pid: ID, sugId: ID, accept: boolean) {
  return act((s, _t, at) => {
    const { user, p } = pmTeamOnly(s, pid)
    const g = s.ragSuggestions.find((x) => x.id === sugId)
    if (!g || g.status !== 'pending') fail('Suggestion not found or already decided.')
    if (accept && g.highlights.some((h) => h.status === 'pending')) fail('Confirm or replace every highlighted old-project detail first.')
    g.status = accept ? 'accepted' : 'rejected'
    g.decidedBy = user.id
    g.decidedAt = at
    const source = projectOf(s, g.sourceProjectId)
    if (accept) {
      let value = g.text
      for (const h of g.highlights) if (h.status === 'replaced' && h.replacement) value = value.split(h.text).join(h.replacement)
      const def = s.factCatalog.find((d) => d.key === g.factKey)
      const credit = `From ${source.name} (PM: ${nameOf(s, headOf(source, 'PM')?.userId)})`
      const existing = p.facts.find((f) => f.key === g.factKey)
      const fact: Fact = {
        key: g.factKey,
        label: def?.label ?? g.factLabel,
        category: def?.category ?? (g.kind === 'risk' ? 'other' : g.kind === 'technical decision' ? 'technical' : 'requirement'),
        value: existing && existing.status !== 'missing' && existing.value ? `${existing.value} ${value}` : value,
        status: 'filled',
        source: { type: 'rag', ref: g.id, label: `${source.name} · ${g.sourceDocType} · ${g.sectionTitle}` },
        credit,
        ai: true,
        extra: !def,
      }
      p.facts = existing ? p.facts.map((f) => (f.key === g.factKey ? fact : f)) : [...p.facts, fact]
    }
    audit(s, { projectId: pid, actorId: user.id, action: accept ? 'RAG suggestion accepted' : 'RAG suggestion rejected', details: `${g.factLabel} (from ${source.name})`, at })
  })
}

/** Completeness check + question loop: one question per missing field, routed by type. */
export async function startRound(pid: ID, purpose: Exclude<RoundPurpose, 'change_request'>) {
  const s0 = await read((s) => s)
  const user = me(s0)
  const p = projectOf(s0, pid)
  const t0 = now()
  ensure(can.change(p))
  ensure(actAsHead(p, 'PM', user.id, t0))
  if (purpose === 'intake') {
    if (!p.intake.analysed) fail('Run the intake analysis first.')
    const run = s0.ragRuns.find((r) => r.id === p.intake.ragRunId)
    if (run?.duplicate && !p.intake.duplicateAck) fail('Acknowledge the duplicate warning first.')
  }
  if (s0.rounds.some((r) => r.projectId === pid && r.purpose === purpose && r.status === 'open')) fail('A round is already open. Close it first.')
  const missing = missingFor(p.facts, s0.factCatalog, purpose)
  // Stop if a team that will get questions has nobody in it yet.
  ensure(peopleCheck(p, questionNeeds([...new Set(missing.map(routeTeam))])))
  const number = roundsOf(s0.rounds, pid, purpose).length + 1
  return runAiJob({
    agent: 'qa_questions',
    title: `Q/A round ${number}: ${ROUND_LABEL[purpose]}`,
    projectId: pid,
    byUserId: user.id,
    link: `/projects/${pid}/intake?tab=questions`,
    steps: missing.length ? missing.map((d, i) => `Writing question ${i + 1} of ${missing.length}: ${d.label}`) : ['Checking the Fact Sheet'],
    work: (step) => {
      const teamName: Record<string, string> = { STAKEHOLDER: 'stakeholders', SPONSOR: 'sponsors', TECH: 'technical team' }
      return writeQuestions(p, missing.map((d) => ({ ...d, team: teamName[routeTeam(d)] ?? 'project team' })), step)
    },
    apply: (s, written) => {
      const proj = projectOf(s, pid)
      const at = nowIso()
      const roundId = newId('round')
      s.rounds.push({ id: roundId, projectId: pid, purpose, number, status: missing.length ? 'open' : 'closed', startedAt: at, closedAt: missing.length ? undefined : at })
      for (const def of missing) {
        const team = routeTeam(def)
        const q = { text: written.get(def.key) ?? questionFor(def).text, sample: def.sample }
        const assignees = proj.members.filter((m) => m.team === team && !m.isSqa).map((m) => m.userId)
        s.questions.push({ id: newId('q'), projectId: pid, roundId, factKey: def.key, text: q.text, team, assigneeIds: assignees, createdAt: at, sampleAnswer: q.sample, defaultValue: def.defaultIfUnknown })
      }
      const byTeam = new Map<string, number>()
      for (const def of missing) byTeam.set(routeTeam(def), (byTeam.get(routeTeam(def)) ?? 0) + 1)
      for (const [team, n] of byTeam)
        notify(s, { to: proj.members.filter((m) => m.team === team && !m.isSqa).map((m) => m.userId), type: 'question', title: `${n} Q/A question${n > 1 ? 's' : ''} assigned to you`, body: `${proj.name}: please answer in My questions. “Unknown” is a valid answer.`, link: '/inbox/questions', projectId: pid, at })
      if (!missing.length && purpose !== 'intake') {
        s.factSheets.push({ id: newId('fs'), projectId: pid, number: s.factSheets.filter((f) => f.projectId === pid).length + 1, facts: structuredClone(proj.facts), createdAt: at, createdBy: user.id, note: `${ROUND_LABEL[purpose]} round closed (nothing missing)` })
      }
      audit(s, { projectId: pid, actorId: user.id, action: 'Q/A round started', details: `${ROUND_LABEL[purpose]} round ${number}: ${missing.length} questions`, at })
      return missing.length ? `${missing.length} questions sent: ${[...byTeam].map(([t, n]) => `${n} to ${TEAM_LABEL[t as 'PM']}`).join(', ')}.` : 'Nothing is missing. The round is closed.'
    },
  })
}

export async function myQuestions() {
  return read((s, t) => {
    const user = me(s)
    const openRounds = new Set(s.rounds.filter((r) => r.status === 'open').map((r) => r.id))
    return s.questions
      .filter((q) => {
        const p = projectOf(s, q.projectId)
        if (p.status !== 'active') return false
        const direct = q.assigneeIds.includes(user.id)
        const covering = q.assigneeIds.some((id) => membershipsOf(p, id).some((m) => m.isHead && actAsHead(p, m.team, user.id, t).actingFor === id))
        return direct || covering
      })
      .map((q) => ({ ...q, open: openRounds.has(q.roundId) && !q.answeredAt, projectName: projectOf(s, q.projectId).name, teamLabel: TEAM_LABEL[q.team], answeredByName: q.answeredBy ? nameOf(s, q.answeredBy) : undefined, roundLabel: ROUND_LABEL[s.rounds.find((r) => r.id === q.roundId)?.purpose ?? 'intake'] }))
      .sort((a, b) => Number(b.open) - Number(a.open) || b.createdAt.localeCompare(a.createdAt))
  })
}

export async function answerQuestion(qid: ID, answer: { text: string; unknown: boolean }) {
  return act((s, t, at) => {
    const user = me(s)
    const q = s.questions.find((x) => x.id === qid)
    if (!q) fail('Question not found.')
    const p = projectOf(s, q.projectId)
    ensure(can.change(p))
    const round = s.rounds.find((r) => r.id === q.roundId)
    if (round?.status !== 'open' || q.answeredAt) fail('This question is already closed.')
    let actingFor: ID | undefined
    if (!q.assigneeIds.includes(user.id)) {
      const covered = q.assigneeIds.find((id) => membershipsOf(p, id).some((m) => m.isHead && actAsHead(p, m.team, user.id, t).actingFor === id))
      if (!covered) throw new ApiError(403, 'This question was routed to someone else.')
      actingFor = covered
    }
    if (!answer.unknown && !answer.text.trim()) fail('Write an answer, or choose “Unknown”.')
    Object.assign(q, { answer: answer.unknown ? 'Unknown' : answer.text.trim(), unknown: answer.unknown, answeredBy: user.id, actingFor, answeredAt: at } satisfies Partial<Question>)
    const def = s.factCatalog.find((d) => d.key === q.factKey) ?? { key: q.factKey, label: q.factKey, category: 'other' as const }
    const fact = factFromAnswer(def, { text: answer.text, unknown: answer.unknown, defaultValue: q.defaultValue ?? s.factCatalog.find((d) => d.key === q.factKey)?.defaultIfUnknown, source: { type: 'answer', ref: q.id, label: `Answer from ${user.name}` }, userName: user.name })
    const i = p.facts.findIndex((f) => f.key === q.factKey)
    if (i === -1) p.facts.push(fact)
    // A change-request answer replaces the old value; other answers can create a conflict.
    else p.facts[i] = round.purpose === 'change_request' ? { ...fact, credit: undefined } : mergeValue(p.facts[i], fact)
    audit(s, { projectId: p.id, actorId: user.id, actingFor, action: 'Q/A answer', details: `${def.label}: ${answer.unknown ? 'Unknown (assumption)' : answer.text.slice(0, 80)}`, at })
    const left = s.questions.filter((x) => x.roundId === q.roundId && !x.answeredAt).length
    if (left === 0) notify(s, { to: [headOf(p, 'PM')!.userId], type: 'qa', title: 'All questions in the round are answered', body: `${p.name}: you can close the round and check again.`, link: `/projects/${p.id}/intake?tab=questions`, projectId: p.id, at, email: false })
  })
}

export async function closeRound(pid: ID, roundId: ID) {
  return act((s, t, at) => {
    const user = me(s)
    const p = projectOf(s, pid)
    ensure(actAsHead(p, 'PM', user.id, t))
    const r = s.rounds.find((x) => x.id === roundId && x.projectId === pid)
    if (!r || r.status !== 'open') fail('Round not found or already closed.')
    r.status = 'closed'
    r.closedAt = at
    if (r.purpose === 'brd_business' || r.purpose === 'srs_technical')
      s.factSheets.push({ id: newId('fs'), projectId: pid, number: s.factSheets.filter((f) => f.projectId === pid).length + 1, facts: structuredClone(p.facts), createdAt: at, createdBy: user.id, note: `${ROUND_LABEL[r.purpose]} round closed` })
    audit(s, { projectId: pid, actorId: user.id, action: 'Q/A round closed', details: `${ROUND_LABEL[r.purpose]} round ${r.number}`, at })
  })
}

export async function logGaps(pid: ID) {
  return act((s, t, at) => {
    const user = me(s)
    const p = projectOf(s, pid)
    ensure(actAsHead(p, 'PM', user.id, t))
    const gaps = missingFor(p.facts, s.factCatalog, 'intake').map((d) => d.key)
    p.intake.gapsLogged = { by: user.id, at, factKeys: gaps }
    audit(s, { projectId: pid, actorId: user.id, action: 'Proceeding with gaps', details: gaps.join(', ') || 'none', at })
  })
}

export async function settle(pid: ID, key: string, value: string) {
  return act((s, t, at) => {
    const user = me(s)
    const p = projectOf(s, pid)
    ensure(actAsHead(p, 'PM', user.id, t))
    const f = p.facts.find((x) => x.key === key)
    if (!f || f.status !== 'conflicting') fail('This fact has no conflict.')
    p.facts = p.facts.map((x) => (x.key === key ? settleConflict(x, value, user.name) : x))
    audit(s, { projectId: pid, actorId: user.id, action: 'Conflict settled', details: `${f.label}: ${value}`, at })
  })
}

export async function editFact(pid: ID, key: string, value: string) {
  return act((s, _t, at) => {
    const user = me(s)
    const p = projectOf(s, pid)
    ensure(can.pmTeam(p, user.id, 'edit the Fact Sheet'))
    const def = s.factCatalog.find((d) => d.key === key)
    const existing = p.facts.find((x) => x.key === key)
    const fact: Fact = { key, label: def?.label ?? existing?.label ?? key, category: def?.category ?? existing?.category ?? 'other', value: value.trim(), status: value.trim() ? 'filled' : 'missing', source: { type: 'manual', label: `Edited by ${user.name}` }, credit: existing?.credit }
    p.facts = existing ? p.facts.map((x) => (x.key === key ? fact : x)) : [...p.facts, fact]
    audit(s, { projectId: pid, actorId: user.id, action: 'Fact edited', details: `${fact.label}: ${value.slice(0, 80)}`, at })
  })
}

export async function requestConfirmation(pid: ID) {
  return act((s, t, at) => {
    const user = me(s)
    const p = projectOf(s, pid)
    ensure(actAsHead(p, 'PM', user.id, t))
    if (conflicts(p.facts).length) fail('Settle the conflicting facts first.')
    const missing = missingFor(p.facts, s.factCatalog, 'intake')
    if (missing.length && !p.intake.gapsLogged) fail(`${missing.length} fields are still missing. Ask again, or choose “Proceed with gaps logged”.`)
    if (s.rounds.some((r) => r.projectId === pid && r.purpose === 'intake' && r.status === 'open')) fail('Close the open Q/A round first.')
    ensure(peopleCheck(p, FACT_CONFIRMATION_NEEDS))
    p.intake.confirmRequestedAt = at
    const sh = headOf(p, 'STAKEHOLDER')!
    notify(s, { to: [sh.userId], type: 'factsheet', title: 'Please confirm the Fact Sheet', body: `${p.name}: the Fact Sheet is ready. Confirm it, or comment on what is wrong.`, link: `/projects/${pid}/intake?tab=facts`, projectId: pid, at })
    audit(s, { projectId: pid, actorId: user.id, action: 'Fact Sheet sent for confirmation', details: '', at })
  })
}

export async function confirmFactSheet(pid: ID) {
  return act((s, t, at) => {
    const user = me(s)
    const p = projectOf(s, pid)
    const check = ensure(actAsHead(p, 'STAKEHOLDER', user.id, t))
    if (!p.intake.confirmRequestedAt) fail('The PM has not sent the Fact Sheet for confirmation yet.')
    if (conflicts(p.facts).length) fail('Some facts are still conflicting.')
    p.facts = p.facts.map((f) => ({ ...f, ai: false }))
    const number = s.factSheets.filter((f) => f.projectId === pid).length + 1
    s.factSheets.push({ id: newId('fs'), projectId: pid, number, facts: structuredClone(p.facts), createdAt: at, createdBy: user.id, note: 'Confirmed by the stakeholder head', confirmedBy: user.id, actingFor: check.actingFor })
    notify(s, { to: teamMembers(p, 'PM'), type: 'factsheet', title: 'Fact Sheet confirmed', body: `${p.name}: Fact Sheet v${number} is confirmed. The Proposal can now be generated.`, link: `/projects/${pid}/docs/PROPOSAL`, projectId: pid, at })
    audit(s, { projectId: pid, actorId: user.id, actingFor: check.actingFor, action: 'Fact Sheet confirmed', details: `Version ${number}`, at })
  })
}

export async function factSheetFeedback(pid: ID, text: string) {
  return act((s, t, at) => {
    const user = me(s)
    const p = projectOf(s, pid)
    ensure(actAsHead(p, 'STAKEHOLDER', user.id, t))
    if (!text.trim()) fail('Write what is wrong.')
    p.intake.feedback = [...(p.intake.feedback ?? []), { by: user.id, at, text: text.trim() }]
    p.intake.confirmRequestedAt = undefined
    notify(s, { to: teamMembers(p, 'PM'), type: 'factsheet', title: 'The stakeholder head commented on the Fact Sheet', body: `${p.name}: “${text.trim()}”`, link: `/projects/${pid}/intake?tab=facts`, projectId: pid, at })
    audit(s, { projectId: pid, actorId: user.id, action: 'Fact Sheet comment', details: text.slice(0, 120), at })
  })
}

export async function restoreFactSheet(pid: ID, number: number) {
  return act((s, t, at) => {
    const user = me(s)
    const p = projectOf(s, pid)
    ensure(actAsHead(p, 'PM', user.id, t))
    const v = s.factSheets.find((f) => f.projectId === pid && f.number === number)
    if (!v) fail('Version not found.')
    p.facts = structuredClone(v.facts)
    const n = s.factSheets.filter((f) => f.projectId === pid).length + 1
    s.factSheets.push({ id: newId('fs'), projectId: pid, number: n, facts: structuredClone(p.facts), createdAt: at, createdBy: user.id, note: `Restored from version ${number}` })
    audit(s, { projectId: pid, actorId: user.id, action: 'Fact Sheet restored', details: `v${number} → v${n}`, at })
  })
}

/** View full document: the signed version of a similar project's document (PM team only). */
export async function ragDocument(pid: ID, pastProjectId: ID, docId: ID) {
  return read((s) => {
    const user = me(s)
    const p = projectOf(s, pid)
    if (!isPmTeam(p, user.id)) throw new ApiError(403, 'RAG results are visible to the PM team only.')
    const run = s.ragRuns.find((r) => r.id === p.intake.ragRunId)
    if (!run?.matches.some((m) => m.projectId === pastProjectId)) throw new ApiError(403, 'This project is not among the matches.')
    const doc = s.docs.find((d) => d.id === docId && d.projectId === pastProjectId)
    if (!doc) throw new ApiError(404, 'Document not found.')
    const version = s.versions.find((v) => v.id === doc.currentVersionId)!
    const signature = s.signatures.find((x) => x.versionId === version.id)
    return { projectName: projectOf(s, pastProjectId).name, title: doc.title, version, signed: !!signature, signedAt: signature?.signedAt }
  })
}
