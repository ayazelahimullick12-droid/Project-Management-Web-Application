/**
 * The SQA and UAT sign-off report.
 *
 * Spec: SPEC_SQA_UAT.md "Sign-off" → "The sign-off report". Every number here is counted by
 * code, never by the AI. The AI only writes the summary paragraph, passed in as `summary`.
 */
import type { Build, Defect, Execution, Requirement, Severity, TestCase, TestStage, User } from '../types'
import { coverage, knownIssues, latestResults, UNRESOLVED } from './testing'

export interface ReportInput {
  stage: TestStage
  build?: Build
  requirements: Requirement[]
  tests: TestCase[]
  executions: Execution[]
  defects: Defect[]
  users: User[]
  blocking: Severity[]
  summary: string
}

export function reportStats(input: Omit<ReportInput, 'summary' | 'users' | 'build'>) {
  const results = latestResults(input.stage, input.tests, input.executions)
  const count = (r: string) => results.filter((x) => (x.latest?.result ?? 'not_run') === r).length
  const cov = coverage(input.stage, input.requirements, input.tests)
  const defects = input.defects.filter((d) => d.stage === input.stage)
  return {
    total: results.length,
    pass: count('pass'),
    fail: count('fail'),
    blocked: count('blocked'),
    notRun: count('not_run'),
    requirements: cov.length,
    covered: cov.filter((c) => c.tests.length > 0).length,
    notTestable: cov.filter((c) => c.requirement.notTestable),
    defects,
    known: knownIssues(input.stage, input.defects, input.blocking),
  }
}

const SEVERITIES: Severity[] = ['Critical', 'High', 'Medium', 'Low']

export function buildReportSections(input: ReportInput): { key: string; title: string; content: string }[] {
  const st = reportStats(input)
  const name = (id?: string) => input.users.find((u) => u.id === id)?.name ?? '—'
  const dates = input.executions
    .filter((e) => e.stage === input.stage && e.executedAt)
    .map((e) => e.executedAt!)
    .sort()
  const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Dhaka' }) : '—')
  const testers = [...new Set(input.executions.filter((e) => e.stage === input.stage && e.executedBy).map((e) => name(e.executedBy)))]

  const defectRows = SEVERITIES.map((sev) => {
    const ds = st.defects.filter((d) => d.severity === sev)
    const unresolved = ds.filter((d) => UNRESOLVED.includes(d.status)).length
    const closed = ds.filter((d) => d.status === 'Closed').length
    const deferred = ds.filter((d) => d.status === 'Deferred').length
    const other = ds.length - unresolved - closed - deferred
    return `| ${sev} | ${ds.length} | ${unresolved} | ${closed} | ${deferred} | ${other} |`
  })

  return [
    { key: 'summary', title: 'Summary', content: `${input.summary}\n\n*AI-generated summary. All numbers below are counted by the app.*` },
    {
      key: 'build',
      title: 'Build and dates',
      content: `- **Build signed off:** ${input.build ? `${input.build.version} (registered ${fmt(input.build.registeredAt)})` : '—'}\n- **Testing dates:** ${fmt(dates[0])} to ${fmt(dates.at(-1))}\n- **Testers:** ${testers.join(', ') || '—'}`,
    },
    {
      key: 'results',
      title: 'Test results',
      content: `| Result | Test cases |\n| --- | --- |\n| Passed | ${st.pass} |\n| Failed | ${st.fail} |\n| Blocked | ${st.blocked} |\n| Not run | ${st.notRun} |\n| **Total** | **${st.total}** |`,
    },
    {
      key: 'coverage',
      title: 'Requirements coverage',
      content: `${st.covered} of ${st.requirements} ${input.stage === 'SQA' ? 'SRS' : 'BRD'} requirements have at least one test case.${st.notTestable.length ? `\n\n**Not testable:**\n${st.notTestable.map((c) => `- **${c.requirement.id}:** ${c.requirement.notTestable!.reason}`).join('\n')}` : ''}`,
    },
    {
      key: 'defects',
      title: 'Defects',
      content: `| Severity | Total | Unresolved | Closed | Deferred | Rejected, duplicate or change request |\n| --- | --- | --- | --- | --- | --- |\n${defectRows.join('\n')}`,
    },
    {
      key: 'known',
      title: 'Known issues',
      content: st.known.length ? st.known.map((d) => `- **${d.key}** (${d.severity}, ${d.status}): ${d.title}${d.outcomeReason ? ` — ${d.outcomeReason}` : ''}`).join('\n') : 'None.',
    },
  ]
}
