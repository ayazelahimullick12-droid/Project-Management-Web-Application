/** Consistent status chips across documents, facts, approvals, tests and defects. */
import type { DefectStatus, FactStatus, Severity, TestResult } from '../types'
import type { StatusKey } from '../rules/pipeline'
import { Badge, Dot, type Tone } from './ui'

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

const SEV_TONE: Record<Severity, Tone> = { Critical: 'red', High: 'amber', Medium: 'blue', Low: 'gray' }
export function SeverityChip({ severity }: { severity: Severity }) {
  return <Badge tone={SEV_TONE[severity]}>{severity}</Badge>
}

const DEF_TONE: Record<DefectStatus, Tone> = {
  New: 'magenta',
  Open: 'blue',
  'In progress': 'blue',
  Fixed: 'violet',
  'Ready for retest': 'amber',
  Closed: 'green',
  Reopened: 'red',
  Rejected: 'gray',
  Duplicate: 'gray',
  Deferred: 'gray',
  'Change request': 'gray',
}
export function DefectStatusChip({ status }: { status: DefectStatus }) {
  return <Dot tone={DEF_TONE[status]}>{status}</Dot>
}

const RES: Record<TestResult, [Tone, string]> = { pass: ['green', 'Pass'], fail: ['red', 'Fail'], blocked: ['amber', 'Blocked'], not_run: ['gray', 'Not run'] }
export function ResultChip({ result }: { result: TestResult | undefined }) {
  const [tone, label] = RES[result ?? 'not_run']
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
