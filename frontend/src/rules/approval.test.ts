import { describe, expect, it } from 'vitest'
import { approve, cancel, minorCorrectionChain, newChain, reassign, requestChanges, RuleError, sendCheck, sign } from './approval'
import { NOW, project } from './fixtures.test-helpers'
import { yes } from './permissions'

const p = project()
const chainFor = (docType: 'PROPOSAL' | 'CHARTER') => newChain({ id: 'c1', docId: 'd1', docType, projectId: 'p1', versionId: 'v1', project: p, startedBy: 'pm', now: NOW })

describe('approval chain order and permissions', () => {
  it('runs PM → tech head → stakeholder head for the Proposal, with no signature', () => {
    let c = chainFor('PROPOSAL')
    expect(c.steps.map((s) => s.role)).toEqual(['PM', 'TECH_HEAD', 'STAKEHOLDER_HEAD'])
    c = approve(c, p, 'pm', NOW).chain
    c = approve(c, p, 'tech', NOW).chain
    const last = approve(c, p, 'sh', NOW)
    expect(last.finished).toBe(true)
    expect(last.chain.status).toBe('approved')
  })

  it('adds the sponsor head signature for the Charter', () => {
    let c = chainFor('CHARTER')
    expect(c.steps.at(-1)).toMatchObject({ role: 'SPONSOR_HEAD', sign: true })
    for (const who of ['pm', 'tech', 'sh']) c = approve(c, p, who, NOW).chain
    expect(() => approve(c, p, 'sp', NOW)).toThrow(RuleError)
    expect(sign(c, p, 'sp', NOW).chain.status).toBe('signed')
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
    expect(r.steps.map((s) => s.status)).toEqual(['approved', 'changes_requested', 'cancelled'])
  })
})

describe('new version during review', () => {
  it('cancels the chain of the earlier version', () => {
    const c = approve(chainFor('PROPOSAL'), p, 'pm', NOW).chain
    const cancelled = cancel(c, 'Version 3 replaced version 2', NOW)
    expect(cancelled.status).toBe('cancelled')
    expect(cancelled.steps.map((s) => s.status)).toEqual(['approved', 'cancelled', 'cancelled'])
  })
})

describe('minor correction', () => {
  it('carries earlier approvals over and resumes at the requester', () => {
    let c = chainFor('CHARTER')
    c = approve(c, p, 'pm', NOW).chain
    c = approve(c, p, 'tech', NOW).chain
    c = requestChanges(c, p, 'sh', 'Typo in the budget table', NOW).chain
    const mc = minorCorrectionChain(c, { id: 'c2', versionId: 'v2', project: p, startedBy: 'pm', now: NOW })
    expect(mc.steps.map((s) => s.status)).toEqual(['carried_over', 'carried_over', 'pending', 'waiting'])
    expect(mc.minorCorrectionOf).toBe('c1')
  })

  it('is only possible after changes were requested', () => {
    expect(() => minorCorrectionChain(chainFor('CHARTER'), { id: 'c2', versionId: 'v2', project: p, startedBy: 'pm', now: NOW })).toThrow(RuleError)
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
})
