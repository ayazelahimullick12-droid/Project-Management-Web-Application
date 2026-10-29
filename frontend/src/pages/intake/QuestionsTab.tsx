import { CircleCheck, Lock, Play, Send } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../api'
import { useAction } from '../../api/hooks'
import { ROUND_LABEL } from '../../api/intake'
import { AiBadge, AiNote } from '../../components/ai'
import { fmtDateTime } from '../../components/format'
import { OpenQuestion } from '../../components/OpenQuestion'
import { Badge, Button, Card, Checkbox, EmptyState, Guarded, Note, Textarea } from '../../components/ui'
import type { IntakeData } from './IntakePage'
import { MissingPeople } from '../../components/People'

type Q = IntakeData['questions'][number]

export function AnswerBox({ q, onDone }: { q: { id: string; sampleAnswer?: string; defaultValue?: string }; onDone?: () => void }) {
  const [text, setText] = useState('')
  const [unknown, setUnknown] = useState(false)
  const answer = useAction(api.intake.answerQuestion, { success: 'Answer saved to the Fact Sheet.', onDone })
  return (
    <div className="mt-2 rounded-md bg-canvas p-3">
      <Textarea rows={2} disabled={unknown} value={unknown ? '' : text} onChange={(e) => setText(e.target.value)} placeholder="Your answer…" />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Checkbox label={<span>Unknown{q.defaultValue ? <span className="text-muted"> (the agreed default “{q.defaultValue}” is used as an assumption)</span> : ' (stored as an assumption)'}</span>} checked={unknown} onChange={setUnknown} />
        {q.sampleAnswer && !unknown && (
          <button className="text-xs font-medium text-brand hover:underline" onClick={() => setText(q.sampleAnswer!)}>
            Use sample answer (demo)
          </button>
        )}
        <Button size="sm" variant="primary" className="ml-auto" onClick={() => answer.run(q.id, { text, unknown })}>
          <Send className="h-3.5 w-3.5" /> Answer
        </Button>
      </div>
    </div>
  )
}

function QuestionRow({ q, open }: { q: Q; open: boolean }) {
  const [answering, setAnswering] = useState(false)
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{q.text}</div>
          <div className="mt-0.5 text-xs text-muted">
            Routed to <b>{q.teamLabel}</b> ({q.assigneeNames.join(', ')}) · {fmtDateTime(q.createdAt)}
          </div>
        </div>
        <AiBadge label="AI question" />
      </div>
      {q.answeredAt ? (
        <div className="mt-2 flex items-start gap-2 rounded-md bg-leaf-soft/60 px-3 py-2 text-sm">
          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-leaf" />
          <div>
            {q.unknown ? <Badge tone="amber">Unknown → assumption</Badge> : q.answer}
            <div className="text-xs text-muted">
              {q.answeredByName}
              {q.actingFor && ' (as deputy)'} · {fmtDateTime(q.answeredAt)}
            </div>
          </div>
        </div>
      ) : open && q.mine ? (
        answering ? (
          <AnswerBox q={q} onDone={() => setAnswering(false)} />
        ) : (
          <Button size="sm" variant="primary" className="mt-2" onClick={() => setAnswering(true)}>
            Answer this question
          </Button>
        )
      ) : (
        <div className="mt-1 text-xs text-muted">{open ? 'Waiting for an answer. Reminded every 4 working hours.' : 'Not answered in this round.'}</div>
      )}
    </li>
  )
}

export function QuestionsTab({ data }: { data: IntakeData }) {
  const p = data.project
  const start = useAction(api.intake.startRound, { success: 'Checking completeness and writing questions…' })
  const close = useAction(api.intake.closeRound, { success: 'Round closed.' })
  const gaps = useAction(api.intake.logGaps, { success: 'Gaps logged. You can now send the Fact Sheet for confirmation.' })
  const ragDone = !!p.intake.ragRunId
  const duplicateBlocking = data.rag?.run.duplicate && !p.intake.duplicateAck
  const openIntake = data.openRounds.find((r) => r.purpose === 'intake')
  const startCheck = !data.perms.pm
    ? { ok: false, reason: 'The PM starts Q/A rounds.' }
    : !p.intake.analysed
      ? { ok: false, reason: 'Run the intake analysis first.' }
      : duplicateBlocking
        ? { ok: false, reason: 'Acknowledge the duplicate warning on the Similar projects tab first.' }
        : openIntake
          ? { ok: false, reason: 'Close the open round first.' }
          : { ok: true }
  const rounds = [...data.rounds].reverse()

  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <div className="space-y-4">
        {rounds.length === 0 && <EmptyState title="No questions yet">After the intake analysis, the PM starts a round: the Q/A agent writes one question per missing field and routes it to the right team.</EmptyState>}
        {rounds.map((r) => {
          const qs = data.questions.filter((q) => q.roundId === r.id)
          const answered = qs.filter((q) => q.answeredAt).length
          return (
            <Card
              key={r.id}
              title={
                <span className="flex flex-wrap items-center gap-2">
                  {ROUND_LABEL[r.purpose]} · round {r.number}
                  <Badge tone={r.status === 'open' ? 'blue' : 'gray'}>{r.status === 'open' ? 'Open' : 'Closed'}</Badge>
                </span>
              }
              subtitle={`${answered} of ${qs.length} answered · started ${fmtDateTime(r.startedAt)}`}
              actions={
                r.status === 'open' &&
                data.perms.pm && (
                  <Button size="sm" onClick={() => close.run(p.id, r.id)}>
                    <Lock className="h-3.5 w-3.5" /> Close round
                  </Button>
                )
              }
            >
              {qs.length ? <ul className="-my-3 divide-y divide-line">{qs.map((q) => <QuestionRow key={q.id} q={q} open={r.status === 'open'} />)}</ul> : <p className="text-sm text-muted">Nothing was missing, so no questions were needed.</p>}
            </Card>
          )
        })}
      </div>
      <div className="space-y-4">
        <Card title="Intake rounds" subtitle={`${data.intakeRoundCount} of ${data.roundLimit} rounds used · ${data.intakeMissing} required fields still missing`} actions={<OpenQuestion id="rounds" />}>
          <div className="space-y-3">
            {!ragDone && p.intake.analysed && <Note tone="blue">The RAG agent is searching similar projects. Accepted suggestions can mean fewer questions.</Note>}
            {data.atLimit && !openIntake && data.intakeMissing > 0 && !p.intake.gapsLogged ? (
              <div className="space-y-2">
                <Note tone="amber">The round limit is reached and {data.intakeMissing} fields are still missing. The PM decides: ask again, or proceed and log the gaps.</Note>
                {data.perms.pm && (
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => start.run(p.id, 'intake')}>Ask again</Button>
                    <Button variant="primary" onClick={() => gaps.run(p.id)}>
                      Proceed with gaps logged
                    </Button>
                  </div>
                )}
              </div>
            ) : data.missingForQuestions.length && data.intakeMissing > 0 && p.intake.analysed && !openIntake ? (
              <MissingPeople pid={p.id} missing={data.missingForQuestions} canAdd={data.perms.canAddPeople} before="Before the questions can be sent" />
            ) : (
              <Guarded variant="primary" check={data.intakeMissing === 0 && p.intake.analysed ? { ok: false, reason: 'Every required intake field has a value.' } : startCheck} onClick={() => start.run(p.id, 'intake')}>
                <Play className="h-4 w-4" /> {data.intakeRoundCount ? 'Check again and ask the next round' : 'Start the first round'}
              </Guarded>
            )}
            {p.intake.gapsLogged && <Note tone="gray">Proceeding with {p.intake.gapsLogged.factKeys.length} gaps logged.</Note>}
            <AiNote agent="qa_questions" compact />
          </div>
        </Card>
        <Card title="How questions are routed">
          <ul className="space-y-1 text-sm">
            <li>Business questions → <b>Stakeholders</b></li>
            <li>Funding and budget → <b>Sponsors</b></li>
            <li>Technical (performance, security, integrations, hosting) → <b>Tech team</b></li>
          </ul>
          <p className="mt-2 text-xs text-muted">“Unknown” is a valid answer: it is stored as an assumption with an agreed default. Unanswered questions are reminded every 4 working hours.</p>
        </Card>
      </div>
    </div>
  )
}
