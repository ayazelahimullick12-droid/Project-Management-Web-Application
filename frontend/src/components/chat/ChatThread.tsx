/**
 * One conversation: messages, reactions, "Mark as decision", transcripts, calls and the composer.
 * Used by the floating chat windows (ChatDock) and the full Messages page.
 *
 * The two kinds of chat look different on purpose, as on social media:
 * - Group channels (project chat, document chats) look like Slack or Discord: everyone's messages
 *   on the left with name and time, reactions, and "Mark as decision".
 * - Direct messages look like Messenger or Instagram: my messages are magenta bubbles on the right,
 *   theirs grey on the left, with "Seen" under my last message.
 *
 * SPEC.md "Chat and meetings". Calls are simulated (the real app uses LiveKit).
 */
import { AtSign, AudioLines, Captions, ChevronDown, Gavel, MessageCircle, Mic, MicOff, MonitorUp, Phone, PhoneCall, PhoneOff, SendHorizontal, SmilePlus, Video, VideoOff } from 'lucide-react'
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { clsx } from 'clsx'
import { api } from '../../api'
import { useAction, useApi, useNow, useSessionUserId } from '../../api/hooks'
import { AiBadge } from '../ai'
import { dayKey, fmtDateTime, fmtDay, fmtTime } from '../format'
import { Avatar, Badge, Button } from '../ui'
import { showCall, useDock } from './dock'

export type ChatData = Awaited<ReturnType<typeof api.chat.getChat>>
type Msg = ChatData['messages'][number]

const QUICK_REACTIONS = ['👍', '✅', '👀', '🎉']

export const isDirect = (kind: string) => kind === 'direct' || kind === 'rag_dm'

export function useChat(chatId: string) {
  const uid = useSessionUserId()
  return useApi(['chat', chatId, uid], () => api.chat.getChat(chatId))
}

// ─── Transcript ─────────────────────────────────────────────────────────

function TranscriptCard({ t }: { t: ChatData['transcripts'][number] }) {
  const [raw, setRaw] = useState(false)
  const [all, setAll] = useState(false)
  const segments = all ? t.segments : t.segments.slice(0, 3)
  return (
    <div className="ai-gradient mt-1 max-w-xl rounded-xl p-3 ring-1 ring-violet-200/70">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <Captions className="h-4 w-4 text-violet-700" />
        <b>Meeting transcript</b> {t.fileName && <span className="text-muted">from {t.fileName}</span>}
        <AiBadge label={raw ? 'Raw BanglaASR' : 'Corrected by AI'} />
        <div className="ml-auto flex overflow-hidden rounded-md text-[11px] ring-1 ring-violet-200">
          <button className={clsx('px-2 py-0.5', !raw && 'bg-violet-600 text-white')} onClick={() => setRaw(false)}>Corrected</button>
          <button className={clsx('px-2 py-0.5', raw && 'bg-violet-600 text-white')} onClick={() => setRaw(true)}>Raw</button>
        </div>
      </div>
      <ul className="space-y-1.5">
        {segments.map((s, i) => (
          <li key={i} className="text-sm">
            <b className="text-xs">{s.speaker}:</b> <span lang="bn">{raw ? s.raw : s.corrected}</span>
          </li>
        ))}
      </ul>
      {t.segments.length > 3 && (
        <button className="mt-1.5 text-xs font-medium text-violet-700 hover:underline" onClick={() => setAll(!all)}>
          {all ? 'Show less' : `Show all ${t.segments.length} lines`}
        </button>
      )}
      <p className="mt-2 text-[11px] text-muted">The raw transcript is kept with the corrected one. Candidate decisions went to the PM’s decision queue.</p>
    </div>
  )
}

// ─── Calls ──────────────────────────────────────────────────────────────

/** Voice / video buttons, or "Join" when a call is running. */
export function CallButtons({ chatId, data, compact }: { chatId: string; data: ChatData; compact?: boolean }) {
  const uid = useSessionUserId()
  const start = useAction(api.chat.startCall, { onDone: () => showCall(chatId) })
  const join = useAction(api.chat.joinCall, { onDone: () => showCall(chatId) })
  if (data.call) {
    const inIt = data.call.participants.some((p) => p.id === uid)
    return (
      <button onClick={() => (inIt ? showCall(chatId) : join.run(data.call!.id))} className="inline-flex h-7 items-center gap-1.5 rounded-full bg-leaf px-2.5 text-xs font-medium text-white shadow-sm hover:brightness-110">
        <PhoneCall className="h-3.5 w-3.5" /> {inIt ? 'Return' : 'Join'}
      </button>
    )
  }
  if (!data.canPost) return null
  const cls = compact ? 'rounded-md p-1.5 text-muted hover:bg-ink/5 hover:text-ink' : 'rounded-lg p-2 text-muted hover:bg-ink/5 hover:text-ink'
  return (
    <>
      <button className={cls} title="Start a voice call" onClick={() => start.run(chatId, 'voice')}>
        <Phone className="h-4 w-4" />
      </button>
      <button className={cls} title="Start a video call" onClick={() => start.run(chatId, 'video')}>
        <Video className="h-4 w-4" />
      </button>
    </>
  )
}

function CallScreen({ data, onLeave }: { data: ChatData; onLeave: () => void }) {
  const uid = useSessionUserId()
  const call = data.call!
  const [muted, setMuted] = useState(false)
  const [camera, setCamera] = useState(call.kind === 'video')
  const [sharing, setSharing] = useState(false)
  const camRef = useRef<HTMLVideoElement>(null)
  const shareRef = useRef<HTMLVideoElement>(null)
  const streams = useRef<MediaStream[]>([])
  const transcription = useAction(api.chat.setTranscription)
  const end = useAction(api.chat.endCall, { success: (c) => (c.transcription ? 'Call ended. Transcribing in the background…' : 'Call ended.'), onDone: onLeave })
  const starter = call.startedBy === uid

  useEffect(() => {
    if (!camera) return
    let stream: MediaStream | undefined
    navigator.mediaDevices?.getUserMedia({ video: true, audio: false }).then(
      (s) => {
        stream = s
        streams.current.push(s)
        if (camRef.current) camRef.current.srcObject = s
      },
      () => setCamera(false),
    )
    return () => stream?.getTracks().forEach((tr) => tr.stop())
  }, [camera])
  useEffect(() => () => streams.current.forEach((s) => s.getTracks().forEach((tr) => tr.stop())), [])
  const share = async () => {
    if (sharing) return setSharing(false)
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true })
      streams.current.push(s)
      setSharing(true)
      setTimeout(() => shareRef.current && (shareRef.current.srcObject = s), 50)
      s.getVideoTracks()[0].addEventListener('ended', () => setSharing(false))
    } catch {
      setSharing(true) // permission refused: show a placeholder tile
    }
  }
  const round = 'flex h-12 w-12 items-center justify-center rounded-full transition'

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#141413] text-white no-print">
      {call.transcription && (
        <div className="flex items-center justify-center gap-2 bg-brand py-2 text-sm font-medium">
          <Captions className="h-4 w-4" /> This meeting is being transcribed
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 px-6 py-4 text-sm">
        <b className="text-base">{data.chat.title}</b>
        <span className="text-white/60">
          {call.kind === 'video' ? 'Video call' : 'Voice call'} · started by {call.startedByName} at {fmtTime(call.startedAt)}
        </span>
        <span className="ml-auto rounded-full bg-amber-400/15 px-2.5 py-0.5 text-xs text-amber-300">Simulated call</span>
      </div>
      <div className="grid flex-1 auto-rows-fr grid-cols-2 gap-3 overflow-y-auto px-6 pb-4 md:grid-cols-3">
        {sharing && (
          <div className="relative col-span-2 flex items-center justify-center overflow-hidden rounded-2xl bg-black ring-2 ring-brand md:col-span-3">
            <video ref={shareRef} autoPlay muted className="h-full w-full object-contain" />
            <span className="absolute text-sm text-white/60">You are sharing your screen</span>
          </div>
        )}
        {call.participants.map((p) => (
          <div key={p.id} className="relative flex min-h-40 items-center justify-center overflow-hidden rounded-2xl bg-white/[0.06] ring-1 ring-white/10">
            {p.id === uid && camera ? <video ref={camRef} autoPlay muted playsInline className="h-full w-full object-cover" /> : <Avatar name={p.name} id={p.id} size={76} />}
            <span className="absolute bottom-2.5 left-2.5 flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-0.5 text-xs backdrop-blur">
              {p.id === uid && muted && <MicOff className="h-3 w-3 text-red-400" />}
              {p.name}
              {p.id === uid && ' (you)'}
            </span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3 px-6 pt-2 pb-5">
        <button onClick={() => setMuted(!muted)} className={clsx(round, muted ? 'bg-red-600' : 'bg-white/10 hover:bg-white/20')} title="Microphone">
          {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>
        <button onClick={() => setCamera(!camera)} className={clsx(round, camera ? 'bg-white/25' : 'bg-white/10 hover:bg-white/20')} title="Camera">
          {camera ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </button>
        <button onClick={share} className={clsx(round, sharing ? 'bg-brand' : 'bg-white/10 hover:bg-white/20')} title="Share screen">
          <MonitorUp className="h-5 w-5" />
        </button>
        <button
          disabled={!starter}
          onClick={() => transcription.run(call.id, !call.transcription)}
          className={clsx('flex h-12 items-center gap-2 rounded-full px-5 text-sm', call.transcription ? 'bg-brand' : 'bg-white/10 hover:bg-white/20', !starter && 'cursor-not-allowed opacity-50')}
          title={starter ? 'Switch transcription on or off' : 'Only the person who started the meeting can switch transcription'}
        >
          <Captions className="h-5 w-5" /> Transcription {call.transcription ? 'on' : 'off'}
        </button>
        <button onClick={() => (starter ? end.run(call.id) : onLeave())} className="flex h-12 items-center gap-2 rounded-full bg-red-600 px-6 text-sm font-medium hover:bg-red-700">
          <PhoneOff className="h-5 w-5" /> {starter ? 'End call' : 'Leave'}
        </button>
      </div>
      <p className="pb-3 text-center text-xs text-white/40">In the real app this is a LiveKit room (token from the backend, project members only) and a recorder bot records each person’s audio separately.</p>
    </div>
  )
}

/** Shows the call screen for whichever chat's call the user is in (mounted once, in the app frame). */
export function CallLayer() {
  const { callChatId } = useDock()
  const uid = useSessionUserId()
  const { data } = useApi(['chat', callChatId, uid], () => api.chat.getChat(callChatId!), !!callChatId)
  useEffect(() => {
    if (callChatId && data && !data.call) showCall(null) // the call ended
  }, [callChatId, data])
  if (!callChatId || !data?.call) return null
  return <CallScreen data={data} onLeave={() => showCall(null)} />
}

// ─── Messages ───────────────────────────────────────────────────────────

/** Message text with @mentions highlighted (your own name stands out more). */
function Body({ text, names, myName, onBrand }: { text: string; names: string[]; myName?: string; onBrand?: boolean }) {
  const parts = useMemo(() => {
    if (!names.length) return [text]
    const re = new RegExp(`(@(?:${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}))`, 'g')
    return text.split(re)
  }, [text, names])
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('@') && names.includes(p.slice(1)) ? (
          <span key={i} className={clsx('rounded px-0.5 font-medium', onBrand ? 'bg-white/20' : p.slice(1) === myName ? 'bg-amber-100 text-amber-900' : 'bg-brand-soft text-brand')}>
            {p}
          </span>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  )
}

function Reactions({ m, onReact, align }: { m: Msg; onReact: (emoji: string) => void; align?: 'end' }) {
  if (!m.reactionList.length) return null
  return (
    <div className={clsx('mt-1 flex flex-wrap gap-1', align === 'end' && 'justify-end')}>
      {m.reactionList.map((r) => (
        <button
          key={r.emoji}
          onClick={() => onReact(r.emoji)}
          title={r.names.join(', ')}
          className={clsx('inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs ring-1 transition', r.mine ? 'bg-brand-soft text-brand ring-brand/40' : 'bg-surface ring-line hover:ring-ink/20')}
        >
          <span>{r.emoji}</span>
          <span className="font-medium tabular-nums">{r.count}</span>
        </button>
      ))}
    </div>
  )
}

function HoverBar({ onReact, onDecision, className }: { onReact: (emoji: string) => void; onDecision?: () => void; className?: string }) {
  return (
    <div className={clsx('z-10 hidden items-center gap-0.5 rounded-lg bg-surface p-0.5 shadow-md ring-1 ring-line group-hover:flex', className)}>
      {QUICK_REACTIONS.map((e) => (
        <button key={e} onClick={() => onReact(e)} className="rounded-md px-1.5 py-0.5 text-sm hover:bg-ink/5" title={`React ${e}`}>
          {e}
        </button>
      ))}
      {onDecision && (
        <button onClick={onDecision} className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-brand hover:bg-brand-soft" title="Mark as decision (the PM confirms it)">
          <Gavel className="h-3.5 w-3.5" /> Decision
        </button>
      )}
    </div>
  )
}

function DecisionTag({ m }: { m: Msg }) {
  if (!m.decision) return null
  const s = m.decision.status
  return (
    <Badge tone={s === 'pending' ? 'amber' : s === 'confirmed' ? 'green' : 'gray'} className="mt-1">
      <Gavel className="h-3 w-3" /> Decision {s === 'pending' ? '· waiting for the PM' : `· ${s}`}
    </Badge>
  )
}

function SystemLine({ m }: { m: Msg }) {
  return (
    <div className="my-3 flex justify-center px-4">
      <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-ink/[0.05] px-3 py-1 text-center text-[11px] text-muted" title={fmtDateTime(m.createdAt)}>
        {m.kind === 'call' && <Phone className="h-3 w-3 shrink-0" />}
        <span>{m.body}</span>
        <span className="shrink-0 opacity-70">· {fmtTime(m.createdAt)}</span>
      </span>
    </div>
  )
}

function DaySeparator({ iso, now }: { iso: string; now: Date }) {
  return (
    <div className="my-4 flex items-center gap-3 px-4 text-[11px] font-medium text-muted">
      <span className="h-px flex-1 bg-line" />
      {fmtDay(iso, now)}
      <span className="h-px flex-1 bg-line" />
    </div>
  )
}

// ─── Composer ───────────────────────────────────────────────────────────

function Composer({ chatId, data, compact }: { chatId: string; data: ChatData; compact?: boolean }) {
  const uid = useSessionUserId()
  const [text, setText] = useState('')
  const [pick, setPick] = useState(0)
  const area = useRef<HTMLTextAreaElement>(null)
  const file = useRef<HTMLInputElement>(null)
  const post = useAction(api.chat.postMessage, { onDone: () => setText('') })
  const audio = useAction((f: string) => api.chat.uploadAudio(chatId, f), { success: 'Transcribing the audio in the background…' })
  const direct = isDirect(data.chat.kind)

  // @mention suggestions while typing "@Na…" in a group channel
  const query = !direct ? /(?:^|\s)@([^@\n]{0,24})$/.exec(text)?.[1] : undefined
  const rank = (name: string, q: string) => (name.toLowerCase().startsWith(q) ? 0 : name.toLowerCase().split(' ').some((w) => w.startsWith(q)) ? 1 : 2)
  const suggestions =
    query === undefined
      ? []
      : data.members
          .filter((m) => m.id !== uid && m.name.toLowerCase().includes(query.toLowerCase()))
          .sort((a, b) => rank(a.name, query.toLowerCase()) - rank(b.name, query.toLowerCase()))
          .slice(0, 5)
  const mention = (name: string) => {
    setText(text.replace(/@([^@\n]{0,24})$/, `@${name} `))
    setPick(0)
    area.current?.focus()
  }

  useEffect(() => {
    const el = area.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, compact ? 96 : 160)}px`
  }, [text, compact])

  if (!data.canPost)
    return <div className="border-t border-line px-4 py-3 text-center text-xs text-muted">This project is no longer active, so its chat is read-only.</div>

  const send = () => text.trim() && post.run(chatId, text)
  const placeholder = direct ? `Message ${data.other?.name ?? ''}` : `Message ${data.doc ? `${data.doc.label} chat` : 'the project chat'}${compact ? '' : ' · @ to mention someone'}`

  return (
    <div className={clsx('relative', compact ? 'p-2' : 'px-4 pt-2 pb-4')}>
      {suggestions.length > 0 && (
        <div className="absolute bottom-full left-3 z-20 mb-1 w-64 rounded-xl bg-surface p-1 shadow-xl ring-1 ring-line">
          <div className="px-2 py-1 text-[11px] text-muted">Mention someone</div>
          {suggestions.map((m, i) => (
            <button key={m.id} onMouseDown={(e) => e.preventDefault()} onClick={() => mention(m.name)} className={clsx('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm', i === pick ? 'bg-brand-soft' : 'hover:bg-canvas')}>
              <Avatar name={m.name} id={m.id} size={22} />
              <span className="min-w-0 flex-1 truncate">{m.name}</span>
              <span className="truncate text-[11px] text-muted">{m.role}</span>
            </button>
          ))}
        </div>
      )}
      <div className="rounded-xl bg-surface ring-1 ring-line transition focus-within:ring-2 focus-within:ring-brand/60">
        <textarea
          ref={area}
          rows={1}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setPick(0)
          }}
          onKeyDown={(e) => {
            if (suggestions.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
              e.preventDefault()
              setPick((pick + (e.key === 'ArrowDown' ? 1 : suggestions.length - 1)) % suggestions.length)
            } else if (suggestions.length && (e.key === 'Enter' || e.key === 'Tab')) {
              e.preventDefault()
              mention(suggestions[pick].name)
            } else if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          placeholder={placeholder}
          className="block w-full resize-none bg-transparent px-3 pt-2.5 pb-1 text-sm outline-none placeholder:text-muted/70"
        />
        <div className="flex items-center gap-0.5 px-1.5 pb-1.5">
          {!direct && (
            <button className="rounded-md p-1.5 text-muted hover:bg-ink/5 hover:text-ink" title="Mention someone" onClick={() => { setText(text + (text && !text.endsWith(' ') ? ' @' : '@')); area.current?.focus() }}>
              <AtSign className="h-4 w-4" />
            </button>
          )}
          <button className="rounded-md p-1.5 text-muted hover:bg-ink/5 hover:text-ink" title="Add a thumbs up" onClick={() => setText(text + '👍')}>
            <SmilePlus className="h-4 w-4" />
          </button>
          {data.project && !direct && (
            <>
              <input ref={file} type="file" accept="audio/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) audio.run(f.name) }} />
              <button className="rounded-md p-1.5 text-muted hover:bg-ink/5 hover:text-ink" title="Upload meeting audio to transcribe" onClick={() => file.current?.click()}>
                <AudioLines className="h-4 w-4" />
              </button>
            </>
          )}
          {!compact && <span className="ml-auto pr-2 text-[11px] text-muted">Enter to send · Shift+Enter for a new line</span>}
          <button
            onClick={send}
            disabled={!text.trim() || post.pending}
            className={clsx('flex h-7 w-7 items-center justify-center rounded-lg transition', compact && 'ml-auto', text.trim() ? 'bg-brand text-white shadow-sm hover:brightness-110' : 'text-muted/60')}
            title="Send"
          >
            <SendHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Thread ─────────────────────────────────────────────────────────────

export function ChatThread({ chatId, data, compact, active = true, header }: { chatId: string; data: ChatData; compact?: boolean; active?: boolean; header?: ReactNode }) {
  const uid = useSessionUserId()
  const now = useNow()
  const scroller = useRef<HTMLDivElement>(null)
  const [atBottom, setAtBottom] = useState(true)
  const react = useAction(api.chat.react)
  const mark = useAction(api.chat.markDecision, { success: 'Marked as a decision. The PM was asked to confirm it.' })
  const direct = isDirect(data.chat.kind)
  const me = data.members.find((m) => m.id === uid)
  const names = useMemo(() => data.members.map((m) => m.name), [data.members])
  const msgs = data.messages
  const myLast = [...msgs].reverse().find((m) => m.authorId === uid && m.kind === 'text')

  // Mark as read while the conversation is on screen.
  useEffect(() => {
    if (active && data.unread) void api.chat.markRead(chatId).catch(() => undefined)
  }, [active, data.unread, chatId])

  // Stay at the newest message, as chat apps do.
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [msgs.length, chatId])

  // Any chat linked to a project can turn a message into a decision (also direct messages, e.g. with a past project's member).
  const decide = (m: Msg) => (data.canMarkDecision && data.canPost && !m.decision && m.kind === 'text' ? () => mark.run(m.id) : undefined)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {header}
      {data.call?.transcription && (
        <div className="flex items-center justify-center gap-2 bg-brand py-1.5 text-xs font-medium text-white">
          <Captions className="h-3.5 w-3.5" /> This meeting is being transcribed
        </div>
      )}
      {data.call && (
        <div className="flex items-center gap-2 border-b border-line bg-leaf-soft px-4 py-2 text-xs">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-leaf opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-leaf" />
          </span>
          <span className="flex-1 text-ink">
            {data.call.kind === 'video' ? 'Video' : 'Voice'} call in progress · {data.call.participants.length} people
          </span>
          <CallButtons chatId={chatId} data={data} compact />
        </div>
      )}
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget
          setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80)
        }}
        className="relative min-h-0 flex-1 overflow-y-auto pt-2 pb-3"
      >
        {data.chat.kind === 'rag_dm' && (
          <div className="mx-4 my-2 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-900">They can see this conversation only, nothing else in your project.</div>
        )}
        {!msgs.length && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-10 text-center">
            {direct && data.other ? <Avatar name={data.other.name} id={data.other.id} size={56} /> : null}
            <div className="text-sm font-medium">{direct ? `Say hello to ${data.other?.name}` : 'No messages yet'}</div>
            <div className="text-xs text-muted">{direct ? 'Only the two of you can see this conversation.' : 'Start the conversation. Document comments never appear here.'}</div>
          </div>
        )}
        {msgs.map((m, i) => {
          const prev = msgs[i - 1]
          const next = msgs[i + 1]
          const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt)
          const close = (a?: Msg, b?: Msg) => !!a && !!b && a.kind === 'text' && b.kind === 'text' && a.authorId === b.authorId && dayKey(a.createdAt) === dayKey(b.createdAt) && Math.abs(new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) < 5 * 60_000
          const groupedWithPrev = close(prev, m)
          const groupedWithNext = close(m, next)
          const sep = newDay && <DaySeparator iso={m.createdAt} now={now} />

          if (m.kind === 'system' || m.kind === 'call')
            return (
              <Fragment key={m.id}>
                {sep}
                <SystemLine m={m} />
              </Fragment>
            )

          if (m.kind === 'transcript')
            return (
              <Fragment key={m.id}>
                {sep}
                <div className="mt-3 flex gap-3 px-4">
                  <span className="ai-gradient flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-violet-700">
                    <Captions className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold">Meeting notes</span>
                      <span className="text-[11px] text-muted">{fmtTime(m.createdAt)}</span>
                    </div>
                    {data.transcripts.filter((t) => t.id === m.transcriptId).map((t) => <TranscriptCard key={t.id} t={t} />)}
                  </div>
                </div>
              </Fragment>
            )

          const mine = m.authorId === uid
          const onReact = (e: string) => react.run(m.id, e)

          if (direct)
            return (
              <Fragment key={m.id}>
                {sep}
                {!groupedWithPrev && !newDay && prev && new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() > 30 * 60_000 && (
                  <div className="mt-3 text-center text-[11px] text-muted">{fmtTime(m.createdAt)}</div>
                )}
                <div className={clsx('group flex items-end gap-2 px-3', mine && 'flex-row-reverse', groupedWithPrev ? 'mt-0.5' : 'mt-2.5')}>
                  {!mine && <span className="w-7 shrink-0">{!groupedWithNext && <Avatar name={m.authorName} id={m.authorId ?? ''} size={28} />}</span>}
                  <div className={clsx('flex max-w-[78%] flex-col', mine ? 'items-end' : 'items-start')}>
                    <div
                      title={fmtDateTime(m.createdAt)}
                      className={clsx(
                        'px-3.5 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap',
                        mine ? 'bg-brand text-white' : 'bg-ink/[0.06] text-ink',
                        'rounded-[20px]',
                        mine ? (groupedWithNext ? 'rounded-br-md' : '') + (groupedWithPrev ? ' rounded-tr-md' : '') : (groupedWithNext ? 'rounded-bl-md' : '') + (groupedWithPrev ? ' rounded-tl-md' : ''),
                      )}
                    >
                      <Body text={m.body} names={names} myName={me?.name} onBrand={mine} />
                    </div>
                    <DecisionTag m={m} />
                    <Reactions m={m} onReact={onReact} align={mine ? 'end' : undefined} />
                    {mine && myLast?.id === m.id && <span className="mt-0.5 text-[10px] text-muted">{data.seenByOther ? 'Seen' : 'Sent'}</span>}
                  </div>
                  <HoverBar onReact={onReact} onDecision={decide(m)} className="mb-1 self-center" />
                </div>
              </Fragment>
            )

          return (
            <Fragment key={m.id}>
              {sep}
              <div className={clsx('group relative flex gap-3 px-4 py-0.5 hover:bg-ink/[0.025]', !groupedWithPrev && 'mt-2.5')}>
                <span className={clsx('shrink-0', compact ? 'w-7' : 'w-8')}>
                  {!groupedWithPrev ? (
                    <Avatar name={m.authorName} id={m.authorId ?? ''} size={compact ? 28 : 32} />
                  ) : (
                    <span className="invisible block pt-0.5 text-right text-[10px] text-muted tabular-nums group-hover:visible">{fmtTime(m.createdAt)}</span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  {!groupedWithPrev && (
                    <div className="flex items-baseline gap-2">
                      <span className={clsx('font-semibold', compact ? 'text-[13px]' : 'text-sm')}>{m.authorName}</span>
                      <span className="text-[11px] text-muted" title={fmtDateTime(m.createdAt)}>{fmtTime(m.createdAt)}</span>
                    </div>
                  )}
                  <div className={clsx('leading-relaxed break-words whitespace-pre-wrap', compact ? 'text-[13px]' : 'text-sm')}>
                    <Body text={m.body} names={names} myName={me?.name} />
                  </div>
                  <DecisionTag m={m} />
                  <Reactions m={m} onReact={onReact} />
                </div>
                <HoverBar onReact={onReact} onDecision={decide(m)} className="absolute -top-3 right-3" />
              </div>
            </Fragment>
          )
        })}
        {!atBottom && (
          <button
            onClick={() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })}
            className="sticky bottom-2 left-full mr-3 ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-surface shadow-md ring-1 ring-line"
            title="Jump to the newest message"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        )}
      </div>
      <Composer chatId={chatId} data={data} compact={compact} />
    </div>
  )
}

/** "Discuss" button for other pages (project overview, documents): opens the chat in a floating window. */
export function DiscussButton({ onClick, unread, label = 'Discuss' }: { onClick: () => void; unread?: number; label?: string }) {
  return (
    <Button onClick={onClick}>
      <MessageCircle className="h-4 w-4" />
      {label}
      {!!unread && <span className="rounded-full bg-brand px-1.5 text-[10px] leading-4 font-semibold text-white">{unread}</span>}
    </Button>
  )
}
