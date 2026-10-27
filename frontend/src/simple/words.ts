/**
 * Plain words for the Simple view. The Full view keeps the spec's terms; the Simple view uses
 * everyday words, so people who open the app a few times a year can follow it.
 * Change wording here and every Simple page follows.
 */
import type { DocType } from '../types'
import type { DocStatus } from '../rules/pipeline'

/** Document names, with the short spec name in brackets where people may know it. */
export const DOC_NAME: Record<DocType, string> = {
  PROPOSAL: 'Project proposal',
  CHARTER: 'Project charter',
  BRD: 'Business requirements (BRD)',
  SRS: 'Software requirements (SRS)',
  SQA_SIGNOFF: 'Technical testing sign-off',
  UAT_SIGNOFF: 'User testing sign-off',
}

/** The eight steps of a project, in plain words. */
export const STEP_NAME: Record<string, string> = {
  INTAKE: 'Gathering information',
  PROPOSAL: 'Project proposal',
  CHARTER: 'Project charter',
  BRD: 'Business requirements',
  SRS: 'Software requirements',
  SQA: 'Technical testing',
  UAT: 'User testing',
  COMPLETE: 'Finished',
}

/** "Waiting for Rokeya Begum's approval", "Signed", "Not written yet"… */
export function docStatusText(status: DocStatus, nameOf: (id?: string) => string): string {
  switch (status.key) {
    case 'not_started':
      return 'Not written yet'
    case 'draft':
      return 'Draft, not sent for approval yet'
    case 'in_review':
      return `Waiting for ${nameOf(status.waitingOn)} to approve`
    case 'changes_requested':
      return 'Changes were asked for. The PM team is updating it.'
    case 'approved':
      return status.label.includes('signature') ? 'Approved, waiting to be signed' : 'Approved'
    case 'signed':
      return 'Signed'
    case 'out_of_sync':
      return 'Needs updating, because an earlier document changed'
  }
}

export type Tone = 'done' | 'waiting' | 'action' | 'problem' | 'todo'

export function docTone(status: DocStatus): Tone {
  if (status.key === 'signed' || status.key === 'approved') return 'done'
  if (status.key === 'in_review') return 'waiting'
  if (status.key === 'changes_requested' || status.key === 'out_of_sync') return 'problem'
  if (status.key === 'draft') return 'action'
  return 'todo'
}

/** "2 days", "3 hours" — how long something has waited. */
export function waited(since: string | undefined, now: Date): string {
  if (!since) return ''
  const h = Math.max(0, (now.getTime() - new Date(since).getTime()) / 3_600_000)
  if (h < 1) return 'less than an hour'
  if (h < 24) return `${Math.round(h)} hour${Math.round(h) === 1 ? '' : 's'}`
  const d = Math.round(h / 24)
  return `${d} day${d === 1 ? '' : 's'}`
}

interface TaskLike {
  type: string
  title: string
  link: string
  count?: number
}

/**
 * A waiting item ("Your turn to approve: BRD v3") as a plain sentence with one button,
 * and where the button goes in the Simple view.
 */
export function plainTask(t: TaskLike): { title: string; button: string; to: string } {
  const n = t.count ?? 1
  const docType = /\/docs\/([A-Z_]+)/.exec(t.link)?.[1] as DocType | undefined
  const code = /: ([A-Z]+-\d+)$/.exec(t.title)?.[1]
  switch (t.type) {
    case 'approval': {
      const sign = t.title.includes('approve and sign')
      const signoff = t.link.includes('tab=signoff') ? (t.link.includes('/SQA') ? DOC_NAME.SQA_SIGNOFF : DOC_NAME.UAT_SIGNOFF) : undefined
      const name = docType ? DOC_NAME[docType] : signoff ?? 'a document'
      return { title: `${sign ? 'Approve and sign' : 'Approve'}: ${name}`, button: 'Read and decide', to: t.link }
    }
    case 'question':
      return { title: n > 1 ? `Answer ${n} questions` : 'Answer a question', button: 'Answer', to: '/questions' }
    case 'factsheet':
      return { title: 'Check and confirm the project facts', button: 'Check', to: t.link }
    case 'tests':
      return { title: 'Test the new system', button: 'Start testing', to: '/my-work?tab=tests' }
    case 'defect':
      return t.title.startsWith('Critical')
        ? { title: `Fix an urgent problem${code ? ` (${code})` : ''}`, button: 'Open', to: t.link }
        : { title: `Assign a new problem report${code ? ` (${code})` : ''}`, button: 'Open', to: t.link }
    case 'retest':
      return { title: `Check that a problem is fixed${code ? ` (${code})` : ''}`, button: 'Check', to: t.link }
    case 'test-list':
      return { title: 'Confirm the list of tests', button: 'Review', to: t.link }
    case 'decision':
      return { title: n > 1 ? `Confirm ${n} decisions from the team` : 'Confirm a decision from the team', button: 'Review', to: t.link }
    case 'fact-update':
      return { title: n > 1 ? `Check ${n} suggested changes to the project facts` : 'Check a suggested change to the project facts', button: 'Review', to: t.link }
    default:
      return { title: t.title, button: 'Open', to: t.link }
  }
}
