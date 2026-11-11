import { describe, expect, it } from 'vitest'
import type { DemoState } from '../types'
import { migrate } from './migrate'

/** Data as an older version of the app saved it: test cases, builds, runs, results and defects. */
const old = () =>
  ({
    settings: { signoffBlocking: ['Critical'], defectDuplicateThreshold: 0.8, workStart: 9 },
    versions: [{ id: 'rep1', docId: 'd', buildId: 'b1' }],
    testCases: [
      { id: 'tc1', projectId: 'p1', stage: 'SQA', key: 'SQA-TC-1', title: 'Login', expected: 'The member sees the balance screen.', requirementIds: ['SR-01'], ai: true, createdBy: null, createdAt: '2026-11-01T00:00:00Z', history: [{ by: null, at: '2026-11-01T00:00:00Z', text: 'Drafted by AI' }] },
      { id: 'tc2', projectId: 'p1', stage: 'SQA', key: 'SQA-TC-2', title: 'Lockout', expected: '', requirementIds: [], ai: true, createdBy: null, createdAt: '2026-11-01T00:00:00Z', history: [{ by: 'u1', at: '2026-11-01T01:00:00Z', text: 'Edited' }] },
    ],
    builds: [{ id: 'b1', projectId: 'p1', version: '1.0', envUrl: 'test.com', notes: 'First', fixesDefectIds: [], registeredBy: 'dev', registeredAt: '2026-11-02T00:00:00Z' }],
    testRuns: [{ id: 'r1' }],
    executions: [
      { id: 'e1', runId: 'r1', projectId: 'p1', stage: 'SQA', testCaseId: 'tc1', buildId: 'b1', assigneeId: 'sqa', result: 'pass', defectIds: [], executedBy: 'sqa', executedAt: '2026-11-03T00:00:00Z' },
      { id: 'e2', runId: 'r1', projectId: 'p1', stage: 'SQA', testCaseId: 'tc2', buildId: 'b1', assigneeId: 'sqa', result: 'blocked', blockedReason: 'No test data', defectIds: ['d1'], executedBy: 'sqa', executedAt: '2026-11-03T01:00:00Z' },
      { id: 'e3', runId: 'r1', projectId: 'p1', stage: 'SQA', testCaseId: 'tc2', buildId: 'b1', assigneeId: 'sqa', result: 'not_run', defectIds: [] },
    ],
    defects: [{ id: 'd1', key: 'SQA-1', title: 'Lockout message missing' }],
    testConfirmations: [{}],
  }) as unknown as DemoState

describe('migrate: test cases, builds and results become points, versions and checks', () => {
  const s = migrate(old())

  it('turns test cases into points and builds into versions', () => {
    expect(s.testPoints.map((x) => [x.key, x.text, x.ai])).toEqual([
      ['SQA-1', 'Login — The member sees the balance screen.', true],
      ['SQA-2', 'Lockout', false],
    ])
    expect(s.productVersions).toEqual([{ id: 'b1', projectId: 'p1', version: '1.0', notes: 'First', link: 'test.com', addedBy: 'dev', addedAt: '2026-11-02T00:00:00Z' }])
  })

  it('keeps the results: Pass → PASS, Blocked → FAIL with the reason and the defect; Not run is dropped', () => {
    expect(s.pointChecks.map((c) => [c.pointId, c.versionId, c.result, c.comment])).toEqual([
      ['tc1', 'b1', 'pass', undefined],
      ['tc2', 'b1', 'fail', 'Blocked: No test data; SQA-1: Lockout message missing'],
    ])
  })

  it('points sign-off reports at the same version and removes the old lists and settings', () => {
    const raw = s as unknown as Record<string, unknown>
    expect(s.versions[0]).toEqual({ id: 'rep1', docId: 'd', testedVersionId: 'b1' })
    for (const k of ['testCases', 'builds', 'testRuns', 'executions', 'defects', 'testConfirmations']) expect(raw[k]).toBeUndefined()
    expect(s.settings).toEqual({ workStart: 9 })
  })

  it('leaves data that is already up to date alone', () => {
    const again = structuredClone(s)
    expect(migrate(again)).toEqual(s)
  })
})
