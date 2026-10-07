import { describe, expect, it } from 'vitest'
import type { Build, Execution, Requirement, TestCase } from '../types'
import { defect, NOW, project, SETTINGS } from './fixtures.test-helpers'
import { canBeAssigned, checkTransition, exitCriteria, markReadyForRetest, releaseCheck } from './testing'
import { no, yes } from './permissions'

const p = project()
const ctx = (userId: string) => ({ project: p, userId, now: NOW, blocking: SETTINGS.signoffBlocking })
const build = (o: Partial<Build> = {}): Build => ({ id: 'b2', projectId: 'p1', version: '1.1', envUrl: '', notes: '', fixesDefectIds: [], registeredBy: 'dev', registeredAt: NOW.toISOString(), ...o })

describe('defect workflow', () => {
  it('lets the PM or tech head triage, nobody else', () => {
    expect(checkTransition(defect(), 'Open', ctx('pm')).ok).toBe(true)
    expect(checkTransition(defect(), 'Open', ctx('tech')).ok).toBe(true)
    expect(checkTransition(defect(), 'Open', ctx('dev')).ok).toBe(false)
  })
  it('lets only the assigned developer work on and fix it', () => {
    const d = defect({ status: 'Open', assigneeId: 'dev' })
    expect(checkTransition(d, 'In progress', ctx('dev')).ok).toBe(true)
    expect(checkTransition(d, 'Fixed', ctx('sqa')).ok).toBe(false)
  })
  it('refuses moves that are not in the flow', () => expect(checkTransition(defect(), 'Closed', ctx('st1')).ok).toBe(false))
  it('lets the reporter’s team close after retest, never developers', () => {
    const d = defect({ status: 'Ready for retest' })
    expect(checkTransition(d, 'Closed', ctx('sh')).ok).toBe(true)
    expect(checkTransition(d, 'Closed', ctx('dev')).ok).toBe(false)
  })
  it('lets SQA testers close SQA defects', () => {
    const d = defect({ stage: 'SQA', status: 'Ready for retest', reporterId: 'sqa', reporterTeam: 'SQA' })
    expect(checkTransition(d, 'Closed', ctx('sqa')).ok).toBe(true)
  })
  it('refuses deferring Critical or High defects', () => {
    expect(checkTransition(defect({ severity: 'High' }), 'Deferred', ctx('pm')).ok).toBe(false)
    expect(checkTransition(defect({ severity: 'Low' }), 'Deferred', ctx('pm')).ok).toBe(true)
  })
  it('keeps the outcomes for the PM only', () => expect(checkTransition(defect(), 'Rejected', ctx('tech')).ok).toBe(false))
  it('never assigns defects to SQA testers', () => {
    expect(canBeAssigned(p, 'sqa').ok).toBe(false)
    expect(canBeAssigned(p, 'dev').ok).toBe(true)
  })
})

describe('builds and retest', () => {
  it('makes an SQA fix ready for retest when its build is registered', () => {
    const d = defect({ stage: 'SQA', status: 'Fixed', fixedInBuildId: 'b2' })
    expect(markReadyForRetest([d], build(), 'SQA', NOW)[0].status).toBe('Ready for retest')
  })
  it('keeps a UAT fix waiting until the build is released to UAT', () => {
    const d = defect({ status: 'Fixed', fixedInBuildId: 'b2' })
    expect(markReadyForRetest([d], build(), 'SQA', NOW)[0].status).toBe('Fixed')
    expect(markReadyForRetest([d], build(), 'UAT', NOW)[0].status).toBe('Ready for retest')
  })
  const run = { id: 'r1', projectId: 'p1', stage: 'SQA' as const, buildId: 'b2', name: 'Check', createdBy: 'sqa', createdAt: NOW.toISOString() }
  const ex = (result: Execution['result']): Execution => ({ id: 'e1', runId: 'r1', projectId: 'p1', stage: 'SQA', testCaseId: 't1', buildId: 'b2', assigneeId: 'sqa', result, defectIds: [], files: [] })
  const base = { build: build(), project: p, userId: 'sqa', runs: [run], executions: [ex('pass')], defects: [], blocking: SETTINGS.signoffBlocking }
  it('allows release after a completed SQA run', () => expect(releaseCheck(base).ok).toBe(true))
  it('refuses release without a completed SQA run', () => expect(releaseCheck({ ...base, executions: [ex('not_run')] }).ok).toBe(false))
  it('refuses release while a High SQA defect is unresolved', () => expect(releaseCheck({ ...base, defects: [defect({ stage: 'SQA', severity: 'High', status: 'Open' })] }).ok).toBe(false))
  it('refuses release until SQA has checked the UAT fixes', () => {
    const d = defect({ id: 'u1', status: 'Fixed', fixedInBuildId: 'b2' })
    const b = build({ fixesDefectIds: ['u1'] })
    expect(releaseCheck({ ...base, build: b, defects: [d] }).ok).toBe(false)
    expect(releaseCheck({ ...base, build: b, defects: [{ ...d, sqaVerified: { buildId: 'b2', by: 'sqa', at: '' } }] }).ok).toBe(true)
  })
  it('is for SQA testers only', () => expect(releaseCheck({ ...base, userId: 'dev' }).ok).toBe(false))
})

describe('exit criteria', () => {
  const req: Requirement = { id: 'BR-01', projectId: 'p1', docType: 'BRD', text: 'Members see statements' }
  const tc: TestCase = { id: 't1', projectId: 'p1', stage: 'UAT', key: 'UAT-TC-1', title: 'View statement', preconditions: '', steps: [], expected: '', requirementIds: ['BR-01'], priority: 'High', type: 'Business scenario', ai: false, createdBy: 'pm', createdAt: '', history: [] }
  const exec = (result: Execution['result'], defectIds: string[] = []): Execution => ({ id: 'e1', runId: 'r1', projectId: 'p1', stage: 'UAT', testCaseId: 't1', buildId: 'b1', assigneeId: 'st1', result, defectIds, files: [], executedAt: NOW.toISOString() })
  const base = { stage: 'UAT' as const, previousDone: yes, confirmations: [{ projectId: 'p1', stage: 'UAT' as const, by: 'sh', at: '' }], projectId: 'p1', requirements: [req], tests: [tc], executions: [exec('pass')], defects: [], blocking: SETTINGS.signoffBlocking }
  it('passes when everything is done', () => expect(exitCriteria(base).ok).toBe(true))
  it('needs the previous stage', () => expect(exitCriteria({ ...base, previousDone: no('SQA not signed off') }).ok).toBe(false))
  it('needs the list confirmed', () => expect(exitCriteria({ ...base, confirmations: [] }).ok).toBe(false))
  it('needs every requirement covered or Not testable', () => {
    const extra: Requirement = { id: 'BR-02', projectId: 'p1', docType: 'BRD', text: 'x' }
    expect(exitCriteria({ ...base, requirements: [req, extra] }).ok).toBe(false)
    expect(exitCriteria({ ...base, requirements: [req, { ...extra, notTestable: { reason: 'Policy', by: 'pm', at: '' } }] }).ok).toBe(true)
  })
  it('needs every test run', () => expect(exitCriteria({ ...base, executions: [] }).ok).toBe(false))
  it('accepts failures caused only by Medium or Low defects', () => {
    const d = defect({ id: 'd9', severity: 'Low', status: 'Open' })
    expect(exitCriteria({ ...base, executions: [exec('fail', ['d9'])], defects: [d] }).ok).toBe(true)
  })
  it('blocks on an unresolved Critical or High defect', () => {
    const d = defect({ id: 'd9', severity: 'Critical', status: 'In progress' })
    expect(exitCriteria({ ...base, defects: [d] }).ok).toBe(false)
  })
})
