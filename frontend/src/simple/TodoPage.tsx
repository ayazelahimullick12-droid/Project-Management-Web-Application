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

function TaskCard({ item, first }: { item: TodoItem; first: boolean }) {
  const now = useNow()
  return (
    <Link to={item.to} className={clsx('group flex flex-wrap items-center gap-4 rounded-2xl bg-surface p-5 ring-1 transition hover:ring-brand/50', first ? 'ring-2 ring-brand/40' : 'ring-line')}>
      <ProjectIcon id={item.projectId} name={item.projectName} size={44} />
      <div className="min-w-0 flex-1">
        <div className="text-lg font-semibold">{item.title}</div>
        <div className="mt-0.5 text-base text-muted">
          {item.projectName}
          {item.since && ` · waiting ${waited(item.since, now)}`}
          {item.coveringFor && ` · for ${item.coveringFor} (away)`}
        </div>
      </div>
      <span className={clsx('inline-flex h-11 items-center rounded-lg px-5 text-base font-medium transition', first ? 'bg-brand text-white shadow-sm group-hover:brightness-110' : 'bg-surface ring-1 ring-line group-hover:bg-canvas')}>{item.button}</span>
    </Link>
  )
}

export function TodoPage() {
  const now = useNow()
  const uid = useSessionUserId()
  const navigate = useNavigate()
  const [all, setAll] = useState(false)
  const { items, dash, isLoading } = useTodo()
  const { data: me } = useApi(['whoami', uid], api.projects.whoami)
  const { data: chats } = useApi(['conversations', uid], api.chat.conversations, !!uid)
  const { data: notes } = useApi(['notifications', uid], api.notifications.myNotifications, !!uid)
  const markRead = useAction(api.notifications.markRead)
  if (isLoading || !dash) return <Loading />
  const shown = all ? items : items.slice(0, 5)
  const unreadNotes = (notes ?? []).filter((n) => !n.readAt).length

  return (
    <SimplePage
      title={`${greeting(now)}, ${me?.name.split(' ')[0] ?? ''}`}
      subtitle={items.length ? `You have ${items.length} thing${items.length > 1 ? 's' : ''} to do.` : undefined}
    >
      {items.length ? (
        <div className="space-y-3">
          {shown.map((it, i) => (
            <TaskCard key={it.key} item={it} first={i === 0} />
          ))}
          {items.length > 5 && (
            <button className="w-full rounded-2xl py-3 text-base font-medium text-brand hover:bg-brand-soft/40" onClick={() => setAll(!all)}>
              {all ? 'Show fewer' : `Show ${items.length - 5} more`}
            </button>
          )}
        </div>
      ) : (
        <Empty icon={<CircleCheck />} title="Nothing to do right now">
          We will send you an email when something needs you.
        </Empty>
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
