/**
 * Documents: generation, the edit lock, drafts, versions, comments, suggestions, approval and signing.
 *
 * Spec: SPEC.md "Document pipeline", "Approval and signing", "Editing, versions and change
 * requests" and "Comments and suggestions". The rules themselves live in src/rules.
 */
import type { ApprovalChain, Comment, DemoState, Doc, DocType, DocVersion, ID, Project, Section, User } from '../types'
import { MAIN_DOCS } from '../types'
import { now, nowIso } from '../demo/clock'
import { newId } from '../demo/ids'
import { runJob } from '../demo/jobs'
import { draftDocument, detectFactChanges, regenerateSection, requirementsFromCanned, requirementsFromText, scopeCheck as simulateScopeCheck, summaries } from '../demo/ai/agents'
import { approve as approveRule, canAct, CHAIN_CONFIG, cancel, currentStep, minorCorrectionChain, newChain, requestChanges as requestChangesRule, ROLE_LABEL, ROLE_TEAM, sendCheck, sign as signRule } from '../rules/approval'
import { blockingCounts, canCheckPending, canComment, canTick, carryForward, commentTeam } from '../rules/comments'
import { actAsHead, can, headOf, headRecipient, inTeam, isSqa, memberOf, TEAM_LABEL, type Check } from '../rules/permissions'
import { activeChain, canGenerate, chainsOf, DOC_LABEL, docStatus, isComplete, laterTypes, PIPELINE, previousComplete } from '../rules/pipeline'
import { exitCriteria, markReadyForRetest } from '../rules/testing'
import { normalize } from '../rules/text'
import { act, ApiError, ensure, fail, me, nameOf, pipelineCtx, projectOf, read } from './core'
import { allMembers, audit, notify, teamMembers } from './effects'
import { canonicalDocument, sha256Hex, signaturePageText } from './fingerprint'

const docLink = (doc: Doc) => (doc.type === 'SQA_SIGNOFF' ? `/projects/${doc.projectId}/testing/SQA?tab=signoff` : doc.type === 'UAT_SIGNOFF' ? `/projects/${doc.projectId}/testing/UAT?tab=signoff` : `/projects/${doc.projectId}/docs/${doc.type}`)

function docById(s: DemoState, docId: ID): Doc {
  const d = s.docs.find((x) => x.id === docId)
  if (!d) throw new ApiError(404, 'Document not found.')
  return d
}

function currentVersion(s: DemoState, doc: Doc): DocVersion | undefined {
  return s.versions.find((v) => v.id === doc.currentVersionId)
}

function lockOf(s: DemoState, docId: ID, t: Date) {
  const l = s.locks.find((x) => x.docId === docId)
  if (!l) return undefined
  if (t.getTime() - new Date(l.heartbeatAt).getTime() > s.settings.lockIdleMinutes * 60000) return undefined
  return l
}

// ─── Reading a document ─────────────────────────────────────────────────

export async function getDocument(pid: ID, type: DocType) {
  return read((s, t) => {
    const user = me(s)
    const p = projectOf(s, pid)
    ensure(can.view(p, user))
    const ctx = pipelineCtx(s, pid)
    const doc = s.docs.find((d) => d.projectId === pid && d.type === type)
    const versions = doc ? s.versions.filter((v) => v.docId === doc.id).sort((a, b) => a.number - b.number) : []
    const current = doc ? currentVersion(s, doc) : undefined
    const chains = doc ? chainsOf(ctx, doc.id) : []
    const active = doc ? activeChain(ctx, doc) : undefined
    const lock = doc ? lockOf(s, doc.id, t) : undefined
    const draft = doc ? s.drafts.find((d) => d.docId === doc.id) : undefined
    const template = s.templates.find((x) => x.docType === type && x.version === (p.templateVersions[type] ?? 1)) ?? s.templates.find((x) => x.docType === type)
    const latestTemplate = Math.max(0, ...s.templates.filter((x) => x.docType === type).map((x) => x.version))
    const counts = doc ? blockingCounts(s.comments, doc.id) : { open: 0, pending: 0 }
    const cfg = CHAIN_CONFIG[type]
    const pm = actAsHead(p, 'PM', user.id, t)
    const pmTeam = inTeam(p, user.id, 'PM')
    const lockedByOther = !!lock && lock.userId !== user.id
    const scopeUndecided = !!current?.scopeCheck?.flagged && !current.scopeCheck.decision

    const send = doc && current
      ? sendCheck({
          docType: type, project: p, userId: user.id, isSqaMember: isSqa(p, user.id), now: t, versionFrozen: current.frozen, outOfSync: !!doc.outOfSync,
          chainInProgress: active?.status === 'in_progress', openComments: counts.open, pendingComments: counts.pending, scopeUndecided,
          previousComplete: previousComplete(ctx, type),
          exitCriteria: type.endsWith('SIGNOFF') ? criteriaCheck(s, pid, type === 'SQA_SIGNOFF' ? 'SQA' : 'UAT') : undefined,
        })
      : ({ ok: false, reason: 'Nothing to send yet.' } as Check)

    const lastChain = chains.at(-1)
    const minor = minorCheck(s, p, doc, current, lastChain, user, t)

    // Derived outputs: regenerated for every saved version (SPEC.md "Derived outputs").
    const derived = current && MAIN_DOCS.includes(type) ? summaries(DOC_LABEL[type], p.name, current.number, current.sections) : undefined

    const signatures = doc ? s.signatures.filter((x) => x.docId === doc.id).map((x) => ({ ...x, signerName: nameOf(s, x.signerId), actingForName: x.actingFor ? nameOf(s, x.actingFor) : undefined })) : []
    const named = (c: ApprovalChain) => ({
      ...c,
      steps: c.steps.map((st) => ({ ...st, assigneeName: nameOf(s, st.assigneeId), actedByName: st.actedBy ? nameOf(s, st.actedBy) : undefined, actingForName: st.actingFor ? nameOf(s, st.actingFor) : undefined, roleLabel: ROLE_LABEL[st.role], deputyCovering: st.status === 'pending' ? headRecipient(p, st.assigneeId, t).forUserId && nameOf(s, headRecipient(p, st.assigneeId, t).to) : undefined })),
      versionNumber: s.versions.find((v) => v.id === c.versionId)?.number,
      startedByName: nameOf(s, c.startedBy),
    })
    const commentsForVersion = (versionId: ID) => canComment(p, user.id, chains.filter((c) => c.versionId === versionId))
    const reqs = s.requirements.filter((r) => r.projectId === pid)

    return {
      project: p,
      type,
      label: DOC_LABEL[type],
      doc,
      template,
      latestTemplate,
      versions: versions.map((v) => ({ ...v, authorName: v.authorId ? nameOf(s, v.authorId) : 'AI', minorByName: v.minorCorrection ? nameOf(s, v.minorCorrection.declaredBy) : undefined, scopeDecidedByName: v.scopeCheck?.decidedBy ? nameOf(s, v.scopeCheck.decidedBy) : undefined })),
      current,
      draft,
      lock: lock ? { ...lock, name: nameOf(s, lock.userId), mine: lock.userId === user.id } : undefined,
      comments: doc ? s.comments.filter((c) => c.docId === doc.id).map((c) => ({ ...c, authorName: nameOf(s, c.authorId), resolvedByName: c.resolvedBy ? nameOf(s, c.resolvedBy) : undefined, teamLabel: c.authorTeam === 'OWNER' ? 'Owner' : TEAM_LABEL[c.authorTeam], replies: c.replies.map((r) => ({ ...r, authorName: nameOf(s, r.authorId) })), canCheck: canCheckPending(p, user.id, c).ok, resolvedOnNumber: s.versions.find((v) => v.id === c.resolvedOnVersionId)?.number, createdOnNumber: s.versions.find((v) => v.id === c.createdOnVersionId)?.number })) : [],
      suggestions: doc ? s.suggestions.filter((x) => x.docId === doc.id).map((x) => ({ ...x, authorName: nameOf(s, x.authorId), decidedByName: x.decidedBy ? nameOf(s, x.decidedBy) : undefined })) : [],
      chains: chains.map(named),
      activeChain: active ? named(active) : undefined,
      lastChain: lastChain ? named(lastChain) : undefined,
      status: docStatus(ctx, doc),
      signatures,
      facts: p.facts,
      factUpdates: doc ? s.factUpdates.filter((f) => f.docId === doc.id) : [],
      derived,
      requirements: reqs,
      traceBuilt: !!s.traceLinksDone[pid],
      testCases: s.testCases.filter((tc) => tc.projectId === pid),
      chatId: doc ? `${doc.id}-chat` : undefined,
      members: p.members.map((m) => ({ userId: m.userId, name: nameOf(s, m.userId), team: m.team })),
      perms: {
        pm: pm.ok,
        pmTeam,
        edit: can.pmTeam(p, user.id, 'edit documents').ok && !lockedByOther && !!current,
        editReason: !pmTeam ? 'Only PM team members edit documents.' : lockedByOther ? `${nameOf(s, lock!.userId)} is editing. One editor at a time.` : can.change(p).reason,
        comment: cfg.comments && current ? commentsForVersion(current.id) : ({ ok: false, reason: 'Sign-off reports have no comments.' } as Check),
        tick: canTick(p, user.id).ok,
        decideSuggestion: canTick(p, user.id).ok,
        generate: canGenerate(ctx, type),
        send,
        act: active ? canAct(active, p, user.id, t) : ({ ok: false } as Check),
        minor,
        forceUnlock: pm.ok && lockedByOther,
        decideScope: pm.ok && scopeUndecided,
        switchTemplate: pm.ok && (p.templateVersions[type] ?? 1) < latestTemplate,
      },
      complete: isComplete(ctx, type),
    }
  })
}

function criteriaCheck(s: DemoState, pid: ID, stage: 'SQA' | 'UAT'): Check {
  const ctx = pipelineCtx(s, pid)
  const r = exitCriteria({
    stage,
    previousDone: previousComplete(ctx, stage === 'SQA' ? 'SQA_SIGNOFF' : 'UAT_SIGNOFF'),
    confirmations: s.testConfirmations,
    projectId: pid,
    requirements: s.requirements.filter((x) => x.projectId === pid),
    tests: s.testCases.filter((x) => x.projectId === pid),
    executions: s.executions.filter((x) => x.projectId === pid),
    defects: s.defects.filter((x) => x.projectId === pid),
    blocking: s.settings.signoffBlocking,
  })
  return r.ok ? { ok: true } : { ok: false, reason: `Exit criteria not met: ${r.items.filter((i) => !i.ok).map((i) => i.label.toLowerCase()).join('; ')}.` }
}

/** Can the PM declare the current version a minor correction? (SPEC.md "Minor correction") */
function minorCheck(s: DemoState, p: Project, doc: Doc | undefined, current: DocVersion | undefined, lastChain: ApprovalChain | undefined, user: User, t: Date): Check & { requested?: boolean } {
  if (!doc || !current || !lastChain) return { ok: false }
  if (lastChain.status !== 'changes_requested') return { ok: false }
  const reviewed = s.versions.find((v) => v.id === lastChain.versionId)!
  if (current.number <= reviewed.number) return { ok: false, reason: 'Save a new version with the fix first.', requested: true }
  if (!CHAIN_CONFIG[doc.type].comments) return { ok: false }
  const pm = actAsHead(p, 'PM', user.id, t)
  if (!pm.ok) return { ok: false, reason: 'Only the PM declares a minor correction.', requested: true }
  const template = s.templates.find((x) => x.docType === doc.type && x.version === (p.templateVersions[doc.type] ?? 1))
  const sc = simulateScopeCheck(template, reviewed.sections, current.sections)
  if (sc.flagged) return { ok: false, reason: `Not possible: ${sc.reason} A minor correction cannot touch objectives, deliverables, budget or timeline, so the full chain must run.`, requested: true }
  const counts = blockingCounts(s.comments, doc.id)
  if (counts.open + counts.pending) return { ok: false, reason: 'Resolve the open comments first (including the Request changes comment).', requested: true }
  return { ok: true, requested: true }
}

// ─── Generation ─────────────────────────────────────────────────────────

export async function generate(pid: ID, type: DocType) {
  const s0 = await read((s) => s)
  const user = me(s0)
  const p = projectOf(s0, pid)
  ensure(can.pmTeam(p, user.id, 'generate documents'))
  ensure(canGenerate(pipelineCtx(s0, pid), type))
  if (s0.docs.some((d) => d.projectId === pid && d.type === type && d.currentVersionId)) fail('This document already has a version. Edit it, or use “Rewrite with AI” on a section.')
  const template = s0.templates.find((x) => x.docType === type && x.version === (p.templateVersions[type] ?? 1))!
  const sections = draftDocument(p, type, template, p.facts)
  return runJob({
    agent: 'docgen',
    title: `Drafting the ${DOC_LABEL[type]}`,
    projectId: pid,
    byUserId: user.id,
    link: `/projects/${pid}/docs/${type}`,
    promptTokens: 900 * sections.length,
    steps: [...sections.map((x, i) => `Drafting section ${i + 1} of ${sections.length}: ${x.title}`), 'Recording which facts each section used'],
    apply: (s) => {
      const at = nowIso()
      let doc = s.docs.find((d) => d.projectId === pid && d.type === type)
      if (!doc) {
        doc = { id: `${pid}-${type}`, projectId: pid, type, title: DOC_LABEL[type] }
        s.docs.push(doc)
        s.chats.push({ id: `${doc.id}-chat`, projectId: pid, kind: 'document', docId: doc.id, title: `${DOC_LABEL[type]} chat` })
      }
      const fsNumber = s.factSheets.filter((f) => f.projectId === pid).length
      const v: DocVersion = {
        id: newId('ver'), docId: doc.id, projectId: pid, number: 1, authorId: null, message: `First draft generated by AI from Fact Sheet v${fsNumber}`, kind: 'ai_draft',
        sections: sections.map((x) => ({ id: `${doc!.id}:${x.key}`, key: x.key, title: x.title, content: x.content, factKeys: x.factKeys })), regeneratedSectionIds: [],
        factSheetVersion: fsNumber, templateVersion: template.version, frozen: false, createdAt: at,
      }
      s.versions.push(v)
      doc.currentVersionId = v.id
      updateRequirements(s, projectOf(s, pid), type, v.sections, true)
      const proj = projectOf(s, pid)
      notify(s, { to: allMembers(proj), type: 'version', title: `New document: ${DOC_LABEL[type]} v1`, body: `${proj.name}: the AI drafted the ${DOC_LABEL[type]}. Please review and comment.`, link: `/projects/${pid}/docs/${type}`, projectId: pid, at })
      audit(s, { projectId: pid, actorId: null, action: 'AI generation', details: `${DOC_LABEL[type]} v1 (${sections.length} sections)`, at })
      return `${sections.length} sections drafted. Everyone in the project was notified.`
    },
  })
}

/** Keeps the numbered requirements (OBJ/BR/SR) in step with the document text. */
function updateRequirements(s: DemoState, p: Project, type: DocType, sections: Section[], firstDraft: boolean) {
  if (type !== 'CHARTER' && type !== 'BRD' && type !== 'SRS') return
  let reqs = requirementsFromText(p, type, sections)
  if (!reqs.length && firstDraft) reqs = requirementsFromCanned(p, type)
  if (!reqs.length) return
  const old = s.requirements.filter((r) => r.projectId === p.id && r.docType === type)
  const changed = reqs.filter((r) => old.find((o) => o.id === r.id && normalize(o.text) !== normalize(r.text))).map((r) => r.id)
  s.requirements = [...s.requirements.filter((r) => !(r.projectId === p.id && r.docType === type)), ...reqs.map((r) => ({ ...r, notTestable: old.find((o) => o.id === r.id)?.notTestable }))]
  const at = nowIso()
  for (const tc of s.testCases.filter((x) => x.projectId === p.id && x.requirementIds.some((id) => changed.includes(id)))) {
    tc.needsReview = true
    tc.history.push({ by: null, at, text: 'Needs review: a linked requirement changed, so the latest result was reset to Not run.' })
  }
}

// ─── Lock, draft and editing ────────────────────────────────────────────

export async function acquireLock(docId: ID) {
  return act((s, t, at) => {
    const user = me(s)
    const doc = docById(s, docId)
    const p = projectOf(s, doc.projectId)
    ensure(can.pmTeam(p, user.id, 'edit documents'))
    const lock = lockOf(s, docId, t)
    if (lock && lock.userId !== user.id) fail(`${nameOf(s, lock.userId)} is editing this document. One editor at a time.`)
    const v = currentVersion(s, doc)
    if (!v) fail('Generate the first draft first.')
    s.locks = s.locks.filter((l) => l.docId !== docId)
    s.locks.push({ docId, userId: user.id, acquiredAt: at, heartbeatAt: at, reason: 'edit' })
    if (!s.drafts.some((d) => d.docId === docId)) s.drafts.push({ docId, baseVersionId: v.id, sections: structuredClone(v.sections), regeneratedSectionIds: [], updatedAt: at, updatedBy: user.id })
    if (!lock) audit(s, { projectId: p.id, actorId: user.id, action: 'Lock acquired', details: DOC_LABEL[doc.type], at })
  })
}

export async function heartbeat(docId: ID) {
  return act((s, _t, at) => {
    const user = me(s)
    const l = s.locks.find((x) => x.docId === docId && x.userId === user.id)
    if (l) l.heartbeatAt = at
  })
}

export async function releaseLock(docId: ID) {
  return act((s, _t, at) => {
    const user = me(s)
    const l = s.locks.find((x) => x.docId === docId)
    if (!l || l.userId !== user.id) return
    s.locks = s.locks.filter((x) => x.docId !== docId)
    const doc = docById(s, docId)
    audit(s, { projectId: doc.projectId, actorId: user.id, action: 'Lock released', details: `${DOC_LABEL[doc.type]} (left the editor; draft autosaved)`, at })
  })
}

export async function forceUnlock(docId: ID) {
  return act((s, t, at) => {
    const user = me(s)
    const doc = docById(s, docId)
    const p = projectOf(s, doc.projectId)
    const pm = ensure(actAsHead(p, 'PM', user.id, t))
    const l = s.locks.find((x) => x.docId === docId)
    if (!l) fail('Nobody is editing.')
    s.locks = s.locks.filter((x) => x.docId !== docId)
    notify(s, { to: [l.userId], type: 'lock', title: 'The PM force-unlocked your document', body: `${user.name} force-unlocked the ${DOC_LABEL[doc.type]}. Your work was autosaved as a draft.`, link: docLink(doc), projectId: p.id, at, email: false })
    audit(s, { projectId: p.id, actorId: user.id, actingFor: pm.actingFor, action: 'Force-unlock', details: `${DOC_LABEL[doc.type]} (was locked by ${nameOf(s, l.userId)})`, at })
  })
}

function ownLock(s: DemoState, docId: ID, user: User, t: Date) {
  const l = lockOf(s, docId, t)
  if (!l || l.userId !== user.id) throw new ApiError(409, 'You no longer hold the edit lock (it was released or force-unlocked). Your draft is saved.')
  l.heartbeatAt = t.toISOString()
  return l
}

/** Autosave: called while typing. */
export async function saveDraft(docId: ID, sections: Section[]) {
  return act((s, t, at) => {
    const user = me(s)
    ownLock(s, docId, user, t)
    const d = s.drafts.find((x) => x.docId === docId)
    if (!d) fail('No draft.')
    d.sections = sections
    d.updatedAt = at
    d.updatedBy = user.id
  })
}

export async function discardDraft(docId: ID) {
  return act((s, t) => {
    const user = me(s)
    ownLock(s, docId, user, t)
    s.drafts = s.drafts.filter((x) => x.docId !== docId)
    s.locks = s.locks.filter((x) => x.docId !== docId)
  })
}

/** AI regenerate a part: the result waits in the draft as a proposal to accept or reject. */
export async function rewriteSection(docId: ID, sectionId: ID, prompt: string) {
  const s0 = await read((s) => s)
  const user = me(s0)
  const t = now()
  const doc = docById(s0, docId)
  const p = projectOf(s0, doc.projectId)
  if (!prompt.trim()) fail('Write what the AI should change.')
  const lock = lockOf(s0, docId, t)
  if (!lock || lock.userId !== user.id) fail('Start editing first (AI regeneration also takes the lock).')
  const draft = s0.drafts.find((d) => d.docId === docId)!
  const section = draft.sections.find((x) => x.id === sectionId)!
  const content = regenerateSection(p, doc.type, section, prompt, p.facts)
  return runJob({
    agent: 'regen',
    title: `Rewriting “${section.title}”`,
    projectId: p.id,
    byUserId: user.id,
    link: docLink(doc),
    promptTokens: Math.round(section.content.length / 4) + 600,
    steps: ['Reading the section and your instruction', 'Writing the new text', 'Preparing the diff'],
    apply: (s) => {
      const d = s.drafts.find((x) => x.docId === docId)
      if (!d) fail('The draft was discarded.')
      d.proposals = [...(d.proposals ?? []).filter((x) => x.sectionId !== sectionId), { sectionId, prompt, content, createdAt: nowIso() }]
      return 'Review the diff and accept or reject it.'
    },
  })
}

export async function decideProposal(docId: ID, sectionId: ID, accept: boolean) {
  return act((s, t) => {
    const user = me(s)
    ownLock(s, docId, user, t)
    const d = s.drafts.find((x) => x.docId === docId)!
    const prop = d.proposals?.find((x) => x.sectionId === sectionId)
    if (!prop) fail('No proposal for this section.')
    if (accept) {
      d.sections = d.sections.map((x) => (x.id === sectionId ? { ...x, content: prop.content } : x))
      if (!d.regeneratedSectionIds.includes(sectionId)) d.regeneratedSectionIds.push(sectionId)
    }
    d.proposals = d.proposals!.filter((x) => x.sectionId !== sectionId)
  })
}

/** What saving would do (scope check and fact changes), shown before saving. */
export async function previewSave(docId: ID) {
  return read((s) => {
    const doc = docById(s, docId)
    const p = projectOf(s, doc.projectId)
    const d = s.drafts.find((x) => x.docId === docId)
    const v = currentVersion(s, doc)
    if (!d || !v) return { changedTitles: [] as string[], flagged: false, reason: 'No draft.', sectionTitles: [] as string[], factChanges: [] as ReturnType<typeof detectFactChanges> }
    const template = s.templates.find((x) => x.docType === doc.type && x.version === (p.templateVersions[doc.type] ?? 1))
    const sc = simulateScopeCheck(template, v.sections, d.sections)
    return { ...sc, factChanges: detectFactChanges(p.facts, v.sections, d.sections) }
  })
}

export async function saveVersion(docId: ID, message: string, scopeDecision?: 'normal' | 'scope_change') {
  return act((s, t, at) => {
    const user = me(s)
    const doc = docById(s, docId)
    const p = projectOf(s, doc.projectId)
    ensure(can.pmTeam(p, user.id, 'save versions'))
    const lock = lockOf(s, docId, t)
    if (lock && lock.userId !== user.id) fail(`${nameOf(s, lock.userId)} is editing.`)
    const d = s.drafts.find((x) => x.docId === docId)
    const prev = currentVersion(s, doc)
    if (!d || !prev) fail('There is no draft to save.')
    if (d.proposals?.length) fail('Accept or reject the AI proposals first.')
    if (d.sections.every((x) => normalize(prev.sections.find((y) => y.id === x.id)?.content ?? '') === normalize(x.content))) fail('Nothing has changed since the last version.')
    if (!message.trim()) fail('Write a short message describing the change.')
    const template = s.templates.find((x) => x.docType === doc.type && x.version === (p.templateVersions[doc.type] ?? 1))
    const sc = simulateScopeCheck(template, prev.sections, d.sections)
    const pm = actAsHead(p, 'PM', user.id, t)
    const v: DocVersion = {
      id: newId('ver'), docId, projectId: p.id, number: prev.number + 1, authorId: user.id, message: message.trim(),
      kind: d.regeneratedSectionIds.length ? 'ai_regen' : 'manual', sections: d.sections, regeneratedSectionIds: d.regeneratedSectionIds,
      factSheetVersion: s.factSheets.filter((f) => f.projectId === p.id).length, templateVersion: prev.templateVersion, frozen: false, createdAt: at,
      scopeCheck: { flagged: sc.flagged, sectionTitles: sc.sectionTitles, reason: sc.reason, ...(sc.flagged && pm.ok && scopeDecision ? { decision: scopeDecision, decidedBy: user.id, decidedAt: at } : {}) },
    }
    s.versions.push(v)
    doc.currentVersionId = v.id
    s.drafts = s.drafts.filter((x) => x.docId !== docId)
    s.locks = s.locks.filter((x) => x.docId !== docId)
    afterNewVersion(s, doc, prev, v, user, at, t, true)
    if (sc.flagged && !v.scopeCheck!.decision)
      notify(s, { to: [headRecipient(p, headOf(p, 'PM')!.userId, t)], type: 'scope', title: 'An edit touches scope: your decision is needed', body: `${p.name}: ${sc.reason} Decide whether it is a normal edit or a scope change.`, link: docLink(doc), projectId: p.id, at })
    if (v.scopeCheck?.decision === 'scope_change') startChangeRequestFromEdit(s, p, doc, v, user, at)
    audit(s, { projectId: p.id, actorId: user.id, action: 'Version saved', details: `${DOC_LABEL[doc.type]} v${v.number}: ${v.message}${sc.flagged ? ' (scope check flagged)' : ''}`, at })
    return v.number
  })
}

/** Everything that happens after any new version (SPEC.md "Editing" → after every new version). */
export function afterNewVersion(s: DemoState, doc: Doc, prev: DocVersion, v: DocVersion, user: User, at: string, t: Date, manual: boolean) {
  const p = projectOf(s, doc.projectId)
  // 1. A new version cancels approvals of earlier versions; the approver holding it is told.
  for (const c of s.chains.filter((x) => x.docId === doc.id && x.status === 'in_progress')) {
    const step = currentStep(c)
    s.chains = s.chains.map((x) => (x.id === c.id ? cancel(c, `Replaced by version ${v.number}`, t) : x))
    if (step) notify(s, { to: [headRecipient(p, step.assigneeId, t)], type: 'replaced', title: `The version you were reviewing was replaced`, body: `${p.name}: ${DOC_LABEL[doc.type]} v${prev.number} was replaced by v${v.number}. The approval chain restarts from the PM.`, link: docLink(doc), projectId: p.id, at })
  }
  // 2. Comments carry forward, or become Pending check.
  const cf = carryForward(s.comments, doc.id, v)
  s.comments = cf.comments
  for (const c of cf.nowPending) {
    const team = c.authorTeam === 'OWNER' ? [] : teamMembers(p, c.authorTeam)
    notify(s, { to: [c.authorId, ...team], type: 'comment', title: 'A comment was auto-resolved', body: `${p.name}: the text of the comment “${c.body.slice(0, 80)}” was ${c.pendingReason === 'regenerated' ? 'regenerated' : 'edited'} in v${v.number}. Confirm it or reopen it.`, link: docLink(doc), projectId: p.id, at, exclude: user.id })
  }
  // 3. Manual edits may change facts: propose Fact Sheet updates.
  if (manual) {
    for (const fc of detectFactChanges(p.facts, prev.sections, v.sections)) {
      s.factUpdates.push({ id: newId('fu'), projectId: p.id, docId: doc.id, versionId: v.id, ...fc, status: 'pending', createdAt: at })
      notify(s, { to: teamMembers(p, 'PM'), type: 'fact-update', title: 'A Fact Sheet update was proposed from an edit', body: `${p.name}: “${fc.factLabel}” may now be “${fc.newValue}”.`, link: `/projects/${p.id}/changes`, projectId: p.id, at, email: false })
    }
  }
  // 4. Later documents that already exist are now Out of sync.
  const changedFacts = new Set(v.sections.filter((x) => normalize(prev.sections.find((y) => y.id === x.id)?.content ?? '') !== normalize(x.content)).flatMap((x) => x.factKeys))
  for (const lt of laterTypes(doc.type)) {
    const later = s.docs.find((d) => d.projectId === p.id && d.type === lt && d.currentVersionId)
    if (!later) continue
    const lv = currentVersion(s, later)!
    const suggested = lv.sections.filter((x) => x.factKeys.some((k) => changedFacts.has(k))).map((x) => x.id)
    later.outOfSync = { since: at, cause: `${DOC_LABEL[doc.type]} changed (v${v.number})`, suggestedSectionIds: suggested }
    notify(s, { to: teamMembers(p, 'PM'), type: 'out-of-sync', title: `${DOC_LABEL[lt]} is out of sync`, body: `${p.name}: the ${DOC_LABEL[doc.type]} changed after the ${DOC_LABEL[lt]} was written. It must be re-approved in order.`, link: docLink(later), projectId: p.id, at, email: false })
  }
  // 5. Requirements follow the text; 6. derived outputs regenerate; 7. everyone is told.
  updateRequirements(s, p, doc.type, v.sections, false)
  if (MAIN_DOCS.includes(doc.type)) s.aiCalls.unshift({ id: newId('ai'), projectId: p.id, agent: 'summary', title: `Summaries and slides for ${DOC_LABEL[doc.type]} v${v.number}`, promptTokens: Math.round(v.sections.reduce((n, x) => n + x.content.length, 0) / 4), durationMs: 2100, success: true, createdAt: at })
  notify(s, { to: allMembers(p), type: 'version', title: `New version: ${DOC_LABEL[doc.type]} v${v.number}`, body: `${p.name}: ${user.name} saved v${v.number} (“${v.message}”).`, link: docLink(doc), projectId: p.id, at, exclude: user.id, email: false })
}

function startChangeRequestFromEdit(s: DemoState, p: Project, doc: Doc, v: DocVersion, user: User, at: string) {
  const id = newId('cr')
  const roundId = newId('round')
  const keys = [...new Set(v.sections.filter((x) => v.scopeCheck?.sectionTitles.includes(x.title)).flatMap((x) => x.factKeys))]
  s.changeRequests.push({ id, projectId: p.id, title: `Scope change from ${DOC_LABEL[doc.type]} v${v.number}`, description: v.scopeCheck?.reason ?? '', trigger: 'edit', sourceLabel: `${DOC_LABEL[doc.type]} v${v.number}: ${v.message}`, status: 'questions', roundId, changedFactKeys: keys, impact: [], createdAt: at, createdBy: user.id })
  s.rounds.push({ id: roundId, projectId: p.id, purpose: 'change_request', number: 1, status: 'open', startedAt: at, changeRequestId: id })
  audit(s, { projectId: p.id, actorId: user.id, action: 'Change request', details: `Started from ${DOC_LABEL[doc.type]} v${v.number}`, at })
}

export async function decideScope(docId: ID, decision: 'normal' | 'scope_change') {
  return act((s, t, at) => {
    const user = me(s)
    const doc = docById(s, docId)
    const p = projectOf(s, doc.projectId)
    const pm = ensure(actAsHead(p, 'PM', user.id, t))
    const v = currentVersion(s, doc)!
    if (!v.scopeCheck?.flagged || v.scopeCheck.decision) fail('Nothing to decide.')
    Object.assign(v.scopeCheck, { decision, decidedBy: user.id, decidedAt: at })
    if (decision === 'scope_change') startChangeRequestFromEdit(s, p, doc, v, user, at)
    audit(s, { projectId: p.id, actorId: user.id, actingFor: pm.actingFor, action: 'Scope decision', details: `${DOC_LABEL[doc.type]} v${v.number}: ${decision === 'normal' ? 'normal edit' : 'scope change'}`, at })
  })
}

export async function restoreVersion(docId: ID, versionId: ID) {
  return act((s, t, at) => {
    const user = me(s)
    const doc = docById(s, docId)
    const p = projectOf(s, doc.projectId)
    ensure(can.pmTeam(p, user.id, 'restore versions'))
    const lock = lockOf(s, docId, t)
    if (lock && lock.userId !== user.id) fail(`${nameOf(s, lock.userId)} is editing.`)
    const old = s.versions.find((v) => v.id === versionId)
    const prev = currentVersion(s, doc)!
    if (!old || old.id === prev.id) fail('Choose an older version.')
    const v: DocVersion = { ...structuredClone(old), id: newId('ver'), number: prev.number + 1, authorId: user.id, message: `Restored version ${old.number}`, kind: 'restore', regeneratedSectionIds: [], frozen: false, createdAt: at, minorCorrection: undefined, scopeCheck: undefined }
    s.versions.push(v)
    doc.currentVersionId = v.id
    s.drafts = s.drafts.filter((x) => x.docId !== docId)
    s.locks = s.locks.filter((x) => x.docId !== docId)
    afterNewVersion(s, doc, prev, v, user, at, t, false)
    audit(s, { projectId: p.id, actorId: user.id, action: 'Version restored', details: `${DOC_LABEL[doc.type]} v${old.number} → v${v.number}`, at })
  })
}

export async function switchTemplate(pid: ID, type: DocType) {
  return act((s, t, at) => {
    const user = me(s)
    const p = projectOf(s, pid)
    ensure(actAsHead(p, 'PM', user.id, t))
    const latest = Math.max(...s.templates.filter((x) => x.docType === type).map((x) => x.version))
    p.templateVersions[type] = latest
    audit(s, { projectId: pid, actorId: user.id, action: 'Template switched', details: `${DOC_LABEL[type]} now uses template v${latest}`, at })
  })
}

/** Out of sync: the PM picks which affected sections the AI should regenerate. */
export async function regenerateOutOfSync(docId: ID, sectionIds: ID[]) {
  await acquireLock(docId)
  const s0 = await read((s) => s)
  const user = me(s0)
  const doc = docById(s0, docId)
  const p = projectOf(s0, doc.projectId)
  ensure(actAsHead(p, 'PM', user.id, now()))
  if (!sectionIds.length) fail('Choose at least one section.')
  const template = s0.templates.find((x) => x.docType === doc.type && x.version === (p.templateVersions[doc.type] ?? 1))!
  const fresh = draftDocument(p, doc.type, template, p.facts)
  const draft = s0.drafts.find((d) => d.docId === docId)!
  return runJob({
    agent: 'docgen',
    title: `Regenerating ${sectionIds.length} section${sectionIds.length > 1 ? 's' : ''} of the ${DOC_LABEL[doc.type]}`,
    projectId: p.id,
    byUserId: user.id,
    link: docLink(doc),
    promptTokens: 900 * sectionIds.length,
    steps: sectionIds.map((id, i) => `Regenerating section ${i + 1} of ${sectionIds.length}: ${draft.sections.find((x) => x.id === id)?.title}`),
    apply: (s) => {
      const d = s.drafts.find((x) => x.docId === docId)
      if (!d) fail('The draft was discarded.')
      for (const id of sectionIds) {
        const sec = d.sections.find((x) => x.id === id)!
        const f = fresh.find((x) => x.key === sec.key)
        d.proposals = [...(d.proposals ?? []).filter((x) => x.sectionId !== id), { sectionId: id, prompt: 'Bring in line with the earlier document that changed', content: f?.content ?? sec.content, createdAt: nowIso() }]
      }
      return 'Review each diff, accept or reject, then save a version.'
    },
  })
}

// ─── Comments and suggestions ───────────────────────────────────────────

export async function addComment(docId: ID, input: { sectionId: ID | null; quote: string; prefix: string; suffix: string; body: string; mentions: ID[] }) {
  return act((s, _t, at) => {
    const user = me(s)
    const doc = docById(s, docId)
    const p = projectOf(s, doc.projectId)
    if (!CHAIN_CONFIG[doc.type].comments) fail('Sign-off reports have no comments.')
    const v = currentVersion(s, doc)!
    ensure(canComment(p, user.id, s.chains.filter((c) => c.versionId === v.id)))
    if (!input.body.trim()) fail('Write a comment.')
    const team = commentTeam(p, user.id)!
    const c: Comment = { id: newId('cmt'), docId, projectId: p.id, createdOnVersionId: v.id, versionId: v.id, sectionId: input.sectionId, quote: input.quote, prefix: input.prefix, suffix: input.suffix, body: input.body.trim(), authorId: user.id, authorTeam: team, mentions: input.mentions, status: 'open', reopenCount: 0, replies: [], createdAt: at }
    s.comments.push(c)
    if (input.mentions.length) notify(s, { to: input.mentions, type: 'mention', title: `${user.name} tagged you in a comment`, body: `${p.name}, ${DOC_LABEL[doc.type]}: “${c.body}”${c.quote ? ` (on “${c.quote.slice(0, 60)}”)` : ''}`, link: docLink(doc), projectId: p.id, at, exclude: user.id })
    audit(s, { projectId: p.id, actorId: user.id, action: 'Comment created', details: `${DOC_LABEL[doc.type]} v${v.number}: ${c.body.slice(0, 80)}`, at })
  })
}

export async function replyToComment(commentId: ID, body: string) {
  return act((s, _t, at) => {
    const user = me(s)
    const c = s.comments.find((x) => x.id === commentId)
    if (!c) fail('Comment not found.')
    const p = projectOf(s, c.projectId)
    ensure(can.memberOrOwner(p, user.id))
    if (!body.trim()) fail('Write a reply.')
    c.replies.push({ id: newId('rep'), authorId: user.id, body: body.trim(), createdAt: at })
    notify(s, { to: [c.authorId], type: 'comment', title: `${user.name} replied to your comment`, body: body.trim(), link: docLink(docById(s, c.docId)), projectId: p.id, at, exclude: user.id, email: false })
  })
}

export async function tickComment(commentId: ID) {
  return act((s, _t, at) => {
    const user = me(s)
    const c = s.comments.find((x) => x.id === commentId)
    if (!c || c.status !== 'open') fail('Only open comments can be resolved.')
    const p = projectOf(s, c.projectId)
    ensure(canTick(p, user.id))
    Object.assign(c, { status: 'resolved', resolvedHow: 'ticked', resolvedBy: user.id, resolvedOnVersionId: docById(s, c.docId).currentVersionId })
    audit(s, { projectId: p.id, actorId: user.id, action: 'Comment resolved', details: c.body.slice(0, 80), at })
  })
}

export async function checkPending(commentId: ID, confirm: boolean) {
  return act((s, _t, at) => {
    const user = me(s)
    const c = s.comments.find((x) => x.id === commentId)
    if (!c) fail('Comment not found.')
    const p = projectOf(s, c.projectId)
    ensure(canCheckPending(p, user.id, c))
    const doc = docById(s, c.docId)
    if (confirm) Object.assign(c, { status: 'resolved', resolvedHow: 'confirmed', resolvedBy: user.id })
    else Object.assign(c, { status: 'open', versionId: doc.currentVersionId, reopenCount: c.reopenCount + 1, pendingReason: undefined, resolvedOnVersionId: undefined })
    audit(s, { projectId: p.id, actorId: user.id, action: confirm ? 'Comment resolved' : 'Comment reopened', details: c.body.slice(0, 80), at })
    if (!confirm) notify(s, { to: teamMembers(p, 'PM'), type: 'comment', title: 'A comment was reopened', body: `${p.name}: “${c.body.slice(0, 80)}”`, link: docLink(doc), projectId: p.id, at, exclude: user.id, email: false })
  })
}

export async function addSuggestion(docId: ID, input: { sectionId: ID; quote: string; prefix: string; suffix: string; proposed: string }) {
  return act((s, _t, at) => {
    const user = me(s)
    const doc = docById(s, docId)
    const p = projectOf(s, doc.projectId)
    const v = currentVersion(s, doc)!
    ensure(canComment(p, user.id, s.chains.filter((c) => c.versionId === v.id)))
    if (!input.proposed.trim()) fail('Write the replacement text.')
    s.suggestions.push({ id: newId('sug'), docId, projectId: p.id, versionId: v.id, ...input, proposed: input.proposed.trim(), authorId: user.id, status: 'open', createdAt: at })
    audit(s, { projectId: p.id, actorId: user.id, action: 'Suggestion created', details: `“${input.quote.slice(0, 40)}” → “${input.proposed.slice(0, 40)}”`, at })
  })
}

function replaceQuote(markdown: string, quote: string, replacement: string): string | null {
  if (markdown.includes(quote)) return markdown.replace(quote, replacement)
  const words = normalize(quote).split(' ').map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(words.join('[\\s*_`]+'))
  return re.test(markdown) ? markdown.replace(re, replacement) : null
}

export async function decideSuggestion(sugId: ID, accept: boolean) {
  return act((s, t, at) => {
    const user = me(s)
    const g = s.suggestions.find((x) => x.id === sugId)
    if (!g || g.status !== 'open') fail('Suggestion not found or already decided.')
    const p = projectOf(s, g.projectId)
    ensure(canTick(p, user.id))
    const doc = docById(s, g.docId)
    if (accept) {
      const lock = lockOf(s, doc.id, t)
      if (lock && lock.userId !== user.id) fail(`${nameOf(s, lock.userId)} is editing. Try again when they finish.`)
      let d = s.drafts.find((x) => x.docId === doc.id)
      if (!d) {
        const v = currentVersion(s, doc)!
        d = { docId: doc.id, baseVersionId: v.id, sections: structuredClone(v.sections), regeneratedSectionIds: [], updatedAt: at, updatedBy: user.id }
        s.drafts.push(d)
      }
      const sec = d.sections.find((x) => x.id === g.sectionId)
      const next = sec ? replaceQuote(sec.content, g.quote, g.proposed) : null
      if (!sec || next === null) fail('The quoted text has changed since the suggestion was made. Edit it by hand instead.')
      sec.content = next
      d.updatedAt = at
    }
    Object.assign(g, { status: accept ? 'accepted' : 'rejected', decidedBy: user.id, decidedAt: at })
    notify(s, { to: [g.authorId], type: 'suggestion', title: `Your suggestion was ${accept ? 'accepted' : 'rejected'}`, body: `${p.name}, ${DOC_LABEL[doc.type]}: “${g.proposed.slice(0, 80)}”`, link: docLink(doc), projectId: p.id, at, exclude: user.id, email: false })
    audit(s, { projectId: p.id, actorId: user.id, action: accept ? 'Suggestion accepted' : 'Suggestion rejected', details: `“${g.quote.slice(0, 40)}”`, at })
  })
}

// ─── Approval ───────────────────────────────────────────────────────────

const NEXT_STEP: Partial<Record<DocType, string>> = {
  PROPOSAL: 'The Proposal is approved and frozen. The Charter can now be generated.',
  CHARTER: 'The Charter is signed. Next: the business processes Q/A round, then the BRD.',
  BRD: 'The BRD is signed. Next: the technical Q/A round (tech team), then the SRS.',
  SRS: 'The SRS is signed. SQA can start: draft the SQA test cases.',
  SQA_SIGNOFF: 'SQA is signed off. The build is released to UAT.',
  UAT_SIGNOFF: 'UAT is signed off. Documentation complete: the Owner may archive the project.',
}

export async function sendForApproval(docId: ID) {
  return act((s, t, at) => {
    const user = me(s)
    const doc = docById(s, docId)
    const p = projectOf(s, doc.projectId)
    const v = currentVersion(s, doc)
    if (!v) fail('Nothing to send yet.')
    const ctx = pipelineCtx(s, p.id)
    const active = activeChain(ctx, doc)
    const counts = blockingCounts(s.comments, docId)
    ensure(
      sendCheck({
        docType: doc.type, project: p, userId: user.id, isSqaMember: isSqa(p, user.id), now: t, versionFrozen: v.frozen, outOfSync: !!doc.outOfSync,
        chainInProgress: active?.status === 'in_progress', openComments: counts.open, pendingComments: counts.pending,
        scopeUndecided: !!v.scopeCheck?.flagged && !v.scopeCheck.decision, previousComplete: previousComplete(ctx, doc.type),
        exitCriteria: doc.type.endsWith('SIGNOFF') ? criteriaCheck(s, p.id, doc.type === 'SQA_SIGNOFF' ? 'SQA' : 'UAT') : undefined,
      }),
    )
    const chain = newChain({ id: newId('chain'), docId, docType: doc.type, projectId: p.id, versionId: v.id, project: p, startedBy: user.id, now: t, reapproval: v.frozen })
    s.chains.push(chain)
    const first = chain.steps[0]
    notify(s, { to: [headRecipient(p, first.assigneeId, t)], type: 'approval', title: `Your turn to approve: ${DOC_LABEL[doc.type]} v${v.number}`, body: `${p.name}: ${user.name} sent the ${DOC_LABEL[doc.type]} for approval.`, link: docLink(doc), projectId: p.id, at, exclude: user.id })
    audit(s, { projectId: p.id, actorId: user.id, action: 'Sent for approval', details: `${DOC_LABEL[doc.type]} v${v.number}${v.frozen ? ' (re-approval of the unchanged version)' : ''}`, at })
  })
}

export async function declareMinorCorrection(docId: ID) {
  return act((s, t, at) => {
    const user = me(s)
    const doc = docById(s, docId)
    const p = projectOf(s, doc.projectId)
    const v = currentVersion(s, doc)!
    const last = chainsOf({ chains: s.chains }, docId).at(-1)
    ensure(minorCheck(s, p, doc, v, last, user, t))
    v.minorCorrection = { declaredBy: user.id, at }
    const chain = minorCorrectionChain(last!, { id: newId('chain'), versionId: v.id, project: p, startedBy: user.id, now: t })
    s.chains.push(chain)
    const step = currentStep(chain)!
    const reviewed = s.versions.find((x) => x.id === last!.versionId)!
    notify(s, { to: [headRecipient(p, step.assigneeId, t)], type: 'minor', title: 'A minor correction is ready for you', body: `${p.name}: ${DOC_LABEL[doc.type]} v${v.number} fixes what you asked for in v${reviewed.number}. Earlier approvals carried over; compare the two versions and approve.`, link: `${docLink(doc)}?tab=compare&a=${reviewed.number}&b=${v.number}`, projectId: p.id, at })
    audit(s, { projectId: p.id, actorId: user.id, action: 'Minor correction declared', details: `${DOC_LABEL[doc.type]} v${v.number} (chain resumes at the ${ROLE_LABEL[step.role].toLowerCase()})`, at })
  })
}

function afterChainFinished(s: DemoState, doc: Doc, chain: ApprovalChain, at: string, actor: User) {
  const p = projectOf(s, doc.projectId)
  const v = s.versions.find((x) => x.id === chain.versionId)!
  v.frozen = true
  doc.outOfSync = undefined
  const verb = chain.status === 'signed' ? 'signed' : 'approved'
  notify(s, { to: allMembers(p), type: 'approved', title: `${DOC_LABEL[doc.type]} v${v.number} ${verb}`, body: `${p.name}: ${NEXT_STEP[doc.type] ?? ''}`, link: docLink(doc), projectId: p.id, at, exclude: actor.id, email: false })
  if (doc.type === 'SQA_SIGNOFF' && v.buildId) {
    const b = s.builds.find((x) => x.id === v.buildId)
    if (b && !b.releasedToUatAt) {
      b.releasedToUatAt = at
      b.releasedBy = null
      s.defects = markReadyForRetest(s.defects, b, 'UAT', new Date(at))
      notify(s, { to: [...teamMembers(p, 'STAKEHOLDER'), ...teamMembers(p, 'PM')], type: 'build', title: `Build ${b.version} is ready for UAT`, body: `${p.name}: SQA signed off build ${b.version}. UAT can start.`, link: `/projects/${p.id}/testing/UAT`, projectId: p.id, at })
      audit(s, { projectId: p.id, actorId: null, action: 'Build released to UAT', details: `${b.version} (automatically, on SQA sign-off)`, at })
    }
  }
  if (doc.type === 'UAT_SIGNOFF') notify(s, { to: [p.ownerId], type: 'complete', title: `${p.name}: documentation complete`, body: 'UAT is signed. You may archive the project.', link: `/projects/${p.id}`, projectId: p.id, at })
  // A change request closes once every affected document is approved again.
  const ctx = pipelineCtx(s, p.id)
  for (const cr of s.changeRequests.filter((c) => c.projectId === p.id && c.status === 'reapproval')) {
    if (PIPELINE.every((t) => !ctx.docs.find((d) => d.type === t && d.currentVersionId) || isComplete(ctx, t))) {
      cr.status = 'closed'
      cr.closedAt = at
      audit(s, { projectId: p.id, actorId: null, action: 'Change request closed', details: cr.title, at })
    }
  }
}

export async function approve(docId: ID) {
  return act((s, t, at) => {
    const user = me(s)
    const doc = docById(s, docId)
    const p = projectOf(s, doc.projectId)
    const chain = activeChain(pipelineCtx(s, p.id), doc)
    if (!chain || chain.status !== 'in_progress') fail('Nothing is waiting for approval.')
    const r = approveRule(chain, p, user.id, t)
    s.chains = s.chains.map((c) => (c.id === chain.id ? r.chain : c))
    const step = r.chain.steps.find((x) => x.actedAt === at && x.actedBy === user.id)
    audit(s, { projectId: p.id, actorId: user.id, actingFor: step?.actingFor, action: 'Approved', details: `${DOC_LABEL[doc.type]} as ${ROLE_LABEL[step?.role ?? 'PM'].toLowerCase()}${step?.actingFor ? ` (deputy for ${nameOf(s, step.actingFor)})` : ''}`, at })
    if (r.finished) afterChainFinished(s, doc, r.chain, at, user)
    else {
      const next = r.nextStep!
      const v = s.versions.find((x) => x.id === chain.versionId)!
      notify(s, { to: [headRecipient(p, next.assigneeId, t)], type: 'approval', title: `Your turn to ${next.sign ? 'approve and sign' : 'approve'}: ${DOC_LABEL[doc.type]} v${v.number}`, body: `${p.name}: approved by ${user.name}. It is now your turn.`, link: docLink(doc), projectId: p.id, at })
    }
  })
}

export async function requestChanges(docId: ID, comment: string) {
  return act((s, t, at) => {
    const user = me(s)
    const doc = docById(s, docId)
    const p = projectOf(s, doc.projectId)
    const chain = activeChain(pipelineCtx(s, p.id), doc)
    if (!chain || chain.status !== 'in_progress') fail('Nothing is waiting for approval.')
    const r = requestChangesRule(chain, p, user.id, comment, t)
    s.chains = s.chains.map((c) => (c.id === chain.id ? r.chain : c))
    const step = r.chain.steps.find((x) => x.status === 'changes_requested')!
    if (CHAIN_CONFIG[doc.type].comments)
      s.comments.push({ id: newId('cmt'), docId, projectId: p.id, createdOnVersionId: chain.versionId, versionId: chain.versionId, sectionId: null, quote: '', prefix: '', suffix: '', body: comment.trim(), authorId: user.id, authorTeam: ROLE_TEAM[step.role], mentions: [], status: 'open', reopenCount: 0, replies: [], createdAt: at, fromRequestChanges: true })
    notify(s, { to: teamMembers(p, doc.type === 'SQA_SIGNOFF' ? 'TECH' : 'PM'), type: 'changes', title: `Changes requested: ${DOC_LABEL[doc.type]}`, body: `${p.name}: ${user.name}${r.actingFor ? ` (for ${nameOf(s, r.actingFor)})` : ''} asked for changes: “${comment.trim()}”`, link: docLink(doc), projectId: p.id, at })
    audit(s, { projectId: p.id, actorId: user.id, actingFor: r.actingFor, action: 'Changes requested', details: `${DOC_LABEL[doc.type]}: ${comment.trim().slice(0, 100)}`, at })
  })
}

/** Email one-time code for re-authentication before signing (SPEC.md "Signing"). */
export async function sendSigningCode() {
  return act((s, t, at) => {
    const user = me(s)
    const code = String(Math.floor(100000 + Math.random() * 900000))
    s.otps[user.id] = { code, expiresAt: new Date(t.getTime() + 10 * 60000).toISOString() }
    const emailId = newId('mail')
    s.emails.unshift({ id: emailId, to: user.id, subject: 'Your signing code', body: `Hello ${user.name.split(' ')[0]},\n\nYour one-time code to sign is: ${code}\nIt expires in 10 minutes.\n\n— BRAC Project Management (prototype)`, createdAt: at })
    return { email: user.email, code }
  })
}

export async function approveAndSign(docId: ID, method: 'password' | 'email_otp', secret: string) {
  const s0 = await read((s) => s)
  const user = me(s0)
  const t = now()
  const doc = docById(s0, docId)
  const p = projectOf(s0, doc.projectId)
  const chain = activeChain(pipelineCtx(s0, p.id), doc)
  if (!chain) fail('Nothing to sign.')
  const check = ensure(canAct(chain, p, user.id, t))
  if (method === 'password' && !secret.trim()) fail('Enter your password to sign.')
  if (method === 'email_otp') {
    const otp = s0.otps[user.id]
    if (!otp || otp.code !== secret.trim()) fail('That code is not right. Check the email in the Mailbox.')
    if (new Date(otp.expiresAt) < t) fail('The code has expired. Send a new one.')
  }
  const v = currentVersion(s0, doc)!
  const signedAt = t.toISOString()
  const snapshot = { title: `${p.name} — ${DOC_LABEL[doc.type]}`, versionNumber: v.number, sections: v.sections.map((x) => ({ title: x.title, content: x.content })) }
  const ip = '10.20.4.17'
  const docHash = await sha256Hex(canonicalDocument(snapshot))
  const page = signaturePageText({ title: snapshot.title, versionNumber: v.number, signer: user.name, actingFor: check.actingFor ? nameOf(s0, check.actingFor) : undefined, signedAt, ip, method, docHash })
  const finalHash = await sha256Hex(canonicalDocument(snapshot) + '\n\n' + page)
  return act((s, t2, at) => {
    const ch = activeChain(pipelineCtx(s, p.id), docById(s, docId))!
    const r = signRule(ch, projectOf(s, p.id), user.id, t2)
    s.chains = s.chains.map((c) => (c.id === ch.id ? r.chain : c))
    s.signatures.push({ id: newId('sig'), projectId: p.id, docId, versionId: v.id, signerId: user.id, actingFor: r.actingFor, signedAt: at, ip, userAgent: navigator.userAgent, method, docHash, finalHash, snapshot })
    delete s.otps[user.id]
    audit(s, { projectId: p.id, actorId: user.id, actingFor: r.actingFor, action: 'Approved and signed', details: `${DOC_LABEL[doc.type]} v${v.number} · SHA-256 ${docHash.slice(0, 16)}… · final ${finalHash.slice(0, 16)}… · ${method === 'password' ? 'password' : 'email code'}`, at })
    afterChainFinished(s, docById(s, docId), r.chain, at, user)
    return { docHash, finalHash }
  })
}

// ─── Fact Sheet updates proposed from edits ─────────────────────────────

export async function decideFactUpdate(id: ID, accept: boolean) {
  return act((s, _t, at) => {
    const user = me(s)
    const f = s.factUpdates.find((x) => x.id === id)
    if (!f || f.status !== 'pending') fail('Already decided.')
    const p = projectOf(s, f.projectId)
    ensure(can.pmTeam(p, user.id, 'decide Fact Sheet updates'))
    Object.assign(f, { status: accept ? 'accepted' : 'rejected', decidedBy: user.id, decidedAt: at })
    if (accept) {
      const doc = docById(s, f.docId)
      const v = s.versions.find((x) => x.id === f.versionId)
      p.facts = p.facts.map((x) => (x.key === f.factKey ? { ...x, value: f.newValue, status: 'filled', source: { type: 'edit', ref: f.versionId, label: `Edit in ${DOC_LABEL[doc.type]} v${v?.number}` } } : x))
      const n = s.factSheets.filter((x) => x.projectId === p.id).length + 1
      s.factSheets.push({ id: newId('fs'), projectId: p.id, number: n, facts: structuredClone(p.facts), createdAt: at, createdBy: user.id, note: `${f.factLabel} updated from ${DOC_LABEL[doc.type]} v${v?.number}` })
      const fact = p.facts.find((x) => x.key === f.factKey)
      if (fact && ['scope', 'budget', 'timeline'].includes(fact.category)) {
        const crId = newId('cr')
        s.changeRequests.push({ id: crId, projectId: p.id, title: `Scope change: ${f.factLabel}`, description: `${f.factLabel} changed from “${f.oldValue}” to “${f.newValue}” in an edit of the ${DOC_LABEL[doc.type]}.`, trigger: 'edit', sourceLabel: `Fact Sheet update from ${DOC_LABEL[doc.type]} v${v?.number}`, status: 'impact_review', changedFactKeys: [f.factKey], impact: [], createdAt: at, createdBy: user.id })
        notify(s, { to: [headOf(p, 'PM')!.userId], type: 'scope', title: 'A Fact Sheet update changes scope', body: `${p.name}: ${f.factLabel} changed, so a change request was started. Run the impact analysis.`, link: `/projects/${p.id}/changes`, projectId: p.id, at })
      }
    }
    audit(s, { projectId: p.id, actorId: user.id, action: accept ? 'Fact Sheet update accepted' : 'Fact Sheet update rejected', details: `${f.factLabel}: “${f.newValue}”`, at })
  })
}

// ─── Traceability and printing ──────────────────────────────────────────

export async function buildTraceability(pid: ID) {
  const s0 = await read((s) => s)
  const user = me(s0)
  const p = projectOf(s0, pid)
  ensure(can.pmTeam(p, user.id, 'build the traceability matrix'))
  const n = s0.requirements.filter((r) => r.projectId === pid).length
  return runJob({
    agent: 'trace',
    title: 'Building the SRS traceability matrix',
    projectId: pid,
    byUserId: user.id,
    link: `/projects/${pid}/docs/SRS?tab=trace`,
    promptTokens: 300 * n + 500,
    steps: ['Reading SRS requirements', 'Linking each SRS requirement to a BRD requirement', 'Linking each BRD requirement to a Charter objective', 'Flagging requirements without a link'],
    apply: (s) => {
      s.traceLinksDone[pid] = true
      const reqs = s.requirements.filter((r) => r.projectId === pid)
      const unlinked = reqs.filter((r) => r.docType !== 'CHARTER' && (!r.parentId || !reqs.some((x) => x.id === r.parentId)))
      return unlinked.length ? `${unlinked.length} requirement${unlinked.length > 1 ? 's have' : ' has'} no link and ${unlinked.length > 1 ? 'are' : 'is'} flagged.` : 'Every requirement is linked.'
    },
  })
}

export async function printable(versionId: ID) {
  return read((s) => {
    const user = me(s)
    const v = s.versions.find((x) => x.id === versionId)
    if (!v) throw new ApiError(404, 'Version not found.')
    const doc = docById(s, v.docId)
    const p = projectOf(s, v.projectId)
    ensure(can.view(p, user))
    const signature = s.signatures.find((x) => x.versionId === v.id)
    const chain = s.chains.filter((c) => c.versionId === v.id && c.status !== 'cancelled').at(-1)
    return { project: p, doc, version: v, label: DOC_LABEL[doc.type], signature: signature ? { ...signature, signerName: nameOf(s, signature.signerId), actingForName: signature.actingFor ? nameOf(s, signature.actingFor) : undefined } : undefined, chainStatus: chain?.status, approvals: chain?.steps.filter((x) => x.actedAt).map((x) => ({ role: ROLE_LABEL[x.role], by: nameOf(s, x.actedBy), at: x.actedAt!, actingFor: x.actingFor ? nameOf(s, x.actingFor) : undefined })) ?? [] }
  })
}

export { memberOf, headOf }
