/**
 * The simulated AI agents (SIMULATED).
 *
 * Each function stands in for one agent in BUILD_PROMPT.md section 3.1. Where pre-written
 * content exists for a project (seed/ai/<slug>.json and .md) it is used; otherwise a simple,
 * predictable result is built from the project's own data so every button still does something.
 *
 * In the real app each of these is a prompt to the local LLM in LM Studio, run by the worker.
 */
import { diffWords } from 'diff'
import type { Defect, DocType, Fact, FactDef, Project, Requirement, Section, Template, TestCase, TestStage } from '../../types'
import { fillPlaceholders, markdownToPlain, normalize } from '../../rules/text'
import { parseSections } from '../markdownSections'
import { cannedDoc, cannedFor } from './content'

const sentences = (text: string) => text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? []

// ─── Q/A agent ──────────────────────────────────────────────────────────

/** Reads the stakeholder description (and uploads) and proposes facts. */
export function extractFacts(project: Project, catalog: FactDef[], uploadNames: string[]): Fact[] {
  const canned = cannedFor(project.slug)?.extraction
  const def = (key: string) => catalog.find((d) => d.key === key)
  if (canned) {
    return canned.map((c) => {
      const d = def(c.key)
      const fact: Fact = {
        key: c.key,
        label: d?.label ?? c.key,
        category: d?.category ?? 'other',
        value: c.value,
        status: 'filled',
        source: { type: 'description', label: 'Stakeholder description' },
        ai: true,
      }
      if (c.conflictFromUpload && uploadNames.length) {
        fact.status = 'conflicting'
        fact.conflict = [
          { value: c.value, source: { type: 'description', label: 'Stakeholder description' } },
          { value: c.conflictFromUpload, source: { type: 'upload', label: `Upload: ${uploadNames[0]}` } },
        ]
      }
      return fact
    })
  }
  // Generic: the first sentences of the description become the problem and objectives.
  const s = sentences(project.intake.description)
  const out: Fact[] = []
  if (s[0]) out.push({ key: 'problem', label: def('problem')?.label ?? 'Problem', category: 'scope', value: s[0], status: 'filled', source: { type: 'description', label: 'Stakeholder description' }, ai: true })
  if (s[1]) out.push({ key: 'objectives', label: def('objectives')?.label ?? 'Objectives', category: 'scope', value: s.slice(1, 3).join(' '), status: 'filled', source: { type: 'description', label: 'Stakeholder description' }, ai: true })
  return out
}

/** OCR / text extraction of an uploaded file. */
export function readUpload(project: Project, fileName: string): { text: string; pages: number; ocrUsed: boolean } {
  const canned = cannedFor(project.slug)?.uploadOcr
  const scanned = /\.(png|jpe?g|tiff?|pdf)$/i.test(fileName)
  if (canned) return { text: canned.text, pages: canned.pages, ocrUsed: scanned }
  return {
    text: `Text extracted from “${fileName}” (simulated). In the real app, PyMuPDF reads the text layer and Tesseract (English + Bangla) reads scanned pages.`,
    pages: 1,
    ocrUsed: scanned,
  }
}

export function questionFor(def: FactDef): { text: string; sample?: string } {
  return { text: def.question ?? `Please provide: ${def.label}.`, sample: def.sample }
}

// ─── RAG agent ──────────────────────────────────────────────────────────

const STOP = new Set('the a an and or of to in on for with is are be it this that as at by from we our they their will must can should not no so only also more less than then have has was were each every'.split(' '))
export const words = (t: string) => new Set(t.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)))

/** Word-overlap similarity (stands in for embedding similarity). */
export function similarity(a: string, b: string): number {
  const A = words(a)
  const B = words(b)
  if (!A.size || !B.size) return 0
  let common = 0
  for (const w of A) if (B.has(w)) common++
  return common / Math.min(A.size, B.size)
}

export function ragMatches(project: Project, finished: Project[], topK: number) {
  const canned = cannedFor(project.slug)?.rag
  if (canned) return { matches: canned.matches.slice(0, topK), suggestions: canned.suggestions }
  const query = `${project.name} ${project.description} ${project.intake.description}`
  const matches = finished
    .map((p) => {
      const score = Math.min(0.89, Math.round(similarity(query, `${p.name} ${p.summary ?? p.description}`) * 100) / 100)
      const shared = [...words(query)].filter((w) => words(`${p.name} ${p.summary ?? ''}`).has(w)).slice(0, 4)
      return { projectId: p.id, score, why: shared.length ? [`Shared topics: ${shared.join(', ')}`] : ['Similar kind of project'], sections: [] as { docType: DocType; sectionKey: string; title: string; excerpt: string }[] }
    })
    .filter((m) => m.score > 0.1)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
  return { matches, suggestions: [] }
}

// ─── Document agent ─────────────────────────────────────────────────────

/** Drafts a document section by section from the template and the Fact Sheet. */
export function draftDocument(project: Project, type: DocType, template: Template, facts: Fact[]): { key: string; title: string; content: string; factKeys: string[] }[] {
  const value = (key: string) => {
    const f = facts.find((x) => x.key === key)
    return f && f.status !== 'missing' && f.value ? f.value : undefined
  }
  const canned = cannedDoc(project.slug, type)
  const cannedSections = canned ? parseSections(canned) : []
  return template.sections.map((ts) => {
    const c = cannedSections.find((s) => s.key === ts.key)
    if (c) return { key: ts.key, title: ts.title, content: fillPlaceholders(c.content, project.name, value), factKeys: ts.factKeys }
    const lines = ts.factKeys.map((k) => {
      const f = facts.find((x) => x.key === k)
      return f?.value ? `- **${f.label}:** ${f.value}` : `- **${k.replace(/_/g, ' ')}:** to be confirmed.`
    })
    return { key: ts.key, title: ts.title, content: `${ts.guidance} For ${project.name}:\n\n${lines.join('\n')}`, factKeys: ts.factKeys }
  })
}

/** Rewrites one section from an edit prompt. The result is shown as a diff to accept or reject. */
export function regenerateSection(project: Project, type: DocType, section: Section, prompt: string, facts: Fact[]): string {
  const canned = cannedFor(project.slug)?.regen?.[`${type}:${section.key}`]
  const value = (key: string) => facts.find((f) => f.key === key && f.value)?.value
  if (canned) return fillPlaceholders(canned, project.name, value)
  const wantsLonger = /detail|expand|longer|more/i.test(prompt)
  const blocks = section.content.split(/\n\s*\n/)
  if (wantsLonger) return `${section.content}\n\nIn practice this means the project team will confirm each point above with the stakeholders before the next version.`
  const condensed = blocks
    .map((b) => {
      if (/^\s*([-*]|\d+\.)\s/m.test(b) || b.trim().startsWith('|')) return b // keep lists and tables
      const s = sentences(b)
      return s.length > 1 ? s.slice(0, Math.max(1, Math.ceil(s.length / 2))).join(' ') : b
    })
    .join('\n\n')
  if (normalize(condensed) !== normalize(section.content)) return condensed
  // Nothing to shorten: turn sentences into a short list instead.
  return sentences(markdownToPlain(section.content)).map((s) => `- ${s}`).join('\n')
}

/** Scope check: does the edit touch objectives, deliverables, budget or timeline? */
export function scopeCheck(template: Template | undefined, before: Section[], after: Section[]) {
  const changed = after.filter((s) => normalize(before.find((b) => b.id === s.id)?.content ?? '') !== normalize(s.content))
  const sensitive = changed.filter((s) => template?.sections.find((t) => t.key === s.key)?.scopeSensitive)
  return {
    changedTitles: changed.map((s) => s.title),
    flagged: sensitive.length > 0,
    sectionTitles: sensitive.map((s) => s.title),
    reason: sensitive.length
      ? `The edit changes ${sensitive.map((s) => `“${s.title}”`).join(', ')}, which cover objectives, deliverables, budget or timeline.`
      : changed.length
        ? 'The edit does not touch objectives, deliverables, budget or timeline.'
        : 'No text changed.',
  }
}

/** Fact change detection on a manual edit: which Fact Sheet values no longer match the text? */
export function detectFactChanges(facts: Fact[], before: Section[], after: Section[]) {
  const proposals: { factKey: string; factLabel: string; oldValue: string; newValue: string; excerpt: string }[] = []
  for (const s of after) {
    const old = before.find((b) => b.id === s.id)
    if (!old || normalize(old.content) === normalize(s.content)) continue
    const oldText = markdownToPlain(old.content)
    const newText = markdownToPlain(s.content)
    const parts = diffWords(oldText, newText)
    for (const f of facts) {
      if (!f.value || f.value.length > 160 || !s.factKeys.includes(f.key)) continue
      const idx = oldText.indexOf(f.value)
      if (idx === -1 || newText.includes(f.value)) continue
      // Rebuild the new text that took the place of the old value.
      let pos = 0
      let replaced = ''
      for (const p of parts) {
        const len = p.removed || !p.added ? p.value.length : 0
        const start = pos
        const end = pos + len
        if (p.added) {
          if (pos >= idx && pos <= idx + f.value.length) replaced += p.value
        } else if (!p.removed) {
          const a = Math.max(start, idx)
          const b = Math.min(end, idx + f.value.length)
          if (a < b) replaced += p.value.slice(a - start, b - start)
        }
        pos = end
      }
      const newValue = normalize(replaced)
      if (newValue && newValue !== f.value) proposals.push({ factKey: f.key, factLabel: f.label, oldValue: f.value, newValue, excerpt: newValue })
    }
  }
  return proposals
}

/** Rewrites affected sections after a Fact Sheet change (change request / Out of sync). */
export function updateForFacts(section: Section, changes: { label: string; oldValue: string; newValue: string }[]): string {
  let content = section.content
  const notes: string[] = []
  for (const c of changes) {
    if (c.oldValue && content.includes(c.oldValue)) content = content.split(c.oldValue).join(c.newValue)
    else notes.push(`**${c.label}:** ${c.newValue}`)
  }
  return notes.length ? `${content}\n\n${notes.map((n) => `- ${n}`).join('\n')}` : content
}

// ─── Summary agent ──────────────────────────────────────────────────────

export function summaries(docLabel: string, projectName: string, versionNumber: number, sections: Section[]) {
  const first = (s: Section) => sentences(markdownToPlain(s.content))[0] ?? ''
  const onePager = sections.map((s) => `**${s.title}.** ${sentences(markdownToPlain(s.content)).slice(0, 2).join(' ')}`).join('\n\n')
  const short = `${docLabel} v${versionNumber} for ${projectName}. ${first(sections[0] ?? { content: '' } as Section)} It has ${sections.length} sections: ${sections.map((s) => s.title.toLowerCase()).join(', ')}.`
  const slides = [
    { title: `${projectName} — ${docLabel}`, bullets: [`Version ${versionNumber}`, 'AI summary for quick understanding; the full document is the approved text.'] },
    ...sections.map((s) => {
      const listItems = s.content.split('\n').filter((l) => /^\s*([-*]|\d+\.)\s/.test(l)).map((l) => markdownToPlain(l))
      const bullets = (listItems.length ? listItems : sentences(markdownToPlain(s.content))).slice(0, 4).map((b) => (b.length > 120 ? b.slice(0, 117) + '…' : b))
      return { title: s.title, bullets }
    }),
  ]
  return { onePager, short, slides }
}

// ─── Traceability agent ─────────────────────────────────────────────────

export function requirementsFromCanned(project: Project, type: 'CHARTER' | 'BRD' | 'SRS'): Requirement[] {
  const rows = cannedFor(project.slug)?.requirements?.[type] ?? []
  return rows.map((r) => ({ id: String(r[0]), projectId: project.id, docType: type, text: String(r[1]), parentId: r[2] ?? undefined }))
}

/** Pulls numbered requirements (OBJ-1, BR-01, SR-01…) out of a document's text. */
export function requirementsFromText(project: Project, type: 'CHARTER' | 'BRD' | 'SRS', sections: Section[]): Requirement[] {
  const prefix = type === 'CHARTER' ? 'OBJ' : type === 'BRD' ? 'BR' : 'SR'
  const out: Requirement[] = []
  for (const s of sections) {
    for (const line of s.content.split('\n')) {
      const m = line.match(new RegExp(`\\*\\*(${prefix}-\\d+):\\*\\*\\s*(.+?)(?:\\s*\\*\\((.+?)\\)\\*)?\\s*$`))
      if (m) out.push({ id: m[1], projectId: project.id, docType: type, text: markdownToPlain(m[2]), parentId: m[3]?.split(',')[0].trim() })
    }
  }
  return out
}

// ─── Meetings ───────────────────────────────────────────────────────────

const GENERIC_TRANSCRIPT = {
  segments: [
    { raw: 'আজকের মিটিং এর মূল বিষয় হলো পরের রিভিউ কবে হবে।', corrected: 'আজকের মিটিংয়ের মূল বিষয় হলো পরের রিভিউ কবে হবে।' },
    { raw: 'আমরা পরের মঙ্গল বার ডেমো দেখাতে পারবো।', corrected: 'আমরা পরের মঙ্গলবার ডেমো দেখাতে পারবো।' },
    { raw: 'ঠিক আছে, তাহলে মঙ্গল বার সকাল দশটায় রিভিউ হবে।', corrected: 'ঠিক আছে, তাহলে মঙ্গলবার সকাল দশটায় রিভিউ হবে।' },
  ],
  decisions: [{ text: 'Hold the next review on Tuesday at 10:00 am with a demo.' }],
}

export function transcribe(project: Project, participantIds: string[]) {
  const canned = cannedFor(project.slug)?.transcript
  if (canned) return { segments: canned.segments.map((s) => ({ speakerId: s.speaker, raw: s.raw, corrected: s.corrected })), decisions: canned.decisions }
  return {
    segments: GENERIC_TRANSCRIPT.segments.map((s, i) => ({ speakerId: participantIds[i % Math.max(1, participantIds.length)] ?? null, ...s })),
    decisions: GENERIC_TRANSCRIPT.decisions,
  }
}

// ─── Testing ────────────────────────────────────────────────────────────

export function draftTestCase(stage: TestStage, req: Requirement): Omit<TestCase, 'id' | 'projectId' | 'key' | 'createdAt' | 'history' | 'createdBy'> {
  const short = req.text.length > 70 ? req.text.slice(0, 67) + '…' : req.text
  return {
    stage,
    title: `${stage === 'SQA' ? 'Verify' : 'Business check'}: ${short}`,
    preconditions: stage === 'SQA' ? 'Test data prepared in the test environment.' : 'A real user from a pilot branch with realistic data.',
    steps: stage === 'SQA' ? ['Prepare the test data', `Do the action described in ${req.id}`, 'Compare the result with the SRS'] : ['Do the task as you would in your daily work', 'Check the result on screen'],
    expected: req.text,
    requirementIds: [req.id],
    priority: 'Medium',
    type: stage === 'SQA' ? 'Functional' : 'Business scenario',
    ai: true,
  }
}

export function writeDefect(note: string, test?: TestCase) {
  const clean = note.trim().replace(/\s+/g, ' ')
  const title = clean.charAt(0).toUpperCase() + clean.slice(1, 80).replace(/[.!]$/, '')
  return {
    title,
    steps: test ? test.steps.map((s, i) => `${i + 1}. ${s}`).join('\n') : `1. ${clean}`,
    expected: test?.expected ?? 'The system behaves as the requirement describes.',
    actual: clean.charAt(0).toUpperCase() + clean.slice(1),
  }
}

export function similarDefects(text: string, defects: Defect[], threshold: number) {
  return defects
    .map((d) => ({ defect: d, score: Math.round(similarity(text, `${d.title} ${d.actual}`) * 100) / 100 }))
    .filter((x) => x.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
}

export function signoffSummary(stage: TestStage, st: { total: number; pass: number; fail: number; blocked: number; notRun: number; known: Defect[] }, buildVersion?: string): string {
  const who = stage === 'SQA' ? 'The SQA team' : 'Business users'
  return `${who} tested build ${buildVersion ?? '—'} with ${st.total} test cases: ${st.pass} passed, ${st.fail} failed, ${st.blocked} blocked and ${st.notRun} not run. ${st.known.length ? `${st.known.length} known issue${st.known.length > 1 ? 's are' : ' is'} listed below; none of them blocks sign-off.` : 'There are no known issues.'} ${stage === 'SQA' ? 'The build is ready for user acceptance testing.' : 'The system is ready for go-live, subject to the known issues.'}`
}
