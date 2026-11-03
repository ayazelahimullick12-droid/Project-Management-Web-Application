/**
 * Who a step needs.
 *
 * A project can start with one person: whoever creates it becomes the Project Owner and the
 * Project Manager. Other people are added when a step needs them. Before such a step, the app
 * checks the needs below. If someone is missing it stops, says who is missing, and the Owner or
 * the PM adds them (see can.addPeople in permissions.ts).
 *
 * The steps that stop (they need people to do real work):
 * - sending Q/A questions        → someone in each team that gets questions
 * - technical or user testing    → testers and developers
 * - marking a head Away          → a deputy (checked in the api, see setAway)
 *
 * Approvals and confirmations do NOT stop for a missing head: the Project Owner or the PM gives
 * them in the head's place (see actForHead in permissions.ts). The screens still show which heads
 * are not added yet, with an Add button.
 */
import type { Project, Team, TestStage } from '../types'
import { headOf, no, yes, type Check } from './permissions'

export type Need = 'PM' | 'TECH_HEAD' | 'STAKEHOLDER_HEAD' | 'SPONSOR_HEAD' | 'STAKEHOLDERS' | 'SPONSORS' | 'TECH_TEAM' | 'SQA' | 'DEVELOPER'

/** A missing person: what to call them, and how to add them (team, head or not, SQA tag). */
export interface MissingRole {
  need: Need
  label: string // "a tech head"
  team: Team
  head?: boolean
  sqa?: boolean
}

const NEEDS: Record<Need, Omit<MissingRole, 'need'> & { has: (p: Project) => boolean }> = {
  PM: { label: 'a project manager', team: 'PM', head: true, has: (p) => !!headOf(p, 'PM') },
  TECH_HEAD: { label: 'a tech head', team: 'TECH', head: true, has: (p) => !!headOf(p, 'TECH') },
  STAKEHOLDER_HEAD: { label: 'a stakeholder head', team: 'STAKEHOLDER', head: true, has: (p) => !!headOf(p, 'STAKEHOLDER') },
  SPONSOR_HEAD: { label: 'a sponsor head', team: 'SPONSOR', head: true, has: (p) => !!headOf(p, 'SPONSOR') },
  STAKEHOLDERS: { label: 'a stakeholder', team: 'STAKEHOLDER', has: (p) => p.members.some((m) => m.team === 'STAKEHOLDER') },
  SPONSORS: { label: 'a sponsor', team: 'SPONSOR', has: (p) => p.members.some((m) => m.team === 'SPONSOR') },
  TECH_TEAM: { label: 'someone in the tech team', team: 'TECH', has: (p) => p.members.some((m) => m.team === 'TECH' && !m.isSqa) },
  SQA: { label: 'an SQA tester', team: 'TECH', sqa: true, has: (p) => p.members.some((m) => m.team === 'TECH' && m.isSqa) },
  DEVELOPER: { label: 'a developer', team: 'TECH', has: (p) => p.members.some((m) => m.team === 'TECH' && !m.isSqa) },
}

/** Who is missing for these needs (each listed once, in order). */
export function missingPeople(p: Project, needs: Need[]): MissingRole[] {
  return [...new Set(needs)].filter((n) => !NEEDS[n].has(p)).map((need) => {
    const { has: _has, ...rest } = NEEDS[need]
    return { need, ...rest }
  })
}

/** "a tech head", "a tech head and a sponsor head", "a, b and c". */
export function listLabels(labels: string[]): string {
  return labels.length <= 1 ? (labels[0] ?? '') : `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`
}

/** Refuses with "Add a tech head and a sponsor head first." when someone is missing. */
export function peopleCheck(p: Project, needs: Need[]): Check {
  const missing = missingPeople(p, needs)
  return missing.length ? no(`Add ${listLabels(missing.map((m) => m.label))} to the project first.`) : yes
}

/** Questions go to whole teams: business → stakeholders, budget → sponsors, technical → tech team. */
export function questionNeeds(teams: Team[]): Need[] {
  const map: Record<Team, Need> = { PM: 'PM', STAKEHOLDER: 'STAKEHOLDERS', SPONSOR: 'SPONSORS', TECH: 'TECH_TEAM' }
  return teams.map((t) => map[t])
}

/** Technical testing needs SQA testers and developers to fix; user testing needs stakeholders to
 * test. (The list confirmation and the sign-off can be given by the Owner or PM if there is no head.) */
export function testingNeeds(stage: TestStage): Need[] {
  return stage === 'SQA' ? ['SQA', 'DEVELOPER'] : ['STAKEHOLDERS']
}

/** The head who confirms the Fact Sheet (the Owner or PM can confirm in their place). */
export const FACT_CONFIRMATION_NEEDS: Need[] = ['STAKEHOLDER_HEAD']
