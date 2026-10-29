/**
 * The parts of the AI work that are still SIMULATED, plus rule-based helpers.
 *
 * The real AI agents (LM Studio) are in src/ai/agents.ts. What stays here:
 *  - readUpload: reading uploaded files (OCR) is simulated;
 *  - transcribe: call transcription is simulated;
 *  - questionFor: the catalog question, used when the AI skips a field;
 *  - scopeCheck, detectFactChanges, requirementsFromText: rules that compare text;
 *  - requirementsFromCanned, signoffSummary: used by the demo projects in the seed files.
 * Where pre-written content exists for a demo project (seed/ai/<slug>.json) it is used.
 */
import { diffWords } from 'diff'
import type { Defect, Fact, FactDef, Project, Requirement, Section, Template, TestStage } from '../../types'
import { markdownToPlain, normalize } from '../../rules/text'
import { cannedFor } from './content'

// ─── Q/A agent ──────────────────────────────────────────────────────────

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

// ─── Rules that compare text ────────────────────────────────────────────

/** Scope check (rule): which changed sections cover objectives, deliverables, budget or timeline? The AI then decides. */
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

// ─── Traceability agent ─────────────────────────────────────────────────

export function requirementsFromCanned(project: Project, type: 'PROPOSAL' | 'BRD' | 'SRS'): Requirement[] {
  const rows = cannedFor(project.slug)?.requirements?.[type] ?? []
  return rows.map((r) => ({ id: String(r[0]), projectId: project.id, docType: type, text: String(r[1]), parentId: r[2] ?? undefined }))
}

/** Pulls numbered requirements (OBJ-1, BR-01, SR-01…) out of a document's text. */
export function requirementsFromText(project: Project, type: 'PROPOSAL' | 'BRD' | 'SRS', sections: Section[]): Requirement[] {
  const prefix = type === 'PROPOSAL' ? 'OBJ' : type === 'BRD' ? 'BR' : 'SR' // objectives come from the Charter part
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

export function signoffSummary(stage: TestStage, st: { total: number; pass: number; fail: number; blocked: number; notRun: number; known: Defect[] }, buildVersion?: string): string {
  const who = stage === 'SQA' ? 'The SQA team' : 'Business users'
  return `${who} tested build ${buildVersion ?? '—'} with ${st.total} test cases: ${st.pass} passed, ${st.fail} failed, ${st.blocked} blocked and ${st.notRun} not run. ${st.known.length ? `${st.known.length} known issue${st.known.length > 1 ? 's are' : ' is'} listed below; none of them blocks sign-off.` : 'There are no known issues.'} ${stage === 'SQA' ? 'The build is ready for user acceptance testing.' : 'The system is ready for go-live, subject to the known issues.'}`
}
