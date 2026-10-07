/** My tests: every test case assigned to me, across projects (SPEC_SQA_UAT.md "Test runs"). */
import { FlaskConical } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useApi } from '../api/hooks'
import { ResultChip } from '../components/status'
import { fmtDateTime } from '../components/format'
import { Badge, Button, Card, EmptyState, Loading, PageHeader, Table, Td } from '../components/ui'
import { RecordResultModal } from './testing/DefectForms'

export function MyTestsPage() {
  const { data, isLoading } = useApi(['my-tests'], api.testing.myTests)
  const [running, setRunning] = useState<NonNullable<typeof data>[number] | null>(null)
  if (isLoading) return <Loading />
  const open = (data ?? []).filter((e) => e.result === 'not_run')
  const done = (data ?? []).filter((e) => e.result !== 'not_run')
  return (
    <div>
      <PageHeader title="My tests" subtitle="Test cases assigned to you. Record Pass, Fail (with a defect) or Blocked (with a reason)." />
      {open.length ? (
        <Card title={`To run (${open.length})`} padded={false} className="mb-6">
          <Table head={['Test', 'Project', 'Run', 'Build', '']}>
            {open.map((e) => (
              <tr key={e.id}>
                <Td><span className="font-mono text-xs">{e.test?.key}</span> {e.test?.title}</Td>
                <Td className="text-xs">{e.projectName} <Badge>{e.stage}</Badge></Td>
                <Td className="text-xs">{e.run?.name}</Td>
                <Td className="text-xs">{e.buildVersion}</Td>
                <Td><Button size="sm" variant="primary" onClick={() => setRunning(e)}>Run test</Button></Td>
              </tr>
            ))}
          </Table>
        </Card>
      ) : (
        <EmptyState title="Nothing to run" icon={<FlaskConical className="h-6 w-6" />}>Try signing in as an SQA tester (Tania Ferdous) or a UAT tester (Habib Ullah) on the Member Savings Statement Portal.</EmptyState>
      )}
      {done.length > 0 && (
        <Card title="Done" padded={false}>
          <Table head={['Test', 'Project', 'Result', 'When']}>
            {done.slice(0, 30).map((e) => (
              <tr key={e.id}>
                <Td><Link to={`/projects/${e.projectId}/testing/${e.stage}?tab=runs`} className="hover:text-brand"><span className="font-mono text-xs">{e.test?.key}</span> {e.test?.title}</Link></Td>
                <Td className="text-xs">{e.projectName}</Td>
                <Td><ResultChip result={e.result} /></Td>
                <Td className="text-xs text-muted">{fmtDateTime(e.executedAt)}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
      {running && <RecordResultModal execution={running} onClose={() => setRunning(null)} />}
    </div>
  )
}
