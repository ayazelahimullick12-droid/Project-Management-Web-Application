/**
 * Builds the starting demo data from the files in /seed (SIMULATED backend data).
 *
 * The seed files are written to be easy to read and edit (see seed/README.md). This loader
 * turns them into the full data model: ids, sections, versions, approval chains, signatures,
 * chats, testing records, plus the notifications and audit entries that history implies.
 *
 * All seed dates are shifted by whole weeks so the demo always starts on a recent Wednesday.
 */
import type {
  ApprovalChain, ApprovalStep, CandidateDecision, Chat, Comment, DemoState, Doc, DocType, DocVersion,
  Fact, FactDef, Member, Message, Project, Requirement, Section, Settings, Team, Template, TestStage, User,
} from '../types'
import { CHAIN_CONFIG, ROLE_TEAM } from '../rules/approval'
import { CHARTER_PREFIX, DOC_LABEL } from '../rules/pipeline'
import { contextAround, markdownToPlain, normalize } from '../rules/text'
import { buildReportSections, reportStats } from '../rules/signoffReport'
import { audit, notify } from '../api/effects'
import { waitingItems } from '../api/waiting'
import { canonicalDocument, sha256Hex, signaturePageText } from '../api/fingerprint'
import { allCannedText } from './ai/content'
import { signoffSummary } from './ai/agents'
import { weekShiftMs } from './clock'
import { parseSections } from './markdownSections'

import usersJson from '../../seed/users.json'
import settingsJson from '../../seed/settings.json'
import catalogJson from '../../seed/catalog.json'
import templatesJson from '../../seed/templates.json'
import teamTemplatesJson from '../../seed/team-templates.json'
import messagesJson from '../../seed/messages.json'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Raw = any

const projectFiles = import.meta.glob('../../seed/projects/*.json', { eager: true, import: 'default' }) as Record<string, Raw>
const docFiles = import.meta.glob('../../seed/docs/*/*.md', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>

function hash(text: string): string {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

/** Changes whenever any seed file changes, so the browser copy resets automatically. */
export const SEED_VERSION = hash(
  JSON.stringify([usersJson, settingsJson, catalogJson, templatesJson, teamTemplatesJson, messagesJson, projectFiles]) + Object.values(docFiles).join('') + allCannedText() + 'v2',
)

const SOURCE_LABEL: Record<string, string> = {
  description: 'Stakeholder description',
  answer: 'Answer in Q/A',
  upload: 'Uploaded file',
  manual: 'Entered by the PM team',
  transcript: 'Meeting transcript',
  chat: 'Chat decision',
}

/**
 * The starting data.
 * - Normally EMPTY: the users, settings, fact checklist and templates, but no projects. The clock is
 *   the real clock.
 * - withProjects: also the demo projects in seed/projects (and their messages), with the demo
 *   clock starting on a recent Wednesday morning (Demo menu → Reset → "Load the demo projects").
 */
export async function buildSeedState(options: { withProjects?: boolean } = {}): Promise<DemoState> {
  const withProjects = !!options.withProjects
  const shift = withProjects ? weekShiftMs(settingsJson.seedNow) : 0
  const T = (iso: string | undefined | null) => (iso ? new Date(new Date(iso).getTime() + shift).toISOString() : (undefined as unknown as string))
  const seedNow = withProjects ? T(settingsJson.seedNow) : new Date().toISOString()
  const nowDate = new Date(seedNow)

  const catalog = catalogJson as FactDef[]
  const templates: Template[] = (templatesJson as Raw[]).map((t) => ({ ...t, createdAt: T(t.createdAt) }))
  const users = usersJson as User[]

  const s: DemoState = {
    meta: { seedVersion: SEED_VERSION, seedNow, loadedAtReal: Date.now(), timeOffsetMs: 0, counter: 0 },
    settings: settingsJson.settings as Settings,
    users,
    projects: [],
    teamTemplates: (teamTemplatesJson as Raw[]).map((t) => ({ id: t.id, ownerId: t.ownerId, name: t.name, members: membersFrom(t.team) })),
    factCatalog: catalog,
    templates,
    factSheets: [], rounds: [], questions: [], uploads: [], ragRuns: [], ragSuggestions: [],
    docs: [], versions: [], drafts: [], locks: [], comments: [], suggestions: [], chains: [], signatures: [],
    changeRequests: [], factUpdates: [], chats: [], messages: [], calls: [], transcripts: [], decisions: [],
    notifications: [], emails: [], audit: [], aiCalls: [], jobs: [], summaries: {}, reminders: {}, otps: {}, chatReads: {},
    requirements: [], traceLinksDone: {}, testPoints: [], productVersions: [], pointChecks: [],
  }

  const signTasks: Promise<void>[] = []

  for (const raw of withProjects ? Object.values(projectFiles) : []) {
    const p: Project = {
      id: raw.id,
      slug: raw.slug,
      name: raw.name,
      description: raw.description,
      ownerId: raw.ownerId,
      status: 'active',
      createdAt: T(raw.createdAt),
      members: membersFrom(raw.team),
      away: (raw.away ?? []).map((a: Raw) => ({ ...a, from: T(a.from), to: T(a.to) })),
      templateVersions: { PROPOSAL: 1, BRD: 1, SRS: 1 },
      facts: (raw.facts ?? []).map((f: Raw) => factFrom(f, catalog)),
      intake: { ...raw.intake },
      finished: raw.finished,
      finishedYear: raw.finishedYear,
      department: raw.department,
      summary: raw.summary,
    }
    s.projects.push(p)
    const head = (team: Team) => p.members.find((m) => m.team === team && m.isHead)?.userId ?? p.ownerId
    const teamOfUser = (uid: string): Team | 'OWNER' => p.members.find((m) => m.userId === uid)?.team ?? 'OWNER'

    // Fact Sheet versions, rounds and questions
    for (const fs of raw.factSheets ?? [])
      s.factSheets.push({ id: `${p.id}-fs${fs.number}`, projectId: p.id, number: fs.number, facts: structuredClone(p.facts), createdAt: T(fs.at), createdBy: fs.by ?? null, note: fs.note, confirmedBy: fs.confirmedBy })
    for (const r of raw.rounds ?? []) s.rounds.push({ id: r.id, projectId: p.id, purpose: r.purpose, number: r.number, status: r.status, startedAt: T(r.startedAt), closedAt: T(r.closedAt) })
    ;(raw.questions ?? []).forEach((q: Raw, i: number) => {
      const def = catalog.find((d) => d.key === q.factKey)
      s.questions.push({
        id: `${p.id}-q${i + 1}`, projectId: p.id, roundId: q.round, factKey: q.factKey, text: def?.question ?? q.factKey, team: q.team,
        assigneeIds: p.members.filter((m) => m.team === q.team && !m.isSqa).map((m) => m.userId), createdAt: T(q.createdAt),
        answer: q.answer, answeredBy: q.answeredBy, answeredAt: T(q.answeredAt), sampleAnswer: def?.sample,
      })
    })

    // Chats: one per project, one per document
    const projectChat: Chat = { id: `${p.id}-chat`, projectId: p.id, kind: 'project', title: 'Project chat' }
    s.chats.push(projectChat)

    // Documents, versions, chains, signatures
    const docByType = new Map<string, Doc>()
    const versionsByDoc = new Map<string, DocVersion[]>()
    for (const d of raw.documents ?? []) {
      const type = d.type as DocType
      const doc: Doc = { id: `${p.id}-${type}`, projectId: p.id, type, title: DOC_LABEL[type] }
      docByType.set(type, doc)
      s.docs.push(doc)
      s.chats.push({ id: `${doc.id}-chat`, projectId: p.id, kind: 'document', docId: doc.id, title: `${DOC_LABEL[type]} chat` })
      const template = templates.find((t) => t.docType === type)
      // "files": the Proposal & Charter has two files; the second one's section keys get the charter_ prefix.
      const fileNames: string[] = d.files ?? [d.file]
      const fileText = (name: string) => Object.entries(docFiles).find(([path]) => path.endsWith(`/${p.slug}/${name}`))?.[1] ?? ''
      const raws = fileNames.flatMap((name, i) => parseSections(fileText(name)).map((sec) => ({ ...sec, key: i > 0 ? CHARTER_PREFIX + sec.key : sec.key })))
      let sections: Section[] = raws.map((sec) => ({
        id: `${doc.id}:${sec.key}`, key: sec.key, title: sec.title, content: sec.content,
        factKeys: template?.sections.find((t) => t.key === sec.key)?.factKeys ?? [],
      }))
      const versions: DocVersion[] = []
      d.versions.forEach((v: Raw, i: number) => {
        if (v.changes) sections = sections.map((sec) => (v.changes[sec.key] ? { ...sec, content: v.changes[sec.key] } : sec))
        versions.push({
          id: `${doc.id}-v${i + 1}`, docId: doc.id, projectId: p.id, number: i + 1, authorId: v.by ?? null, message: v.message, kind: v.kind,
          sections: structuredClone(sections), regeneratedSectionIds: (v.regenerated ?? []).map((k: string) => `${doc.id}:${k}`),
          factSheetVersion: Math.max(1, (raw.factSheets ?? []).length), templateVersion: 1, frozen: false, createdAt: T(v.at),
          scopeCheck: v.scopeCheck ? { ...v.scopeCheck, decidedAt: T(v.at) } : undefined,
        })
      })
      versionsByDoc.set(doc.id, versions)
      s.versions.push(...versions)
      doc.currentVersionId = versions.at(-1)?.id

      ;(d.chains ?? []).forEach((c: Raw, ci: number) => {
        const version = versions[c.version - 1]
        const roles = CHAIN_CONFIG[type].steps
        const steps: ApprovalStep[] = roles.map((role, i) => {
          const st = c.steps[i] ?? { s: 'waiting' }
          const assigneeId = head(ROLE_TEAM[role])
          return {
            role, assigneeId, status: st.s, sign: CHAIN_CONFIG[type].signs && role === 'SPONSOR_HEAD',
            pendingSince: st.s === 'pending' ? T(st.at) : undefined,
            actedAt: st.s !== 'pending' && st.s !== 'waiting' ? T(st.at) : undefined,
            actedBy: st.s === 'approved' || st.s === 'changes_requested' ? (st.by ?? assigneeId) : undefined,
            actingFor: st.for, comment: st.comment,
          }
        })
        const chain: ApprovalChain = {
          id: `${doc.id}-c${ci + 1}`, docId: doc.id, projectId: p.id, versionId: version.id, status: c.status, steps,
          startedAt: T(c.at), startedBy: head('PM'), endedAt: c.status === 'in_progress' ? undefined : steps.filter((x) => x.actedAt).at(-1)?.actedAt,
        }
        s.chains.push(chain)
        if (c.status === 'approved' || c.status === 'signed') version.frozen = true
        if (c.status === 'changes_requested') {
          const st = steps.find((x) => x.status === 'changes_requested')!
          s.comments.push({
            id: `${chain.id}-rc`, docId: doc.id, projectId: p.id, createdOnVersionId: version.id, versionId: version.id, sectionId: null, quote: '', prefix: '', suffix: '',
            body: st.comment ?? 'Changes requested.', authorId: st.actedBy!, authorTeam: ROLE_TEAM[st.role], mentions: [], status: 'resolved', resolvedHow: 'ticked',
            resolvedBy: head('PM'), resolvedOnVersionId: versions[c.version]?.id ?? version.id, reopenCount: 0, replies: [], createdAt: st.actedAt!, fromRequestChanges: true,
          })
        }
        if (c.status === 'signed') {
          const signStep = steps.at(-1)!
          signTasks.push(makeSignature(s, p, doc, version, signStep.actedBy!, signStep.actedAt!, signStep.actingFor))
        }
      })
    }

    // Comments and suggestions (anchored by section, quote and a little context)
    const anchor = (docType: string, versionNo: number, sectionKey: string | null, quote: string) => {
      const doc = docByType.get(docType)!
      const version = versionsByDoc.get(doc.id)![versionNo - 1]
      const section = sectionKey ? version.sections.find((x) => x.key === sectionKey) : undefined
      const plain = section ? markdownToPlain(section.content) : ''
      const idx = plain.indexOf(normalize(quote))
      const ctx = idx >= 0 ? contextAround(plain, idx, normalize(quote).length) : { prefix: '', suffix: '' }
      return { doc, version, section, ...ctx }
    }
    ;(raw.comments ?? []).forEach((c: Raw, i: number) => {
      const a = anchor(c.doc, c.version, c.section, c.quote)
      const versions = versionsByDoc.get(a.doc.id)!
      const resolvedOn = c.resolvedOnVersion ? versions[c.resolvedOnVersion - 1]?.id : undefined
      const comment: Comment = {
        id: `${p.id}-cm${i + 1}`, docId: a.doc.id, projectId: p.id, createdOnVersionId: a.version.id,
        versionId: c.status === 'open' ? a.doc.currentVersionId! : resolvedOn ?? a.version.id, sectionId: a.section?.id ?? null,
        quote: c.quote, prefix: a.prefix, suffix: a.suffix, body: c.body, authorId: c.by, authorTeam: teamOfUser(c.by), mentions: c.mentions ?? [],
        status: c.status, pendingReason: c.pendingReason, resolvedHow: c.resolvedHow, resolvedBy: c.resolvedBy, resolvedOnVersionId: resolvedOn,
        reopenCount: 0, replies: (c.replies ?? []).map((r: Raw, j: number) => ({ id: `${p.id}-cm${i + 1}-r${j}`, authorId: r.by, body: r.body, createdAt: T(r.at) })), createdAt: T(c.at),
      }
      s.comments.push(comment)
    })
    ;(raw.suggestions ?? []).forEach((g: Raw, i: number) => {
      const a = anchor(g.doc, g.version, g.section, g.quote)
      s.suggestions.push({ id: `${p.id}-sg${i + 1}`, docId: a.doc.id, projectId: p.id, versionId: a.version.id, sectionId: a.section!.id, quote: g.quote, prefix: a.prefix, suffix: a.suffix, proposed: g.proposed, authorId: g.by, status: g.status, createdAt: T(g.at) })
    })
    ;(raw.factUpdates ?? []).forEach((f: Raw, i: number) => {
      const doc = docByType.get(f.doc)!
      const def = catalog.find((d) => d.key === f.factKey)
      s.factUpdates.push({ id: `${p.id}-fu${i + 1}`, projectId: p.id, docId: doc.id, versionId: `${doc.id}-v${f.version}`, factKey: f.factKey, factLabel: def?.label ?? f.factKey, oldValue: f.oldValue, newValue: f.newValue, excerpt: f.excerpt, status: 'pending', createdAt: T(f.at) })
    })

    // Messages, decisions and a meeting transcript
    const chatId = (name: string) => (name === 'project' ? projectChat.id : `${p.id}-${name.replace('doc:', '')}-chat`)
    ;(raw.messages ?? []).forEach((m: Raw, i: number) => {
      const msg: Message = { id: `${p.id}-m${i + 1}`, chatId: chatId(m.chat), authorId: m.by, body: m.body, createdAt: T(m.at), kind: m.by ? 'text' : 'system', reactions: m.reactions }
      if (m.decisionBy) {
        const dec: CandidateDecision = { id: `${p.id}-dec${i + 1}`, projectId: p.id, source: 'chat', chatId: msg.chatId, messageId: msg.id, text: m.body, ai: false, markedBy: m.decisionBy, status: 'pending', createdAt: T(m.at) }
        s.decisions.push(dec)
        msg.decisionId = dec.id
      }
      s.messages.push(msg)
    })
    if (raw.transcript) {
      const t = raw.transcript
      const cId = chatId(t.chat)
      const callId = `${p.id}-call1`
      const speakers: string[] = [...new Set<string>(t.segments.map((x: Raw) => x.speaker))]
      s.calls.push({ id: callId, chatId: cId, kind: t.kind ?? 'voice', startedBy: t.by, startedAt: T(t.at), endedAt: new Date(new Date(T(t.at)).getTime() + 25 * 60000).toISOString(), transcription: true, participantIds: speakers })
      const trId = `${p.id}-tr1`
      s.transcripts.push({ id: trId, chatId: cId, projectId: p.id, source: 'call', callId, createdAt: new Date(new Date(T(t.at)).getTime() + 40 * 60000).toISOString(), segments: t.segments.map((x: Raw) => ({ speakerId: x.speaker, speaker: users.find((u) => u.id === x.speaker)?.name ?? x.speaker, raw: x.raw, corrected: x.corrected })) })
      s.messages.push({ id: `${p.id}-mcall`, chatId: cId, authorId: null, kind: 'call', body: `Video call started by ${users.find((u) => u.id === t.by)?.name}. This meeting was transcribed.`, createdAt: T(t.at) })
      s.messages.push({ id: `${p.id}-mtr`, chatId: cId, authorId: null, kind: 'transcript', body: 'Meeting transcript (corrected by AI, raw transcript kept).', transcriptId: trId, createdAt: new Date(new Date(T(t.at)).getTime() + 40 * 60000).toISOString() })
      t.decisions.forEach((d: Raw, i: number) =>
        s.decisions.push({ id: `${p.id}-tdec${i + 1}`, projectId: p.id, source: 'transcript', chatId: cId, transcriptId: trId, text: d.text, ai: true, status: 'pending', factKey: d.factKey, createdAt: new Date(new Date(T(t.at)).getTime() + 41 * 60000).toISOString() }),
      )
    }

    // Change requests (with their focused Q/A round)
    for (const cr of raw.changeRequests ?? []) {
      const roundId = `${cr.id}-round`
      s.rounds.push({ id: roundId, projectId: p.id, purpose: 'change_request', number: 1, status: 'open', startedAt: T(cr.at), changeRequestId: cr.id })
      s.changeRequests.push({ id: cr.id, projectId: p.id, title: cr.title, description: cr.description, trigger: cr.trigger, sourceLabel: cr.sourceLabel, status: cr.status, roundId, changedFactKeys: cr.changedFactKeys, impact: [], createdAt: T(cr.at), createdBy: cr.by })
      if (cr.question)
        s.questions.push({ id: `${cr.id}-q1`, projectId: p.id, roundId, factKey: cr.question.factKey, text: cr.question.text, team: cr.question.team, assigneeIds: p.members.filter((m) => m.team === cr.question.team).map((m) => m.userId), createdAt: T(cr.at) })
    }

    // Requirements (for traceability and test coverage)
    for (const r of raw.requirements ?? []) {
      const req: Requirement = { id: r[0], projectId: p.id, docType: r[1], text: r[2], parentId: r[3] ?? undefined }
      if (r[4]) req.notTestable = { reason: r[4], by: head('PM'), at: seedNow }
      s.requirements.push(req)
    }
    if (raw.traceabilityBuilt) s.traceLinksDone[p.id] = true

    if (raw.testing) loadTesting(s, p, raw.testing, T, head, docByType)
  }

  if (withProjects) loadDirectMessages(s, T)

  await Promise.all(signTasks)
  deriveAudit(s)
  for (const item of waitingItems(s, nowDate))
    notify(s, { to: item.recipients, type: item.type, title: item.title, body: item.body, link: item.link, projectId: item.projectId, at: item.since < seedNow ? item.since : seedNow })
  s.notifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  s.emails.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return s
}

function membersFrom(team: Raw): Member[] {
  const out: Member[] = []
  for (const t of ['PM', 'TECH', 'STAKEHOLDER', 'SPONSOR'] as Team[]) {
    const g = team?.[t]
    if (!g) continue
    if (g.head) out.push({ userId: g.head, team: t, isHead: true })
    if (g.deputy) out.push({ userId: g.deputy, team: t, isDeputy: true })
    for (const id of g.members ?? []) out.push({ userId: id, team: t })
    for (const id of g.sqa ?? []) out.push({ userId: id, team: t, isSqa: true })
  }
  return out
}

function factFrom(f: Raw, catalog: FactDef[]): Fact {
  const def = catalog.find((d) => d.key === f.key)
  return { key: f.key, label: def?.label ?? f.label ?? f.key, category: def?.category ?? 'other', value: f.value, status: f.status ?? 'filled', source: { type: f.source ?? 'manual', label: SOURCE_LABEL[f.source] ?? 'Entered by the PM team' } }
}

async function makeSignature(s: DemoState, p: Project, doc: Doc, version: DocVersion, signerId: string, at: string, actingFor?: string) {
  const snapshot = { title: `${p.name} — ${DOC_LABEL[doc.type]}`, versionNumber: version.number, sections: version.sections.map((x) => ({ title: x.title, content: x.content })) }
  const docHash = await sha256Hex(canonicalDocument(snapshot))
  const name = (id?: string) => s.users.find((u) => u.id === id)?.name ?? ''
  const ip = '10.20.4.17'
  const page = signaturePageText({ title: snapshot.title, versionNumber: version.number, signer: name(signerId), onBehalf: actingFor ? `deputy for ${name(actingFor)}` : undefined, signedAt: at, ip, method: 'password', docHash })
  const finalHash = await sha256Hex(canonicalDocument(snapshot) + '\n\n' + page)
  s.signatures.push({ id: `${version.id}-sig`, projectId: p.id, docId: doc.id, versionId: version.id, signerId, actingFor, signedAt: at, ip, userAgent: 'Seed data (prototype)', method: 'password', docHash, finalHash, snapshot })
}

function loadTesting(s: DemoState, p: Project, t: Raw, T: (x: string) => string, head: (t: Team) => string, docByType: Map<string, Doc>) {
  const pointId = (key: string) => `${p.id}-${key}`
  const versionId = (id: string) => `${p.id}-${id}`
  const created = T('2026-08-20T10:00:00+06:00')
  for (const x of t.points ?? [])
    s.testPoints.push({ id: pointId(x.key), projectId: p.id, stage: x.stage, key: x.key, text: x.text, requirementIds: x.req ?? [], ai: false, changedAt: created, createdBy: null, createdAt: created, history: [{ by: null, at: created, text: `Written by AI from ${(x.req ?? []).join(', ')}` }, { by: x.stage === 'SQA' ? 'u-sqa1' : 'u-pm1', at: created, text: 'Edited' }] })
  for (const v of t.versions ?? []) s.productVersions.push({ id: versionId(v.id), projectId: p.id, version: v.version, notes: v.notes ?? '', link: v.link ?? '', addedBy: v.by, addedAt: T(v.at) })
  for (const c of t.checks ?? [])
    c.results.forEach((r: Raw[], i: number) => {
      const [key, result, by, comment] = r as [string, 'pass' | 'fail', string, string | undefined]
      const at = new Date(new Date(T(c.at)).getTime() + (i + 1) * 25 * 60000).toISOString()
      s.pointChecks.push({ id: `${p.id}-chk-${c.version}-${key}`, projectId: p.id, stage: c.stage, pointId: pointId(key), versionId: versionId(c.version), result, comment, by, at })
    })
  for (const so of t.signoffs ?? []) {
    const type = so.type as DocType
    const stage: TestStage = type === 'SQA_SIGNOFF' ? 'SQA' : 'UAT'
    const doc: Doc = { id: `${p.id}-${type}`, projectId: p.id, type, title: DOC_LABEL[type] }
    docByType.set(type, doc)
    s.docs.push(doc)
    const version = s.productVersions.find((v) => v.id === versionId(so.version))
    // The report as it was then: checks made up to the sign-off date.
    const input = { stage, version, requirements: s.requirements.filter((r) => r.projectId === p.id), points: s.testPoints.filter((x) => x.projectId === p.id && x.stage === stage), checks: s.pointChecks.filter((c) => c.projectId === p.id && c.stage === stage && c.at <= T(so.at)) }
    const sections = buildReportSections({ ...input, versions: s.productVersions.filter((v) => v.projectId === p.id), users: s.users, summary: signoffSummary(stage, reportStats(input), version?.version) }).map((x) => ({ id: `${doc.id}:${x.key}`, key: x.key, title: x.title, content: x.content, factKeys: [] }))
    const dv: DocVersion = { id: `${doc.id}-v1`, docId: doc.id, projectId: p.id, number: 1, authorId: so.by, message: `Report made for version ${version?.version}`, kind: 'report', sections, testedVersionId: version?.id, regeneratedSectionIds: [], factSheetVersion: 1, templateVersion: 1, frozen: true, createdAt: T(so.at) }
    s.versions.push(dv)
    doc.currentVersionId = dv.id
    const techHead = head('TECH')
    s.chains.push({ id: `${doc.id}-c1`, docId: doc.id, projectId: p.id, versionId: dv.id, status: 'approved', startedAt: T(so.at), startedBy: so.by, endedAt: T(so.approvedAt), steps: [{ role: 'TECH_HEAD', assigneeId: techHead, status: 'approved', actedAt: T(so.approvedAt), actedBy: techHead }] })
    s.chats.push({ id: `${doc.id}-chat`, projectId: p.id, kind: 'document', docId: doc.id, title: `${DOC_LABEL[type]} chat` })
  }
}

/** Audit entries implied by the seeded history. */
function deriveAudit(s: DemoState) {
  const name = (id?: string | null) => (id ? (s.users.find((u) => u.id === id)?.name ?? id) : 'AI')
  for (const v of s.versions) {
    const doc = s.docs.find((d) => d.id === v.docId)!
    audit(s, { projectId: v.projectId, actorId: v.authorId, action: v.authorId ? 'Version saved' : 'AI generation', details: `${DOC_LABEL[doc.type]} v${v.number}: ${v.message}`, at: v.createdAt })
  }
  for (const c of s.chains) {
    const doc = s.docs.find((d) => d.id === c.docId)!
    for (const st of c.steps.filter((x) => x.actedAt)) {
      const what = st.status === 'changes_requested' ? 'Changes requested' : st.sign && c.status === 'signed' ? 'Approved and signed' : 'Approved'
      audit(s, { projectId: c.projectId, actorId: st.actedBy, actingFor: st.actingFor, action: what, details: `${DOC_LABEL[doc.type]} (${name(st.actedBy)})${st.comment ? `: “${st.comment}”` : ''}`, at: st.actedAt! })
    }
  }
  for (const sig of s.signatures) audit(s, { projectId: sig.projectId, actorId: sig.signerId, action: 'Signature recorded', details: `SHA-256 ${sig.docHash.slice(0, 16)}… (final ${sig.finalHash.slice(0, 16)}…)`, at: sig.signedAt })
  for (const f of s.factSheets.filter((x) => x.confirmedBy)) audit(s, { projectId: f.projectId, actorId: f.confirmedBy, action: 'Fact Sheet confirmed', details: `Version ${f.number}`, at: f.createdAt })
  for (const p of s.projects) audit(s, { projectId: p.id, actorId: p.ownerId, action: 'Project created', details: p.name, at: p.createdAt })
  s.audit.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** Direct messages and "last read" times from seed/messages.json. */
function loadDirectMessages(s: DemoState, T: (iso: string) => string) {
  const raw = messagesJson as Raw
  raw.direct.forEach((d: Raw, i: number) => {
    const [a, b] = d.between as string[]
    const shared = s.projects.find((p) => p.status === 'active' && !p.finished && p.members.some((m) => m.userId === a) && p.members.some((m) => m.userId === b))
    const id = `dm-${i + 1}`
    s.chats.push({ id, projectId: shared?.id ?? null, kind: 'direct', memberIds: [a, b] })
    d.messages.forEach((m: Raw, j: number) => s.messages.push({ id: `${id}-m${j + 1}`, chatId: id, authorId: m.by, body: m.body, createdAt: T(m.at), kind: 'text', reactions: m.reactions }))
  })
  for (const r of raw.lastRead as Raw[]) {
    const [pid, kind, type] = String(r.chat).split(':')
    const chatId = pid === 'dm' ? `dm-${kind}` : kind === 'project' ? `${pid}-chat` : `${pid}-${type}-chat`
    s.chatReads[`${r.user}:${chatId}`] = T(r.at)
  }
}
