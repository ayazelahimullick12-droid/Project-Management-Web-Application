/**
 * The AI agents: each one is a short request to the local model in LM Studio (prompts.ts),
 * plus reading back its labelled lines. They only PROPOSE: the api layer stores the result as a
 * draft or a suggestion, labelled as AI, until a person accepts it.
 *
 * Still simulated (see src/demo/ai/agents.ts): reading PDF, Word and scanned uploads (OCR) and
 * call transcription.
 */
import type { DocType, Fact, FactDef, Project, Requirement, Section, TemplateSection, TestCase, TestStage } from '../types'
import { markdownToPlain } from '../rules/text'
import { AiError, ask, cosine, embed } from './client'
import { LIMITS, prompts } from './prompts'

type Ctx = { projectId?: string }

// ─── Reading the answers ────────────────────────────────────────────────

const unusable = () => new AiError('The AI gave an answer the app could not use. Try again.')

/** The answer's lines, without blank lines, code fences and bold markers. */
const linesOf = (text: string) =>
  text
    .replace(/```[a-z]*/gi, '')
    .split('\n')
    .map((l) => l.replace(/\*\*/g, '').trim())
    .filter(Boolean)

const BULLET = /^([-*•]|\d+[.)])\s+/
/** Lines that start with "- ", "* " or "1. ", without the marker. */
const bullets = (lines: string[]) => lines.filter((l) => BULLET.test(l)).map((l) => l.replace(BULLET, '').trim())

const clean = (v: string) => v.replace(/\s+/g, ' ').trim().replace(/^["“]|["”]$/g, '').trim()

const sentencesOf = (t: string) => t.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g)?.map((x) => x.trim()).filter((x) => x.length > 3) ?? []

/** A summary point or slide bullet: its first sentence, at most 18 words. */
function brief(v: string): string {
  const first = clean(v).match(/^.+?[.!?](\s|$)/)?.[0].trim() ?? clean(v)
  const words = first.split(' ')
  return words.length > 18 ? `${words.slice(0, 18).join(' ').replace(/[,;:]$/, '')}…` : first
}

/** "key: value" lines whose key is one of `keys` (first one wins). */
function keyValues(text: string, keys: string[]): Map<string, string> {
  const out = new Map<string, string>()
  for (const line of linesOf(text)) {
    const m = line.replace(BULLET, '').match(/^`?([a-z_]+)`?\s*[:=]\s*(.+)$/i)
    const key = m?.[1].toLowerCase()
    if (m && key && keys.includes(key) && !out.has(key)) out.set(key, clean(m[2]))
  }
  return out
}

/** The text after "Label:" up to the next labelled line, for layouts like Title / Steps / Expected. */
function part(text: string, label: string, labels: string[]): string {
  const starts = (l: string, x: string) => new RegExp(`^${x}\\s*:`, 'i').test(l)
  const lines = linesOf(text)
  const i = lines.findIndex((l) => starts(l, label))
  if (i === -1) return ''
  const out = [lines[i].replace(new RegExp(`^${label}\\s*:\\s*`, 'i'), '')]
  for (const l of lines.slice(i + 1)) {
    if (labels.some((x) => starts(l, x))) break
    out.push(l)
  }
  return out.join('\n').trim()
}

/** "Unknown", "Not specified in the text", "No specific risks are mentioned": the text does not answer it. */
const EMPTY = /^(to be confirmed|tbc|unknown|n\/?a|none)\.?$|\b(not|no)\b.*\b(given|specified|mentioned|provided|stated|available|known)\b/i
const plain = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
/** The model sometimes just repeats the field's name ("scope_in: In scope."): that is not an answer. */
/** Words that add nothing after a repeated field name ("Key risks related to the application"). */
const FILLER = new Set('a an the of for to in on and its it is are this that related relating regarding about project application app system details information'.split(' '))
function echoesLabel(value: string, label: string): boolean {
  const v = plain(value)
  const l = plain(label)
  if (v === l || (v.split(' ').length <= l.split(' ').length + 1 && (l.includes(v) || v.includes(l)))) return true
  return v.startsWith(l) && v.slice(l.length).trim().split(' ').every((w) => FILLER.has(w))
}

/** Removes headings and filler; keeps at most 4 bullets and about 80 words. */
export function tidy(text: string): string {
  const lines = text
    .replace(/```[a-z]*\n?|```/gi, '')
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => !/^#{1,6}\s/.test(l.trim()) && !/^\*\*[^*]+\*\*:?$/.test(l.trim()))
    .map((l) => l.replace(/^\s*[*•]\s+/, '- '))
  const list = lines.filter((l) => l.startsWith('- '))
  let out = list.length >= 2 ? list.slice(0, 4).join('\n') : lines.filter(Boolean).join(' ').replace(/\s+/g, ' ')
  const words = out.split(/\s+/)
  if (words.length > 80) {
    out = words.slice(0, 80).join(' ')
    const end = Math.max(out.lastIndexOf('. '), out.lastIndexOf('.\n'))
    if (end > 40) out = out.slice(0, end + 1)
  }
  if (!out.trim()) throw unusable()
  return out.trim()
}

const pad = (kind: 'OBJ' | 'BR' | 'SR', n: number) => (kind === 'OBJ' ? `OBJ-${n}` : `${kind}-${String(n).padStart(2, '0')}`)

// ─── Documents ──────────────────────────────────────────────────────────

/** Writes one section of a document from the template guidance and the Fact Sheet. */
export async function draftSection(p: Project, docLabel: string, ts: TemplateSection, facts: Fact[], parents: { id: string; text: string }[]): Promise<string> {
  const relevant = facts.filter((f) => ts.factKeys.includes(f.key))
  const use = relevant.length ? relevant : facts
  if (!ts.numbered) {
    return tidy(await ask({ agent: 'docgen', title: `${docLabel}: ${ts.title}`, projectId: p.id, prompt: prompts.section(p, docLabel, ts.title, ts.guidance, use), maxTokens: LIMITS.section }))
  }
  // A numbered list (Charter objectives, BRD or SRS requirements), each linked to what it supports.
  const text = await ask({ agent: 'docgen', title: `${docLabel}: ${ts.title}`, projectId: p.id, prompt: prompts.numbered(p, ts.numbered, use, parents), maxTokens: LIMITS.list })
  const lines = linesOf(text)
  // The id it supports may come first ("[OBJ-1]: …"), last ("… [OBJ-1]") or written as OBJ-01.
  const sameId = (a: string, b: string) => a.split('-')[0].toUpperCase() === b.split('-')[0].toUpperCase() && Number(a.split('-')[1]) === Number(b.split('-')[1])
  const items = (bullets(lines).length ? bullets(lines) : lines)
    .map((line) => {
      const refs = line.match(/\b(OBJ|BR|SR)-\d+\b/gi) ?? []
      const body = line
        .replace(/[[(]\s*(OBJ|BR|SR)-\d+\s*[\])]\s*[:.-]?/gi, '')
        .replace(/^(OBJ|BR|SR)-\d+\s*[:.-]\s*/i, '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[.;,:]$/, '')
      return { body, supports: parents.find((x) => refs.some((r) => sameId(r, x.id)))?.id }
    })
    .filter((x) => x.body.length > 3)
    .slice(0, 3)
  if (!items.length) throw unusable()
  return items.map((x, i) => `- **${pad(ts.numbered!, i + 1)}:** ${x.body}.${x.supports ? ` *(${x.supports})*` : ''}`).join('\n')
}

/** "Rewrite with AI" on one section. */
export async function rewriteSection(p: Project, docLabel: string, section: Section, instruction: string): Promise<string> {
  return tidy(await ask({ agent: 'regen', title: `Rewrite: ${section.title}`, projectId: p.id, prompt: prompts.rewrite(docLabel, section.title, section.content, instruction), maxTokens: LIMITS.rewrite }))
}

/**
 * Updates a section after facts changed (change request). An old value written word for word in
 * the text is simply replaced (instant and exact). The AI rewrites only for the other changes,
 * and a new value it still leaves out is added as a line, so the PM sees it in the diff.
 */
export async function updateForFacts(p: Project, docLabel: string, section: Section, changes: { label: string; oldValue: string; newValue: string }[]): Promise<string> {
  let content = section.content
  const left = changes.filter((c) => {
    if (!c.oldValue || !content.includes(c.oldValue)) return true
    content = content.split(c.oldValue).join(c.newValue)
    return false
  })
  if (!left.length) return content
  const rewritten = tidy(await ask({ agent: 'docgen', title: `Update: ${section.title}`, projectId: p.id, prompt: prompts.updateForFacts(docLabel, section.title, content, left), maxTokens: LIMITS.rewrite }))
  const missing = left.filter((c) => !rewritten.includes(c.newValue))
  if (!missing.length) return rewritten
  const lines = missing.map((c) => `- **${c.label}:** ${c.newValue}`).join('\n')
  return rewritten.startsWith('- ') ? `${rewritten}\n${lines}` : `${rewritten}\n\n${lines}`
}

/** Does an edit change objectives, deliverables, budget or timeline? */
export async function scopeVerdict(changes: { title: string; before: string; after: string }[], ctx: Ctx): Promise<{ changesScope: boolean; reason: string }> {
  const cut = (t: string) => (t.length > 500 ? `${t.slice(0, 500)}…` : t)
  const text = await ask({
    agent: 'scope',
    title: 'Scope check',
    projectId: ctx.projectId,
    prompt: prompts.scope(changes.slice(0, 3).map((c) => ({ title: c.title, before: cut(markdownToPlain(c.before)), after: cut(markdownToPlain(c.after)) }))),
    maxTokens: LIMITS.scope,
  })
  const m = linesOf(text)[0]?.match(/^\W*(yes|no)\b[\s,.:;-]*(.*)$/i)
  if (!m) throw unusable()
  const reason = m[2] ? brief(m[2]).replace(/[^.!?…]$/, '$&.') : ''
  return { changesScope: m[1].toLowerCase() === 'yes', reason: reason.charAt(0).toUpperCase() + reason.slice(1) }
}

/** One-sentence summary, key points and slides for a document version. */
export async function summarize(docLabel: string, projectName: string, sections: Section[], ctx: Ctx, step?: (i: number) => void) {
  // A short input keeps a small model on task: each section's first two sentences.
  const text = sections
    .map((s) => `${s.title}: ${sentencesOf(markdownToPlain(s.content)).slice(0, 2).join(' ')}`)
    .join('\n')
    .slice(0, 1500)
  const sumLines = linesOf(await ask({ agent: 'summary', title: `Summary: ${docLabel}`, projectId: ctx.projectId, prompt: prompts.summary(docLabel, projectName, text), maxTokens: LIMITS.summary })).filter((l) => !/^#/.test(l) && !/:$/.test(l))
  // If it skipped the "- " markers, the points are the sentences it wrote.
  const listed = bullets(sumLines)
  const said = sumLines.filter((l) => !BULLET.test(l)).flatMap((l) => sentencesOf(l.replace(/^(summary|first line)\s*:\s*/i, '')))
  const short = said[0] ? brief(said[0]) : ''
  const points = (listed.length ? listed : said.length > 1 ? said.slice(1) : said).filter((x) => x.split(' ').length >= 3).slice(0, 4).map(brief)
  if (!short || !points.length) throw unusable()

  step?.(1)
  const slideLines = linesOf(await ask({ agent: 'summary', title: `Slides: ${docLabel}`, projectId: ctx.projectId, prompt: prompts.slides(docLabel, projectName, text), maxTokens: LIMITS.slides }))
  const slides: { title: string; bullets: string[] }[] = []
  for (const line of slideLines) {
    const title = line.match(/^slide\s*\d*\s*[:.-]\s*(.+)$/i)?.[1]
    if (title) slides.push({ title: clean(title.replace(/[<>]/g, '')), bullets: [] })
    else if (BULLET.test(line) && slides.length && slides.at(-1)!.bullets.length < 3) slides.at(-1)!.bullets.push(brief(line.replace(BULLET, '')))
  }
  // The answer may stop mid-sentence at the length limit: that last bullet is dropped.
  const last = slides.at(-1)?.bullets
  if (last?.length && !/[.!?…]$/.test(last.at(-1)!)) last.pop()
  const usable = slides.filter((x) => x.title && x.bullets.length).slice(0, 5)
  if (!usable.length) throw unusable()
  return {
    short,
    onePager: points.map((x) => `- ${x}`).join('\n'),
    slides: [{ title: `${projectName}: ${docLabel}`, bullets: [short] }, ...usable],
  }
}

// ─── Q/A agent ──────────────────────────────────────────────────────────

/** Reads a text (the description, or an uploaded file's text) and proposes facts. */
export async function extractFacts(p: Project, fields: FactDef[], text: string, title: string): Promise<{ key: string; value: string }[]> {
  if (!text.trim() || !fields.length) return []
  const answer = await ask({ agent: 'qa_extract', title, projectId: p.id, prompt: prompts.facts(fields, text.slice(0, 3000)), maxTokens: LIMITS.facts, temperature: 0.2 })
  const found = keyValues(answer, fields.map((f) => f.key))
  return [...found]
    .map(([key, value]) => {
      const label = fields.find((d) => d.key === key)!.label
      // "Total budget: BDT 1.2 crore" → "BDT 1.2 crore" (the model repeated the field's name first)
      const prefix = value.match(/^([^:]{2,40}):\s+(.+)$/)
      const v = prefix && echoesLabel(prefix[1], label) ? prefix[2] : value
      return { key, label, value: v.replace(/\.$/, '') }
    })
    .filter((f) => f.value && !EMPTY.test(f.value) && !echoesLabel(f.value, f.label))
    .map(({ key, value }) => ({ key, value }))
}

/** Writes the questions for missing facts, one request per question. */
export async function writeQuestions(p: Project, fields: (FactDef & { team: string })[], step?: (i: number) => void): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  for (const [i, f] of fields.entries()) {
    step?.(i)
    const q = clean(linesOf(await ask({ agent: 'qa_questions', title: `Question about ${f.label.toLowerCase()}`, projectId: p.id, prompt: prompts.question(p, f), maxTokens: LIMITS.question }))[0] ?? '')
    if (q.length < 8) throw unusable()
    out.set(f.key, q.endsWith('?') ? q : `${q.replace(/[.!]$/, '')}?`)
  }
  return out
}

/**
 * Which fact a chat or meeting decision sets, and the clean value.
 * A small model cannot reliably pick one field out of 24, so the field is the one closest in
 * meaning (embeddings); the model then writes just the value. The "search_query:" and
 * "search_document:" prefixes are what the nomic embedding model expects for this kind of match.
 */
export async function suggestDecision(text: string, catalog: FactDef[], ctx: Ctx): Promise<{ factKey: string; value: string }> {
  const fields = catalog.map((d) => `search_document: ${d.label}. ${d.question ?? ''}${d.sample ? ` For example: ${d.sample}` : ''}`)
  const [q, ...vs] = await embed([`search_query: ${text}`, ...fields], { agent: 'decisions', title: 'Finding the fact a decision sets', projectId: ctx.projectId })
  const best = catalog.map((d, i) => ({ d, score: cosine(q, vs[i]) })).sort((a, b) => b.score - a.score)[0]
  if (!best) throw new AiError('There are no facts to choose from.')
  const value = clean(linesOf(await ask({ agent: 'decisions', title: `Writing the value for ${best.d.label.toLowerCase()}`, projectId: ctx.projectId, prompt: prompts.decisionValue(text, best.d.label), maxTokens: LIMITS.decision, temperature: 0.2 }))[0] ?? '')
  return { factKey: best.d.key, value: value.replace(/\.$/, '') || text }
}

// ─── RAG agent: similar finished projects (embeddings) ──────────────────

export interface PastProject {
  project: Project
  sections: { docType: DocType; key: string; title: string; content: string }[]
}

const KIND: { test: RegExp; kind: 'risk' | 'objective' | 'requirement'; factKey: string; factLabel: string }[] = [
  { test: /risk|constraint/, kind: 'risk', factKey: 'risks', factLabel: 'Key risks' },
  { test: /objective/, kind: 'objective', factKey: 'success_criteria', factLabel: 'Success criteria' },
  { test: /requirement|functional/, kind: 'requirement', factKey: 'scope_in', factLabel: 'In scope' },
]

/** Details that belong to the old project and must be checked: numbers, amounts, dates, names. */
function oldDetails(text: string): string[] {
  const found =
    text.match(/BDT\s?[\d.,]+(\s?(crore|lakh))?|\b\d[\d.,]*\s?%|\b\d[\d.,]*\s(?:[a-z]+\s)?(?:branches|days|months|weeks|users|officers)\b|\b(?:19|20)\d\d\b|\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)+\b/g) ?? []
  return [...new Set(found.map((x) => x.trim()))].slice(0, 4)
}

/**
 * Finds finished projects similar to this one: compares the meaning (embeddings) of the new
 * project's description with each past project, then with each of their document sections.
 */
export async function findSimilarProjects(p: Project, past: PastProject[], topK: number) {
  if (!past.length) return { matches: [], suggestions: [] }
  const query = `${p.name}. ${p.description}. ${p.intake.description}`.slice(0, 2000)
  const summaries = past.map((x) => `${x.project.name}. ${x.project.summary ?? x.project.description}`)
  const [q, ...vs] = await embed([query, ...summaries], { agent: 'rag', title: 'Comparing with past projects', projectId: p.id })
  const ranked = past
    .map((x, i) => ({ x, score: Math.round(cosine(q, vs[i]) * 100) / 100 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter((m) => m.score >= 0.6) // unrelated texts still score about 0.5 with this embedding model

  const matches = []
  const suggestions = []
  for (const { x, score } of ranked) {
    const texts = x.sections.map((s) => `${s.title}. ${markdownToPlain(s.content)}`.slice(0, 1500))
    const sv = texts.length ? await embed(texts, { agent: 'rag', title: `Reading ${x.project.name}`, projectId: p.id }) : []
    const best = x.sections.map((s, i) => ({ s, sim: cosine(q, sv[i]) })).sort((a, b) => b.sim - a.sim).slice(0, 3)
    matches.push({
      projectId: x.project.id,
      score,
      why: [`Similar meaning (${Math.round(score * 100)}% match)`, ...(best.length ? [`Closest parts: ${best.map((b) => b.s.title).join(', ')}`] : [])],
      sections: best.map((b) => ({ docType: b.s.docType, sectionKey: b.s.key, title: b.s.title, excerpt: markdownToPlain(b.s.content).slice(0, 220) })),
    })
    for (const b of best) {
      const k = KIND.find((x) => x.test.test(b.s.key))
      if (!k) continue
      const line = b.s.content
        .split('\n')
        .map((l) => markdownToPlain(l).trim().replace(/^(OBJ|BR|SR)-\d+\s*:\s*/, ''))
        .find((l) => l.length > 15)
      if (line) suggestions.push({ kind: k.kind, factKey: k.factKey, factLabel: k.factLabel, text: line, sourceProjectId: x.project.id, sourceDocType: b.s.docType, sectionTitle: b.s.title, highlights: oldDetails(line) })
    }
  }
  return { matches, suggestions: suggestions.slice(0, 6) }
}

// ─── Testing ────────────────────────────────────────────────────────────

export async function draftTestCase(stage: TestStage, req: Requirement): Promise<Omit<TestCase, 'id' | 'projectId' | 'key' | 'createdAt' | 'history' | 'createdBy'>> {
  const text = await ask({ agent: 'testcases', title: `Test case for ${req.id}`, projectId: req.projectId, prompt: prompts.testCase(stage, req.id, req.text), maxTokens: LIMITS.testCase })
  const labels = ['Title', 'Steps', 'Expected']
  const steps = bullets(linesOf(part(text, 'Steps', labels))).filter((x) => !/:$/.test(x)).map(brief).slice(0, 4) // lines ending in ':' are headings
  const title = clean(part(text, 'Title', labels).split('\n')[0] ?? '')
  const expected = brief(part(text, 'Expected', labels).replace(BULLET, ''))
  if (!title || !steps.length) throw unusable()
  return {
    stage,
    title,
    preconditions: stage === 'SQA' ? 'Test data prepared in the test environment.' : 'A business user with realistic data.',
    steps,
    expected: expected || req.text,
    requirementIds: [req.id],
    priority: 'Medium',
    type: stage === 'SQA' ? 'Functional' : 'Business scenario',
    ai: true,
  }
}

export async function writeDefect(note: string, test: TestCase | undefined, ctx: Ctx) {
  const text = await ask({ agent: 'defectwriter', title: 'Writing a defect from a note', projectId: ctx.projectId, prompt: prompts.defect(note, test), maxTokens: LIMITS.defect })
  const labels = ['Title', 'Steps', 'Expected', 'Actual']
  const title = clean(part(text, 'Title', labels).split('\n')[0] ?? '')
  const steps = bullets(linesOf(part(text, 'Steps', labels))).map(clean).filter(Boolean)
  if (!title) throw unusable()
  return {
    title,
    steps: (steps.length ? steps : [clean(note)]).map((s, i) => `${i + 1}. ${s}`).join('\n'),
    expected: clean(part(text, 'Expected', labels)) || test?.expected || '',
    actual: clean(part(text, 'Actual', labels)) || clean(note),
  }
}

/** Existing defects that mean the same thing (embeddings). */
export async function similarDefects<D extends { title: string; actual: string }>(text: string, defects: D[], threshold: number, ctx: Ctx) {
  if (!text.trim() || !defects.length) return []
  const [q, ...vs] = await embed([text, ...defects.map((d) => `${d.title}. ${d.actual}`)], { agent: 'duplicates', title: 'Looking for duplicate defects', projectId: ctx.projectId })
  return defects
    .map((defect, i) => ({ defect, score: Math.round(cosine(q, vs[i]) * 100) / 100 }))
    .filter((x) => x.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
}

export async function signoffParagraph(stage: TestStage, st: { total: number; pass: number; fail: number; blocked: number; notRun: number; known: unknown[] }, buildVersion: string, ctx: Ctx): Promise<string> {
  const counts = `${st.total} test cases: ${st.pass} passed, ${st.fail} failed, ${st.blocked} blocked, ${st.notRun} not run`
  return tidy(await ask({ agent: 'signoff', title: `${stage} sign-off summary`, projectId: ctx.projectId, prompt: prompts.signoff(stage, counts, buildVersion, st.known.length), maxTokens: LIMITS.signoff }))
}
