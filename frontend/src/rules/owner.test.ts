/**
 * The Project Owner's master key: in their own project the Owner may do anything any member may
 * do. Only WHO may act changes; the other checks still apply to them.
 */
import { describe, expect, it } from 'vitest'
import type { ApprovalChain } from '../types'
import { approve, newChain, sendCheck } from './approval'
import { canComment, canTick } from './comments'
import { NOW, project } from './fixtures.test-helpers'
import { actAsHead, can, yes } from './permissions'
import { canAddVersion, canMakeReport, canTest } from './testing'

const p = project() // Owner: 'owner' (not a member)

describe('the Project Owner can do what any member can', () => {
  it('acts in any head\'s place, also where the project has no head yet', () => {
    expect(actAsHead(p, 'TECH', 'owner', NOW)).toEqual({ ok: true, actingFor: 'tech', coveredAs: 'OWNER' })
    const noSponsorHead = project({ members: p.members.filter((m) => m.team !== 'SPONSOR') })
    expect(actAsHead(noSponsorHead, 'SPONSOR', 'owner', NOW)).toEqual({ ok: true, actingFor: undefined, coveredAs: 'OWNER' })
  })

  it('acts as themselves when they are also the head', () => {
    const solo = project({ ownerId: 'pm' })
    expect(actAsHead(solo, 'PM', 'pm', NOW)).toEqual({ ok: true })
  })

  it('does the PM team\'s work: edit documents, resolve comments, comment after the heads approved', () => {
    expect(can.pmTeam(p, 'owner').ok).toBe(true)
    expect(canTick(p, 'owner').ok).toBe(true)
    const approvedByEveryone = { status: 'approved', steps: [{ role: 'TECH_HEAD', status: 'approved' }, { role: 'STAKEHOLDER_HEAD', status: 'approved' }] } as unknown as ApprovalChain
    expect(canComment(p, 'owner', [approvedByEveryone]).ok).toBe(true)
  })

  it('writes and checks the points in SQA and UAT, adds versions and makes both reports', () => {
    expect(canTest(p, 'owner', 'SQA')).toMatchObject({ ok: true, coveredAs: 'OWNER' })
    expect(canTest(p, 'owner', 'UAT').ok).toBe(true)
    expect(canAddVersion(p, 'owner').ok).toBe(true)
    expect(canMakeReport(p, 'owner', 'SQA', NOW).ok).toBe(true)
    expect(canMakeReport(p, 'owner', 'UAT', NOW).ok).toBe(true)
  })

  it('sends the SQA sign-off and approves any step', () => {
    const base = { docType: 'SQA_SIGNOFF' as const, project: p, userId: 'owner', isSqaMember: false, now: NOW, versionFrozen: false, outOfSync: false, chainInProgress: false, openComments: 0, pendingComments: 0, scopeUndecided: false, previousComplete: yes }
    expect(sendCheck(base).ok).toBe(true)
    const chain = newChain({ id: 'c', docId: 'd', docType: 'SQA_SIGNOFF', projectId: 'p1', versionId: 'v', project: p, startedBy: 'owner', now: NOW })
    expect(approve(chain, p, 'owner', NOW).chain.steps[0]).toMatchObject({ status: 'approved', coveredAs: 'OWNER', actingFor: 'tech' })
  })
})

describe('the other checks still apply to the Owner', () => {
  it('cannot send a document with open comments, or change an archived project', () => {
    const base = { docType: 'BRD' as const, project: p, userId: 'owner', isSqaMember: false, now: NOW, versionFrozen: false, outOfSync: false, chainInProgress: false, openComments: 1, pendingComments: 0, scopeUndecided: false, previousComplete: yes }
    expect(sendCheck(base).reason).toMatch(/Resolve every open comment/)
    expect(can.pmTeam(project({ status: 'archived' }), 'owner').ok).toBe(false)
  })

  it('has no master key in projects they do not own', () => {
    const other = project({ ownerId: 'someone-else' })
    expect(actAsHead(other, 'TECH', 'owner', NOW).ok).toBe(false)
    expect(can.pmTeam(other, 'owner').ok).toBe(false)
  })
})
