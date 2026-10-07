/**
 * Chats (project, per document, direct messages, cross-project messages), calls, transcripts
 * and "Mark as decision". SPEC.md "Chat and meetings". Calls are simulated (the real app uses LiveKit).
 */
import { AudioLines, Captions, Gavel, Hash, MessageCircle, Mic, MicOff, MonitorUp, Phone, PhoneOff, Send, Video, VideoOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { clsx } from 'clsx'
import { api } from '../../api'
import { useAction, useApi, useSessionUserId } from '../../api/hooks'
import { AiBadge, AiNote } from '../../components/ai'
import { FileButton } from '../../components/FileButton'
import { fmtDateTime, fmtTime } from '../../components/format'
import { Avatar, Badge, Button, Card, EmptyState, ErrorBox, Loading, Note, PageHeader, Select, Textarea } from '../../components/ui'

type ChatData = Awaited<ReturnType<typeof api.chat.getChat>>

function TranscriptCard({ t }: { t: ChatData['transcripts'][number] }) {
  const [raw, setRaw] = useState(false)
  return (
    <div className="mt-1 rounded-md bg-violet-50/50 p-3 ring-1 ring-violet-200">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <Captions className="h-4 w-4 text-violet-700" />
        <b>Meeting transcript</b> {t.fileName && <span className="text-muted">from {t.fileName}</span>}
        <AiBadge label={raw ? 'Raw BanglaASR output' : 'Corrected by AI'} />
        <div className="ml-auto flex overflow-hidden rounded ring-1 ring-violet-200">
          <button className={clsx('px-2 py-0.5', !raw && 'bg-violet-700 text-white')} onClick={() => setRaw(false)}>Corrected</button>
          <button className={clsx('px-2 py-0.5', raw && 'bg-violet-700 text-white')} onClick={() => setRaw(true)}>Raw</button>
        </div>
      </div>
      <ul className="space-y-1.5">
        {t.segments.map((s, i) => (
          <li key={i} className="text-sm">
            <b className="text-xs">{s.speaker}:</b> <span lang="bn">{raw ? s.raw : s.corrected}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-muted">The raw transcript is kept with the corrected one, so corrections can be checked. Candidate decisions went to the PM’s decision queue.</p>
    </div>
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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1d1e15] text-white no-print">
      {call.transcription && <div className="flex items-center justify-center gap-2 bg-brand py-2 text-sm font-medium"><Captions className="h-4 w-4" /> This meeting is being transcribed</div>}
      <div className="flex items-center gap-2 px-5 py-3 text-sm">
        <b>{data.chat.title}</b> · {call.kind === 'video' ? 'Video call' : 'Voice call'} · started by {call.startedByName} at {fmtTime(call.startedAt)}
        <Badge tone="amber" className="ml-2">Simulated call</Badge>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto p-5 md:grid-cols-3">
        {sharing && (
          <div className="col-span-2 flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-black ring-2 ring-brand md:col-span-3">
            <video ref={shareRef} autoPlay muted className="h-full w-full object-contain" />
            <span className="absolute text-sm text-white/60">You are sharing your screen</span>
          </div>
        )}
        {call.participants.map((p) => (
          <div key={p.id} className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10">
            {p.id === uid && camera ? <video ref={camRef} autoPlay muted playsInline className="h-full w-full object-cover" /> : <Avatar name={p.name} id={p.id} size={72} />}
            <span className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-0.5 text-xs">{p.name}{p.id === uid && ' (you)'}{p.id === uid && muted && ' · muted'}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3 border-t border-white/10 px-5 py-4">
        <button onClick={() => setMuted(!muted)} className={clsx('rounded-full p-3', muted ? 'bg-red-600' : 'bg-white/10 hover:bg-white/20')} title="Microphone">{muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}</button>
        <button onClick={() => setCamera(!camera)} className={clsx('rounded-full p-3', !camera ? 'bg-white/10 hover:bg-white/20' : 'bg-white/30')} title="Camera">{camera ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}</button>
        <button onClick={share} className={clsx('rounded-full p-3', sharing ? 'bg-brand' : 'bg-white/10 hover:bg-white/20')} title="Share screen"><MonitorUp className="h-5 w-5" /></button>
        <button
          disabled={!starter}
          onClick={() => transcription.run(call.id, !call.transcription)}
          className={clsx('flex items-center gap-2 rounded-full px-4 py-3 text-sm', call.transcription ? 'bg-brand' : 'bg-white/10 hover:bg-white/20', !starter && 'cursor-not-allowed opacity-50')}
          title={starter ? 'Switch transcription on or off' : 'Only the person who started the meeting can switch transcription'}
        >
          <Captions className="h-5 w-5" /> Transcription {call.transcription ? 'on' : 'off'}
        </button>
        <button onClick={() => (starter ? end.run(call.id) : onLeave())} className="flex items-center gap-2 rounded-full bg-red-600 px-5 py-3 text-sm font-medium hover:bg-red-700">
          <PhoneOff className="h-5 w-5" /> {starter ? 'End call' : 'Leave'}
        </button>
      </div>
      <p className="pb-3 text-center text-xs text-white/50">In the real app this is a LiveKit room (token from the backend, project members only) and a Python recorder bot records each person’s audio separately.</p>
    </div>
  )
}

export function ChatView({ chatId }: { chatId: string }) {
  const uid = useSessionUserId()
  const { data, isLoading, error } = useApi(['chat', chatId, uid], () => api.chat.getChat(chatId))
  const [text, setText] = useState('')
  const [inCall, setInCall] = useState(false)
  const bottom = useRef<HTMLDivElement>(null)
  const post = useAction(api.chat.postMessage, { onDone: () => setText('') })
  const mark = useAction(api.chat.markDecision, { success: 'Marked as a decision. The PM was asked to confirm it.' })
  const start = useAction(api.chat.startCall, { onDone: () => setInCall(true) })
  const join = useAction(api.chat.joinCall, { onDone: () => setInCall(true) })
  const audio = useAction((f: string) => api.chat.uploadAudio(chatId, f), { success: 'Transcribing the audio in the background…' })
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' }) // newer browsers return a Promise here, so don't return it
  }, [data?.messages.length])
  if (isLoading) return <Loading />
  if (error || !data) return <ErrorBox error={error} />
  return (
    <div className="flex h-[calc(100vh-11rem)] flex-col rounded-lg bg-white ring-1 ring-line">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{data.chat.title}</div>
          <div className="text-xs text-muted">{data.chat.kind === 'rag_dm' ? 'Conversation with a member of a similar past project. They see this conversation only.' : `${data.members.length} people`}{data.project && data.chat.kind !== 'rag_dm' && <> · <Link to={`/projects/${data.project.id}`} className="text-brand">{data.project.name}</Link></>}</div>
        </div>
        {data.call ? (
          <Button variant="success" onClick={() => join.run(data.call!.id)}><Phone className="h-4 w-4" /> Join the call</Button>
        ) : (
          data.canPost && (
            <>
              <Button size="sm" onClick={() => start.run(chatId, 'voice')}><Phone className="h-3.5 w-3.5" /> Voice call</Button>
              <Button size="sm" onClick={() => start.run(chatId, 'video')}><Video className="h-3.5 w-3.5" /> Video call</Button>
            </>
          )
        )}
        {data.project && data.chat.kind !== 'rag_dm' && data.canPost && <FileButton size="sm" accept="audio/*" onPick={(f) => audio.run(f.name)}><AudioLines className="h-3.5 w-3.5" /> Meeting audio</FileButton>}
      </div>
      {data.call?.transcription && <div className="flex items-center justify-center gap-2 bg-brand py-1.5 text-xs font-medium text-white"><Captions className="h-3.5 w-3.5" /> This meeting is being transcribed</div>}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {data.messages.map((m) =>
          m.kind === 'system' || m.kind === 'call' ? (
            <div key={m.id} className="text-center text-xs text-muted">{m.body} · {fmtDateTime(m.createdAt)}</div>
          ) : m.kind === 'transcript' ? (
            <div key={m.id}>
              <div className="text-xs text-muted">{fmtDateTime(m.createdAt)}</div>
              {data.transcripts.filter((t) => t.id === m.transcriptId).map((t) => <TranscriptCard key={t.id} t={t} />)}
            </div>
          ) : (
            <div key={m.id} className={clsx('group flex gap-2', m.authorId === uid && 'flex-row-reverse')}>
              <Avatar name={m.authorName} id={m.authorId ?? ''} size={28} />
              <div className={clsx('max-w-[75%] rounded-lg px-3 py-2 text-sm', m.authorId === uid ? 'bg-brand-soft' : 'bg-canvas')}>
                <div className="mb-0.5 text-[11px] text-muted"><b className="text-ink">{m.authorName}</b> · {fmtDateTime(m.createdAt)}</div>
                <div className="whitespace-pre-line">{m.body}</div>
                {m.decision ? (
                  <Badge tone={m.decision.status === 'pending' ? 'amber' : m.decision.status === 'confirmed' ? 'green' : 'gray'} className="mt-1"><Gavel className="h-3 w-3" /> Decision {m.decision.status === 'pending' ? 'waiting for the PM' : m.decision.status}</Badge>
                ) : (
                  data.canMarkDecision && data.canPost && (
                    <button onClick={() => mark.run(m.id)} className="mt-1 hidden items-center gap-1 text-[11px] font-medium text-brand group-hover:inline-flex">
                      <Gavel className="h-3 w-3" /> Mark as decision
                    </button>
                  )
                )}
              </div>
            </div>
          ),
        )}
        {!data.messages.length && <div className="text-center text-sm text-muted">No messages yet.</div>}
        <div ref={bottom} />
      </div>
      {data.canPost && (
        <div className="flex gap-2 border-t border-line p-3">
          <Textarea rows={1} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); post.run(chatId, text) } }} placeholder="Write a message… (document comments never appear here)" />
          <Button variant="primary" onClick={() => post.run(chatId, text)}><Send className="h-4 w-4" /></Button>
        </div>
      )}
      {inCall && data.call && <CallScreen data={data} onLeave={() => setInCall(false)} />}
    </div>
  )
}

function ChatList({ chats, active, base }: { chats: Awaited<ReturnType<typeof api.chat.listChats>>; active?: string; base: string }) {
  return (
    <ul className="space-y-1">
      {chats.map((c) => (
        <li key={c.id}>
          <Link to={`${base}/${c.id}`} className={clsx('flex items-start gap-2 rounded-md px-2.5 py-2 text-sm', active === c.id ? 'bg-brand-soft' : 'hover:bg-black/5')}>
            {c.kind === 'direct' || c.kind === 'rag_dm' ? <MessageCircle className="mt-0.5 h-4 w-4 text-muted" /> : <Hash className="mt-0.5 h-4 w-4 text-muted" />}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{c.title}</span>
              <span className="block truncate text-xs text-muted">{c.last ? `${c.lastAuthor}: ${c.last.body}` : 'No messages'}</span>
              {c.projectName && base === '/messages' && <span className="block truncate text-[11px] text-muted">{c.projectName}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function ChatPage() {
  const { pid = '', chatId } = useParams()
  const navigate = useNavigate()
  const uid = useSessionUserId()
  const { data: chats } = useApi(['chats', pid, uid], () => api.chat.listChats(pid))
  const { data: project } = useApi(['project', pid], () => api.projects.getProject(pid))
  const [dmWith, setDmWith] = useState('')
  const dm = useAction(api.chat.startDirect, { onDone: (id) => navigate(`/projects/${pid}/chat/${id}`) })
  const active = chatId ?? chats?.[0]?.id
  return (
    <div>
      <PageHeader eyebrow={<Link to={`/projects/${pid}`}>{project?.summary.project.name}</Link>} title="Chats and calls" subtitle="A project chat, a chat per document, and direct messages. Any chat can start a voice or video call." />
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-3">
          <Card padded={false}><div className="p-2">{chats && <ChatList chats={chats} active={active} base={`/projects/${pid}/chat`} />}</div></Card>
          {project && (
            <Card title="Direct message">
              <div className="flex gap-2">
                <Select value={dmWith} onChange={(e) => setDmWith(e.target.value)} className="text-xs">
                  <option value="">Choose a member…</option>
                  {project.members.filter((m) => m.member.userId !== uid).map((m) => <option key={m.member.userId} value={m.member.userId}>{m.name}</option>)}
                </Select>
                <Button size="sm" disabled={!dmWith} onClick={() => dm.run(pid, dmWith)}>Open</Button>
              </div>
            </Card>
          )}
          <AiNote agent="transcribe" compact />
          <Note className="!text-xs">Document comments never appear in chat. Any member can mark a message as a decision; the PM confirms it.</Note>
        </div>
        {active ? <ChatView key={active} chatId={active} /> : <EmptyState title="No chat" />}
      </div>
    </div>
  )
}

export function MessagesPage() {
  const { chatId } = useParams()
  const uid = useSessionUserId()
  const { data: chats } = useApi(['dm-chats', uid], () => api.chat.listChats(null))
  const active = chatId ?? chats?.[0]?.id
  return (
    <div>
      <PageHeader title="Direct messages" subtitle="Your one-to-one conversations, including messages with members of similar past projects." />
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card padded={false}><div className="p-2">{chats?.length ? <ChatList chats={chats} active={active} base="/messages" /> : <p className="p-3 text-sm text-muted">No direct messages yet.</p>}</div></Card>
        {active ? <ChatView key={active} chatId={active} /> : <EmptyState title="No conversation selected" />}
      </div>
    </div>
  )
}
