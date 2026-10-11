/**
 * Project overview: the next step first, then documents and testing as a simple list, then only
 * the items that need attention. SPEC.md "Dashboard" (per project). Layout idea from Linear's
 * project page.
 */
import { Archive, ArrowRight, FileText, FlaskConical, MessageSquare, MoreHorizontal } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { clsx } from 'clsx'
import { api } from '../api'
import { useApi, useNow } from '../api/hooks'
import { DOC_LABEL, STAGES, STAGE_LABEL } from '../rules/pipeline'
import { TEAM_LABEL } from '../rules/permissions'
import { DocStatusChip } from '../components/status'
import { ago, duration, fmtDate } from '../components/format'
import { Avatar, Dot, ErrorBox, LinkButton, Loading, MenuButton, Note } from '../components/ui'

const NEXT_STYLE = {
  action: 'border-brand/30 bg-brand-soft/40',
  waiting: 'border-sky-200 bg-sky-50/60',
  done: 'border-green-200 bg-leaf-soft/50',
  problem: 'border-red-200 bg-red-50/60',
} as const

export function ProjectHomePage() {
  const { pid = '' } = useParams()
  const now = useNow()
  const navigate = useNavigate()
  const { data, isLoading, error } = useApi(['project', pid], () => api.projects.getProject(pid))
  if (isLoading) return <Loading />
  if (error || !data) return <ErrorBox error={error} />
  const { summary, me } = data
  const p = summary.project
  const next = summary.next
  const at = STAGES.indexOf(summary.stage)
  const docLink = (type: string) => (type === 'SQA_SIGNOFF' ? `/projects/${pid}/testing/SQA?tab=signoff` : type === 'UAT_SIGNOFF' ? `/projects/${pid}/testing/UAT?tab=signoff` : `/projects/${pid}/docs/${type}`)
  const nameOf = (id?: string) => data.members.find((m) => m.member.userId === id)?.name ?? '—'
  const attention = data.openItems.filter((o) => o.count > 0)
  const heads = data.members.filter((m) => m.member.isHead)

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="page-title text-[24px]">{p.name}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">{p.description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
            <span>
              {summary.myRole} · Owner {data.ownerName} · started {fmtDate(p.createdAt)}
            </span>
            <span className="flex -space-x-1.5">
              {heads.map((m) => (
                <span key={m.member.userId} className="rounded-full ring-2 ring-white" title={`${m.name} — ${m.role}`}>
                  <Avatar name={m.name} id={m.member.userId} size={24} />
                </span>
              ))}
            </span>
          </div>
        </div>
        <MenuButton
          label={<MoreHorizontal className="h-4 w-4" />}
          items={[
            { label: 'Team and roles', onClick: () => navigate(`/projects/${pid}/team`) },
            { label: 'Audit log', onClick: () => navigate(`/projects/${pid}/audit`) },
            { label: 'Project chat', onClick: () => navigate(`/projects/${pid}/chat`) },
          ]}
        />
      </div>

      {p.status === 'archived' && (
        <Note tone="gray" icon={<Archive className="h-4 w-4" />}>
          Archived on {fmtDate(p.archivedAt)}. The project is read-only.
        </Note>
      )}

      {/* Stage */}
      <div>
        <div className="flex gap-1">
          {STAGES.map((s, i) => (
            <div key={s} className="flex-1">
              <div className={clsx('h-1.5 rounded-full', summary.stage === 'COMPLETE' || i < at ? 'bg-leaf' : i === at ? 'bg-brand' : 'bg-black/10')} />
              <div className={clsx('mt-1.5 truncate text-[11px]', i === at && summary.stage !== 'COMPLETE' ? 'font-semibold text-ink' : 'text-muted')}>{STAGE_LABEL[s]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Next step */}
      <Link to={next.link} className={clsx('flex flex-wrap items-center gap-4 rounded-xl border px-5 py-4 transition hover:shadow-sm', NEXT_STYLE[next.tone])}>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold tracking-wide text-muted uppercase">{next.tone === 'done' ? 'Status' : 'Next step'}</div>
          <div className="mt-0.5 text-base font-semibold">{next.title}</div>
          <div className="mt-0.5 text-sm text-muted">
            {next.waitingOnName ? (
              <>
                Waiting on <b className="font-medium text-ink">{next.waitingOnName}</b>
                {next.coveringName && <> (Away; {next.coveringName} is covering)</>}
                {next.since && <> for {duration(now.getTime() - new Date(next.since).getTime())}</>}
                {' '}· reminded every 4 working hours
              </>
            ) : (
              next.detail
            )}
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-medium text-brand">
          {next.action ?? 'Open'} <ArrowRight className="h-4 w-4" />
        </span>
      </Link>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-8">
          <section>
            <h2 className="mb-2 text-sm font-semibold">Documents</h2>
            <ul className="divide-y divide-line/70 overflow-hidden rounded-xl border border-line/80 bg-white">
              {summary.docs.map((d) => {
                const signoff = d.type.endsWith('SIGNOFF')
                const testing = signoff ? data.testing[d.type === 'SQA_SIGNOFF' ? 'SQA' : 'UAT'] : undefined
                return (
                  <li key={d.type}>
                    <Link to={docLink(d.type)} className="grid items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-canvas sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)_auto]">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        {signoff ? <FlaskConical className="h-4 w-4 text-muted" /> : <FileText className="h-4 w-4 text-muted" />}
                        {DOC_LABEL[d.type]}
                        {d.versionNumber && <span className="text-xs font-normal text-muted">v{d.versionNumber}</span>}
                      </span>
                      <span className="min-w-0 truncate text-xs text-muted">
                        {d.status.key === 'not_started' && testing && testing.status !== 'Not started' ? (
                          <Dot tone="blue">{testing.status}</Dot>
                        ) : (
                          <DocStatusChip status={d.status} />
                        )}
                        {d.status.waitingOn && <span className="ml-2">{nameOf(d.status.waitingOn)} · {ago(d.status.since, now)}</span>}
                        {testing && testing.tests > 0 && <span className="ml-2">{testing.passed}/{testing.tests} passing · {testing.defectsOpen} open defects</span>}
                      </span>
                      <span className="flex items-center gap-3 text-xs text-muted">
                        {d.openComments + d.pendingComments > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <MessageSquare className="h-3.5 w-3.5" /> {d.openComments + d.pendingComments}
                          </span>
                        )}
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>

        <aside className="space-y-8">
          <section>
            <h2 className="mb-2 text-sm font-semibold">Needs attention</h2>
            {attention.length ? (
              <ul className="space-y-1">
                {attention.map((o) => (
                  <li key={o.label}>
                    <Link to={o.link} className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-black/[0.04]">
                      {o.label}
                      <span className="rounded-full bg-brand px-1.5 text-[11px] font-semibold text-white">{o.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Nothing open.</p>
            )}
          </section>
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Team</h2>
              <Link to={`/projects/${pid}/team`} className="text-xs font-medium text-brand">
                {me.canManageTeam ? 'Manage' : 'All members'}
              </Link>
            </div>
            <ul className="space-y-2">
              {(['PM', 'TECH', 'STAKEHOLDER', 'SPONSOR'] as const).map((team) => {
                const head = data.members.find((m) => m.member.team === team && m.member.isHead)
                const n = data.members.filter((m) => m.member.team === team).length
                return (
                  <li key={team} className="flex items-center gap-2 text-sm">
                    {head && <Avatar name={head.name} id={head.member.userId} size={24} />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{head?.name ?? '—'}</span>
                      <span className="block text-[11px] text-muted">
                        {TEAM_LABEL[team]} head · {n} member{n === 1 ? '' : 's'}
                        {head?.away && ' · Away'}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
          {me.isOwner && summary.stage === 'COMPLETE' && p.status === 'active' && !p.finished && (
            <LinkButton to={`/projects/${pid}/team`} variant="secondary" size="sm">
              <Archive className="h-3.5 w-3.5" /> Archive project
            </LinkButton>
          )}
        </aside>
      </div>
    </div>
  )
}
