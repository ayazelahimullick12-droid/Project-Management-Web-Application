/**
 * My tests: the SQA and UAT testing I take part in, across projects, with how many points are
 * still to check on the newest version.
 */
import { ArrowRight, FlaskConical } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useApi } from '../api/hooks'
import { Badge, EmptyState, Loading, PageHeader } from '../components/ui'

export function MyTestsPage({ embedded }: { embedded?: boolean } = {}) {
  const { data, isLoading } = useApi(['my-tests'], api.testing.myTests)
  if (isLoading) return <Loading />
  const rows = data ?? []
  return (
    <div>
      {!embedded && <PageHeader title="My tests" subtitle="Testing you take part in. Pick the version, then mark each point PASS or FAIL." />}
      {rows.length ? (
        <ul className="shadow-soft divide-y divide-line/70 overflow-hidden rounded-3xl border border-line/70 bg-surface">
          {rows.map((r) => (
            <li key={`${r.projectId}:${r.stage}`}>
              <Link to={`/projects/${r.projectId}/testing/${r.stage}${r.versionId ? `?version=${r.versionId}` : ''}`} className="flex items-center gap-3 px-4 py-3 hover:bg-canvas">
                <FlaskConical className="h-4 w-4 shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {r.projectName} <Badge>{r.stage}</Badge>
                  </div>
                  <div className="truncate text-xs text-muted">
                    {!r.total ? 'No testing points yet' : !r.version ? `${r.total} points · no version to test yet` : `Version ${r.version}: ${r.toCheck} to check · ${r.pass} passed · ${r.fail} failed`}
                  </div>
                </div>
                {r.toCheck > 0 && r.version && <Badge tone="blue">{r.toCheck} to check</Badge>}
                <ArrowRight className="h-4 w-4 shrink-0 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No testing for you right now" icon={<FlaskConical className="h-6 w-6" />}>
          SQA testers check SQA points after the SRS is signed. Developers, stakeholders and the PM team check UAT points after the SQA sign-off.
        </EmptyState>
      )}
    </div>
  )
}
