import { describe, expect, it } from 'vitest'
import { actForHead, canMarkDecision, onBehalfText } from './permissions'
import { NOW, project } from './fixtures.test-helpers'

describe('confirmations in a head\'s place', () => {
  const p = project()
  it('lets the head, the Owner and the PM confirm, and no one else', () => {
    expect(actForHead(p, 'STAKEHOLDER', 'sh', NOW)).toEqual({ ok: true })
    expect(actForHead(p, 'STAKEHOLDER', 'owner', NOW)).toEqual({ ok: true, actingFor: 'sh', coveredAs: 'OWNER' })
    expect(actForHead(p, 'STAKEHOLDER', 'pm', NOW)).toEqual({ ok: true, actingFor: 'sh', coveredAs: 'PM' })
    expect(actForHead(p, 'STAKEHOLDER', 'st1', NOW).ok).toBe(false)
    expect(actForHead(p, 'STAKEHOLDER', 'pm1', NOW).reason).toMatch(/Project Owner or the Project Manager can also do it/)
  })
  it('works when the project has no such head yet', () => {
    const solo = project({ members: [{ userId: 'pm', team: 'PM', isHead: true }] })
    expect(actForHead(solo, 'SPONSOR', 'pm', NOW)).toEqual({ ok: true, actingFor: undefined, coveredAs: 'PM' })
  })
  it('says who acted for whom', () => {
    expect(onBehalfText({ coveredAs: 'PM', actingForName: 'Rokeya Begum', headLabel: 'Stakeholder head' })).toBe('Project Manager, for the stakeholder head (Rokeya Begum)')
    expect(onBehalfText({ coveredAs: 'OWNER', headLabel: 'Sponsor head' })).toBe('Project Owner, for the sponsor head')
    expect(onBehalfText({ actingForName: 'Rokeya Begum', headLabel: 'Stakeholder head' })).toBe('deputy for Rokeya Begum')
    expect(onBehalfText({ headLabel: 'Stakeholder head' })).toBe('')
  })
})

describe('where "Mark as decision" is offered', () => {
  it('is offered in the project chat and in document chats', () => {
    expect(canMarkDecision({ kind: 'project', projectId: 'p1' }).ok).toBe(true)
    expect(canMarkDecision({ kind: 'document', projectId: 'p1' }).ok).toBe(true)
  })
  it('is offered in messages with a member of a similar past project (started from one project)', () => {
    expect(canMarkDecision({ kind: 'rag_dm', projectId: 'p1' }).ok).toBe(true)
  })
  it('is not offered in direct messages between two members, even when they share a project', () => {
    const check = canMarkDecision({ kind: 'direct', projectId: 'p1' })
    expect(check.ok).toBe(false)
    expect(check.reason).toMatch(/project chat/)
  })
})
