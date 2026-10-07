/**
 * The document pipeline and project stages.
 *
 * Spec: SPEC.md "Document pipeline" (order, what each document needs first, restarting the
 * pipeline, Out of sync) and SPEC_SQA_UAT.md "The two stages".
 */
import type { ApprovalChain, Doc, DocType, DocVersion, FactSheetVersion, ID, Project, QARound } from '../types'
import { CHAIN_CONFIG, ROLE_LABEL, currentStep } from './approval'
import { no, yes, type Check } from './permissions'

export type Stage = 'INTAKE' | 'PROPOSAL' | 'CHARTER' | 'BRD' | 'SRS' | 'SQA' | 'UAT' | 'COMPLETE'
export const STAGES: Stage[] = ['INTAKE', 'PROPOSAL', 'CHARTER', 'BRD', 'SRS', 'SQA', 'UAT', 'COMPLETE']
export const STAGE_LABEL: Record<Stage, string> = {
  INTAKE: 'Intake',
  PROPOSAL: 'Proposal',
  CHARTER: 'Charter',
  BRD: 'BRD',
  SRS: 'SRS',
  SQA: 'SQA',
  UAT: 'UAT',
  COMPLETE: 'Complete',
}

/** Every step of the pipeline in order. Sign-offs count as later documents (SPEC_SQA_UAT.md). */
export const PIPELINE: DocType[] = ['PROPOSAL', 'CHARTER', 'BRD', 'SRS', 'SQA_SIGNOFF', 'UAT_SIGNOFF']

export const DOC_LABEL: Record<DocType, string> = {
  PROPOSAL: 'Project Proposal',
  CHARTER: 'Project Charter',
  BRD: 'BRD',
  SRS: 'SRS',
  SQA_SIGNOFF: 'SQA sign-off',
  UAT_SIGNOFF: 'UAT sign-off',
}

export const DOC_SHORT: Record<DocType, string> = {
  PROPOSAL: 'Proposal',
  CHARTER: 'Charter',
  BRD: 'BRD',
  SRS: 'SRS',
  SQA_SIGNOFF: 'SQA sign-off',
  UAT_SIGNOFF: 'UAT sign-off',
}

/** Everything about one project the pipeline rules need. */
export interface PipelineCtx {
  project: Project
  docs: Doc[]
  versions: DocVersion[]
  chains: ApprovalChain[]
  factSheets: FactSheetVersion[]
  rounds: QARound[]
}

export function docOf(ctx: PipelineCtx, type: DocType): Doc | undefined {
  return ctx.docs.find((d) => d.type === type)
}

export function chainsOf(ctx: Pick<PipelineCtx, 'chains'>, docId: ID): ApprovalChain[] {
  return ctx.chains.filter((c) => c.docId === docId).sort((a, b) => a.startedAt.localeCompare(b.startedAt))
}

/** The most recent chain on the document's current version (if any). */
export function activeChain(ctx: Pick<PipelineCtx, 'chains'>, doc: Doc): ApprovalChain | undefined {
  return chainsOf(ctx, doc.id)
    .filter((c) => c.versionId === doc.currentVersionId && c.status !== 'cancelled')
    .at(-1)
}

/** Fully approved (and signed where signing applies) on its current version, and in sync. */
export function isComplete(ctx: PipelineCtx, type: DocType): boolean {
  if (ctx.project.finished) return true
  const doc = docOf(ctx, type)
  if (!doc?.currentVersionId || doc.outOfSync) return false
  const chain = activeChain(ctx, doc)
  return !!chain && chain.status === (CHAIN_CONFIG[type].signs ? 'signed' : 'approved')
}

export function factSheetConfirmed(ctx: Pick<PipelineCtx, 'factSheets' | 'project'>): boolean {
  return ctx.project.finished || ctx.factSheets.some((f) => f.projectId === ctx.project.id && !!f.confirmedBy)
}

export function roundClosed(ctx: Pick<PipelineCtx, 'rounds' | 'project'>, purpose: QARound['purpose']): boolean {
  return ctx.rounds.some((r) => r.projectId === ctx.project.id && r.purpose === purpose && r.status === 'closed')
}

export function previousType(type: DocType): DocType | undefined {
  const i = PIPELINE.indexOf(type)
  return i > 0 ? PIPELINE[i - 1] : undefined
}

export function laterTypes(type: DocType): DocType[] {
  return PIPELINE.slice(PIPELINE.indexOf(type) + 1)
}

/** Is everything before this document done, so it can go for approval? */
export function previousComplete(ctx: PipelineCtx, type: DocType): Check {
  const prev = previousType(type)
  if (!prev) return factSheetConfirmed(ctx) ? yes : no('The stakeholder head must confirm the Fact Sheet first.')
  if (isComplete(ctx, prev)) return yes
  const verb = CHAIN_CONFIG[prev].signs ? 'signed' : 'approved'
  return no(`The ${DOC_LABEL[prev]} must be ${verb} first (documents are approved in order).`)
}

/** Can the AI generate the first draft of this document? */
export function canGenerate(ctx: PipelineCtx, type: DocType): Check {
  const before = previousComplete(ctx, type)
  if (!before.ok) return before
  if (type === 'BRD' && !roundClosed(ctx, 'brd_business')) return no('Run and close the business processes Q/A round first.')
  if (type === 'SRS' && !roundClosed(ctx, 'srs_technical')) return no('Run and close the technical Q/A round (answered by the tech team) first.')
  return yes
}

/** Where the project is: the first step that is not complete. */
export function projectStage(ctx: PipelineCtx): Stage {
  if (ctx.project.finished) return 'COMPLETE'
  if (!factSheetConfirmed(ctx)) return 'INTAKE'
  const map: Record<DocType, Stage> = { PROPOSAL: 'PROPOSAL', CHARTER: 'CHARTER', BRD: 'BRD', SRS: 'SRS', SQA_SIGNOFF: 'SQA', UAT_SIGNOFF: 'UAT' }
  for (const t of PIPELINE) if (!isComplete(ctx, t)) return map[t]
  return 'COMPLETE'
}

export type StatusKey = 'not_started' | 'draft' | 'in_review' | 'changes_requested' | 'approved' | 'signed' | 'out_of_sync'

export interface DocStatus {
  key: StatusKey
  label: string
  waitingOn?: ID
  waitingRole?: string
  since?: string
}

/** The status shown on document cards and the dashboard (SPEC.md "Dashboard"). */
export function docStatus(ctx: PipelineCtx, doc: Doc | undefined): DocStatus {
  if (!doc?.currentVersionId) return { key: 'not_started', label: 'Not started' }
  const chain = activeChain(ctx, doc)
  if (chain?.status === 'in_progress') {
    const step = currentStep(chain)!
    return { key: 'in_review', label: `Waiting on ${ROLE_LABEL[step.role].toLowerCase()}`, waitingOn: step.assigneeId, waitingRole: ROLE_LABEL[step.role], since: step.pendingSince }
  }
  if (doc.outOfSync) return { key: 'out_of_sync', label: 'Out of sync', since: doc.outOfSync.since }
  if (chain?.status === 'changes_requested') return { key: 'changes_requested', label: 'Changes requested', since: chain.endedAt }
  if (chain?.status === 'signed') return { key: 'signed', label: 'Signed (frozen)', since: chain.endedAt }
  if (chain?.status === 'approved') return { key: 'approved', label: CHAIN_CONFIG[doc.type].signs ? 'Approved, awaiting signature' : 'Approved (frozen)', since: chain.endedAt }
  return { key: 'draft', label: 'Draft' }
}
