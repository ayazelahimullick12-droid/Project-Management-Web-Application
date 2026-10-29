/**
 * The approval state machine.
 *
 * Spec: SPEC.md "Approval and signing" (order, Request changes, new versions, editing and
 * comments during review, minor correction, signing) and SPEC_SQA_UAT.md "Sign-off".
 *
 * Pure functions: they take a chain and return a new chain, or throw RuleError.
 * No screen code and no storage here.
 */
import type { ApprovalChain, ApprovalStep, ApproverRole, DocType, ID, Project, Team } from '../types'
import { actAsHead, headOf, type Check, yes, no } from './permissions'
import { peopleCheck, type Need } from './people'

export class RuleError extends Error {}

export interface ChainConfig {
  steps: ApproverRole[]
  signs: boolean // the last step (sponsor head) signs
  sender: 'PM' | 'SQA' // who may send the version for approval
  comments: boolean // document comments exist (and block sending)
}

export const CHAIN_CONFIG: Record<DocType, ChainConfig> = {
  // Proposal & Charter: one round for both parts; the sponsor head signs the package.
  PROPOSAL: { steps: ['PM', 'TECH_HEAD', 'STAKEHOLDER_HEAD', 'SPONSOR_HEAD'], signs: true, sender: 'PM', comments: true },
  BRD: { steps: ['PM', 'TECH_HEAD', 'STAKEHOLDER_HEAD', 'SPONSOR_HEAD'], signs: true, sender: 'PM', comments: true },
  SRS: { steps: ['PM', 'TECH_HEAD', 'STAKEHOLDER_HEAD', 'SPONSOR_HEAD'], signs: true, sender: 'PM', comments: true },
  SQA_SIGNOFF: { steps: ['TECH_HEAD'], signs: false, sender: 'SQA', comments: false },
  UAT_SIGNOFF: { steps: ['PM', 'TECH_HEAD', 'STAKEHOLDER_HEAD', 'SPONSOR_HEAD'], signs: true, sender: 'PM', comments: false },
}

export const ROLE_TEAM: Record<ApproverRole, Team> = {
  PM: 'PM',
  TECH_HEAD: 'TECH',
  STAKEHOLDER_HEAD: 'STAKEHOLDER',
  SPONSOR_HEAD: 'SPONSOR',
}

export const ROLE_LABEL: Record<ApproverRole, string> = {
  PM: 'Project Manager',
  TECH_HEAD: 'Tech head',
  STAKEHOLDER_HEAD: 'Stakeholder head',
  SPONSOR_HEAD: 'Sponsor head',
}

/** Starts a new chain on one exact version. The first step is pending. */
export function newChain(args: {
  id: ID
  docId: ID
  docType: DocType
  projectId: ID
  versionId: ID
  project: Project
  startedBy: ID
  now: Date
  reapproval?: boolean
}): ApprovalChain {
  const cfg = CHAIN_CONFIG[args.docType]
  const at = args.now.toISOString()
  const steps: ApprovalStep[] = cfg.steps.map((role, i) => {
    const head = headOf(args.project, ROLE_TEAM[role])
    if (!head) throw new RuleError(`The project has no ${ROLE_LABEL[role].toLowerCase()}.`)
    return {
      role,
      assigneeId: head.userId,
      status: i === 0 ? 'pending' : 'waiting',
      pendingSince: i === 0 ? at : undefined,
      sign: cfg.signs && role === 'SPONSOR_HEAD',
    }
  })
  return {
    id: args.id,
    docId: args.docId,
    projectId: args.projectId,
    versionId: args.versionId,
    status: 'in_progress',
    steps,
    startedAt: at,
    startedBy: args.startedBy,
    reapproval: args.reapproval,
  }
}

export function currentStep(chain: ApprovalChain): ApprovalStep | undefined {
  return chain.status === 'in_progress' ? chain.steps.find((s) => s.status === 'pending') : undefined
}

/** Can this user act on the chain's current step (as the head, or as the deputy of an Away head)? */
export function canAct(chain: ApprovalChain, project: Project, userId: ID | null, now: Date): Check {
  if (project.status === 'archived') return no('This project is archived, so it is read-only.')
  const step = currentStep(chain)
  if (!step) return no('Nothing is waiting for approval.')
  const check = actAsHead(project, ROLE_TEAM[step.role], userId, now)
  if (!check.ok) return no(`It is the ${ROLE_LABEL[step.role].toLowerCase()}'s turn. ${check.reason ?? ''}`.trim())
  return check
}

function cloneChain(chain: ApprovalChain): ApprovalChain {
  return { ...chain, steps: chain.steps.map((s) => ({ ...s })) }
}

/** Approve the current step. Returns the new chain and what happened. */
export function approve(chain: ApprovalChain, project: Project, userId: ID, now: Date) {
  const check = canAct(chain, project, userId, now)
  if (!check.ok) throw new RuleError(check.reason)
  const next = cloneChain(chain)
  const idx = next.steps.findIndex((s) => s.status === 'pending')
  const step = next.steps[idx]
  if (step.sign) throw new RuleError('This step needs a signature. Use Approve and Sign.')
  const at = now.toISOString()
  Object.assign(step, { status: 'approved', actedAt: at, actedBy: userId, actingFor: check.actingFor })
  const following = next.steps[idx + 1]
  if (following) {
    following.status = 'pending'
    following.pendingSince = at
    return { chain: next, finished: false as const, nextStep: following }
  }
  next.status = 'approved'
  next.endedAt = at
  return { chain: next, finished: true as const, nextStep: undefined }
}

/** The sponsor head approves and signs (after re-authentication, handled by the caller). */
export function sign(chain: ApprovalChain, project: Project, userId: ID, now: Date) {
  const check = canAct(chain, project, userId, now)
  if (!check.ok) throw new RuleError(check.reason)
  const next = cloneChain(chain)
  const step = next.steps.find((s) => s.status === 'pending')!
  if (!step.sign) throw new RuleError('This step is an approval, not a signature.')
  const at = now.toISOString()
  Object.assign(step, { status: 'approved', actedAt: at, actedBy: userId, actingFor: check.actingFor })
  next.status = 'signed'
  next.endedAt = at
  return { chain: next, actingFor: check.actingFor }
}

/** Request changes. A comment is required. The document goes back to the PM team. */
export function requestChanges(chain: ApprovalChain, project: Project, userId: ID, comment: string, now: Date) {
  if (!comment.trim()) throw new RuleError('Request changes needs a comment explaining what to change.')
  const check = canAct(chain, project, userId, now)
  if (!check.ok) throw new RuleError(check.reason)
  const next = cloneChain(chain)
  const at = now.toISOString()
  for (const s of next.steps) {
    if (s.status === 'pending') Object.assign(s, { status: 'changes_requested', actedAt: at, actedBy: userId, actingFor: check.actingFor, comment })
    else if (s.status === 'waiting') s.status = 'cancelled'
  }
  next.status = 'changes_requested'
  next.endedAt = at
  return { chain: next, actingFor: check.actingFor }
}

/** A new version cancels the chain of the earlier version. */
export function cancel(chain: ApprovalChain, reason: string, now: Date): ApprovalChain {
  if (chain.status !== 'in_progress') return chain
  const next = cloneChain(chain)
  for (const s of next.steps) if (s.status === 'pending' || s.status === 'waiting') s.status = 'cancelled'
  next.status = 'cancelled'
  next.cancelReason = reason
  next.endedAt = now.toISOString()
  return next
}

/**
 * Minor correction (SPEC.md "Minor correction"): approvals given before the person who
 * requested changes carry over; the chain resumes at the requester.
 */
export function minorCorrectionChain(prev: ApprovalChain, args: { id: ID; versionId: ID; project: Project; startedBy: ID; now: Date }): ApprovalChain {
  if (prev.status !== 'changes_requested') throw new RuleError('A minor correction is only possible after someone requested changes.')
  const requesterIdx = prev.steps.findIndex((s) => s.status === 'changes_requested')
  const at = args.now.toISOString()
  const steps: ApprovalStep[] = prev.steps.map((s, i) => {
    const head = headOf(args.project, ROLE_TEAM[s.role])
    const assigneeId = head?.userId ?? s.assigneeId
    if (i < requesterIdx) return { ...s, status: 'carried_over' }
    if (i === requesterIdx) return { role: s.role, assigneeId, sign: s.sign, status: 'pending', pendingSince: at }
    return { role: s.role, assigneeId, sign: s.sign, status: 'waiting' }
  })
  return {
    id: args.id,
    docId: prev.docId,
    projectId: prev.projectId,
    versionId: args.versionId,
    status: 'in_progress',
    steps,
    startedAt: at,
    startedBy: args.startedBy,
    minorCorrectionOf: prev.id,
  }
}

/** The Owner replaced a head: pending and waiting steps move to the new head, same version. */
export function reassign(chain: ApprovalChain, team: Team, newHeadId: ID): ApprovalChain {
  if (chain.status !== 'in_progress') return chain
  const next = cloneChain(chain)
  for (const s of next.steps) if (ROLE_TEAM[s.role] === team && (s.status === 'pending' || s.status === 'waiting')) s.assigneeId = newHeadId
  return next
}

/** Can this version be sent for approval? (SPEC.md approval rules.) */
export function sendCheck(args: {
  docType: DocType
  project: Project
  userId: ID | null
  isSqaMember: boolean
  now: Date
  versionFrozen: boolean
  outOfSync: boolean
  chainInProgress: boolean
  openComments: number
  pendingComments: number
  scopeUndecided: boolean
  previousComplete: Check
  exitCriteria?: Check
}): Check {
  const cfg = CHAIN_CONFIG[args.docType]
  if (args.project.status === 'archived') return no('This project is archived, so it is read-only.')
  const people = peopleCheck(args.project, chainNeeds(args.docType))
  if (cfg.sender === 'PM') {
    const pm = actAsHead(args.project, 'PM', args.userId, args.now)
    if (!pm.ok) return no('Only the Project Manager can send a version for approval.')
  } else if (!args.isSqaMember) return no('Only an SQA team member can send the SQA sign-off.')
  if (args.chainInProgress) return no('This version is already in review.')
  if (args.versionFrozen && !args.outOfSync) return no('This version is already approved and frozen.')
  if (cfg.comments && args.openComments + args.pendingComments > 0)
    return no(`Resolve every open comment and comment pending check first (${args.openComments} open, ${args.pendingComments} pending check).`)
  if (args.scopeUndecided) return no('The PM must first decide whether the flagged edit is a normal edit or a scope change.')
  if (!args.previousComplete.ok) return args.previousComplete
  if (args.exitCriteria && !args.exitCriteria.ok) return args.exitCriteria
  // The whole chain is checked before it starts, so it never stalls halfway for a missing head.
  if (!people.ok) return people
  return yes
}

/** Who must exist before a document's approval chain can start: every head in the chain. */
export function chainNeeds(docType: DocType): Need[] {
  return CHAIN_CONFIG[docType].steps.map((role) => ROLE_NEED[role])
}

const ROLE_NEED: Record<ApproverRole, Need> = { PM: 'PM', TECH_HEAD: 'TECH_HEAD', STAKEHOLDER_HEAD: 'STAKEHOLDER_HEAD', SPONSOR_HEAD: 'SPONSOR_HEAD' }
