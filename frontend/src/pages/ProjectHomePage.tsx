/**
 * Project overview: the next step first, then documents and testing as a simple list, then only
 * the items that need attention. SPEC.md "Dashboard" (per project). Layout idea from Linear's
 * project page.
 */
import { Archive, ArrowRight, FileText, FlaskConical, MessageSquare, MoreHorizontal, SendHorizontal } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { clsx } from 'clsx'
import { api } from '../api'
import { useAction, useApi, useNow } from '../api/hooks'
import { DiscussButton, useChat } from '../components/chat/ChatThread'
import { openChat } from '../components/chat/dock'
import { DOC_LABEL, STAGES, STAGE_LABEL } from '../rules/pipeline'
import { TEAM_LABEL } from '../rules/permissions'
import { DocStatusChip } from '../components/status'
import { ago, duration, fmtDate, shortAgo } from '../components/format'
import { Avatar, AvatarStack, Dot, ErrorBox, LinkButton, Loading, MenuButton, Note, ProjectIcon } from '../components/ui'

/** The latest project chat messages with a quick reply box, so the conversation is visible on the overview. */
function Discussion({ pid }: { pid: string }) {
  const chatId = `${pid}-chat`
  const now = useNow()
  const navigate = useNavigate()
  const { data } = useChat(chatId)
  const [text, setText] = useState('')
  const post = useAction(api.chat.postMessage, { onDone: () => setText('') })
  if (!data) return null
  const latest = data.messages.filter((m) => m.kind === 'text').slice(-3)
  return (
    <section className="shadow-soft rounded-2xl border border-line/70 bg-surface">
      <div className="flex items-center justify-between px-4 pt-3.5 pb-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          Team discussion
          {!!data.unread && <span className="rounded-full bg-brand px-1.5 text-[10px] leading-4 font-semibold text-white">{data.unread} new</span>}
        </h2>
        <button className="text-xs font-medium text-brand hover:underline" onClick={() => openChat(chatId, navigate)}>
          Open chat
        </button>
      </div>
      <ul className="px-2">
        {latest.map((m) => (
          <li key={m.id}>
            <button onClick={() => openChat(chatId, navigate)} className="flex w-full gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-ink/[0.04]">
              <Avatar name={m.authorName} id={m.authorId ?? ''} size={26} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-1.5 text-xs">
                  <b className="font-semibold">{m.authorName}</b>
                  <span className="text-muted">{shortAgo(m.createdAt, now)}</span>
                </span>
                <span className="line-clamp-2 text-[13px] text-ink/85">{m.body}</span>
              </span>
            </button>
          </li>
        ))}
        {!latest.length && <li className="px-2 py-3 text-sm text-muted">No messages yet. Say hello to the team.</li>}
      </ul>
      {data.canPost && (
        <form
          className="m-3 mt-1 flex items-center gap-1 rounded-xl bg-canvas py-1 pr-1 pl-3 ring-1 ring-line focus-within:ring-2 focus-within:ring-brand/60"
          onSubmit={(e) => {
            e.preventDefault()
            if (text.trim()) post.run(chatId, text)
          }}
        >
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write to the team…" className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-muted/70" />
          <button type="submit" disabled={!text.trim()} className={clsx('flex h-7 w-7 items-center justify-center rounded-lg', text.trim() ? 'bg-brand text-white' : 'text-muted/60')} title="Send">
            <SendHorizontal className="h-4 w-4" />
          </button>
        </form>
      )}
    </section>
  )
}

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
  const { data: chat } = useChat(`${pid}-chat`)
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
  const chatUnread = chat?.unread ?? 0

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <ProjectIcon id={p.id} name={p.name} size={48} />
          <div className="min-w-0">
            <h1 className="page-title text-2xl">{p.name}</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted">{p.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
              <AvatarStack people={heads.map((m) => ({ id: m.member.userId, name: m.name }))} size={24} max={6} />
              <span>
                {summary.myRole} · Owner {data.ownerName} · started {fmtDate(p.createdAt)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DiscussButton onClick={() => openChat(`${pid}-chat`, navigate)} unread={chatUnread} />
          <MenuButton
            label={<MoreHorizontal className="h-4 w-4" />}
            items={[
              { label: 'Team and roles', onClick: () => navigate(`/projects/${pid}/team`) },
              { label: 'Audit log', onClick: () => navigate(`/projects/${pid}/audit`) },
              { label: 'Open in Messages', onClick: () => navigate(`/messages/${pid}-chat`) },
            ]}
          />
        </div>
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
              <div className={clsx('h-1.5 rounded-full', summary.stage === 'COMPLETE' || i < at ? 'bg-leaf' : i === at ? 'bg-brand' : 'bg-ink/10')} />
              <div className={clsx('mt-1.5 truncate text-[11px]', i === at && summary.stage !== 'COMPLETE' ? 'font-semibold text-ink' : 'text-muted')}>{STAGE_LABEL[s]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Next step */}
      <Link to={next.link} className={clsx('flex flex-wrap items-center gap-4 rounded-2xl border px-5 py-4 transition hover:-translate-y-0.5 hover:shadow-md', NEXT_STYLE[next.tone])}>
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

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-8">
          <section>
            <h2 className="mb-2 text-sm font-semibold">Documents</h2>
            <ul className="shadow-soft divide-y divide-line/70 overflow-hidden rounded-2xl border border-line/70 bg-surface">
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
          <Discussion pid={pid} />
          <section>
            <h2 className="mb-2 text-sm font-semibold">Needs attention</h2>
            {attention.length ? (
              <ul className="space-y-1">
                {attention.map((o) => (
                  <li key={o.label}>
                    <Link to={o.link} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-ink/[0.04]">
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
