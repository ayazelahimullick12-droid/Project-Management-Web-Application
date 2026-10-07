/**
 * Project home: stage tracker, document cards ("Waiting on name since time"), open items and team.
 * SPEC.md "Dashboard" (per project) and BUILD_SPEC "Project home".
 */
import { Archive, ArrowRight, Crown, FileText, FlaskConical, Plane } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { useApi, useNow } from '../api/hooks'
import { DOC_LABEL } from '../rules/pipeline'
import { TEAM_LABEL } from '../rules/permissions'
import { DocStatusChip } from '../components/status'
import { StageTracker } from '../components/StageTracker'
import { ago, fmtDate } from '../components/format'
import { Avatar, Badge, Card, ErrorBox, LinkButton, Loading, Note, PageHeader } from '../components/ui'

export function ProjectHomePage() {
  const { pid = '' } = useParams()
  const now = useNow()
  const { data, isLoading, error } = useApi(['project', pid], () => api.projects.getProject(pid))
  if (isLoading) return <Loading />
  if (error || !data) return <ErrorBox error={error} />
  const { summary, me } = data
  const p = summary.project
  const docLink = (type: string) => (type === 'SQA_SIGNOFF' ? `/projects/${pid}/testing/SQA?tab=signoff` : type === 'UAT_SIGNOFF' ? `/projects/${pid}/testing/UAT?tab=signoff` : `/projects/${pid}/docs/${type}`)
  const nameOf = (id?: string) => data.members.find((m) => m.member.userId === id)?.name ?? '—'

  return (
    <div>
      <PageHeader
        eyebrow={summary.myRole}
        title={p.name}
        subtitle={`${p.description} · Owner: ${data.ownerName} · Created ${fmtDate(p.createdAt)}`}
        actions={me.canManageTeam && <LinkButton to={`/projects/${pid}/team`}>Manage team</LinkButton>}
      />
      {p.status === 'archived' && (
        <Note tone="gray" icon={<Archive className="h-4 w-4" />} className="mb-4">
          Archived on {fmtDate(p.archivedAt)}. The project is read-only.
        </Note>
      )}
      {p.finished && (
        <Note tone="green" className="mb-4">
          Finished project ({p.finishedYear ?? p.legacy?.year}). Its signed documents are indexed so the RAG agent can suggest from them.
        </Note>
      )}
      <div className="mb-6 rounded-lg bg-white p-4 ring-1 ring-line">
        <div className="mb-2 text-xs font-medium text-muted">Stage</div>
        <StageTracker stage={summary.stage} />
        {summary.stage === 'INTAKE' && (
          <div className="mt-3 text-sm">
            Next: the stakeholders give their information on the <Link className="font-medium text-brand" to={`/projects/${pid}/intake`}>Intake page</Link>, then the Q/A agent builds the Fact Sheet.
          </div>
        )}
        {summary.stage === 'COMPLETE' && !p.finished && (
          <div className="mt-3 text-sm">
            Documentation complete. {me.isOwner && p.status === 'active' && <Link className="font-medium text-brand" to={`/projects/${pid}/team`}>The Owner may archive the project.</Link>}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <div>
          <h2 className="mb-3 text-sm font-semibold">Documents and sign-offs</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {summary.docs.map((d) => (
              <Link key={d.type} to={docLink(d.type)} className="rounded-lg bg-white p-4 ring-1 ring-line transition hover:ring-brand">
                <div className="mb-2 flex items-center gap-2">
                  {d.type.endsWith('SIGNOFF') ? <FlaskConical className="h-4 w-4 text-muted" /> : <FileText className="h-4 w-4 text-muted" />}
                  <span className="font-medium">{DOC_LABEL[d.type]}</span>
                  {d.versionNumber && <span className="text-xs text-muted">v{d.versionNumber}</span>}
                  <ArrowRight className="ml-auto h-4 w-4 text-muted" />
                </div>
                <DocStatusChip status={d.status} />
                {d.status.waitingOn && (
                  <div className="mt-2 text-xs text-muted">
                    Waiting on <b className="text-ink">{nameOf(d.status.waitingOn)}</b> since {ago(d.status.since, now)}
                  </div>
                )}
                {d.status.key === 'out_of_sync' && <div className="mt-2 text-xs text-red-700">An earlier document changed. Re-approval needed, in order.</div>}
                {(d.openComments > 0 || d.pendingComments > 0) && (
                  <div className="mt-2 flex gap-2 text-xs">
                    {d.openComments > 0 && <Badge tone="magenta">{d.openComments} open comments</Badge>}
                    {d.pendingComments > 0 && <Badge tone="amber">{d.pendingComments} pending check</Badge>}
                  </div>
                )}
              </Link>
            ))}
          </div>

          <h2 className="mt-6 mb-3 text-sm font-semibold">Testing</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(['SQA', 'UAT'] as const).map((stage) => {
              const t = data.testing[stage]
              return (
                <Link key={stage} to={`/projects/${pid}/testing/${stage}`} className="rounded-lg bg-white p-4 ring-1 ring-line hover:ring-brand">
                  <div className="mb-2 flex items-center gap-2 font-medium">{stage} <Badge tone={t.status === 'Signed off' ? 'green' : t.status === 'Not started' ? 'gray' : 'blue'}>{t.status}</Badge></div>
                  {t.tests ? (
                    <>
                      <div className="mb-1 h-2 overflow-hidden rounded bg-canvas">
                        <div className="h-full bg-leaf" style={{ width: `${(t.passed / t.tests) * 100}%` }} />
                      </div>
                      <div className="text-xs text-muted">
                        {t.passed} of {t.tests} test cases passing · {t.run} run · {t.defectsOpen} unresolved defects
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-muted">Not started. {stage === 'SQA' ? 'Starts after the SRS is signed.' : 'Starts after SQA is signed off.'}</div>
                  )}
                </Link>
              )
            })}
          </div>
        </div>

        <div className="space-y-4">
          <Card title="Open items">
            <ul className="space-y-1.5 text-sm">
              {data.openItems.map((o) => (
                <li key={o.label} className="flex items-center justify-between">
                  <Link to={o.link} className={o.count ? 'hover:text-brand' : 'text-muted'}>
                    {o.label}
                  </Link>
                  <Badge tone={o.count ? 'magenta' : 'gray'}>{o.count}</Badge>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Team" actions={<Link to={`/projects/${pid}/team`} className="text-xs font-medium text-brand">All members</Link>}>
            <div className="space-y-3">
              {(['PM', 'TECH', 'STAKEHOLDER', 'SPONSOR'] as const).map((team) => (
                <div key={team}>
                  <div className="mb-1 text-[11px] font-semibold text-muted uppercase">{TEAM_LABEL[team]}</div>
                  {data.members
                    .filter((m) => m.member.team === team && (m.member.isHead || m.member.isDeputy))
                    .map((m) => (
                      <div key={m.member.userId} className="flex items-center gap-2 py-0.5 text-sm">
                        <Avatar name={m.name} id={m.member.userId} size={22} />
                        <span className="flex-1 truncate">{m.name}</span>
                        {m.member.isHead && <Crown className="h-3.5 w-3.5 text-brand" />}
                        {m.member.isDeputy && <span className="text-[11px] text-muted">deputy</span>}
                        {m.away && (
                          <Badge tone="amber">
                            <Plane className="h-3 w-3" /> Away until {fmtDate(m.awayUntil)}
                          </Badge>
                        )}
                      </div>
                    ))}
                  <div className="text-[11px] text-muted">{data.members.filter((m) => m.member.team === team).length} members</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
