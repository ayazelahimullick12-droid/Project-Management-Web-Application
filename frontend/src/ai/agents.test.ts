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

const { chatQuestion, classifyKind, draftSection, draftTestPoints, grillQuestion, extractFacts, findSimilarProjects, rewriteTestPoint, scopeVerdict, summarize, tidy, updateForFacts, writeQuestions } = await import('./agents')

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

describe('draftTestPoints', () => {
  const req: Requirement = { id: 'SR-02', projectId: 'p1', docType: 'SRS', text: 'Check borrower history' }

  it('reads up to 3 points, skipping headings and a point cut off at the length limit', async () => {
    answer.text = ['Testing points:', '- An officer opens a loan and sees the borrower history.', '- **History shows the last 3 loans.**', '- A borrower with no history shows a clear message.', '- Loading takes under 2 seconds.', '- Works on'].join('\n')
    expect(await draftTestPoints('SQA', req)).toEqual(['An officer opens a loan and sees the borrower history.', 'History shows the last 3 loans.', 'A borrower with no history shows a clear message.'])
  })

  it('accepts plain lines when the model forgets the bullets', async () => {
    answer.text = 'The officer sees the borrower history on the loan screen.'
    expect(await draftTestPoints('UAT', req)).toEqual(['The officer sees the borrower history on the loan screen.'])
  })

  it('refuses an answer with no usable point', async () => {
    answer.text = 'OK'
    await expect(draftTestPoints('SQA', req)).rejects.toThrow()
  })
})

describe('rewriteTestPoint', () => {
  it('keeps the first real line, without a bullet or quotes', async () => {
    answer.text = '- "The officer sees the last 3 loans of the borrower."\nThis is clearer.'
    expect(await rewriteTestPoint('SQA', 'Check borrower history', 'History works', {})).toBe('The officer sees the last 3 loans of the borrower.')
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

  it('uses the first bullet as the summary when the model writes only bullets (and drops a cut-off last one)', async () => {
    const ask = (await import('./client')).ask as unknown as ReturnType<typeof vi.fn>
    ask.mockResolvedValueOnce('- The proposal outlines the Agami app update.\n- It covers the mobile and web apps.\n- The budget is $100 million.\n- Deliverables include')
    ask.mockResolvedValueOnce('Slide: Why\n- Users want a better app.')
    const r = await summarize('Proposal & Charter', 'Agami Update', [{ id: 's', key: 'k', title: 'T', content: 'text', factKeys: [] }], {})
    expect(r.short).toBe('The proposal outlines the Agami app update.')
    expect(r.onePager).toBe('- It covers the mobile and web apps.\n- The budget is $100 million.')
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

describe('grillQuestion', () => {
  const keys = [
    { key: 'budget_total', label: 'Total budget' },
    { key: 'timeline', label: 'Overall timeline' },
  ]

  it('reads the question and the fact it is about', async () => {
    answer.text = 'Question: Who pays the SMS charges after go-live?\nFact: budget_total'
    expect(await grillQuestion(p, '', [], keys)).toEqual({ question: 'Who pays the SMS charges after go-live?', factKey: 'budget_total' })
  })

  it('ignores a fact the list does not have, and adds a missing question mark', async () => {
    answer.text = '**Question:** What happens if the gateway approval takes longer than 4 months\nFact: gateway_approval'
    expect(await grillQuestion(p, '', [], keys)).toEqual({ question: 'What happens if the gateway approval takes longer than 4 months?', factKey: undefined })
  })

  it('takes a question even without the layout, and refuses an answer without one', async () => {
    answer.text = 'Sure. Which 25 branches go first?'
    expect((await grillQuestion(p, '', [], keys)).question).toBe('Sure. Which 25 branches go first?')
    answer.text = 'OK'
    await expect(grillQuestion(p, '', [], keys)).rejects.toThrow()
  })
})

describe('classifyKind', () => {
  it('reads "Update" with its reason', async () => {
    answer.text = 'Type: Update\nReason: They want to change the existing attendance app.'
    expect(await classifyKind(p, 'text')).toEqual({ value: 'update', reason: 'They want to change the existing attendance app.' })
  })
  it('reads "New", and gives a reason when the model leaves it out', async () => {
    answer.text = 'Type: New'
    const r = await classifyKind(p, 'text')
    expect(r.value).toBe('new')
    expect(r.reason.length).toBeGreaterThan(10)
  })
})

describe('chatQuestion', () => {
  const field = { key: 'coverage', label: 'Branches and regions covered', category: 'scope', round: 'intake' } as FactDef

  it('keeps a good conversational question', async () => {
    answer.text = 'Thanks, that helps! Which branches go first?'
    expect(await chatQuestion(p, field, 'stakeholders', { q: 'Who uses it?', a: 'Field officers' })).toBe('Thanks, that helps! Which branches go first?')
  })

  it('asks again with the plain prompt when the model refuses or leaves a placeholder', async () => {
    const ask = (await import('./client')).ask as unknown as ReturnType<typeof vi.fn>
    ask.mockResolvedValueOnce("Hi [Stakeholders], I'm sorry, but I can't assist with that request.")
    ask.mockResolvedValueOnce('Which branches will use the app first?')
    expect(await chatQuestion(p, field, 'stakeholders', { q: 'Who uses it?', a: 'Field officers' })).toBe('Thank you. Which branches will use the app first?')
  })
})

describe('chatQuestion does not repeat itself', () => {
  const field = { key: 'approvals', label: 'Approval steps', category: 'process', round: 'brd_business' } as FactDef
  it('asks again when the model repeats an earlier question, and names the fact when it repeats again', async () => {
    const ask = (await import('./client')).ask as unknown as ReturnType<typeof vi.fn>
    ask.mockResolvedValueOnce('Thank you for your prompt response! How can I get started?')
    ask.mockResolvedValueOnce('How can I get started?')
    const q = await chatQuestion(p, field, 'stakeholders', { q: 'x', a: 'y' }, ['Thank you for your prompt response! How can I get started?'])
    expect(q).toBe('Thank you. Could you tell me about this: approval steps?')
  })
})
