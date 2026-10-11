/**
 * The chat dock, always on screen (like LinkedIn messaging and Facebook Messenger on the web):
 * a "Messages" bar at the bottom right with the unread count. Click it to see your conversations;
 * click a conversation to open it in a small window next to the bar, so you can keep chatting
 * while you work on a document. Up to two windows; each can be minimised, expanded to the full
 * Messages page, or closed. On phones it is a round button that opens the Messages page.
 */
import { ChevronDown, Maximize2, MessageCircle, Minus, SquarePen, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation, useMatch, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { api } from '../../api'
import { useApi, useSessionUserId } from '../../api/hooks'
import { Avatar } from '../ui'
import { CallButtons, ChatThread, isDirect, useChat } from './ChatThread'
import { ChannelIcon, ConversationList, NewMessage } from './ConversationList'
import { closeChat, openChat, setDockOpen, toggleMinimized, useDock } from './dock'

function DockWindow({ chatId, minimized }: { chatId: string; minimized: boolean }) {
  const navigate = useNavigate()
  const { data, error } = useChat(chatId)
  useEffect(() => {
    if (error) closeChat(chatId) // e.g. another user signed in who is not in this chat
  }, [error, chatId])
  if (error) return null
  const direct = data ? isDirect(data.chat.kind) : false
  const away = direct && data?.members.find((m) => m.id === data.other?.id)?.away
  return (
    <div className={clsx('pointer-events-auto flex w-[340px] flex-col overflow-hidden rounded-t-2xl bg-surface shadow-2xl ring-1 ring-line', !minimized && 'h-[min(480px,calc(100vh-6rem))]')}>
      <div className={clsx('flex h-12 shrink-0 cursor-pointer items-center gap-2.5 px-2.5', !minimized && 'border-b border-line')} onClick={() => toggleMinimized(chatId)}>
        {data && (direct && data.other ? <Avatar name={data.other.name} id={data.other.id} size={30} status={data.other.unavailable ? 'off' : away ? 'away' : undefined} /> : <ChannelIcon c={{ kind: data.chat.kind, projectId: data.chat.projectId }} size={30} />)}
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-sm font-semibold">{data?.chat.title ?? 'Loading…'}</div>
          <div className="truncate text-[11px] text-muted">{data ? (direct ? (away ? 'Away' : data.other?.title) : data.project?.name) : ''}</div>
        </div>
        {minimized && !!data?.unread && <span className="rounded-full bg-brand px-1.5 text-[10px] leading-5 font-semibold text-white">{data.unread}</span>}
        <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
          {data && !minimized && <CallButtons chatId={chatId} data={data} compact />}
          <button className="rounded-md p-1.5 text-muted hover:bg-ink/5 hover:text-ink" title="Open in Messages" onClick={() => { closeChat(chatId); navigate(`/messages/${chatId}`) }}>
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button className="rounded-md p-1.5 text-muted hover:bg-ink/5 hover:text-ink" title={minimized ? 'Open' : 'Minimise'} onClick={() => toggleMinimized(chatId)}>
            <Minus className="h-4 w-4" />
          </button>
          <button className="rounded-md p-1.5 text-muted hover:bg-ink/5 hover:text-ink" title="Close" onClick={() => closeChat(chatId)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      {!minimized && data && <ChatThread chatId={chatId} data={data} compact />}
    </div>
  )
}

export function ChatDock() {
  const uid = useSessionUserId()
  const dock = useDock()
  const navigate = useNavigate()
  const location = useLocation()
  const pid = useMatch('/projects/:pid/*')?.params.pid
  const { data: me } = useApi(['whoami', uid], api.projects.whoami)
  const { data: lists } = useApi(['conversations', uid], api.chat.conversations, !!uid)
  const [composing, setComposing] = useState(false)
  if (!uid || location.pathname.startsWith('/messages')) return null
  const open = (id: string) => {
    setComposing(false)
    openChat(id, navigate)
  }
  const unread = lists?.unread ?? 0

  return (
    <>
      {/* Phones: a round button that opens the Messages page */}
      <button onClick={() => navigate('/messages')} className="fixed right-4 bottom-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white shadow-lg md:hidden no-print" aria-label="Messages">
        <MessageCircle className="h-5 w-5" />
        {unread > 0 && <span className="absolute -top-1 -right-1 min-w-5 rounded-full bg-ink px-1 text-center text-[10px] leading-5 font-semibold text-canvas">{unread}</span>}
      </button>

      <div className="pointer-events-none fixed right-4 bottom-0 z-40 hidden flex-row-reverse items-end gap-3 md:flex no-print">
        <div className="pointer-events-auto w-80 overflow-hidden rounded-t-2xl bg-surface shadow-2xl ring-1 ring-line">
          <div className="flex h-12 cursor-pointer items-center gap-2.5 px-3" onClick={() => setDockOpen(!dock.open)}>
            {me && <Avatar name={me.name} id={me.id} size={28} status="online" />}
            <span className="flex-1 text-sm font-semibold">Messages</span>
            {unread > 0 && <span className="min-w-5 rounded-full bg-brand px-1.5 text-center text-[10px] leading-5 font-semibold text-white">{unread}</span>}
            <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
              <button className="rounded-md p-1.5 text-muted hover:bg-ink/5 hover:text-ink" title="New message" onClick={() => { setComposing(true); setDockOpen(true) }}>
                <SquarePen className="h-4 w-4" />
              </button>
              <button className="rounded-md p-1.5 text-muted hover:bg-ink/5 hover:text-ink" title="Open the Messages page" onClick={() => navigate('/messages')}>
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
              <button className="rounded-md p-1.5 text-muted hover:bg-ink/5 hover:text-ink" title={dock.open ? 'Collapse' : 'Expand'} onClick={() => setDockOpen(!dock.open)}>
                <ChevronDown className={clsx('h-4 w-4 transition', !dock.open && 'rotate-180')} />
              </button>
            </div>
          </div>
          {dock.open && (
            <div className="flex h-[min(520px,calc(100vh-8rem))] flex-col border-t border-line">
              {composing ? <NewMessage onOpen={open} onBack={() => setComposing(false)} /> : <ConversationList lists={lists} onOpen={open} currentPid={pid} activeId={dock.windows[0]} />}
            </div>
          )}
        </div>
        {dock.windows.map((id) => (
          <DockWindow key={id} chatId={id} minimized={dock.minimized.includes(id)} />
        ))}
      </div>
    </>
  )
}
