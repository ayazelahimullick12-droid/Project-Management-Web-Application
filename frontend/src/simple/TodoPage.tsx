/**
 * Simple view · Home ("To do"): only what this person has to do, oldest first, one button each.
 * Numbers, charts and the portfolio are on the Reports page (Owner and Admin).
 */
import { BarChart3, Bell, CircleCheck, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { api } from '../api'
import { useAction, useApi, useNow, useSessionUserId } from '../api/hooks'
import { ago } from '../components/format'
import { Loading, ProjectIcon } from '../components/ui'
import { Empty, More, Row, Rows, SimplePage } from './parts'
import { useTodo, type TodoItem } from './todo'
import { waited } from './words'

function greeting(now: Date) {
  const h = Number(now.toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Dhaka' }))
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

/** How long something has waited, as a coloured label: grey under a day, amber up to 3 days, red after. */
function WaitLabel({ since, now }: { since?: string; now: Date }) {
  if (!since) return <span className="text-sm text-muted">—</span>
  const days = (now.getTime() - new Date(since).getTime()) / 86_400_000
  const tone = days > 3 ? 'bg-red-50 text-red-700 ring-red-200' : days >= 1 ? 'bg-amber-50 text-amber-800 ring-amber-200' : 'bg-ink/[0.04] text-muted ring-line'
  return <span className={clsx('inline-flex items-center rounded-md px-2 py-0.5 text-sm font-medium whitespace-nowrap ring-1', tone)}>{waited(since, now)}</span>
}

/** Column layout of the work queue (the header and every row use it, so they line up). */
const QUEUE_COLS = 'md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,15rem)_7rem_9.5rem] md:items-center md:gap-4'

/** The work queue: one row per task, with its project, how long it has waited and the button. */
function TaskQueue({ items, now }: { items: TodoItem[]; now: Date }) {
  return (
    <div className="shadow-soft overflow-hidden rounded-2xl">
      <div className={clsx('hidden border-b border-line px-5 py-2.5 text-xs font-semibold text-muted', QUEUE_COLS)}>
        <span>Task</span>
        <span>Project</span>
        <span>Waiting</span>
        <span className="sr-only">Action</span>
      </div>
      <ul className="divide-y divide-line">
        {items.map((it, i) => (
          <li key={it.key}>
            <Link to={it.to} className={clsx('group flex flex-col gap-2 px-5 py-4 transition hover:bg-ink/[0.025] dark:hover:bg-white/[0.03]', QUEUE_COLS)}>
              <span className="min-w-0">
                <span className="block text-lg leading-snug font-medium">{it.title}</span>
                {it.coveringFor && <span className="mt-0.5 block text-sm text-muted">For {it.coveringFor}, who is away</span>}
              </span>
              <span className="flex min-w-0 items-center gap-2 text-base leading-snug text-muted">
                <ProjectIcon id={it.projectId} name={it.projectName} size={24} />
                <span className="min-w-0">{it.projectName}</span>
              </span>
              <span className="flex items-center gap-2 md:block">
                <span className="text-sm text-muted md:hidden">Waiting</span>
                <WaitLabel since={it.since} now={now} />
              </span>
              <span className="md:text-right">
                <span className={clsx('inline-flex h-10 items-center justify-center rounded-full px-5 text-base font-medium transition', i === 0 ? 'glass-tint text-white group-hover:brightness-110' : 'glass-control group-hover:brightness-[0.98]')}>{it.button}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function TodoPage() {
  const now = useNow()
  const uid = useSessionUserId()
  const navigate = useNavigate()
  const [all, setAll] = useState(false)
  const { items, ownerItems, dash, isLoading } = useTodo()
  const { data: me } = useApi(['whoami', uid], api.projects.whoami)
  const { data: chats } = useApi(['conversations', uid], api.chat.conversations, !!uid)
  const { data: notes } = useApi(['notifications', uid], api.notifications.myNotifications, !!uid)
  const markRead = useAction(api.notifications.markRead)
  if (isLoading || !dash) return <Loading />
  const shown = all ? items : items.slice(0, 5)
  const unreadNotes = (notes ?? []).filter((n) => !n.readAt).length

  return (
    <SimplePage
      wide
      eyebrow={now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Dhaka' })}
      title={`${greeting(now)}, ${me?.name.split(' ')[0] ?? ''}`}
      subtitle={items.length ? `You have ${items.length} thing${items.length > 1 ? 's' : ''} to do.` : undefined}
    >
      {items.length ? (
        <div className="space-y-3">
          <TaskQueue items={shown} now={now} />
          {items.length > 5 && (
            <button className="w-full rounded-xl py-3 text-base font-medium text-brand hover:bg-ink/[0.04]" onClick={() => setAll(!all)}>
              {all ? 'Show fewer' : `Show ${items.length - 5} more`}
            </button>
          )}
        </div>
      ) : (
        <Empty icon={<CircleCheck />} title="Nothing to do right now">
          We will send you an email when something needs you.
        </Empty>
      )}

      {ownerItems.length > 0 && (
        <More label={`You can also do, as Project Owner (${ownerItems.length})`}>
          <p className="mb-3 text-base text-muted">Waiting for other people in your projects. As the Project Owner you can do any of it yourself.</p>
          <Rows>
            {ownerItems.map((it) => (
              <Row key={it.key} to={it.to} icon={<ProjectIcon id={it.projectId} name={it.projectName} size={36} />} title={it.title} subtitle={[it.projectName, it.whose, `waiting ${waited(it.since, now)}`].filter(Boolean).join(' · ')} right="Open" />
            ))}
          </Rows>
        </More>
      )}

      {(!!chats?.unread || dash.portfolio) && (
        <Rows>
          {!!chats?.unread && <Row to="/messages" icon={<MessageCircle className="h-6 w-6 text-brand" />} title={`${chats.unread} unread message${chats.unread > 1 ? 's' : ''}`} subtitle="From your project teams" right="Read" />}
          {dash.portfolio && <Row to="/reports" icon={<BarChart3 className="h-6 w-6 text-muted" />} title="Reports" subtitle="All projects at a glance: progress, delays and recent activity" />}
        </Rows>
      )}

      <More label={`Recent updates${unreadNotes ? ` (${unreadNotes} new)` : ''}`}>
        <div className="divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
          {(notes ?? []).slice(0, 6).map((n) => (
            <button
              key={n.id}
              className="flex w-full items-start gap-3 px-5 py-3.5 text-left hover:bg-canvas"
              onClick={() => {
                markRead.run(n.id)
                navigate(n.link)
              }}
            >
              <Bell className={clsx('mt-1 h-4 w-4 shrink-0', n.readAt ? 'text-muted' : 'text-brand')} />
              <span className="min-w-0 flex-1">
                <span className={clsx('block text-base', !n.readAt && 'font-semibold')}>{n.title}</span>
                <span className="block text-sm text-muted">{ago(n.createdAt, now)}</span>
              </span>
            </button>
          ))}
          {!notes?.length && <div className="px-5 py-4 text-base text-muted">No updates yet.</div>}
        </div>
        <Link to="/notifications" className="mt-3 inline-block text-base font-medium text-brand hover:underline">
          See all updates
        </Link>
      </More>
    </SimplePage>
  )
}
