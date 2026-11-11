/** Consistent status chips across documents, facts, approvals and testing points. */
import type { FactStatus } from '../types'
import type { PointStatus } from '../rules/testing'
import type { StatusKey } from '../rules/pipeline'
import { Dot, type Tone } from './ui'

const DOC_TONE: Record<StatusKey, Tone> = {
  not_started: 'gray',
  draft: 'gray',
  in_review: 'blue',
  changes_requested: 'amber',
  approved: 'green',
  signed: 'green',
  out_of_sync: 'red',
}

export function DocStatusChip({ status }: { status: { key: StatusKey; label: string } }) {
  return <Dot tone={DOC_TONE[status.key]}>{status.label}</Dot>
}

const FACT_TONE: Record<FactStatus, Tone> = { filled: 'green', missing: 'gray', assumed: 'amber', conflicting: 'red' }
export function FactChip({ status }: { status: FactStatus }) {
  return <Dot tone={FACT_TONE[status]}>{status}</Dot>
}

const POINT: Record<PointStatus, [Tone, string]> = { pass: ['green', 'PASS'], fail: ['red', 'FAIL'], to_check: ['gray', 'To check'] }
export function PointChip({ status }: { status: PointStatus }) {
  const [tone, label] = POINT[status]
  return <Dot tone={tone}>{label}</Dot>
}

export function StepStatusChip({ status }: { status: string }) {
  const map: Record<string, [Tone, string]> = {
    waiting: ['gray', 'Waiting'],
    pending: ['blue', 'Their turn'],
    approved: ['green', 'Approved'],
    changes_requested: ['amber', 'Changes requested'],
    cancelled: ['gray', 'Cancelled'],
    carried_over: ['green', 'Carried over'],
  }
  const [tone, label] = map[status] ?? ['gray', status]
  return <Dot tone={tone}>{label}</Dot>
}
