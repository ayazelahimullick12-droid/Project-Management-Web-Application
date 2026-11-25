/**
 * Simple view · Questions & facts: one chat, in the centre of the page, with the Fact Sheet beside it.
 * It replaces the separate Description and Q/A tabs (the full intake tools are under "Details").
 *
 * The conversation, step by step (supervisor's process, November 2026):
 *  1. The AI asks what the project needs; a stakeholder (or the PM team) describes it and can attach files.
 *  2. The PM lets the AI read it: the AI fills the Fact Sheet and says whether this looks like an
 *     UPDATE to an existing application or a NEW project, with its reason.
 *  3. The PM approves (or changes) that.
 *  4. The AI asks about missing facts in "grill me" style: one question at a time, at most 3 per stage.
 *     Each question goes to the person or team it is about; the PM and the Owner can answer any.
 *  5. Then the PM sends the facts to the stakeholder head to confirm → the Proposal & Charter.
 *  Before the BRD and before the SRS, up to 3 more questions are asked in that document's own tab
 *  (DocQuestions), so each document runs its own steps in one place.
 *
 * Data: api/intake.ts (getIntake, saveDescription, runAnalysis, approveKind, askNextChatQuestion,
 * answerQuestion, requestConfirmation, confirmFactSheet).
 */
import { clsx } from 'clsx'
import { ArrowUp, Check, ChevronRight, FileText, Paperclip, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useAction, useApi } from '../api/hooks'
import { Avatar, Button, ErrorBox, LinkButton, Loading, Segmented } from '../components/ui'
import { FileButton } from '../components/FileButton'
import { FactsTab } from '../pages/intake/FactsTab'

type Data = Awaited<ReturnType<typeof api.intake.getIntake>>
type Stage = 'intake' | 'brd_business' | 'srs_technical'

const STAGES: { id: Stage; title: string; intro: string; doneText: string; next: { label: string; to: string } }[] = [
  {
    id: 'intake',
    title: 'For the Proposal & Charter',
    intro: 'Tell me about the project: what do you need, and why? Who will use it, how many people, and the budget and deadline if you know them. You can also attach documents.',
    doneText: 'That is what I need for the Proposal & Charter.',
    next: { label: 'Open the Proposal & Charter', to: 'docs/PROPOSAL' },
  },
  {
    id: 'brd_business',
    title: 'Before the BRD',
    intro: 'Before I write the BRD, a few questions (at most 3) about how the work is done today and how it should work.',
    doneText: 'That is what I need. The BRD can be written now.',
    next: { label: 'Open the BRD', to: 'docs/BRD' },
  },
  {
    id: 'srs_technical',
    title: 'Before the SRS',
    intro: 'Before I write the SRS, a few technical questions (at most 3) for the tech team.',
    doneText: 'That is what I need. The SRS can be written now.',
    next: { label: 'Open the SRS', to: 'docs/SRS' },
  },
]

// ─── Chat pieces ────────────────────────────────────────────────────────

function AiMessage({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand" aria-hidden>
        <Sparkles className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-muted">AI assistant</div>
        <div className="mt-1 rounded-2xl rounded-tl-md bg-paper px-4 py-3 text-base leading-relaxed ring-1 ring-line">{children}</div>
        {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  )
}

function PersonMessage({ name, children, note }: { name: string; children: ReactNode; note?: ReactNode }) {
  return (
    <div className="flex items-start justify-end gap-3">
      <div className="min-w-0 max-w-[85%]">
        <div className="text-right text-sm font-medium text-muted">{name}</div>
        <div className="mt-1 rounded-2xl rounded-tr-md bg-brand-soft px-4 py-3 text-base leading-relaxed whitespace-pre-wrap">{children}</div>
        {note && <div className="mt-1 text-right text-sm text-muted">{note}</div>}
      </div>
      <Avatar name={name} id={name} size={36} />
    </div>
  )
}

/** A quiet line in the conversation: a step done, or who it is waiting for. */
function StatusNote({ tone = 'wait', children }: { tone?: 'wait' | 'done'; children: ReactNode }) {
  return (
    <div className={clsx('flex items-center justify-center gap-2 text-center text-sm', tone === 'done' ? 'text-leaf' : 'text-muted')}>
      {tone === 'done' && <Check className="h-4 w-4" />}
      <span>{children}</span>
    </div>
  )
}

/** The AI is typing: three dots in a bubble. */
function Typing({ label }: { label: string }) {
  return (
    <div className="flex items-start gap-3" role="status" aria-label={label}>
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand" aria-hidden>
        <Sparkles className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <div className="text-sm font-medium text-muted">AI assistant</div>
        <div className="mt-1 inline-flex items-center gap-1.5 rounded-2xl rounded-tl-md bg-paper px-4 py-3.5 ring-1 ring-line">
          {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-muted/70" style={{ animationDelay: `${i * 150}ms` }} />)}
          <span className="ml-2 text-sm text-muted">{label}</span>
        </div>
      </div>
    </div>
  )
}

/**
 * The message box at the bottom of the chat, as in ChatGPT or Claude: Enter sends, Shift+Enter is a
 * new line, the round button sends. `chips` are quick replies shown above it; `attach` sits beside it.
 * When nothing is waiting for this person, it shows why (disabled).
 */
function ChatInput({ placeholder, disabledReason, onSend, busy, chips, attach, initial = '', resetKey }: { placeholder?: string; disabledReason?: string; onSend?: (text: string) => void; busy?: boolean; chips?: ReactNode; attach?: ReactNode; initial?: string; resetKey?: string }) {
  const [text, setText] = useState(initial)
  const box = useRef<HTMLTextAreaElement>(null)
  useEffect(() => setText(initial), [resetKey, initial])
  const off = !!disabledReason
  useEffect(() => {
    const el = box.current
    if (!el) return
    el.style.height = 'auto'
    if (text && !off) el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [text, off])
  const send = () => {
    if (!text.trim() || busy || off || !onSend) return
    onSend(text.trim())
    setText('')
  }
  return (
    <div className="shrink-0 border-t border-line bg-canvas/80 p-3 sm:p-4">
      {chips && !off && <div className="mb-2 flex flex-wrap gap-2">{chips}</div>}
      <div className={clsx('flex items-end gap-2 rounded-3xl bg-paper px-3 py-2 ring-1 transition', off ? 'ring-line' : 'ring-brand/40 focus-within:ring-2 focus-within:ring-brand')}>
        {attach}
        <textarea
          ref={box}
          rows={1}
          value={off ? '' : text}
          disabled={off}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          placeholder={off ? disabledReason : placeholder}
          aria-label={off ? disabledReason : placeholder}
          className="max-h-[200px] min-h-[2.75rem] flex-1 resize-none bg-transparent px-1 py-2.5 text-base outline-none placeholder:text-muted disabled:cursor-not-allowed"
        />
        <button type="button" onClick={send} disabled={off || busy || !text.trim()} aria-label="Send" className="mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white transition hover:brightness-110 disabled:bg-ink/15 disabled:text-muted">
          <ArrowUp className="h-5 w-5" />
        </button>
      </div>
      {!off && <p className="mt-1.5 px-2 text-xs text-muted">Enter to send · Shift+Enter for a new line</p>}
    </div>
  )
}

const chip = 'rounded-full bg-paper px-3 py-1.5 text-sm ring-1 ring-line hover:bg-brand-soft disabled:opacity-50'

/**
 * What the message box is for right now: describing the need (no request yet, or editing it),
 * answering the AI's open question, or nothing (with the reason).
 */
function useChatInput(data: Data | undefined, pid: string, stage: Stage, opts: { editing?: boolean; onDescribed?: () => void; onAnswered: () => void; busyReason?: string }) {
  const save = useAction((text: string) => api.intake.saveDescription(pid, text), { onDone: () => opts.onDescribed?.() })
  const answer = useAction(api.intake.answerQuestion, { onDone: opts.onAnswered })
  if (!data) return null
  const open = chatQuestions(data, stage).find((q) => !q.answeredAt)
  const describing = stage === 'intake' && (!data.project.intake.description || opts.editing)
  if (describing && data.perms.editDescription)
    return { kind: 'describe' as const, placeholder: data.project.intake.description ? 'Change what you need, then send' : 'Describe what you need…', onSend: (t: string) => save.run(t), busy: save.pending, initial: opts.editing ? data.project.intake.description : '', resetKey: `d-${opts.editing}` }
  if (opts.busyReason) return { kind: 'off' as const, disabledReason: opts.busyReason }
  if (describing) return { kind: 'off' as const, disabledReason: 'Waiting for the stakeholders to describe what they need' }
  if (open?.canAnswer)
    return {
      kind: 'answer' as const,
      placeholder: 'Type your answer',
      onSend: (t: string) => answer.run(open.id, { text: t, unknown: false }),
      busy: answer.pending,
      resetKey: open.id,
      chips: (
        <>
          <button type="button" className={chip} disabled={answer.pending} onClick={() => answer.run(open.id, { text: '', unknown: true })}>I don't know</button>
          {open.sampleAnswer && <button type="button" className={chip} disabled={answer.pending} onClick={() => answer.run(open.id, { text: open.sampleAnswer!, unknown: false })} title="Prototype only">Use a sample answer (demo)</button>}
        </>
      ),
    }
  if (open) return { kind: 'off' as const, disabledReason: `Waiting for ${open.assigneeNames.length ? open.assigneeNames.join(' or ') : open.teamLabel} to answer` }
  return { kind: 'off' as const, disabledReason: stageDone(data, stage) ? 'This part of the chat is finished' : 'Nothing to answer right now' }
}

// ─── One question in the chat ───────────────────────────────────────────

function QuestionTurn({ q, factLabel }: { q: Data['questions'][number]; factLabel?: string }) {
  const waitingFor = q.assigneeNames.length ? q.assigneeNames.join(' or ') : q.teamLabel
  return (
    <>
      <AiMessage>
        <p>{q.text}</p>
        <p className="mt-1 text-sm text-muted">
          {factLabel && <>Fills in: <b className="font-medium text-ink">{factLabel}</b> · </>}
          For: {q.teamLabel}
          {q.assigneeNames.length ? ` (${q.assigneeNames.join(', ')})` : ''}
        </p>
      </AiMessage>
      {q.answeredAt ? (
        <PersonMessage name={q.answeredByName ?? 'Someone'} note={q.coveredAs === 'PM' ? 'Answered by the Project Manager' : q.coveredAs === 'OWNER' ? 'Answered by the Project Owner' : undefined}>
          {q.unknown ? (
            <span>
              I don't know.{q.defaultValue && <span className="text-muted"> (Assumption for now: {q.defaultValue})</span>}
            </span>
          ) : (
            q.answer
          )}
        </PersonMessage>
      ) : q.canAnswer ? null : (
        <StatusNote>Waiting for {waitingFor} to answer.</StatusNote>
      )}
    </>
  )
}

// ─── One stage of the chat ──────────────────────────────────────────────

const stageRounds = (data: Data, stage: Stage) => data.rounds.filter((r) => r.purpose === stage)
const chatQuestions = (data: Data, stage: Stage) => data.questions.filter((q) => stageRounds(data, stage).some((r) => r.id === q.roundId && r.chat)).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
const earlierQuestions = (data: Data, stage: Stage) => data.questions.filter((q) => stageRounds(data, stage).some((r) => r.id === q.roundId && !r.chat))
const stageDone = (data: Data, stage: Stage) => stageRounds(data, stage).some((r) => r.chat && r.status === 'closed') || (stage !== 'intake' && stageRounds(data, stage).some((r) => r.status === 'closed'))

/** Moves the chat on: the AI asks the next question (or closes the stage after 3). */
function useAskNext(pid: string) {
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const askNext = async () => {
    setAsking(true)
    setError(null)
    try {
      await api.intake.askNextChatQuestion(pid)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The AI did not answer.')
    } finally {
      setAsking(false)
    }
  }
  return { asking, error, askNext }
}

function StageBlock({ st, data, pid, chat, intakeBody, openFacts, showNext = true }: { st: (typeof STAGES)[number]; data: Data; pid: string; chat: ReturnType<typeof useAskNext>; intakeBody?: ReactNode; openFacts?: () => void; showNext?: boolean }) {
  const qs = chatQuestions(data, st.id)
  const done = stageDone(data, st.id)
  const isCurrent = data.chatStage === st.id
  const pending = qs.some((q) => !q.answeredAt)
  const canMoveOn = isCurrent && !done && !pending && (st.id !== 'intake' || !!data.kind?.approvedBy)
  const earlier = earlierQuestions(data, st.id)
  // Like an AI assistant, it asks the next question by itself (once per step)
  const asked = useRef('')
  useEffect(() => {
    const key = `${st.id}:${qs.length}`
    if (canMoveOn && !chat.asking && !chat.error && asked.current !== key) {
      asked.current = key
      void chat.askNext()
    }
  }, [canMoveOn, chat, qs.length, st.id])
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 text-sm font-semibold text-muted">
        <span className="h-px flex-1 bg-line" />
        {st.title}
        <span className="h-px flex-1 bg-line" />
      </div>
      <AiMessage>{st.intro}</AiMessage>
      {intakeBody}
      {st.id !== 'intake' && earlier.length > 0 && <EarlierQuestions questions={earlier} />}
      {qs.map((q) => (
        <QuestionTurn key={q.id} q={q} factLabel={data.facts.find((f) => f.key === q.factKey)?.label} />
      ))}

      {/* Not this stage's turn yet */}
      {!isCurrent && !done && st.id !== 'intake' && <StatusNote>{st.id === 'brd_business' ? 'These questions start when the Proposal & Charter is signed.' : 'These questions start when the BRD is signed.'}</StatusNote>}

      {/* Moving on: the AI thinking, an error, or a button to continue */}
      {isCurrent && chat.asking && <Typing label={qs.length ? 'Thinking of the next question…' : 'Thinking of a question…'} />}
      {isCurrent && chat.error && !chat.asking && (
        <AiMessage actions={<Button onClick={() => void chat.askNext()}>Try again</Button>}>
          <span className="text-red-700">{chat.error}</span>
        </AiMessage>
      )}

      {/* The stage is done */}
      {done && (
        <AiMessage>
          {st.doneText}
          {st.id === 'intake' && data.project.intake.gapsLogged?.factKeys.length ? (
            <span className="mt-1 block text-muted">
              Still unknown, written as assumptions for now: {data.facts.filter((f) => data.project.intake.gapsLogged!.factKeys.includes(f.key)).map((f) => f.label).join(', ')}. You can change them in the Fact Sheet.
            </span>
          ) : null}
        </AiMessage>
      )}
      {done && st.id === 'intake' && openFacts && <ConfirmNote data={data} openFacts={openFacts} />}
      {showNext && done && (st.id !== 'intake' || data.confirmed) && (
        <div className="flex justify-center">
          <LinkButton to={`/projects/${pid}/${st.next.to}`} variant="primary" size="lg">
            {st.next.label} <ChevronRight className="h-5 w-5" />
          </LinkButton>
        </div>
      )}
    </div>
  )
}

/**
 * The BRD's or the SRS's own questions, shown in that document's tab before it is written
 * (step 1 of the document). Up to 3 questions; then the document can be written.
 */
export function DocQuestions({ pid, stage }: { pid: string; stage: 'brd_business' | 'srs_technical' }) {
  const { data, isLoading, error } = useApi(['intake', pid], () => api.intake.getIntake(pid))
  const chat = useAskNext(pid)
  const box = useRef<HTMLDivElement>(null)
  const turns = data?.questions.length ?? 0
  const input = useChatInput(data, pid, stage, { onAnswered: () => void chat.askNext(), busyReason: chat.asking ? 'The AI is thinking…' : undefined })
  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight
  }, [turns, chat.asking])
  if (isLoading) return <Loading />
  if (error || !data) return <ErrorBox error={error} />
  const st = STAGES.find((x) => x.id === stage)!
  return (
    <section aria-label="Questions" className="flex max-h-[34rem] flex-col overflow-hidden rounded-3xl bg-canvas/60 ring-1 ring-line">
      <div ref={box} className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-4 sm:p-6">
        <StageBlock st={st} data={data} pid={pid} chat={chat} showNext={false} />
      </div>
      {input && (input.kind !== 'off' || data.chatStage === stage) && <ChatInput {...input} />}
    </section>
  )
}

// ─── The page ───────────────────────────────────────────────────────────

export function SimpleIntakePage() {
  const { pid = '' } = useParams()
  const { data, isLoading, error } = useApi(['intake', pid], () => api.intake.getIntake(pid))
  const [editing, setEditing] = useState(false)
  const chat = useAskNext(pid)
  // The chat scrolls inside its own box, so the history is there without scrolling the page
  const chatBox = useRef<HTMLDivElement>(null)
  // Two tabs: the chat (the main thing) and the Fact Sheet it fills in
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'facts' ? 'facts' : 'chat'

  const upload = useAction((f: Parameters<typeof api.intake.upload>[1]) => api.intake.upload(pid, f), { success: 'File attached. The AI reads it with your message.' })
  // As soon as the request is sent (or changed), the AI reads it: no button
  const analyse = useAction(() => api.intake.runAnalysis(pid))
  const input = useChatInput(data, pid, 'intake', {
    editing,
    onDescribed: () => {
      setEditing(false)
      analyse.run()
    },
    onAnswered: () => void chat.askNext(),
    busyReason: data?.analysing ? 'The AI is reading your request…' : chat.asking ? 'The AI is thinking…' : undefined,
  })

  const approveKind = useAction((value: 'new' | 'update') => api.intake.approveKind(pid, value), { onDone: () => void chat.askNext() })

  const turns = data?.questions.length ?? 0
  const loaded = !!data
  useEffect(() => {
    const box = chatBox.current
    if (box) box.scrollTop = box.scrollHeight // start at the latest message
  }, [turns, chat.asking, tab, loaded, data?.analysing, data?.project.intake.analysed])

  if (isLoading) return <Loading />
  if (error || !data) return <ErrorBox error={error} />

  const p = data.project
  const earlier = earlierQuestions(data, 'intake')
  const kindLabel = data.kind?.value === 'update' ? 'an update to an existing application' : 'a new project'

  const intakeBody = (
    <>
      {/* 1. The request */}
      {p.intake.description && !editing ? (
        <PersonMessage name={data.descriptionByName ?? 'Stakeholder'} note={data.perms.editDescription && !data.analysing && <button className="font-medium text-brand underline" onClick={() => setEditing(true)}>Edit</button>}>
          {p.intake.description}
          {data.uploads.length > 0 && (
            <span className="mt-3 flex flex-wrap gap-2">
              {data.uploads.map((u) => (
                <span key={u.id} className="inline-flex items-center gap-1.5 rounded-lg bg-paper px-2.5 py-1 text-sm ring-1 ring-line">
                  <FileText className="h-4 w-4 text-muted" /> {u.name}
                </span>
              ))}
            </span>
          )}
        </PersonMessage>
      ) : !data.perms.editDescription ? (
        <StatusNote>Waiting for the stakeholders to describe what they need.</StatusNote>
      ) : null}

      {/* 2. The AI reads it, by itself */}
      {data.analysing && <Typing label={`Reading your request${data.uploads.length ? ' and the files' : ''}…`} />}
      {!data.analysing && data.analyseError && p.intake.description && (
        <AiMessage actions={<Button onClick={() => analyse.run()}>Try again</Button>}>
          <span className="text-red-700">I could not read it just now (the AI did not answer).</span>
        </AiMessage>
      )}
      {!data.analysing && !data.analyseError && p.intake.description && !p.intake.analysed && !editing && !analyse.pending && (
        <AiMessage actions={<Button onClick={() => analyse.run()}>Read it now</Button>}>Your request is saved. I have not read it yet.</AiMessage>
      )}

      {/* 3. Facts found, and: update or new? */}
      {p.intake.analysed && (
        <AiMessage>
          I read it and filled in {data.facts.filter((f) => f.status === 'filled').length} facts (see the Fact Sheet tab).{' '}
          {data.intakeMissing ? `${data.intakeMissing} are still missing; I will ask about the most important ones, at most ${data.chatLimit} questions.` : 'Nothing important is missing.'}
        </AiMessage>
      )}
      {p.intake.analysed && data.kind && (
        <>
          <AiMessage
            actions={
              !data.kind.approvedBy &&
              data.perms.pm && (
                <>
                  <Button variant="primary" disabled={approveKind.pending} onClick={() => approveKind.run(data.kind!.value)}>
                    Yes, it is {data.kind.value === 'update' ? 'an update' : 'a new project'}
                  </Button>
                  <Button disabled={approveKind.pending} onClick={() => approveKind.run(data.kind!.value === 'update' ? 'new' : 'update')}>
                    No, it is {data.kind.value === 'update' ? 'a new project' : 'an update'}
                  </Button>
                </>
              )
            }
          >
            {data.kind.ai || !data.kind.approvedBy ? (
              <>
                I think this is <b>{kindLabel}</b>. {data.kind.reason}
                {!data.kind.approvedBy && ' Is that right?'}
              </>
            ) : (
              <>
                This is <b>{kindLabel}</b>.
              </>
            )}
          </AiMessage>
          {data.kind.approvedBy ? (
            <StatusNote tone="done">
              {data.kind.value === 'update' ? 'Update to an existing application' : 'New project'}: confirmed by {data.kind.approvedByName}
            </StatusNote>
          ) : (
            !data.perms.pm && <StatusNote>Waiting for the Project Manager to confirm.</StatusNote>
          )}
        </>
      )}
      {p.intake.analysed && !data.kind && data.perms.pm && (
        <AiMessage
          actions={
            <>
              <Button onClick={() => approveKind.run('update')}>An update</Button>
              <Button onClick={() => approveKind.run('new')}>A new project</Button>
            </>
          }
        >
          Is this an update to an existing application, or a new project?
        </AiMessage>
      )}
      {earlier.length > 0 && <EarlierQuestions questions={earlier} />}
    </>
  )

  return (
    <div>
      {/* No visible title: the tab bar already says where you are, and the chat gets the room */}
      <h1 className="sr-only">Questions & facts</h1>
      <div className="mx-auto max-w-5xl space-y-4">
        <Segmented
          value={tab}
          onChange={(x) => setParams(x === 'facts' ? { tab: 'facts' } : {}, { replace: true })}
          options={[
            { id: 'chat', label: 'Chat' },
            { id: 'facts', label: data.confirmed ? 'Fact Sheet · confirmed' : data.confirmRequested ? 'Fact Sheet · to confirm' : 'Fact Sheet' },
          ]}
        />
        {tab === 'chat' && (
        <section aria-label="Chat" className="min-w-0">
          <div className="flex h-[calc(100dvh-16rem)] min-h-[24rem] flex-col overflow-hidden rounded-3xl bg-canvas/60 ring-1 ring-line">
            <div ref={chatBox} className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-4 sm:p-6">
              <StageBlock st={STAGES[0]} data={data} pid={pid} chat={chat} intakeBody={intakeBody} openFacts={() => setParams({ tab: 'facts' }, { replace: true })} />
            </div>
            {input && (
              <ChatInput
                {...input}
                attach={
                  input.kind === 'describe' && data.perms.upload ? (
                    <FileButton onPick={(file) => upload.run(file)} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.tif,.tiff,.txt,.md,.csv" icon={{ label: 'Attach a file', node: <Paperclip className="h-5 w-5" /> }} />
                  ) : undefined
                }
                chips={input.kind === 'describe' ? (
                  <>
                    {data.uploads.map((u) => <span key={u.id} className="inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-1 text-sm ring-1 ring-line"><FileText className="h-4 w-4 text-muted" /> {u.name}</span>)}
                    {editing && <button type="button" className={chip} onClick={() => setEditing(false)}>Cancel the change</button>}
                  </>
                ) : 'chips' in input ? input.chips : undefined}
              />
            )}
          </div>
        </section>
        )}

        {tab === 'facts' && (
          <div className="space-y-4">
            {data.kind?.approvedBy && (
              <p className="inline-flex rounded-md bg-ink/[0.05] px-2.5 py-1 text-sm font-medium">{data.kind.value === 'update' ? 'Update to an existing application' : 'New project'}</p>
            )}
            {/* The main Fact Sheet: edit, comments, sending it for confirmation and confirming it happen here only */}
            <FactsTab data={data} />
          </div>
        )}
      </div>
    </div>
  )
}

/** The facts are sent and confirmed in the Fact Sheet tab, not in the chat: the chat only points there. */
function ConfirmNote({ data, openFacts }: { data: Data; openFacts: () => void }) {
  if (data.confirmed) return <StatusNote tone="done">The facts are confirmed. The documents are written from them.</StatusNote>
  const text = !data.confirmRequested
    ? data.perms.pm
      ? 'Check the facts in the Fact Sheet tab, then send them to the stakeholder head to confirm.'
      : 'The Project Manager will check the facts and send them to be confirmed.'
    : data.perms.confirm
      ? `Please check and confirm the facts in the Fact Sheet tab${data.perms.coveredAs ? ', in the stakeholder head’s place' : ''}.`
      : 'Waiting for the stakeholder head to confirm the facts in the Fact Sheet tab.'
  return (
    <AiMessage actions={<Button variant="primary" onClick={openFacts}>Open the Fact Sheet</Button>}>
      {text}
    </AiMessage>
  )
}

function EarlierQuestions({ questions }: { questions: Data['questions'] }) {
  return (
    <details className="rounded-2xl bg-paper px-4 py-3 ring-1 ring-line">
      <summary className="cursor-pointer text-base font-medium">Earlier questions ({questions.length})</summary>
      <ul className="mt-3 space-y-3">
        {questions.map((q) => (
          <li key={q.id} className="text-base">
            <div className="font-medium">{q.text}</div>
            <div className="text-muted">{q.answeredAt ? (q.unknown ? 'Not known' : q.answer) : 'Not answered'}</div>
          </li>
        ))}
      </ul>
    </details>
  )
}
