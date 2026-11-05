/**
 * The Project Owner's master key: in their own project the Owner may do anything any member may
 * do. Only WHO may act changes; the other checks still apply to them.
 */
import { describe, expect, it } from 'vitest'
import type { ApprovalChain, Build, Execution } from '../types'
import { approve, newChain, sendCheck } from './approval'
import { canComment, canTick } from './comments'
import { defect, NOW, project, SETTINGS } from './fixtures.test-helpers'
import { actAsHead, can, yes } from './permissions'
import { checkTransition, releaseCheck } from './testing'

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

  it('makes every defect move: triage, start and fix, retest and close, the PM\'s outcomes', () => {
    const ctx = { project: p, userId: 'owner', now: NOW, blocking: SETTINGS.signoffBlocking }
    expect(checkTransition(defect(), 'Open', ctx)).toMatchObject({ ok: true, coveredAs: 'OWNER' })
    expect(checkTransition(defect({ status: 'Open', assigneeId: 'dev' }), 'In progress', ctx).ok).toBe(true)
    expect(checkTransition(defect({ status: 'Ready for retest' }), 'Closed', ctx).ok).toBe(true)
    expect(checkTransition(defect({ status: 'Open', severity: 'Medium' }), 'Deferred', ctx).ok).toBe(true)
  })

  it('sends the SQA sign-off and approves any step', () => {
    const base = { docType: 'SQA_SIGNOFF' as const, project: p, userId: 'owner', isSqaMember: false, now: NOW, versionFrozen: false, outOfSync: false, chainInProgress: false, openComments: 0, pendingComments: 0, scopeUndecided: false, previousComplete: yes }
    expect(sendCheck(base).ok).toBe(true)
    const chain = newChain({ id: 'c', docId: 'd', docType: 'SQA_SIGNOFF', projectId: 'p1', versionId: 'v', project: p, startedBy: 'owner', now: NOW })
    expect(approve(chain, p, 'owner', NOW).chain.steps[0]).toMatchObject({ status: 'approved', coveredAs: 'OWNER', actingFor: 'tech' })
  })
})

describe('the other checks still apply to the Owner', () => {
  it('cannot defer a Critical defect', () => {
    const r = checkTransition(defect({ status: 'Open', severity: 'Critical' }), 'Deferred', { project: p, userId: 'owner', now: NOW, blocking: SETTINGS.signoffBlocking })
    expect(r.reason).toMatch(/cannot be deferred/)
  })

  it('cannot release a build to UAT before SQA has completed a run on it', () => {
    const build: Build = { id: 'b2', projectId: 'p1', version: '1.1', envUrl: '', notes: '', fixesDefectIds: [], registeredBy: 'dev', registeredAt: NOW.toISOString() }
    const ex: Execution = { id: 'e1', runId: 'r1', projectId: 'p1', stage: 'SQA', testCaseId: 't1', buildId: 'b2', assigneeId: 'sqa', result: 'not_run', defectIds: [], files: [] }
    const run = { id: 'r1', projectId: 'p1', stage: 'SQA' as const, buildId: 'b2', name: 'Check', createdBy: 'sqa', createdAt: NOW.toISOString() }
    const r = releaseCheck({ build, project: p, userId: 'owner', runs: [run], executions: [ex], defects: [], blocking: SETTINGS.signoffBlocking })
    expect(r.reason).toMatch(/must first complete a test run/)
    expect(releaseCheck({ build, project: p, userId: 'owner', runs: [run], executions: [{ ...ex, result: 'pass' }], defects: [], blocking: SETTINGS.signoffBlocking }).ok).toBe(true)
  })

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
