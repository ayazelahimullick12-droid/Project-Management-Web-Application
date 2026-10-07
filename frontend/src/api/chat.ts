/**
 * Chats, calls, transcripts and "Mark as decision".
 *
 * Spec: SPEC.md "Chat and meetings" and "RAG agent" → Talking to the original team
 * (cross-project direct messages: the old member sees only that conversation).
 * Calls are simulated: the real app uses LiveKit rooms and a Python recorder bot.
 */
import type { Chat, DemoState, ID, User } from '../types'
import { now, nowIso } from '../demo/clock'
import { newId } from '../demo/ids'
import { runJob } from '../demo/jobs'
import { transcribe } from '../demo/ai/agents'
import { actAsHead, can, headOf, inTeam, isOwner, memberOf } from '../rules/permissions'
import { DOC_LABEL } from '../rules/pipeline'
import { act, ApiError, ensure, fail, me, nameOf, projectOf, read } from './core'
import { audit, notify } from './effects'

function canSee(s: DemoState, chat: Chat, user: User): boolean {
  if (chat.kind === 'direct' || chat.kind === 'rag_dm') return !!chat.memberIds?.includes(user.id)
  const p = projectOf(s, chat.projectId!)
  return !!user.isAdmin || isOwner(p, user.id) || !!memberOf(p, user.id)
}

function chatTitle(s: DemoState, chat: Chat, userId: ID): string {
  if (chat.kind === 'direct' || chat.kind === 'rag_dm') {
    const other = chat.memberIds?.find((id) => id !== userId)
    return `${nameOf(s, other)}${chat.kind === 'rag_dm' ? ' (past project)' : ''}`
  }
  if (chat.kind === 'document') {
    const doc = s.docs.find((d) => d.id === chat.docId)
    return doc ? `${DOC_LABEL[doc.type]} chat` : chat.title ?? 'Document chat'
  }
  return 'Project chat'
}

export async function listChats(pid: ID | null) {
  return read((s) => {
    const user = me(s)
    const chats = s.chats.filter((c) => (pid ? c.projectId === pid : c.kind === 'direct' || c.kind === 'rag_dm') && canSee(s, c, user))
    return chats
      .map((c) => {
        const last = s.messages.filter((m) => m.chatId === c.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
        return { ...c, title: chatTitle(s, c, user.id), last, lastAuthor: last ? nameOf(s, last.authorId) : undefined, projectName: c.projectId ? projectOf(s, c.projectId).name : undefined }
      })
      .sort((a, b) => (a.kind === 'project' ? -1 : b.kind === 'project' ? 1 : (b.last?.createdAt ?? '').localeCompare(a.last?.createdAt ?? '')))
  })
}

export async function getChat(chatId: ID) {
  return read((s, t) => {
    const user = me(s)
    const chat = s.chats.find((c) => c.id === chatId)
    if (!chat) throw new ApiError(404, 'Chat not found.')
    if (!canSee(s, chat, user)) throw new ApiError(403, 'You are not part of this conversation.')
    const p = chat.projectId ? projectOf(s, chat.projectId) : undefined
    const call = s.calls.find((c) => c.chatId === chatId && !c.endedAt)
    const members = chat.memberIds ?? p?.members.map((m) => m.userId) ?? []
    return {
      chat: { ...chat, title: chatTitle(s, chat, user.id) },
      project: p,
      messages: s.messages.filter((m) => m.chatId === chatId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((m) => ({ ...m, authorName: m.authorId ? nameOf(s, m.authorId) : 'System', decision: m.decisionId ? s.decisions.find((d) => d.id === m.decisionId) : undefined })),
      transcripts: s.transcripts.filter((x) => x.chatId === chatId),
      call: call ? { ...call, participants: call.participantIds.map((id) => ({ id, name: nameOf(s, id) })), startedByName: nameOf(s, call.startedBy) } : undefined,
      members: members.map((id) => ({ id, name: nameOf(s, id) })),
      canPost: p ? p.status === 'active' : true,
      canMarkDecision: !!p || chat.kind === 'rag_dm',
      isPm: p ? actAsHead(p, 'PM', user.id, t).ok : false,
    }
  })
}

export async function postMessage(chatId: ID, body: string) {
  return act((s, _t, at) => {
    const user = me(s)
    const chat = s.chats.find((c) => c.id === chatId)
    if (!chat || !canSee(s, chat, user)) throw new ApiError(403, 'You are not part of this conversation.')
    if (chat.projectId && chat.kind !== 'rag_dm') ensure(can.change(projectOf(s, chat.projectId)))
    if (!body.trim()) fail('Write a message.')
    s.messages.push({ id: newId('msg'), chatId, authorId: user.id, body: body.trim(), createdAt: at, kind: 'text' })
    if (chat.kind === 'direct' || chat.kind === 'rag_dm')
      notify(s, { to: chat.memberIds!.filter((id) => id !== user.id), type: 'message', title: `New message from ${user.name}`, body: body.trim().slice(0, 140), link: `/messages/${chatId}`, at, email: false })
  })
}

export async function startDirect(pid: ID, otherId: ID) {
  return act((s) => {
    const user = me(s)
    const p = projectOf(s, pid)
    if (!memberOf(p, user.id) || !memberOf(p, otherId)) fail('Direct messages are between members of the project.')
    const existing = s.chats.find((c) => c.kind === 'direct' && c.projectId === pid && c.memberIds?.includes(user.id) && c.memberIds.includes(otherId))
    if (existing) return existing.id
    const id = newId('chat')
    s.chats.push({ id, projectId: pid, kind: 'direct', memberIds: [user.id, otherId] })
    return id
  })
}

/** PM team → member of a similar past project. The old member sees this conversation only. */
export async function startRagDm(pid: ID, pastUserId: ID) {
  return act((s, _t, at) => {
    const user = me(s)
    const p = projectOf(s, pid)
    if (!inTeam(p, user.id, 'PM')) throw new ApiError(403, 'Only the PM team can message members of similar projects.')
    const other = s.users.find((u) => u.id === pastUserId)
    if (!other || other.deactivated) fail('This person’s account is deactivated, so they cannot be messaged.')
    const existing = s.chats.find((c) => c.kind === 'rag_dm' && c.projectId === pid && c.memberIds?.includes(user.id) && c.memberIds.includes(pastUserId))
    if (existing) return existing.id
    const id = newId('chat')
    s.chats.push({ id, projectId: pid, kind: 'rag_dm', memberIds: [user.id, pastUserId], title: `About ${p.name}` })
    s.messages.push({ id: newId('msg'), chatId: id, authorId: null, kind: 'system', body: `${user.name} (PM team, ${p.name}) started this conversation about a similar past project. ${other.name} can see this conversation only, nothing else in ${p.name}.`, createdAt: at })
    audit(s, { projectId: pid, actorId: user.id, action: 'Cross-project message', details: `With ${other.name}`, at })
    return id
  })
}

export async function markDecision(messageId: ID) {
  return act((s, t, at) => {
    const user = me(s)
    const m = s.messages.find((x) => x.id === messageId)
    if (!m) fail('Message not found.')
    const chat = s.chats.find((c) => c.id === m.chatId)!
    if (!canSee(s, chat, user)) throw new ApiError(403, 'You are not part of this conversation.')
    if (m.decisionId) fail('Already marked as a decision.')
    if (!chat.projectId) fail('Decisions belong to a project.')
    const p = projectOf(s, chat.projectId)
    const id = newId('dec')
    s.decisions.push({ id, projectId: p.id, source: 'chat', chatId: chat.id, messageId, text: m.body, ai: false, markedBy: user.id, status: 'pending', createdAt: at })
    m.decisionId = id
    const pm = headOf(p, 'PM')!
    notify(s, { to: [pm.userId], type: 'decision', title: 'A decision is waiting for your confirmation', body: `${p.name}: ${user.name} marked “${m.body.slice(0, 100)}” as a decision.`, link: `/projects/${p.id}/decisions`, projectId: p.id, at })
    void t
  })
}

// ─── Calls (simulated LiveKit) ──────────────────────────────────────────

export async function startCall(chatId: ID, kind: 'voice' | 'video') {
  return act((s, _t, at) => {
    const user = me(s)
    const chat = s.chats.find((c) => c.id === chatId)
    if (!chat || !canSee(s, chat, user)) throw new ApiError(403, 'Only project members can join calls.')
    if (s.calls.some((c) => c.chatId === chatId && !c.endedAt)) fail('A call is already running in this chat. Join it instead.')
    const p = chat.projectId ? projectOf(s, chat.projectId) : undefined
    const others = (chat.memberIds ?? p?.members.filter((m) => m.isHead).map((m) => m.userId) ?? []).filter((id) => id !== user.id).slice(0, 3)
    const id = newId('call')
    s.calls.push({ id, chatId, kind, startedBy: user.id, startedAt: at, transcription: false, participantIds: [user.id, ...others] })
    s.messages.push({ id: newId('msg'), chatId, authorId: null, kind: 'call', body: `${kind === 'video' ? 'Video' : 'Voice'} call started by ${user.name}.`, createdAt: at })
    return id
  })
}

export async function setTranscription(callId: ID, on: boolean) {
  return act((s, _t, at) => {
    const user = me(s)
    const call = s.calls.find((c) => c.id === callId)
    if (!call || call.endedAt) fail('The call has ended.')
    if (call.startedBy !== user.id) throw new ApiError(403, 'Only the person who started the meeting can switch transcription on or off.')
    call.transcription = on
    s.messages.push({ id: newId('msg'), chatId: call.chatId, authorId: null, kind: 'system', body: on ? 'Transcription switched on. Everyone sees “This meeting is being transcribed”.' : 'Transcription switched off.', createdAt: at })
  })
}

export async function joinCall(callId: ID) {
  return act((s) => {
    const user = me(s)
    const call = s.calls.find((c) => c.id === callId)
    if (!call || call.endedAt) fail('The call has ended.')
    if (!call.participantIds.includes(user.id)) call.participantIds.push(user.id)
  })
}

export async function endCall(callId: ID) {
  const ended = await act((s, _t, at) => {
    const user = me(s)
    const call = s.calls.find((c) => c.id === callId)
    if (!call || call.endedAt) fail('The call has already ended.')
    call.endedAt = at
    s.messages.push({ id: newId('msg'), chatId: call.chatId, authorId: null, kind: 'call', body: `Call ended by ${user.name} (${Math.max(1, Math.round((new Date(at).getTime() - new Date(call.startedAt).getTime()) / 60000))} min).`, createdAt: at })
    return { ...call, userId: user.id }
  })
  if (ended.transcription) await transcribeInto(ended.chatId, ended.userId, ended.participantIds, { callId })
  return ended
}

/** Audio upload as a transcript source (demo without a live call). */
export async function uploadAudio(chatId: ID, fileName: string) {
  const user = await read((s) => me(s))
  const s0 = await read((s) => s)
  const chat = s0.chats.find((c) => c.id === chatId)
  if (!chat?.projectId) fail('Audio can be added to project and document chats.')
  const p = projectOf(s0, chat.projectId)
  return transcribeInto(chatId, user.id, p.members.filter((m) => m.isHead).map((m) => m.userId), { fileName })
}

async function transcribeInto(chatId: ID, byUserId: ID, participantIds: ID[], source: { callId?: ID; fileName?: string }) {
  const s0 = await read((s) => s)
  const chat = s0.chats.find((c) => c.id === chatId)!
  const p = projectOf(s0, chat.projectId!)
  const result = transcribe(p, participantIds)
  return runJob({
    agent: 'transcribe',
    title: source.fileName ? `Transcribing ${source.fileName}` : 'Transcribing the meeting',
    projectId: p.id,
    byUserId,
    link: chat.kind === 'document' ? `/projects/${p.id}/chat/${chatId}` : `/projects/${p.id}/chat/${chatId}`,
    promptTokens: 1800,
    steps: [source.fileName ? 'Reading the audio file' : 'Collecting each speaker’s audio track', 'Splitting the audio into 30-second chunks', 'Transcribing with BanglaASR on the CPU', 'Correcting recognition mistakes with the LLM', 'Extracting candidate decisions'],
    apply: (s) => {
      const at = nowIso()
      const trId = newId('tr')
      s.transcripts.push({ id: trId, chatId, projectId: p.id, source: source.callId ? 'call' : 'upload', callId: source.callId, fileName: source.fileName, createdAt: at, segments: result.segments.map((x) => ({ ...x, speaker: nameOf(s, x.speakerId) })) })
      s.messages.push({ id: newId('msg'), chatId, authorId: null, kind: 'transcript', transcriptId: trId, body: 'Meeting transcript (corrected by AI, raw transcript kept).', createdAt: at })
      for (const d of result.decisions) s.decisions.push({ id: newId('dec'), projectId: p.id, source: 'transcript', chatId, transcriptId: trId, text: d.text, ai: true, status: 'pending', factKey: 'factKey' in d ? (d.factKey as string | undefined) : undefined, createdAt: at })
      const pm = headOf(projectOf(s, p.id), 'PM')!
      notify(s, { to: [pm.userId], type: 'decision', title: `${result.decisions.length} decision${result.decisions.length > 1 ? 's' : ''} from a meeting await your confirmation`, body: `${p.name}: the AI found candidate decisions in the transcript.`, link: `/projects/${p.id}/decisions`, projectId: p.id, at })
      audit(s, { projectId: p.id, actorId: null, action: 'AI generation', details: `Transcript with ${result.segments.length} segments and ${result.decisions.length} candidate decisions`, at })
      return `Transcript saved to the chat. ${result.decisions.length} candidate decisions sent to the PM.`
    },
  })
}

export { now }
