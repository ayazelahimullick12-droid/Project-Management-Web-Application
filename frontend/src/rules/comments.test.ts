import { describe, expect, it } from 'vitest'
import type { ApprovalChain, Comment, Section } from '../types'
import { canCheckPending, canComment, carryForward } from './comments'
import { NOW, project } from './fixtures.test-helpers'
import { findQuote, markdownToPlain } from './text'

const section = (id: string, content: string): Section => ({ id, key: id, title: id, content, factKeys: [] })
const comment = (o: Partial<Comment>): Comment => ({
  id: 'c1',
  docId: 'doc',
  projectId: 'p1',
  createdOnVersionId: 'v1',
  versionId: 'v1',
  sectionId: 's1',
  quote: 'within six months',
  prefix: '',
  suffix: '',
  body: 'Is this realistic?',
  authorId: 'st1',
  authorTeam: 'STAKEHOLDER',
  mentions: [],
  status: 'open',
  reopenCount: 0,
  replies: [],
  createdAt: NOW.toISOString(),
  ...o,
})

describe('comment carry-forward and auto Pending check', () => {
  it('carries forward when the quoted text is unchanged', () => {
    const r = carryForward([comment({})], 'doc', { id: 'v2', sections: [section('s1', 'Deliver **within six months** of approval.')], regeneratedSectionIds: [] })
    expect(r.comments[0]).toMatchObject({ status: 'open', versionId: 'v2' })
    expect(r.nowPending).toHaveLength(0)
  })
  it('becomes Pending check when the quoted text was edited', () => {
    const r = carryForward([comment({})], 'doc', { id: 'v2', sections: [section('s1', 'Deliver within nine months.')], regeneratedSectionIds: [] })
    expect(r.comments[0]).toMatchObject({ status: 'pending_check', pendingReason: 'text_edited', resolvedOnVersionId: 'v2' })
  })
  it('becomes Pending check when the section was regenerated, even if the text survived', () => {
    const r = carryForward([comment({})], 'doc', { id: 'v2', sections: [section('s1', 'within six months')], regeneratedSectionIds: ['s1'] })
    expect(r.comments[0]).toMatchObject({ status: 'pending_check', pendingReason: 'regenerated' })
  })
  it('leaves resolved comments and other documents alone', () => {
    const r = carryForward([comment({ status: 'resolved' }), comment({ id: 'c2', docId: 'other' })], 'doc', { id: 'v2', sections: [], regeneratedSectionIds: [] })
    expect(r.comments.map((c) => c.status)).toEqual(['resolved', 'open'])
  })
})

describe('who can comment', () => {
  const p = project()
  const chain = (techApproved: boolean): ApprovalChain => ({
    id: 'ch',
    docId: 'doc',
    projectId: 'p1',
    versionId: 'v1',
    status: 'in_progress',
    startedAt: NOW.toISOString(),
    startedBy: 'pm',
    steps: [
      { role: 'PM', assigneeId: 'pm', status: 'approved' },
      { role: 'TECH_HEAD', assigneeId: 'tech', status: techApproved ? 'approved' : 'pending' },
      { role: 'STAKEHOLDER_HEAD', assigneeId: 'sh', status: 'waiting' },
    ],
  })
  it('blocks a team once its head has approved that version', () => {
    expect(canComment(p, 'dev', [chain(true)]).ok).toBe(false)
    expect(canComment(p, 'dev', [chain(false)]).ok).toBe(true)
  })
  it('still lets teams whose head has not approved comment', () => expect(canComment(p, 'st1', [chain(true)]).ok).toBe(true))
  it('always lets the PM team comment', () => expect(canComment(p, 'pm1', [chain(true)]).ok).toBe(true))
  it('lets members of the author’s team confirm Pending check', () => {
    const c = comment({ status: 'pending_check' })
    expect(canCheckPending(p, 'sh', c).ok).toBe(true)
    expect(canCheckPending(p, 'dev', c).ok).toBe(false)
  })
})

describe('text helpers', () => {
  it('strips Markdown to readable text', () => expect(markdownToPlain('## Title\n- **Bold** item\n- [link](http://x)')).toBe('Title Bold item link'))
  it('uses the saved context to pick the right occurrence', () => {
    const t = 'the app works offline. later the app works online'
    expect(findQuote(t, 'the app works', 'later', 'online')).toBe(t.lastIndexOf('the app works'))
  })
})
