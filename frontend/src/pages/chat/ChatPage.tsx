/**
 * The full Messages page, in three panes like Slack and Messenger on the web:
 * conversations | the open conversation | details (people, decisions, transcripts).
 * The same conversations are always reachable from the chat dock at the bottom right.
 *
 * SPEC.md "Chat and meetings": a project chat, a chat per document, direct messages, and
 * cross-project messages with members of similar past projects. Any chat can start a call.
 */
import { ArrowLeft, FileText, Gavel, PanelRightClose, PanelRightOpen, SquarePen } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { clsx } from 'clsx'
import { api } from '../../api'
import { useApi, useSessionUserId } from '../../api/hooks'
import { AiNote } from '../../components/ai'
import { CallButtons, ChatThread, isDirect, useChat, type ChatData } from '../../components/chat/ChatThread'
import { ChannelIcon, ConversationList, NewMessage } from '../../components/chat/ConversationList'
import { Avatar, Badge, ErrorBox, ProjectIcon } from '../../components/ui'

function Details({ data }: { data: ChatData }) {
  const direct = isDirect(data.chat.kind)
  const pid = data.project?.id
  return (
    <div className="space-y-6 p-5 text-sm">
      {direct && data.other ? (
        <div className="flex flex-col items-center pt-2 text-center">
          <Avatar name={data.other.name} id={data.other.id} size={72} />
          <div className="mt-3 text-base font-semibold">{data.other.name}</div>
          <div className="text-xs text-muted">{data.other.title}</div>
          {data.other.unavailable && <Badge tone="gray" className="mt-2">Account deactivated</Badge>}
          <p className="mt-3 text-xs text-muted">{data.chat.kind === 'rag_dm' ? 'A member of a similar past project. They can see this conversation only.' : 'A private conversation between the two of you.'}</p>
        </div>
      ) : (
        <div>
          <div className="mb-2 text-[11px] font-semibold tracking-wide text-muted uppercase">About</div>
          <p className="text-xs text-muted">{data.doc ? `Discussion about the ${data.doc.label}. Comments on the document itself stay on the document.` : 'The whole team’s conversation for this project.'}</p>
        </div>
      )}

      {data.project && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold tracking-wide text-muted uppercase">{direct ? 'Shared project' : 'Project'}</div>
          <Link to={`/projects/${pid}`} className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-ink/[0.04]">
            <ProjectIcon id={data.project.id} name={data.project.name} size={24} />
            <span className="truncate font-medium">{data.project.name}</span>
          </Link>
          {data.doc && (
            <Link to={`/projects/${pid}/docs/${data.doc.type}`} className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-ink/[0.04]">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-ink/5"><FileText className="h-3.5 w-3.5" /></span>
              <span className="font-medium">Open the {data.doc.label}</span>
            </Link>
          )}
        </div>
      )}

      {!direct && (
        <div>
          <div className="mb-2 text-[11px] font-semibold tracking-wide text-muted uppercase">People · {data.members.length}</div>
          <ul className="space-y-1">
            {data.members.map((m) => (
              <li key={m.id} className="flex items-center gap-2.5 rounded-lg p-1">
                <Avatar name={m.name} id={m.id} size={28} status={m.away ? 'away' : undefined} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{m.name}</span>
                  <span className="block truncate text-[11px] text-muted">{m.away ? 'Away · ' : ''}{m.role}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.decisions.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between text-[11px] font-semibold tracking-wide text-muted uppercase">
            Decisions from this chat
            {pid && <Link to={`/projects/${pid}/decisions`} className="normal-case tracking-normal text-brand hover:underline">All</Link>}
          </div>
          <ul className="space-y-2">
            {data.decisions.map((d) => (
              <li key={d.id} className="rounded-xl bg-canvas p-2.5">
                <div className="line-clamp-2 text-[13px]">{d.text}</div>
                <Badge tone={d.status === 'pending' ? 'amber' : d.status === 'confirmed' ? 'green' : 'gray'} className="mt-1.5">
                  <Gavel className="h-3 w-3" /> {d.status === 'pending' ? 'Waiting for the PM' : d.status}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!direct && <p className="text-[11px] leading-relaxed text-muted">Anyone in the chat can mark a message as a decision (hover a message). The PM confirms it before it counts. Calls can be transcribed; the AI suggests decisions from the transcript.</p>}
      <AiNote agent="transcribe" compact />
    </div>
  )
}

function Conversation({ chatId, onBack }: { chatId: string; onBack: () => void }) {
  const { data, error } = useChat(chatId)
  const [details, setDetails] = useState(true)
  if (error) return <div className="p-6"><ErrorBox error={error} /></div>
  if (!data) return <div className="flex-1 animate-pulse bg-ink/[0.02]" />
  const direct = isDirect(data.chat.kind)
  const away = direct && data.members.find((m) => m.id === data.other?.id)?.away
  return (
    <div className="flex min-w-0 flex-1">
      <ChatThread
        chatId={chatId}
        data={data}
        header={
          <div className="flex h-16 shrink-0 items-center gap-3 border-b border-line px-4">
            <button onClick={onBack} className="rounded-md p-1 text-muted hover:bg-ink/5 md:hidden" aria-label="Back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            {direct && data.other ? <Avatar name={data.other.name} id={data.other.id} size={36} status={away ? 'away' : undefined} /> : <ChannelIcon c={{ kind: data.chat.kind, projectId: data.chat.projectId }} />}
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate font-semibold">{data.chat.title}</div>
              <div className="truncate text-xs text-muted">
                {direct ? (away ? 'Away' : data.other?.title) : `${data.project?.name} · ${data.members.length} people`}
              </div>
            </div>
            <CallButtons chatId={chatId} data={data} />
            <button onClick={() => setDetails(!details)} className="hidden rounded-lg p-2 text-muted hover:bg-ink/5 hover:text-ink xl:block" title={details ? 'Hide details' : 'Show details'}>
              {details ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </button>
          </div>
        }
      />
      {details && (
        <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-line xl:block">
          <Details data={data} />
        </aside>
      )}
    </div>
  )
}

export function MessagesPage() {
  const { chatId } = useParams()
  const navigate = useNavigate()
  const uid = useSessionUserId()
  const { data: lists } = useApi(['conversations', uid], api.chat.conversations, !!uid)
  const [composing, setComposing] = useState(false)
  const all = [...(lists?.channels ?? []), ...(lists?.direct ?? [])].sort((a, b) => (b.last?.createdAt ?? '').localeCompare(a.last?.createdAt ?? ''))
  const active = chatId ?? all[0]?.id
  const open = (id: string) => {
    setComposing(false)
    navigate(`/messages/${id}`)
  }
  return (
    <div className="flex h-full min-h-0">
      <aside className={clsx('w-full shrink-0 flex-col border-r border-line md:flex md:w-80', chatId ? 'hidden' : 'flex')}>
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4">
          <h1 className="page-title text-lg">Messages</h1>
          <button onClick={() => setComposing(true)} className="rounded-lg p-2 text-muted hover:bg-ink/5 hover:text-ink" title="New message">
            <SquarePen className="h-4 w-4" />
          </button>
        </div>
        {composing ? <NewMessage onOpen={open} onBack={() => setComposing(false)} /> : <ConversationList lists={lists} activeId={active} onOpen={open} />}
      </aside>
      <section className={clsx('min-w-0 flex-1', chatId ? 'flex' : 'hidden md:flex')}>
        {active ? (
          <Conversation key={active} chatId={active} onBack={() => navigate('/messages')} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted">Choose a conversation.</div>
        )}
      </section>
    </div>
  )
}

/** Old project chat links (/projects/:pid/chat/…) now open the Messages page. */
export function ChatRedirect() {
  const { pid, chatId } = useParams()
  return <Navigate to={`/messages/${chatId ?? `${pid}-chat`}`} replace />
}
