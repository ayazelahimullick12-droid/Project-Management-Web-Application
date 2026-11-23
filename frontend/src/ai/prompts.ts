/**
 * Every instruction the app sends to the AI, in one place. Change the wording here.
 *
 * The answers are kept SHORT on purpose so a small local model on a laptop answers in seconds
 * (about 17 words per second on this laptop). That is also why answers are plain labelled lines
 * ("key: value", "- point", "Title: …") and not JSON: JSON's quotes and brackets cost tokens.
 * agents.ts reads the lines back. The length limits are in LIMITS below.
 */
import type { Fact, Project } from '../types'

/** Sent before every request. */
export const SYSTEM =
  'You write short, plain English for project documents at BRAC, a development organisation in Bangladesh. ' +
  'Use only the information given. Never add headings, introductions or explanations.'

/** Maximum answer length (tokens) per kind of request. About 1 token = 0.75 words. */
export const LIMITS = {
  section: 90, // one document section: 1–2 sentences or 3 bullets
  list: 150, // 3 numbered objectives or requirements
  facts: 300, // facts pulled from a text, one line each
  question: 40, // one question for one missing fact
  grill: 70, // "Grill me": one pointed question and the fact it is about
  kind: 45, // update or new project, with a short reason
  askDoc: 120, // an approver's question about a document, answered from its text
  chatQuestion: 55, // the next question in the intake chat
  rewrite: 120,
  scope: 50,
  summary: 100,
  slides: 200,
  testPoints: 90,
  testPoint: 40,
  signoff: 80,
  decision: 40,
} as const

function about(p: Project): string {
  const text = (p.intake.description || p.description || '').replace(/\s+/g, ' ').trim()
  return text.length > 400 ? `${text.slice(0, 400)}…` : text
}

function factLines(facts: Fact[]): string {
  const known = facts.filter((f) => f.value && f.status !== 'missing')
  return known.length ? known.map((f) => `- ${f.label}: ${f.value}`).join('\n') : '- (no facts confirmed yet)'
}

export const prompts = {
  section: (p: Project, docLabel: string, title: string, guidance: string, facts: Fact[]) =>
    `Project: ${p.name}
About the project: ${about(p)}
Known facts:
${factLines(facts)}

Write the "${title}" section of the ${docLabel}. It should cover: ${guidance}
Write at most 2 short sentences, or 3 lines starting with "- ". Under 50 words. No heading.`,

  numbered: (p: Project, kind: 'OBJ' | 'BR' | 'SR', facts: Fact[], parents: { id: string; text: string }[]) => {
    const what = kind === 'OBJ' ? 'objectives, each with how success is measured' : kind === 'BR' ? 'business requirements (what users must be able to do)' : 'software requirements (what the system must do)'
    const link = parents.length ? `\nEach one must support one of these. End the line with its id in brackets, e.g. [${parents[0].id}]:\n${parents.map((x) => `- ${x.id}: ${x.text}`).join('\n')}` : ''
    return `Project: ${p.name}
About the project: ${about(p)}
Known facts:
${factLines(facts)}

List 3 ${what}. One per line, starting with "- ". Each under 18 words.${link}`
  },

  facts: (fields: { key: string; label: string }[], text: string) =>
    `Read the text and fill in only the fields it answers. One line per field, as key: value. Values under 12 words. Leave out fields the text does not answer.
Fields: ${fields.map((f) => `${f.key} (${f.label})`).join(', ')}

Text:
${text}`,

  /**
   * "Grill me": one pointed question about the weakest part of the plan, like a strict reviewer.
   * One question per request (a small model mixes up several), never one already asked.
   */
  grill: (projectName: string, facts: Fact[], docText: string, asked: { q: string; a: string }[], keys: { key: string; label: string }[]) =>
    `You are a strict senior manager reviewing the plan for the project "${projectName}".
What the team has said so far:
${factLines(facts)}
${docText ? `\nThe document says:\n${docText}\n` : ''}${asked.length ? `\nAlready asked (do not ask these again):\n${asked.map((x) => `- ${x.q} → ${x.a || 'no answer'}`).join('\n')}\n` : ''}
Ask ONE short, pointed question about the weakest, vaguest or riskiest part of this plan: something missing, unrealistic or unclear. Under 25 words.
Then say which of these facts it is about, or none: ${keys.map((k) => k.key).join(', ')}
Use exactly this layout:
Question: <the question>
Fact: <one key from the list, or none>`,

  /** An approver asks about a document: answer only from its summary and text. */
  askDoc: (docLabel: string, projectName: string, summary: string, text: string, question: string) =>
    `This is the ${docLabel} of the project "${projectName}".
${summary ? `Summary:\n${summary}\n\n` : ''}Document:
${text}

Question from a reviewer: ${question}
Answer in plain words, in at most 3 short sentences, using only the summary and the document above. If they do not say, answer exactly: The document does not say.`,

  /** Update to an existing application, or a new one? */
  kind: (p: Project, text: string) =>
    `A team asked for this project: "${p.name}".
Their request:
${text.slice(0, 1500)}

Is this an UPDATE to an application or system that already exists (changing, extending or replacing it), or a NEW one built from scratch?
Use exactly this layout:
Type: Update or New
Reason: <one sentence under 20 words>`,

  /** The next question in the intake chat: conversational, one at a time, like an interviewer. */
  chatQuestion: (p: Project, field: { label: string; question?: string }, team: string, previous?: { q: string; a: string }) =>
    `You are chatting with the ${team} of the project "${p.name}" to fill in a missing detail, like a friendly but sharp interviewer.
${previous ? `Your last question was: "${previous.q}"\nThey answered: "${previous.a}"\n` : ''}Now ask ONE short, specific question about: ${field.label}.${field.question ? ` (For example: ${field.question})` : ''}
${previous ? 'Start with a 2 to 5 word reaction to their answer, then the question. ' : ''}Only that, under 30 words.`,

  // One question per request: a small model mixes up several at once.
  question: (p: Project, field: { label: string; question?: string; team: string }) =>
    `Project: ${p.name}.
Write one short, polite question to ask the ${field.team} about: ${field.label}.${field.question ? ` (For example: ${field.question})` : ''}
Only the question, under 15 words.`,

  rewrite: (docLabel: string, title: string, content: string, instruction: string) =>
    `This is the "${title}" section of a ${docLabel}:
${content}

Rewrite it. Instruction: ${instruction || 'make it clearer'}
Under 60 words. Keep any ids such as OBJ-1, BR-01 or SR-01 and their bold formatting. No heading.`,

  updateForFacts: (docLabel: string, title: string, content: string, changes: { label: string; oldValue: string; newValue: string }[]) =>
    `This is the "${title}" section of a ${docLabel}:
${content}

These facts changed:
${changes.map((c) => `- ${c.label}: was "${c.oldValue || 'not set'}", now "${c.newValue}"`).join('\n')}

Rewrite the section so it uses the new values. Keep everything else. Under 60 words. Keep ids such as OBJ-1 or BR-01. No heading.`,

  scope: (changes: { title: string; before: string; after: string }[]) =>
    `A project document was edited. The changed sections:
${changes.map((c) => `Section "${c.title}"\nBefore: ${c.before}\nAfter: ${c.after}`).join('\n\n')}

Does this edit change the project's objectives, deliverables, budget or timeline?
Answer on one line: yes or no, then a short reason. Example: no - only the wording changed.`,

  // The text comes first and the instructions last: a small model follows what it read last.
  summary: (docLabel: string, projectName: string, text: string) =>
    `The ${docLabel} of ${projectName}, in short:
${text}

Summarise it. First line: one sentence under 25 words.
Then 3 key points, each on its own line starting with "- ", each under 15 words. No headings.`,

  slides: (docLabel: string, projectName: string, text: string) =>
    `The ${docLabel} of ${projectName}, in short:
${text}

Make 3 presentation slides about it. For each slide write a line "Slide: <title under 6 words>", then 2 lines starting with "- " (each under 12 words).`,

  testPoints: (stage: 'SQA' | 'UAT', reqId: string, reqText: string) =>
    `Requirement ${reqId}: ${reqText}
Write 3 ${stage === 'SQA' ? 'technical testing' : 'user acceptance testing'} points for it. Each point is one thing a tester ${stage === 'UAT' ? '(a business user) ' : ''}can try and then mark PASS or FAIL.
Write each point on its own line starting with "- ", under 15 words, as a statement (for example "- A member can log in with the code sent by SMS"). Nothing else.`,

  testPoint: (stage: 'SQA' | 'UAT', reqText: string, oldText: string) =>
    `Requirement: ${reqText}
A ${stage === 'SQA' ? 'technical' : 'user acceptance'} testing point for it was: "${oldText}"
Write it again, better and clearer: one thing a tester can try and mark PASS or FAIL, under 15 words, as a statement. Write only the point.`,

  signoff: (stage: 'SQA' | 'UAT', counts: string, version: string) =>
    `Write 2 short sentences summarising ${stage === 'SQA' ? 'technical (SQA)' : 'user acceptance (UAT)'} testing of version ${version}. Results: ${counts}. Use only these numbers.`,

  // The field itself is chosen by meaning (embeddings, see agents.ts); the model only writes the value.
  decisionValue: (text: string, label: string) =>
    `A team agreed this: "${text}"
Write only the new value for "${label}", in under 15 words.`,
}
