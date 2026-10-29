import { describe, expect, it } from 'vitest'
import type { ApprovalChain, Doc, DocType } from '../types'
import { NOW, project } from './fixtures.test-helpers'
import { canGenerate, docStatus, isComplete, previousComplete, projectStage, sectionPart, type PipelineCtx } from './pipeline'
import { factFromAnswer, mergeValue, routeTeam } from './qa'

const doc = (type: DocType, outOfSync = false): Doc => ({ id: type, projectId: 'p1', type, title: type, currentVersionId: `${type}-v1`, outOfSync: outOfSync ? { since: '', cause: '', suggestedSectionIds: [] } : undefined })
const done = (type: DocType, status: ApprovalChain['status']): ApprovalChain => ({ id: `c-${type}`, docId: type, projectId: 'p1', versionId: `${type}-v1`, status, steps: [], startedAt: NOW.toISOString(), startedBy: 'pm' })

const ctx = (o: Partial<PipelineCtx> = {}): PipelineCtx => ({
  project: project(),
  docs: [],
  versions: [],
  chains: [],
  factSheets: [{ id: 'f1', projectId: 'p1', number: 1, facts: [], createdAt: '', createdBy: null, note: '', confirmedBy: 'sh' }],
  rounds: [],
  ...o,
})

describe('pipeline order', () => {
  it('starts in Intake until the Fact Sheet is confirmed', () => expect(projectStage(ctx({ factSheets: [] }))).toBe('INTAKE'))
  it('writes the Proposal and the Charter in one step, which needs the sponsor signature', () => {
    const approvedOnly = ctx({ docs: [doc('PROPOSAL')], chains: [done('PROPOSAL', 'approved')] })
    expect(isComplete(approvedOnly, 'PROPOSAL')).toBe(false)
    expect(projectStage(approvedOnly)).toBe('PROPOSAL')
    expect(projectStage(ctx({ docs: [doc('PROPOSAL')], chains: [done('PROPOSAL', 'signed')] }))).toBe('BRD')
  })
  it('tells which part of the Proposal & Charter a section belongs to', () => {
    expect(sectionPart('objectives')).toBe('proposal')
    expect(sectionPart('charter_objectives')).toBe('charter')
  })
  it('needs the business processes round before the BRD', () => {
    const c = ctx({ docs: [doc('PROPOSAL')], chains: [done('PROPOSAL', 'signed')] })
    expect(canGenerate(c, 'BRD').ok).toBe(false)
    const withRound = { ...c, rounds: [{ id: 'r', projectId: 'p1', purpose: 'brd_business' as const, number: 1, status: 'closed' as const, startedAt: '' }] }
    expect(canGenerate(withRound, 'BRD').ok).toBe(true)
  })
  it('treats an Out of sync document as not complete, so later ones wait', () => {
    const c = ctx({ docs: [doc('PROPOSAL', true), doc('BRD')], chains: [done('PROPOSAL', 'signed'), done('BRD', 'signed')] })
    expect(projectStage(c)).toBe('PROPOSAL')
    expect(previousComplete(c, 'BRD').ok).toBe(false)
    expect(docStatus(c, c.docs[0]).key).toBe('out_of_sync')
  })
  it('reaches SQA, then UAT, then Complete', () => {
    const types: DocType[] = ['PROPOSAL', 'BRD', 'SRS']
    const chains = types.map((t) => done(t, 'signed'))
    expect(projectStage(ctx({ docs: types.map((t) => doc(t)), chains }))).toBe('SQA')
    const withSqa = ctx({ docs: [...types, 'SQA_SIGNOFF' as const].map((t) => doc(t)), chains: [...chains, done('SQA_SIGNOFF', 'approved')] })
    expect(projectStage(withSqa)).toBe('UAT')
  })
})

describe('Q/A rules', () => {
  it('routes questions by type', () => {
    expect(routeTeam({ category: 'budget' })).toBe('SPONSOR')
    expect(routeTeam({ category: 'technical' })).toBe('TECH')
    expect(routeTeam({ category: 'process' })).toBe('STAKEHOLDER')
  })
  it('stores Unknown as an assumption with the agreed default', () => {
    const f = factFromAnswer({ key: 'funding_source', label: 'Funding source', category: 'budget' }, { text: '', unknown: true, defaultValue: 'BRAC core budget', source: { type: 'answer', label: 'Answer' }, userName: 'Selim' })
    expect(f).toMatchObject({ status: 'assumed', value: 'BRAC core budget' })
  })
  it('marks a fact conflicting when two sources disagree', () => {
    const a = { key: 'user_count', label: 'Users', category: 'stakeholder' as const, value: '1,200', status: 'filled' as const }
    expect(mergeValue(a, { ...a, value: '1,450' }).status).toBe('conflicting')
    expect(mergeValue(a, { ...a, value: '1,200' }).status).toBe('filled')
  })
})
