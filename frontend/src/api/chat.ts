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
import { actAsHead, can, headOf, inTeam, isAway, isOwner, memberOf, roleLabel } from '../rules/permissions'
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

/** When this person last read the chat (messages from before the demo started count as read). */
function lastRead(s: DemoState, userId: ID, chatId: ID): string {
  return s.chatReads?.[`${userId}:${chatId}`] ?? s.meta.seedNow
}

function unreadIn(s: DemoState, userId: ID, chatId: ID): number {
  const since = lastRead(s, userId, chatId)
  return s.messages.filter((m) => m.chatId === chatId && m.authorId !== userId && m.createdAt > since && (m.kind === 'text' || m.kind === 'transcript')).length
}

export interface Conversation {
  id: ID
  kind: Chat['kind']
  title: string
  subtitle: string
  projectId: ID | null
  projectName?: string
  docType?: string
  otherUserId?: ID
  away?: boolean
  unavailable?: boolean
  unread: number
  callActive: boolean
  last?: { body: string; authorName: string; mine: boolean; createdAt: string }
}

/**
 * Everything I can chat in, split like Slack and Messenger: group channels (one per project and
 * one per document) and direct messages (one-to-one, including people from past projects).
 */
export async function conversations() {
  return read((s, t) => {
    const user = me(s)
    const list: Conversation[] = []
    for (const c of s.chats) {
      if (!canSee(s, c, user)) continue
      const p = c.projectId ? s.projects.find((x) => x.id === c.projectId) : undefined
      if ((c.kind === 'project' || c.kind === 'document') && (!p || p.status !== 'active' || p.finished)) continue
      const last = s.messages.filter((m) => m.chatId === c.id && m.kind !== 'system').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
      const other = c.memberIds?.find((id) => id !== user.id)
      const otherUser = other ? s.users.find((u) => u.id === other) : undefined
      const doc = c.docId ? s.docs.find((d) => d.id === c.docId) : undefined
      const awayIn = other ? s.projects.some((pp) => isAway(pp, other, t)) : false
      list.push({
        id: c.id,
        kind: c.kind,
        title: c.kind === 'direct' || c.kind === 'rag_dm' ? nameOf(s, other) : doc ? DOC_LABEL[doc.type] : 'Project chat',
        subtitle: c.kind === 'rag_dm' ? `About a similar past project · ${p?.name ?? ''}` : c.kind === 'direct' ? otherUser?.title ?? '' : p?.name ?? '',
        projectId: c.projectId,
        projectName: p?.name,
        docType: doc?.type,
        otherUserId: other,
        away: awayIn,
        unavailable: otherUser?.deactivated,
        unread: unreadIn(s, user.id, c.id),
        callActive: s.calls.some((x) => x.chatId === c.id && !x.endedAt),
        last: last ? { body: last.kind === 'transcript' ? 'Meeting transcript' : last.body, authorName: last.authorId ? nameOf(s, last.authorId) : '', mine: last.authorId === user.id, createdAt: last.createdAt } : undefined,
      })
    }
    const byRecent = (a: Conversation, b: Conversation) => (b.last?.createdAt ?? '').localeCompare(a.last?.createdAt ?? '')
    const channels = list.filter((c) => c.kind === 'project' || c.kind === 'document').sort((a, b) => (a.projectName ?? '').localeCompare(b.projectName ?? '') || (a.kind === 'project' ? -1 : b.kind === 'project' ? 1 : 0) || byRecent(a, b))
    const direct = list.filter((c) => c.kind === 'direct' || c.kind === 'rag_dm').sort(byRecent)
    return { channels, direct, unread: list.reduce((n, c) => n + c.unread, 0) }
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
    const memberIds = chat.memberIds ?? p?.members.map((m) => m.userId) ?? []
    const messages = s.messages.filter((m) => m.chatId === chatId).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    const other = chat.kind === 'direct' || chat.kind === 'rag_dm' ? chat.memberIds?.find((id) => id !== user.id) : undefined
    const myLast = [...messages].reverse().find((m) => m.authorId === user.id)
    const doc = chat.docId ? s.docs.find((d) => d.id === chat.docId) : undefined
    return {
      chat: { ...chat, title: chatTitle(s, chat, user.id) },
      project: p,
      doc: doc ? { type: doc.type, label: DOC_LABEL[doc.type] } : undefined,
      messages: messages.map((m) => ({
        ...m,
        authorName: m.authorId ? nameOf(s, m.authorId) : 'System',
        decision: m.decisionId ? s.decisions.find((d) => d.id === m.decisionId) : undefined,
        reactionList: Object.entries(m.reactions ?? {}).filter(([, ids]) => ids.length).map(([emoji, ids]) => ({ emoji, count: ids.length, mine: ids.includes(user.id), names: ids.map((id) => nameOf(s, id)) })),
      })),
      transcripts: s.transcripts.filter((x) => x.chatId === chatId),
      call: call ? { ...call, participants: call.participantIds.map((id) => ({ id, name: nameOf(s, id) })), startedByName: nameOf(s, call.startedBy) } : undefined,
      members: memberIds.map((id) => {
        const m = p ? memberOf(p, id) : undefined
        return { id, name: nameOf(s, id), role: p && m ? roleLabel(p, id) : s.users.find((u) => u.id === id)?.title ?? '', away: p ? isAway(p, id, t) : false }
      }),
      other: other ? { id: other, name: nameOf(s, other), title: s.users.find((u) => u.id === other)?.title ?? '', unavailable: !!s.users.find((u) => u.id === other)?.deactivated } : undefined,
      seenByOther: !!(other && myLast && lastRead(s, other, chatId) >= myLast.createdAt),
      decisions: s.decisions.filter((d) => d.chatId === chatId).map((d) => ({ ...d, decidedByName: d.decidedBy ? nameOf(s, d.decidedBy) : undefined })),
      unread: unreadIn(s, user.id, chatId),
      canPost: p ? p.status === 'active' || chat.kind === 'rag_dm' || chat.kind === 'direct' : true,
      canMarkDecision: !!p,
      isPm: p ? actAsHead(p, 'PM', user.id, t).ok : false,
    }
  })
}

export async function markRead(chatId: ID) {
  const user = await read((s) => me(s))
  const unread = await read((s) => unreadIn(s, user.id, chatId))
  if (!unread) return
  return act((s, _t, at) => {
    s.chatReads = { ...(s.chatReads ?? {}), [`${user.id}:${chatId}`]: at }
  })
}

/** Emoji reactions, like most chat apps. Click again to remove yours. */
export async function react(messageId: ID, emoji: string) {
  return act((s) => {
    const user = me(s)
    const m = s.messages.find((x) => x.id === messageId)
    if (!m) fail('Message not found.')
    const chat = s.chats.find((c) => c.id === m.chatId)!
    if (!canSee(s, chat, user)) throw new ApiError(403, 'You are not part of this conversation.')
    const who = m.reactions?.[emoji] ?? []
    m.reactions = { ...(m.reactions ?? {}), [emoji]: who.includes(user.id) ? who.filter((x) => x !== user.id) : [...who, user.id] }
  })
}

export async function postMessage(chatId: ID, body: string) {
  return act((s, _t, at) => {
    const user = me(s)
    const chat = s.chats.find((c) => c.id === chatId)
    if (!chat || !canSee(s, chat, user)) throw new ApiError(403, 'You are not part of this conversation.')
    if (chat.projectId && (chat.kind === 'project' || chat.kind === 'document')) ensure(can.change(projectOf(s, chat.projectId)))
    if (!body.trim()) fail('Write a message.')
    s.messages.push({ id: newId('msg'), chatId, authorId: user.id, body: body.trim(), createdAt: at, kind: 'text' })
    s.chatReads = { ...(s.chatReads ?? {}), [`${user.id}:${chatId}`]: at }
    if (chat.kind === 'direct' || chat.kind === 'rag_dm')
      notify(s, { to: chat.memberIds!.filter((id) => id !== user.id), type: 'message', title: `New message from ${user.name}`, body: body.trim().slice(0, 140), link: `/messages/${chatId}`, at, email: false })
    else if (chat.projectId) {
      // @mentions in group channels notify the person mentioned.
      const p = projectOf(s, chat.projectId)
      const mentioned = p.members.map((m) => m.userId).filter((id) => id !== user.id && body.includes(`@${nameOf(s, id)}`))
      if (mentioned.length) notify(s, { to: mentioned, type: 'mention', title: `${user.name} mentioned you in ${chatTitle(s, chat, user.id)}`, body: body.trim().slice(0, 140), link: `/messages/${chatId}`, projectId: p.id, at, email: false })
    }
  })
}

/** Opens (or creates) a one-to-one conversation. It is linked to a shared project so decisions can be marked. */
export async function startDirect(otherId: ID) {
  return act((s) => {
    const user = me(s)
    if (otherId === user.id) fail('Choose someone else.')
    const other = s.users.find((u) => u.id === otherId)
    if (!other || other.deactivated) fail('This account is deactivated.')
    const existing = s.chats.find((c) => c.kind === 'direct' && c.memberIds?.includes(user.id) && c.memberIds.includes(otherId))
    if (existing) return existing.id
    const shared = s.projects.find((p) => p.status === 'active' && !p.finished && memberOf(p, user.id) && memberOf(p, otherId))
    const id = newId('chat')
    s.chats.push({ id, projectId: shared?.id ?? null, kind: 'direct', memberIds: [user.id, otherId] })
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
    link: `/messages/${chatId}`,
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
