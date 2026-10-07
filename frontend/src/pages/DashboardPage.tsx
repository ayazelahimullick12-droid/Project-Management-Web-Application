/**
 * Dashboard: my tasks, my projects with document statuses, and (for the Owner and Admin)
 * the portfolio view with stalled items sorted by waiting time. SPEC.md "Dashboard".
 */
import { Plus, Timer } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useApi, useNow } from '../api/hooks'
import type { ProjectSummary } from '../api/projects'
import { DOC_SHORT } from '../rules/pipeline'
import { DocStatusChip } from '../components/status'
import { StageTracker } from '../components/StageTracker'
import { ago, duration } from '../components/format'
import { OpenQuestion } from '../components/OpenQuestion'
import { Badge, Card, EmptyState, ErrorBox, LinkButton, Loading, PageHeader, Table, Td } from '../components/ui'

export function ProjectCard({ s }: { s: ProjectSummary }) {
  const now = useNow()
  return (
    <Link to={`/projects/${s.project.id}`} className="block rounded-lg bg-white p-4 ring-1 ring-line transition hover:ring-brand">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{s.project.name}</h3>
        {s.project.status === 'archived' && <Badge>Archived</Badge>}
        {s.project.finished && <Badge tone="green">Finished {s.project.finishedYear}</Badge>}
        <span className="ml-auto text-xs text-muted">{s.myRole}</span>
      </div>
      <p className="mb-3 line-clamp-2 text-sm text-muted">{s.project.description}</p>
      <StageTracker stage={s.stage} compact />
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
        {s.docs
          .filter((d) => d.status.key !== 'not_started')
          .map((d) => (
            <div key={d.type} className="flex items-center gap-1.5">
              <span className="w-20 shrink-0 text-muted">{DOC_SHORT[d.type]}</span>
              <DocStatusChip status={d.status} />
              {d.status.since && d.status.key === 'in_review' && <span className="text-muted">{ago(d.status.since, now)}</span>}
            </div>
          ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
        {s.unansweredQuestions > 0 && <span>{s.unansweredQuestions} unanswered questions</span>}
        {s.docs.reduce((n, d) => n + d.openComments, 0) > 0 && <span>{s.docs.reduce((n, d) => n + d.openComments, 0)} open comments</span>}
        {s.docs.reduce((n, d) => n + d.pendingComments, 0) > 0 && <span>{s.docs.reduce((n, d) => n + d.pendingComments, 0)} pending check</span>}
        {s.openChangeRequests > 0 && <span>{s.openChangeRequests} open change requests</span>}
        {s.openDefects > 0 && <span>{s.openDefects} unresolved defects</span>}
      </div>
    </Link>
  )
}

export function DashboardPage() {
  const now = useNow()
  const { data, isLoading, error } = useApi(['dashboard'], api.projects.dashboard)
  if (isLoading) return <Loading />
  if (error || !data) return <ErrorBox error={error} />
  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Your tasks and projects. Anything waiting on you is reminded every 4 working hours." actions={<LinkButton to="/projects/new" variant="primary"><Plus className="h-4 w-4" /> New project</LinkButton>} />
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <h2 className="text-sm font-semibold">Active projects</h2>
          {data.active.length ? data.active.map((s) => <ProjectCard key={s.project.id} s={s} />) : <EmptyState title="No active projects">Create one with New project.</EmptyState>}
        </div>
        <div className="space-y-4">
          <Card title="Waiting on you" subtitle="Approvals, questions, tests and defects that need you">
            {data.myTasks.length ? (
              <ul className="-my-1 divide-y divide-line">
                {data.myTasks.map((t) => (
                  <li key={t.key} className="py-2">
                    <Link to={t.link} className="block hover:text-brand">
                      <div className="text-sm font-medium">{t.title}</div>
                      <div className="text-xs text-muted">
                        {t.projectName} · waiting {duration(now.getTime() - new Date(t.since).getTime())}
                        {t.recipients.find((r) => r.forUserId) && ' · covering for an Away head'}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Nothing is waiting on you.</p>
            )}
          </Card>
          {data.finished.length > 0 && (
            <Card title="Finished projects" subtitle="Indexed for the RAG agent">
              <ul className="space-y-1 text-sm">
                {data.finished.map((s) => (
                  <li key={s.project.id}>
                    <Link to={`/projects/${s.project.id}`} className="hover:text-brand">
                      {s.project.name}
                    </Link>{' '}
                    <span className="text-xs text-muted">({s.project.finishedYear ?? s.project.legacy?.year})</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
      {data.portfolio && (
        <div className="mt-8">
          <Card
            title={
              <span className="flex items-center gap-2">
                <Timer className="h-4 w-4" /> Portfolio: stalled items <OpenQuestion id="escalation" />
              </span>
            }
            subtitle="Everything waiting on a person across your projects, longest waiting first (Owner and Admin view)."
            padded={false}
          >
            <Table head={['Waiting', 'Item', 'Project', 'Waiting on', 'Reminders']}>
              {data.stalled.map((t) => (
                <tr key={t.key}>
                  <Td className="whitespace-nowrap font-medium">{duration(now.getTime() - new Date(t.since).getTime())}</Td>
                  <Td>
                    <Link to={t.link} className="hover:text-brand">
                      {t.title}
                    </Link>
                  </Td>
                  <Td className="text-muted">{t.projectName}</Td>
                  <Td>
                    {t.waitingOnName}
                    {t.recipients.some((r) => r.forUserId) && <span className="text-xs text-muted"> (deputy covering)</span>}
                  </Td>
                  <Td className="text-muted">every 4 working hours</Td>
                </tr>
              ))}
            </Table>
            {!data.stalled.length && <p className="p-4 text-sm text-muted">Nothing is stalled.</p>}
          </Card>
        </div>
      )}
    </div>
  )
}

export function ArchivePage() {
  const { data } = useApi(['dashboard'], api.projects.dashboard)
  return (
    <div>
      <PageHeader title="Archived projects" subtitle="Archived projects are read-only and leave the active dashboard." actions={<OpenQuestion id="archive-reopen" />} />
      <div className="space-y-4">{data?.archived.length ? data.archived.map((s) => <ProjectCard key={s.project.id} s={s} />) : <EmptyState title="No archived projects" />}</div>
    </div>
  )
}
