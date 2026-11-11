import { describe, expect, it } from 'vitest'
import type { PointCheck, Requirement } from '../types'
import { NOW, point, project } from './fixtures.test-helpers'
import { canAddVersion, canMakeReport, canTest, exitCriteria, latestCheck, pointStatus, testersOf, versionCounts } from './testing'
import { no, yes } from './permissions'

const p = project()
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60000).toISOString()
const check = (o: Partial<PointCheck>): PointCheck => ({ id: `c${Math.random()}`, projectId: 'p1', stage: 'SQA', pointId: 'pt1', versionId: 'v1', result: 'pass', by: 'sqa', at: at(10), ...o })

describe('who writes and checks the points', () => {
  it('SQA: only SQA testers (and the Owner)', () => {
    expect(canTest(p, 'sqa', 'SQA').ok).toBe(true)
    expect(canTest(p, 'dev', 'SQA').ok).toBe(false)
    expect(canTest(p, 'pm', 'SQA').ok).toBe(false)
    expect(canTest(p, 'owner', 'SQA')).toMatchObject({ ok: true, coveredAs: 'OWNER' })
  })
  it('UAT: developers, stakeholders and the PM team (not SQA testers or sponsors)', () => {
    for (const id of ['dev', 'tech', 'st1', 'sh', 'pm', 'pm1']) expect(canTest(p, id, 'UAT').ok).toBe(true)
    expect(canTest(p, 'sqa', 'UAT').ok).toBe(false)
    expect(canTest(p, 'sp1', 'UAT').ok).toBe(false)
    expect(testersOf(p, 'UAT').sort()).toEqual(['dev', 'pm', 'pm1', 'pmdep', 'sh', 'shdep', 'st1', 'tech', 'techdep'].sort())
  })
  it('the tech team, the PM team and the Owner add versions; nobody changes an archived project', () => {
    expect(canAddVersion(p, 'dev').ok).toBe(true)
    expect(canAddVersion(p, 'sqa').ok).toBe(true)
    expect(canAddVersion(p, 'pm1').ok).toBe(true)
    expect(canAddVersion(p, 'st1').ok).toBe(false)
    expect(canTest(project({ status: 'archived' }), 'owner', 'SQA').ok).toBe(false)
  })
  it('an SQA tester makes the SQA report; the PM makes the UAT report', () => {
    expect(canMakeReport(p, 'sqa', 'SQA', NOW).ok).toBe(true)
    expect(canMakeReport(p, 'pm', 'SQA', NOW).ok).toBe(false)
    expect(canMakeReport(p, 'pm', 'UAT', NOW).ok).toBe(true)
    expect(canMakeReport(p, 'st1', 'UAT', NOW).ok).toBe(false)
  })
})

describe("a point's result on a version", () => {
  const pt = point({ changedAt: at(0) })
  it('is the latest check on that version', () => {
    const checks = [check({ result: 'fail', at: at(5) }), check({ result: 'pass', at: at(9) })]
    expect(pointStatus(pt, 'v1', checks)).toBe('pass')
    expect(latestCheck(pt, 'v1', checks)?.at).toBe(at(9))
  })
  it('starts as To check on a new version (every point is checked again)', () => {
    expect(pointStatus(pt, 'v2', [check({ result: 'pass' })])).toBe('to_check')
    expect(pointStatus(pt, undefined, [check({})])).toBe('to_check')
  })
  it('no longer counts checks made before the point was edited or its requirement changed', () => {
    expect(pointStatus(point({ changedAt: at(20) }), 'v1', [check({ at: at(10) })])).toBe('to_check')
  })
  it('counts pass, fail and to check', () => {
    const pts = [point({ id: 'a' }), point({ id: 'b' }), point({ id: 'c' })]
    const checks = [check({ pointId: 'a' }), check({ pointId: 'b', result: 'fail', comment: 'Button missing' })]
    expect(versionCounts(pts, 'v1', checks)).toEqual({ total: 3, pass: 1, fail: 1, toCheck: 1 })
  })
})

describe('ready to sign off', () => {
  const reqs: Requirement[] = [
    { id: 'SR-01', projectId: 'p1', docType: 'SRS', text: 'Login' },
    { id: 'SR-02', projectId: 'p1', docType: 'SRS', text: 'Reports' },
  ]
  const pts = [point({ id: 'a', key: 'SQA-1', requirementIds: ['SR-01'] }), point({ id: 'b', key: 'SQA-2', requirementIds: ['SR-02'] })]
  const all = (checks: PointCheck[], o: Partial<Parameters<typeof exitCriteria>[0]> = {}) => exitCriteria({ stage: 'SQA', previousDone: yes, requirements: reqs, points: pts, checks, versionId: 'v1', versionLabel: '1.0', ...o })

  it('needs every point checked and passed on the version', () => {
    expect(all([check({ pointId: 'a' }), check({ pointId: 'b' })]).ok).toBe(true)
    const one = all([check({ pointId: 'a' })])
    expect(one.ok).toBe(false)
    expect(one.items.find((i) => !i.ok)?.detail).toMatch(/SQA-2/)
    const failed = all([check({ pointId: 'a' }), check({ pointId: 'b', result: 'fail' })])
    expect(failed.items.find((i) => !i.ok)?.detail).toMatch(/Failed: SQA-2.*new version/)
  })
  it('passes on an older version do not count for a newer one', () => {
    expect(all([check({ pointId: 'a' }), check({ pointId: 'b' })], { versionId: 'v2' }).ok).toBe(false)
  })
  it('needs a version, points for every requirement (or Not testable), and the previous document done', () => {
    expect(all([], { versionId: undefined }).items.some((i) => i.detail === 'Choose a version first.')).toBe(true)
    const uncovered = all([check({ pointId: 'a' })], { points: [pts[0]] })
    expect(uncovered.items[1]).toMatchObject({ ok: false, detail: 'No point yet: SR-02' })
    const notTestable = all([check({ pointId: 'a' })], { points: [pts[0]], requirements: [reqs[0], { ...reqs[1], notTestable: { reason: 'Manual only', by: 'pm', at: at(0) } }] })
    expect(notTestable.ok).toBe(true)
    expect(all([check({ pointId: 'a' }), check({ pointId: 'b' })], { previousDone: no('The SRS is not signed yet.') }).ok).toBe(false)
  })
})
