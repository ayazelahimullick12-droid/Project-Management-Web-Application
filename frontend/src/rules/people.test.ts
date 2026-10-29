import { describe, expect, it } from 'vitest'
import { NOW, project } from './fixtures.test-helpers'
import { can, canComment, inTeam, isSqa, roleLabel, teamProblems, teamWarnings } from './index.test-helpers'
import { listLabels, missingPeople, peopleCheck, questionNeeds, testingNeeds } from './people'

const alone = project({ ownerId: 'pm', members: [{ userId: 'pm', team: 'PM', isHead: true }] })

describe('starting a project alone', () => {
  it('needs nothing else until a step needs someone', () => {
    expect(teamProblems(alone.members)).toEqual([])
    expect(missingPeople(alone, ['PM'])).toEqual([])
  })
  it('names who is missing for questions to the stakeholders and sponsors', () => {
    const missing = missingPeople(alone, questionNeeds(['STAKEHOLDER', 'SPONSOR']))
    expect(missing.map((m) => m.label)).toEqual(['a stakeholder', 'a sponsor'])
    expect(peopleCheck(alone, questionNeeds(['STAKEHOLDER'])).reason).toBe('Add a stakeholder to the project first.')
  })
  it('names the testers, developers and heads that testing needs', () => {
    expect(missingPeople(alone, testingNeeds('SQA')).map((m) => m.need)).toEqual(['TECH_HEAD', 'SQA', 'DEVELOPER'])
    expect(missingPeople(project(), testingNeeds('UAT'))).toEqual([])
  })
  it('lets the Owner and the PM add people, but only the Owner replace or remove them', () => {
    const p = project()
    expect(can.addPeople(p, 'owner', NOW).ok).toBe(true)
    expect(can.addPeople(p, 'pm', NOW).ok).toBe(true)
    expect(can.addPeople(p, 'pm1', NOW).ok).toBe(false)
    expect(can.manageTeam(p, 'pm').ok).toBe(false)
  })
  it('writes lists in plain English', () => {
    expect(listLabels(['a tech head'])).toBe('a tech head')
    expect(listLabels(['a', 'b', 'c'])).toBe('a, b and c')
  })
})

describe('one person in several roles', () => {
  const twoRoles = project({ members: [...project().members, { userId: 'tech', team: 'STAKEHOLDER' }] })
  it('is allowed, with a warning', () => {
    expect(teamProblems(twoRoles.members)).toEqual([])
    expect(teamWarnings(twoRoles.members)).toEqual([{ userId: 'tech', roles: ['Tech head', 'Stakeholder'] }])
  })
  it('counts every role the person holds', () => {
    expect(inTeam(twoRoles, 'tech', 'STAKEHOLDER')).toBe(true)
    expect(inTeam(twoRoles, 'tech', 'TECH')).toBe(true)
    expect(roleLabel(twoRoles, 'tech')).toBe('Tech head · Stakeholder')
    expect(isSqa(twoRoles, 'tech')).toBe(false)
  })
  it('still allows comments while one of their teams may comment', () => {
    const techApproved = [{ id: 'c', docId: 'd', projectId: 'p1', versionId: 'v', status: 'in_progress' as const, startedAt: '', startedBy: 'pm', steps: [{ role: 'TECH_HEAD' as const, assigneeId: 'tech', status: 'approved' as const }] }]
    expect(canComment(twoRoles, 'tech', techApproved).ok).toBe(true)
    expect(canComment(project(), 'dev', techApproved).ok).toBe(false)
  })
  it('still blocks real mistakes: two heads in a team, or the same person twice in one team', () => {
    expect(teamProblems([{ userId: 'a', team: 'TECH', isHead: true }, { userId: 'b', team: 'TECH', isHead: true }])).toContain('Tech team can have only one head.')
    expect(teamProblems([{ userId: 'a', team: 'TECH' }, { userId: 'a', team: 'TECH' }])).toContain('Someone is listed twice in the Tech team.')
  })
})
