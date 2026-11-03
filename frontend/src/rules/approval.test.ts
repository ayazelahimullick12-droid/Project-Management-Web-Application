import { describe, expect, it } from 'vitest'
import { approve, cancel, minorCorrectionChain, newChain, reassign, requestChanges, RuleError, sendCheck, sign } from './approval'
import { NOW, project } from './fixtures.test-helpers'
import { yes } from './permissions'

const p = project()
const chainFor = (docType: 'PROPOSAL' | 'SQA_SIGNOFF') => newChain({ id: 'c1', docId: 'd1', docType, projectId: 'p1', versionId: 'v1', project: p, startedBy: 'pm', now: NOW })

describe('approval chain order and permissions', () => {
  it('runs one round for the Proposal & Charter: PM → tech head → stakeholder head, then the sponsor head signs', () => {
    let c = chainFor('PROPOSAL')
    expect(c.steps.map((s) => s.role)).toEqual(['PM', 'TECH_HEAD', 'STAKEHOLDER_HEAD', 'SPONSOR_HEAD'])
    expect(c.steps.at(-1)).toMatchObject({ role: 'SPONSOR_HEAD', sign: true })
    for (const who of ['pm', 'tech', 'sh']) c = approve(c, p, who, NOW).chain
    expect(() => approve(c, p, 'sp', NOW)).toThrow(RuleError)
    const signed = sign(c, p, 'sp', NOW)
    expect(signed.chain.status).toBe('signed')
  })

  it('has a single approver and no signature for the SQA sign-off', () => {
    const c = chainFor('SQA_SIGNOFF')
    expect(c.steps.map((s) => s.role)).toEqual(['TECH_HEAD'])
    expect(approve(c, p, 'tech', NOW).chain.status).toBe('approved')
  })

  it('refuses people who are not the current approver', () => {
    const c = chainFor('PROPOSAL')
    expect(() => approve(c, p, 'tech', NOW)).toThrow(/project manager's turn/i)
    expect(() => approve(c, p, 'pm1', NOW)).toThrow(RuleError)
  })

  it('requires a comment to request changes and cancels the remaining steps', () => {
    const c = approve(chainFor('PROPOSAL'), p, 'pm', NOW).chain
    expect(() => requestChanges(c, p, 'tech', '  ', NOW)).toThrow(/comment/)
    const r = requestChanges(c, p, 'tech', 'Hosting section is wrong', NOW).chain
    expect(r.status).toBe('changes_requested')
    expect(r.steps.map((s) => s.status)).toEqual(['approved', 'changes_requested', 'cancelled', 'cancelled'])
  })
})

describe('new version during review', () => {
  it('cancels the chain of the earlier version', () => {
    const c = approve(chainFor('PROPOSAL'), p, 'pm', NOW).chain
    const cancelled = cancel(c, 'Version 3 replaced version 2', NOW)
    expect(cancelled.status).toBe('cancelled')
    expect(cancelled.steps.map((s) => s.status)).toEqual(['approved', 'cancelled', 'cancelled', 'cancelled'])
  })
})

describe('minor correction', () => {
  it('carries earlier approvals over and resumes at the requester', () => {
    let c = chainFor('PROPOSAL')
    c = approve(c, p, 'pm', NOW).chain
    c = approve(c, p, 'tech', NOW).chain
    c = requestChanges(c, p, 'sh', 'Typo in the budget table', NOW).chain
    const mc = minorCorrectionChain(c, { id: 'c2', versionId: 'v2', project: p, startedBy: 'pm', now: NOW })
    expect(mc.steps.map((s) => s.status)).toEqual(['carried_over', 'carried_over', 'pending', 'waiting'])
    expect(mc.minorCorrectionOf).toBe('c1')
  })

  it('is only possible after changes were requested', () => {
    expect(() => minorCorrectionChain(chainFor('PROPOSAL'), { id: 'c2', versionId: 'v2', project: p, startedBy: 'pm', now: NOW })).toThrow(RuleError)
  })
})

describe('deputies while a head is Away', () => {
  const away = project({ away: [{ userId: 'sh', from: '2026-10-05T00:00:00+06:00', to: '2026-10-09T23:59:00+06:00', setBy: 'sh' }] })
  it('lets the deputy act and records who acted for whom', () => {
    let c = newChain({ id: 'c1', docId: 'd1', docType: 'PROPOSAL', projectId: 'p1', versionId: 'v1', project: away, startedBy: 'pm', now: NOW })
    c = approve(c, away, 'pm', NOW).chain
    c = approve(c, away, 'tech', NOW).chain
    const r = approve(c, away, 'shdep', NOW)
    expect(r.chain.steps[2]).toMatchObject({ actedBy: 'shdep', actingFor: 'sh', status: 'approved' })
  })
  it('stops the Away head from acting', () => {
    let c = newChain({ id: 'c1', docId: 'd1', docType: 'PROPOSAL', projectId: 'p1', versionId: 'v1', project: away, startedBy: 'pm', now: NOW })
    c = approve(approve(c, away, 'pm', NOW).chain, away, 'tech', NOW).chain
    expect(() => approve(c, away, 'sh', NOW)).toThrow(/Away/)
  })
  it('does not let a deputy act while the head is present', () => {
    const c = chainFor('PROPOSAL')
    expect(() => approve(c, p, 'pmdep', NOW)).toThrow(RuleError)
  })
})

describe('reassigning a head mid-chain', () => {
  it('moves the pending step to the new head on the same version', () => {
    const c = approve(chainFor('PROPOSAL'), p, 'pm', NOW).chain
    const r = reassign(c, 'TECH', 'newtech')
    expect(r.steps[1]).toMatchObject({ assigneeId: 'newtech', status: 'pending' })
    expect(r.versionId).toBe('v1')
  })
})

describe('sending for approval', () => {
  const base = {
    docType: 'PROPOSAL' as const,
    project: p,
    userId: 'pm',
    isSqaMember: false,
    now: NOW,
    versionFrozen: false,
    outOfSync: false,
    chainInProgress: false,
    openComments: 0,
    pendingComments: 0,
    scopeUndecided: false,
    previousComplete: yes,
  }
  it('is allowed for the PM with no open comments', () => expect(sendCheck(base).ok).toBe(true))
  it('is blocked by open comments', () => expect(sendCheck({ ...base, openComments: 1 }).ok).toBe(false))
  it('is blocked by comments pending check', () => expect(sendCheck({ ...base, pendingComments: 2 }).reason).toMatch(/2 pending check/))
  it('is PM only', () => expect(sendCheck({ ...base, userId: 'pm1' }).ok).toBe(false))
  it('needs the scope decision first', () => expect(sendCheck({ ...base, scopeUndecided: true }).ok).toBe(false))
  it('allows re-approving a frozen version that is out of sync', () => expect(sendCheck({ ...base, versionFrozen: true, outOfSync: true }).ok).toBe(true))
  it('lets an SQA member send the SQA sign-off', () => expect(sendCheck({ ...base, docType: 'SQA_SIGNOFF', userId: 'sqa', isSqaMember: true }).ok).toBe(true))
  it('does not stop for missing heads: the Owner or the PM approves those steps', () => {
    const alone = project({ members: [{ userId: 'pm', team: 'PM', isHead: true }] })
    expect(sendCheck({ ...base, project: alone }).ok).toBe(true)
  })
})

describe('the Project Owner and the PM can approve in a head\'s place', () => {
  it('lets them approve and sign any step; the record says who acted for whom', () => {
    let c = chainFor('PROPOSAL')
    c = approve(c, p, 'pm', NOW).chain // the PM's own step
    expect(c.steps[0]).toMatchObject({ actedBy: 'pm', coveredAs: undefined })
    c = approve(c, p, 'owner', NOW).chain // the tech head's step, by the Owner
    expect(c.steps[1]).toMatchObject({ status: 'approved', actedBy: 'owner', actingFor: 'tech', coveredAs: 'OWNER' })
    c = approve(c, p, 'pm', NOW).chain // the stakeholder head's step, by the PM
    expect(c.steps[2]).toMatchObject({ actedBy: 'pm', actingFor: 'sh', coveredAs: 'PM' })
    const signed = sign(c, p, 'pm', NOW) // the sponsor head's signature, by the PM
    expect(signed).toMatchObject({ coveredAs: 'PM', actingFor: 'sp', role: 'SPONSOR_HEAD' })
    expect(signed.chain.status).toBe('signed')
  })

  it('lets them request changes in the head\'s place', () => {
    const c = approve(chainFor('PROPOSAL'), p, 'pm', NOW).chain
    expect(requestChanges(c, p, 'owner', 'Split the budget', NOW).chain.steps[1]).toMatchObject({ status: 'changes_requested', coveredAs: 'OWNER', actingFor: 'tech' })
  })

  it('still refuses other members, including the rest of the PM team', () => {
    const c = approve(chainFor('PROPOSAL'), p, 'pm', NOW).chain
    expect(() => approve(c, p, 'pm1', NOW)).toThrow(/tech head's turn/i)
    expect(() => approve(c, p, 'sh', NOW)).toThrow(RuleError)
  })

  it('makes a step without a head wait on the PM, and moves it to the head once one is added', () => {
    const solo = project({ members: [{ userId: 'pm', team: 'PM', isHead: true }] })
    let c = newChain({ id: 'c1', docId: 'd1', docType: 'BRD', projectId: 'p1', versionId: 'v1', project: solo, startedBy: 'pm', now: NOW })
    expect(c.steps.slice(1).map((s) => [s.assigneeId, s.vacant])).toEqual([['pm', true], ['pm', true], ['pm', true]])
    c = approve(c, solo, 'pm', NOW).chain
    c = approve(c, solo, 'pm', NOW).chain // no tech head: the PM approves in their place
    expect(c.steps[1]).toMatchObject({ coveredAs: 'PM', actingFor: undefined })
    const moved = reassign(c, 'STAKEHOLDER', 'sh')
    expect(moved.steps[2]).toMatchObject({ assigneeId: 'sh', status: 'pending' })
    expect(moved.steps[2].vacant).toBeUndefined()
  })
})
