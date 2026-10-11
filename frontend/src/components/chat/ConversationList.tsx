/**
 * The list of conversations, shared by the chat dock and the Messages page.
 * Like Slack and Messenger: a search box, All / Channels / Direct filters, the current project's
 * channels first, other channels grouped by project, then direct messages. Unread ones are bold.
 */
import { ArrowLeft, FileText, Hash, Phone, Search } from 'lucide-react'
import { useState } from 'react'
import { clsx } from 'clsx'
import { api } from '../../api'
import type { Conversation } from '../../api/chat'
import { useAction, useApi, useNow, useSessionUserId } from '../../api/hooks'
import { shortAgo } from '../format'
import { Avatar, colorFor } from '../ui'

type Lists = { channels: Conversation[]; direct: Conversation[]; unread: number }

export function ChannelIcon({ c, size = 36 }: { c: { kind: string; projectId: string | null }; size?: number }) {
  const color = colorFor(c.projectId ?? 'x')
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-xl" style={{ width: size, height: size, background: `${color}1f`, color }}>
      {c.kind === 'document' ? <FileText style={{ width: size * 0.45, height: size * 0.45 }} /> : <Hash style={{ width: size * 0.45, height: size * 0.45 }} />}
    </span>
  )
}

function Row({ c, active, onOpen }: { c: Conversation; active?: boolean; onOpen: (id: string) => void }) {
  const now = useNow()
  const direct = c.kind === 'direct' || c.kind === 'rag_dm'
  const preview = c.last ? `${c.last.mine ? 'You: ' : direct || !c.last.authorName ? '' : `${c.last.authorName.split(' ')[0]}: `}${c.last.body}` : 'No messages yet'
  return (
    <button onClick={() => onOpen(c.id)} className={clsx('flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition', active ? 'bg-brand-soft' : 'hover:bg-ink/[0.04]')}>
      {direct ? <Avatar name={c.title} id={c.otherUserId} size={36} status={c.unavailable ? 'off' : c.away ? 'away' : undefined} /> : <ChannelIcon c={c} />}
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={clsx('min-w-0 flex-1 truncate text-sm', c.unread ? 'font-semibold' : 'font-medium')}>
            {c.title}
            {c.kind === 'rag_dm' && <span className="ml-1 text-[11px] font-normal text-muted">· past project</span>}
          </span>
          <span className={clsx('shrink-0 text-[11px]', c.unread ? 'font-medium text-brand' : 'text-muted')}>{shortAgo(c.last?.createdAt, now)}</span>
        </span>
        <span className="flex items-center gap-2">
          {c.callActive ? (
            <span className="flex min-w-0 flex-1 items-center gap-1 truncate text-xs font-medium text-leaf">
              <Phone className="h-3 w-3" /> Call in progress
            </span>
          ) : (
            <span className={clsx('min-w-0 flex-1 truncate text-xs', c.unread ? 'text-ink' : 'text-muted')}>{preview}</span>
          )}
          {c.unread > 0 && <span className="min-w-5 shrink-0 rounded-full bg-brand px-1.5 text-center text-[10px] leading-5 font-semibold text-white">{c.unread}</span>}
        </span>
      </span>
    </button>
  )
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 mb-1 flex items-center gap-2 px-2.5 text-[11px] font-semibold tracking-wide text-muted uppercase first:mt-1">{children}</div>
}

export function ConversationList({ lists, activeId, onOpen, currentPid }: { lists?: Lists; activeId?: string; onOpen: (id: string) => void; currentPid?: string }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'channels' | 'direct'>('all')
  if (!lists) return <div className="p-4 text-sm text-muted">Loading…</div>
  const match = (c: Conversation) => !q || `${c.title} ${c.projectName ?? ''} ${c.subtitle}`.toLowerCase().includes(q.toLowerCase())
  // Document chats with no messages yet are left out until searched for (each document has a Discuss button).
  const channels = filter === 'direct' ? [] : lists.channels.filter((c) => match(c) && (c.kind !== 'document' || c.last || q))
  const direct = filter === 'channels' ? [] : lists.direct.filter(match)
  const here = channels.filter((c) => c.projectId === currentPid)
  const byProject = new Map<string, Conversation[]>()
  for (const c of channels.filter((x) => x.projectId !== currentPid)) byProject.set(c.projectName ?? '', [...(byProject.get(c.projectName ?? '') ?? []), c])
  const unread = (xs: Conversation[]) => xs.reduce((n, c) => n + c.unread, 0)
  const tabs = [
    { id: 'all', label: 'All', n: lists.unread },
    { id: 'channels', label: 'Channels', n: unread(lists.channels) },
    { id: 'direct', label: 'Direct', n: unread(lists.direct) },
  ] as const

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 px-3 pt-3 pb-2">
        <label className="flex items-center gap-2 rounded-lg bg-ink/[0.05] px-2.5 py-1.5 text-sm">
          <Search className="h-4 w-4 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search conversations" className="w-full bg-transparent outline-none placeholder:text-muted/80" />
        </label>
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setFilter(t.id)} className={clsx('inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition', filter === t.id ? 'bg-ink text-canvas' : 'text-muted hover:bg-ink/5 hover:text-ink')}>
              {t.label}
              {t.n > 0 && <span className={clsx('rounded-full px-1 text-[10px]', filter === t.id ? 'bg-canvas/20' : 'bg-brand text-white')}>{t.n}</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
        {here.length > 0 && (
          <>
            <GroupLabel>This project</GroupLabel>
            {here.map((c) => <Row key={c.id} c={c} active={c.id === activeId} onOpen={onOpen} />)}
          </>
        )}
        {[...byProject.entries()].map(([name, cs]) => (
          <div key={name}>
            <GroupLabel>
              <span className="truncate normal-case">{name}</span>
            </GroupLabel>
            {cs.map((c) => <Row key={c.id} c={c} active={c.id === activeId} onOpen={onOpen} />)}
          </div>
        ))}
        {direct.length > 0 && (
          <>
            <GroupLabel>Direct messages</GroupLabel>
            {direct.map((c) => <Row key={c.id} c={c} active={c.id === activeId} onOpen={onOpen} />)}
          </>
        )}
        {!here.length && !byProject.size && !direct.length && <div className="px-3 py-8 text-center text-sm text-muted">{q ? 'No conversations match.' : 'No conversations yet.'}</div>}
      </div>
    </div>
  )
}

/** "New message": pick a person to message directly. */
export function NewMessage({ onOpen, onBack }: { onOpen: (id: string) => void; onBack: () => void }) {
  const uid = useSessionUserId()
  const { data: users } = useApi(['users'], api.projects.users)
  const [q, setQ] = useState('')
  const start = useAction(api.chat.startDirect, { onDone: (id) => onOpen(id) })
  const people = (users ?? []).filter((u) => !u.deactivated && u.id !== uid && `${u.name} ${u.title}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <button onClick={onBack} className="rounded-md p-1 text-muted hover:bg-ink/5 hover:text-ink" title="Back">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <label className="flex flex-1 items-center gap-2 rounded-lg bg-ink/[0.05] px-2.5 py-1.5 text-sm">
          <span className="text-muted">To:</span>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a name" className="w-full bg-transparent outline-none placeholder:text-muted/80" />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
        <GroupLabel>People</GroupLabel>
        {people.map((u) => (
          <button key={u.id} onClick={() => start.run(u.id)} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-ink/[0.04]">
            <Avatar name={u.name} id={u.id} size={32} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{u.name}</span>
              <span className="block truncate text-xs text-muted">{u.title}</span>
            </span>
          </button>
        ))}
        {!people.length && <div className="px-3 py-6 text-center text-sm text-muted">Nobody matches.</div>}
      </div>
    </div>
  )
}
