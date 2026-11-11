/**
 * The SQA and UAT sign-off report, for one product version.
 *
 * Every number here is counted by code, never by the AI. The AI only writes the summary
 * paragraph, passed in as `summary`.
 */
import type { PointCheck, ProductVersion, Requirement, TestPoint, TestStage, User } from '../types'
import { coverage, latestCheck, versionCounts } from './testing'

export interface ReportInput {
  stage: TestStage
  version?: ProductVersion
  requirements: Requirement[]
  points: TestPoint[] // this stage's points
  checks: PointCheck[]
  versions: ProductVersion[] // every version of the project, oldest first (for the history)
  users: User[]
  summary: string
}

export function reportStats(input: Omit<ReportInput, 'summary' | 'users' | 'versions'>) {
  const cov = coverage(input.stage, input.requirements, input.points)
  return {
    ...versionCounts(input.points, input.version?.id, input.checks),
    requirements: cov.length,
    covered: cov.filter((c) => c.points.length > 0).length,
    notTestable: cov.filter((c) => c.requirement.notTestable),
  }
}

const cell = (t: string) => t.replace(/\|/g, '/').replace(/\s+/g, ' ').trim()

export function buildReportSections(input: ReportInput): { key: string; title: string; content: string }[] {
  const st = reportStats(input)
  const name = (id?: string) => input.users.find((u) => u.id === id)?.name ?? '—'
  const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Dhaka' }) : '—')
  const v = input.version
  const onVersion = input.points.map((pt) => ({ pt, check: latestCheck(pt, v?.id, input.checks) }))
  const dates = onVersion.map((x) => x.check?.at).filter(Boolean).sort() as string[]
  const testers = [...new Set(onVersion.map((x) => x.check && name(x.check.by)).filter(Boolean))]
  const pointIds = new Set(input.points.map((pt) => pt.id))
  // Earlier versions that were tested in this stage, with how many points failed on each.
  const earlier = input.versions
    .filter((x) => x.id !== v?.id && input.checks.some((c) => c.versionId === x.id && pointIds.has(c.pointId)))
    .map((x) => ({ x, n: versionCounts(input.points, x.id, input.checks) }))

  return [
    { key: 'summary', title: 'Summary', content: `${input.summary}\n\n*AI-generated summary. All numbers below are counted by the app.*` },
    {
      key: 'version',
      title: 'Version and dates',
      content: `- **Version signed off:** ${v ? `${v.version} (added ${fmt(v.addedAt)})` : '—'}\n- **Checked between:** ${fmt(dates[0])} and ${fmt(dates.at(-1))}\n- **Checked by:** ${testers.join(', ') || '—'}`,
    },
    {
      key: 'results',
      title: 'Results',
      content: `| Result | Points |\n| --- | --- |\n| Passed | ${st.pass} |\n| Failed | ${st.fail} |\n| Not checked | ${st.toCheck} |\n| **Total** | **${st.total}** |`,
    },
    {
      key: 'points',
      title: 'Testing points',
      content: onVersion.length
        ? `| Point | Result | Comment |\n| --- | --- | --- |\n${onVersion.map(({ pt, check }) => `| **${pt.key}** ${cell(pt.text)} | ${check ? (check.result === 'pass' ? 'PASS' : 'FAIL') : 'Not checked'} | ${cell(check?.comment ?? '') || '—'} |`).join('\n')}`
        : 'No testing points.',
    },
    {
      key: 'coverage',
      title: 'Requirements coverage',
      content: `${st.covered} of ${st.requirements} ${input.stage === 'SQA' ? 'SRS' : 'BRD'} requirements have at least one testing point.${st.notTestable.length ? `\n\n**Not testable:**\n${st.notTestable.map((c) => `- **${c.requirement.id}:** ${c.requirement.notTestable!.reason}`).join('\n')}` : ''}`,
    },
    {
      key: 'history',
      title: 'Earlier versions',
      content: earlier.length ? earlier.map(({ x, n }) => `- **${x.version}:** ${n.pass} passed, ${n.fail} failed, ${n.toCheck} not checked`).join('\n') : 'None. This was the first version tested.',
    },
  ]
}
