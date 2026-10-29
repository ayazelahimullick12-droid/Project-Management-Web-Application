/**
 * Reading the AI's answers back. The model is not called: `ask` returns answers like the ones
 * qwen2.5-coder-0.5b-instruct gave in testing, including its usual mistakes.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FactDef, Requirement, TemplateSection } from '../types'
import { project } from '../rules/fixtures.test-helpers'

const answer = vi.hoisted(() => ({ text: '' }))
vi.mock('./client', () => ({
  AiError: class AiError extends Error {},
  ask: vi.fn(async () => answer.text),
  embed: vi.fn(async (texts: string[]) => texts.map(() => [1])),
  cosine: vi.fn(() => 0.9),
}))

const { draftSection, draftTestCase, extractFacts, findSimilarProjects, scopeVerdict, summarize, tidy, updateForFacts, writeQuestions } = await import('./agents')

const def = (key: string, label: string): FactDef => ({ key, label, category: 'scope', round: 'intake' }) as FactDef
const p = project({ name: 'Branch Loan Approval App', intake: { description: 'Loan officers approve loans on paper.', analysed: false } })

beforeEach(() => {
  answer.text = ''
})

describe('extractFacts', () => {
  const fields = [def('problem', 'Problem to solve'), def('scope_in', 'In scope'), def('budget_total', 'Total budget'), def('timeline', 'Overall timeline'), def('risks', 'Key risks')]

  it('keeps real answers, removes a repeated field name, and drops echoes and "not given" values', async () => {
    answer.text = [
      'problem: Loan officers approve small loans on paper today.',
      'scope_in: In scope.',
      'budget_total: Total budget: BDT 1.2 crore from the Microfinance Programme',
      'timeline: Overall timeline is not provided in the text',
      'scope_in: In scope for the project',
      '- risks: Weak internet',
      'made_up_key: something',
    ].join('\n')
    expect(await extractFacts(p, fields, 'some text', 'test')).toEqual([
      { key: 'problem', value: 'Loan officers approve small loans on paper today' },
      { key: 'budget_total', value: 'BDT 1.2 crore from the Microfinance Programme' },
      { key: 'risks', value: 'Weak internet' },
    ])
  })

  it('does not call the AI for an empty text', async () => {
    expect(await extractFacts(p, fields, '   ', 'test')).toEqual([])
  })
})

describe('findSimilarProjects', () => {
  it('suggests lines from the closest sections and highlights the old project\'s details', async () => {
    const past = project({ id: 'old', name: 'Field Collection Tracker', finished: true })
    const r = await findSimilarProjects(p, [{ project: past, sections: [{ docType: 'PROPOSAL', key: 'charter_objectives', title: 'Objectives', content: '- **OBJ-1:** Cut loan processing from 7 working days to 2 working days for 90% of loans in Dhaka Division.' }] }], 5)
    expect(r.matches[0]).toMatchObject({ projectId: 'old', score: 0.9 })
    expect(r.suggestions[0].text).toBe('Cut loan processing from 7 working days to 2 working days for 90% of loans in Dhaka Division.')
    expect(r.suggestions[0].highlights).toEqual(['7 working days', '2 working days', '90%', 'Dhaka Division'])
  })
})

describe('draftSection: numbered lists', () => {
  const ts: TemplateSection = { key: 'requirements', title: 'Business requirements', guidance: '', factKeys: [], numbered: 'BR' }
  const parents = [
    { id: 'OBJ-1', text: 'Collect the application' },
    { id: 'OBJ-2', text: 'Check borrower history' },
  ]

  it('numbers the items and links each to the objective it names, wherever the id is written', async () => {
    answer.text = '- [OBJ-1]: Collect the application in the app.\n- Check borrower history before approval (OBJ-02)\n- Send it to the manager the same day.\n- An extra fourth line'
    expect(await draftSection(p, 'BRD', ts, [], parents)).toBe(
      ['- **BR-01:** Collect the application in the app. *(OBJ-1)*', '- **BR-02:** Check borrower history before approval. *(OBJ-2)*', '- **BR-03:** Send it to the manager the same day.'].join('\n'),
    )
  })

  it('refuses an answer with no items', async () => {
    answer.text = '\n\n'
    await expect(draftSection(p, 'BRD', ts, [], parents)).rejects.toThrow('could not use')
  })
})

describe('tidy', () => {
  it('drops headings and keeps at most 4 bullets', () => {
    expect(tidy('## Background\n- one\n* two\n- three\n- four\n- five')).toBe('- one\n- two\n- three\n- four')
  })
})

describe('scopeVerdict', () => {
  it('reads yes or no and keeps one short reason', async () => {
    answer.text = "Yes - the budget and the go-live date changed. The changes include:"
    expect(await scopeVerdict([{ title: 'Timeline and budget', before: 'a', after: 'b' }], {})).toEqual({ changesScope: true, reason: 'The budget and the go-live date changed.' })
    answer.text = 'no, only the wording changed'
    expect((await scopeVerdict([{ title: 'x', before: 'a', after: 'b' }], {})).changesScope).toBe(false)
  })
})

describe('draftTestCase', () => {
  it('reads the title, steps and expected result, skipping heading-like steps', async () => {
    answer.text = 'Title: Verify borrower history\nSteps:\n1. Open the Application:\n2. Open a loan application\n3. Tap Check history\nExpected: - The borrower history is shown.'
    const req: Requirement = { id: 'SR-02', projectId: 'p1', docType: 'SRS', text: 'Check borrower history' }
    const tc = await draftTestCase('SQA', req)
    expect(tc).toMatchObject({ title: 'Verify borrower history', steps: ['Open a loan application', 'Tap Check history'], expected: 'The borrower history is shown.', requirementIds: ['SR-02'], ai: true })
  })
})

describe('summarize', () => {
  it('reads the sentence, the points and the slides', async () => {
    const ask = (await import('./client')).ask as unknown as ReturnType<typeof vi.fn>
    ask.mockResolvedValueOnce('Summary: An app to approve loans the same day.\n- Officers fill the form in the app\n- Managers approve on the phone')
    ask.mockResolvedValueOnce('Slide: The problem\n- Paper takes 5 days.\n- Forms get lost.\nSlide: The app\n- Works offline.\n- Syncs in the')
    const r = await summarize('BRD', 'Loan App', [{ id: 's', key: 'k', title: 'T', content: 'text', factKeys: [] }], {})
    expect(r.short).toBe('An app to approve loans the same day.')
    expect(r.onePager).toBe('- Officers fill the form in the app\n- Managers approve on the phone')
    expect(r.slides.map((x) => x.title)).toEqual(['Loan App: BRD', 'The problem', 'The app'])
    expect(r.slides[2].bullets).toEqual(['Works offline.']) // the bullet cut off at the length limit is dropped
  })

  it('uses the sentences when the model skips the "- " markers', async () => {
    const ask = (await import('./client')).ask as unknown as ReturnType<typeof vi.fn>
    ask.mockResolvedValueOnce('The charter sets up daily cash checks. Differences are flagged the same evening. Area managers follow up.')
    ask.mockResolvedValueOnce('Slide: Why\n- Paper is slow.')
    const r = await summarize('BRD', 'Loan App', [{ id: 's', key: 'k', title: 'T', content: 'text', factKeys: [] }], {})
    expect(r.short).toBe('The charter sets up daily cash checks.')
    expect(r.onePager).toBe('- Differences are flagged the same evening.\n- Area managers follow up.')
  })
})

describe('updateForFacts', () => {
  const section = { id: 's', key: 'timeline_budget', title: 'Timeline and budget', content: '- **Go-live:** April 2027.\n- **Budget:** BDT 2 crore.', factKeys: [] }

  it('replaces an old value written word for word, without asking the AI', async () => {
    const ask = (await import('./client')).ask as unknown as ReturnType<typeof vi.fn>
    ask.mockClear()
    expect(await updateForFacts(p, 'Proposal', section, [{ label: 'Target go-live', oldValue: 'April 2027', newValue: 'July 2027' }])).toBe('- **Go-live:** July 2027.\n- **Budget:** BDT 2 crore.')
    expect(ask).not.toHaveBeenCalled()
  })

  it('adds a new value the AI left out, so the PM sees it in the diff', async () => {
    answer.text = '- **Go-live:** April 2027.\n- **Budget:** BDT 2 crore.'
    expect(await updateForFacts(p, 'Proposal', section, [{ label: 'Funding source', oldValue: '', newValue: 'BRAC core funds' }])).toBe('- **Go-live:** April 2027.\n- **Budget:** BDT 2 crore.\n- **Funding source:** BRAC core funds')
  })
})

describe('writeQuestions', () => {
  it('asks one question per field and ends each with a question mark', async () => {
    answer.text = 'Which branches and regions will use the app'
    const q = await writeQuestions(p, [{ ...def('coverage', 'Branches and regions covered'), team: 'stakeholders' }])
    expect(q.get('coverage')).toBe('Which branches and regions will use the app?')
  })
})
