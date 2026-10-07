/** Per-project audit log, shown to the Project Owner and the PM. */
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { useApi } from '../api/hooks'
import { fmtDateTime } from '../components/format'
import { Card, ErrorBox, Loading, PageHeader, Table, Td } from '../components/ui'

export function AuditPage() {
  const { pid = '' } = useParams()
  const { data: project } = useApi(['project', pid], () => api.projects.getProject(pid))
  const { data, isLoading, error } = useApi(['audit', pid], () => api.projects.projectAudit(pid))
  if (isLoading) return <Loading />
  return (
    <div>
      <PageHeader eyebrow={<Link to={`/projects/${pid}`}>{project?.summary.project.name}</Link>} title="Audit log" subtitle="Logins, roles, uploads, answers, confirmations, versions, AI generations, locks, comments, suggestions, approvals, signatures (with fingerprints), change requests, archive." />
      {error ? (
        <ErrorBox error={error} />
      ) : (
        <Card padded={false}>
          <Table head={['When', 'Who', 'Action', 'Details']}>
            {data?.map((a) => (
              <tr key={a.id}>
                <Td className="whitespace-nowrap text-xs text-muted">{fmtDateTime(a.createdAt)}</Td>
                <Td className="text-xs">{a.actorName}{a.actingForName && <span className="text-muted"> (for {a.actingForName})</span>}</Td>
                <Td className="text-sm font-medium">{a.action}</Td>
                <Td className="text-sm">{a.details}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </div>
  )
}
