import { describe, expect, it } from 'vitest'
import { canMarkDecision } from './permissions'

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
