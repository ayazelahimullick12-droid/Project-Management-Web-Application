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
import { Check, ChevronRight, FileText, Paperclip, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useAction, useApi } from '../api/hooks'
import { Avatar, Button, ErrorBox, LinkButton, Loading, Segmented, Textarea } from '../components/ui'
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

function Composer({ placeholder, initial = '', submitLabel, onSubmit, extra, busy }: { placeholder: string; initial?: string; submitLabel: string; onSubmit: (text: string) => void; extra?: ReactNode; busy?: boolean }) {
  const [text, setText] = useState(initial)
  return (
    <div className="rounded-2xl bg-paper p-3 ring-2 ring-brand/30">
      <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="!border-0 !bg-transparent !shadow-none !ring-0" />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button variant="primary" disabled={!text.trim() || busy} onClick={() => onSubmit(text)}>
          {busy ? 'Sending…' : submitLabel}
        </Button>
        {extra}
      </div>
    </div>
  )
}

// ─── One question in the chat ───────────────────────────────────────────

function QuestionTurn({ q, factLabel, onAnswered }: { q: Data['questions'][number]; factLabel?: string; onAnswered: () => void }) {
  const answer = useAction(api.intake.answerQuestion, { onDone: onAnswered })
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
      ) : q.canAnswer ? (
        <Composer
          key={q.id}
          placeholder="Your answer"
          submitLabel="Send answer"
          busy={answer.pending}
          onSubmit={(text) => answer.run(q.id, { text, unknown: false })}
          extra={
            <>
              <Button variant="ghost" disabled={answer.pending} onClick={() => answer.run(q.id, { text: '', unknown: true })}>
                I don't know
              </Button>
              {q.sampleAnswer && (
                <Button variant="ghost" disabled={answer.pending} onClick={() => answer.run(q.id, { text: q.sampleAnswer!, unknown: false })} title="Prototype only: answers with a sample">
                  Use a sample answer (demo)
                </Button>
              )}
            </>
          }
        />
      ) : (
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
        <QuestionTurn key={q.id} q={q} factLabel={data.facts.find((f) => f.key === q.factKey)?.label} onAnswered={() => void chat.askNext()} />
      ))}

      {/* Not this stage's turn yet */}
      {!isCurrent && !done && st.id !== 'intake' && <StatusNote>{st.id === 'brd_business' ? 'These questions start when the Proposal & Charter is signed.' : 'These questions start when the BRD is signed.'}</StatusNote>}

      {/* Moving on: the AI thinking, an error, or a button to continue */}
      {isCurrent && chat.asking && (
        <div className="flex items-center gap-3 text-base text-muted">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-brand">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </span>
          The AI is thinking of the next question… (a few seconds)
        </div>
      )}
      {isCurrent && chat.error && !chat.asking && (
        <AiMessage actions={<Button onClick={() => void chat.askNext()}>Try again</Button>}>
          <span className="text-red-700">{chat.error}</span>
        </AiMessage>
      )}
      {canMoveOn && !chat.asking && !chat.error && (
        <div className="flex justify-center">
          <Button variant={qs.length ? 'secondary' : 'primary'} onClick={() => void chat.askNext()}>{qs.length ? 'Next question' : 'Start the questions'}</Button>
        </div>
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
  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight
  }, [turns, chat.asking])
  if (isLoading) return <Loading />
  if (error || !data) return <ErrorBox error={error} />
  const st = STAGES.find((x) => x.id === stage)!
  return (
    <section aria-label="Questions" ref={box} className="max-h-[32rem] space-y-6 overflow-y-auto overscroll-contain rounded-3xl bg-canvas/60 p-4 ring-1 ring-line sm:p-6">
      <StageBlock st={st} data={data} pid={pid} chat={chat} showNext={false} />
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

  const save = useAction((text: string) => api.intake.saveDescription(pid, text), { success: 'Saved.', onDone: () => setEditing(false) })
  const upload = useAction((f: Parameters<typeof api.intake.upload>[1]) => api.intake.upload(pid, f), { success: 'Reading the file in the background…' })
  const analyse = useAction(() => api.intake.runAnalysis(pid), { success: 'The AI is reading it. Progress is shown at the top.' })

  const approveKind = useAction((value: 'new' | 'update') => api.intake.approveKind(pid, value), { onDone: () => void chat.askNext() })

  const turns = data?.questions.length ?? 0
  const loaded = !!data
  useEffect(() => {
    const box = chatBox.current
    if (box) box.scrollTop = box.scrollHeight // start at the latest message
  }, [turns, chat.asking, tab, loaded])

  if (isLoading) return <Loading />
  if (error || !data) return <ErrorBox error={error} />

  const p = data.project
  const earlier = earlierQuestions(data, 'intake')
  const kindLabel = data.kind?.value === 'update' ? 'an update to an existing application' : 'a new project'

  const intakeBody = (
    <>
      {/* 1. The request */}
      {p.intake.description && !editing ? (
        <PersonMessage name={data.descriptionByName ?? 'Stakeholder'} note={data.perms.editDescription && <button className="font-medium text-brand underline" onClick={() => setEditing(true)}>Edit</button>}>
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
      ) : data.perms.editDescription ? (
        <Composer
          initial={p.intake.description}
          placeholder="Describe what you need"
          submitLabel={p.intake.description ? 'Save' : 'Send'}
          busy={save.pending}
          onSubmit={(text) => save.run(text)}
          extra={
            <>
              {data.perms.upload && (
                <FileButton onPick={(f) => upload.run(f)} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.tif,.tiff,.txt,.md,.csv">
                  <Paperclip className="h-4 w-4" /> Attach a file
                </FileButton>
              )}
              {editing && (
                <Button variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              )}
            </>
          }
        />
      ) : (
        <StatusNote>Waiting for the stakeholders to describe what they need.</StatusNote>
      )}

      {/* 2. The AI reads it */}
      {p.intake.description && !p.intake.analysed && !editing && (
        data.perms.pmTeam ? (
          <AiMessage
            actions={
              <Button variant="primary" disabled={analyse.pending} onClick={() => analyse.run()}>
                <Sparkles className="h-4 w-4" /> Let the AI read it
              </Button>
            }
          >
            Thank you. When you are ready, I will read the request{data.uploads.length ? ' and the files' : ''}, fill in the Fact Sheet and tell you whether this looks like an update or a new project.
          </AiMessage>
        ) : (
          <StatusNote>Thank you. The PM will let the AI read it next.</StatusNote>
        )
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
          <div ref={chatBox} className="h-[calc(100dvh-16rem)] min-h-[24rem] space-y-6 overflow-y-auto overscroll-contain rounded-3xl bg-canvas/60 p-4 ring-1 ring-line sm:p-6">
            <StageBlock st={STAGES[0]} data={data} pid={pid} chat={chat} intakeBody={intakeBody} openFacts={() => setParams({ tab: 'facts' }, { replace: true })} />
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
