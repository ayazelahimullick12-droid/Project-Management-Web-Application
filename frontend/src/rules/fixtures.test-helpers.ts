/** Small fixtures shared by the rule tests. */
import type { Project, Settings, TestPoint } from '../types'

export const NOW = new Date('2026-10-07T10:00:00+06:00') // a Wednesday morning in Dhaka

export function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    slug: 'test',
    name: 'Test project',
    description: '',
    ownerId: 'owner',
    status: 'active',
    createdAt: NOW.toISOString(),
    members: [
      { userId: 'pm', team: 'PM', isHead: true },
      { userId: 'pmdep', team: 'PM', isDeputy: true },
      { userId: 'pm1', team: 'PM' },
      { userId: 'tech', team: 'TECH', isHead: true },
      { userId: 'techdep', team: 'TECH', isDeputy: true },
      { userId: 'dev', team: 'TECH' },
      { userId: 'sqa', team: 'TECH', isSqa: true },
      { userId: 'sh', team: 'STAKEHOLDER', isHead: true },
      { userId: 'shdep', team: 'STAKEHOLDER', isDeputy: true },
      { userId: 'st1', team: 'STAKEHOLDER' },
      { userId: 'sp', team: 'SPONSOR', isHead: true },
      { userId: 'spdep', team: 'SPONSOR', isDeputy: true },
      { userId: 'sp1', team: 'SPONSOR' },
    ],
    away: [],
    templateVersions: {},
    facts: [],
    intake: { description: '', analysed: false },
    ...overrides,
  }
}

export const SETTINGS: Settings = {
  workDays: [0, 1, 2, 3, 4],
  workStart: 9,
  workEnd: 17,
  reminderHours: 4,
  lockIdleMinutes: 60,
  qaRoundLimit: 3,
  ragTopK: 5,
  ragDuplicateThreshold: 0.9,
  aiSpeed: 'instant',
  holidays: [],
  ai: { model: 'test-model', embedModel: 'test-embed' },
}

export function point(overrides: Partial<TestPoint> = {}): TestPoint {
  return {
    id: 'pt1',
    projectId: 'p1',
    stage: 'SQA',
    key: 'SQA-1',
    text: 'A member logs in with the code sent by SMS.',
    requirementIds: ['SR-01'],
    ai: true,
    changedAt: NOW.toISOString(),
    createdBy: null,
    createdAt: NOW.toISOString(),
    history: [],
    ...overrides,
  }
}
