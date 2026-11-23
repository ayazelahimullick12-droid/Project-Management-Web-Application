/**
 * "Grill me": a button that opens a panel where the AI asks the PM team one pointed question at a
 * time about the weakest part of the plan (the Fact Sheet or a document), up to 8 questions, then
 * shows a summary. The rules and saving are in src/api/grill.ts.
 *
 * Each question: type an answer → "Save answer" (also updates the Fact Sheet, or proposes the
 * update, when the box is ticked), or "I don't know" (recorded as open), or "Skip".
 */
import { Flame, Loader2, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { api } from '../api'
import type { GrillTarget } from '../api/grill'
import { useApi } from '../api/hooks'
import { AiBadge, AiNote } from './ai'
import { Button, Checkbox, Modal, Note, Textarea } from './ui'

const LIMIT = 8

interface Question {
  question: string
  factKey?: string
  factLabel?: string
  factValue?: string
}
interface Turn extends Question {
  answer: string
  outcome: string
}

export function GrillMeButton({ pid, target, size = 'md', label = 'Grill me' }: { pid: string; target: GrillTarget; size?: 'sm' | 'md' | 'lg'; label?: string }) {
  const [open, setOpen] = useState(false)
  const { data: info } = useApi(['grill-info', pid, target], () => api.grill.grillInfo(pid, target))
  if (!info?.allowed.ok || !info.hasDocument) return null
  return (
    <>
      <Button size={size} onClick={() => setOpen(true)} title={`The AI asks you hard questions about ${info.targetName}, one at a time`}>
        <Flame className="h-4 w-4 text-brand" /> {label}
      </Button>
      {open && <GrillPanel pid={pid} target={target} saves={info.saves} targetName={info.targetName} onClose={() => setOpen(false)} />}
    </>
  )
}

function GrillPanel({ pid, target, saves, targetName, onClose }: { pid: string; target: GrillTarget; saves: 'fact' | 'proposal' | 'none'; targetName: string; onClose: () => void }) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [current, setCurrent] = useState<Question | null>(null)
  const [answer, setAnswer] = useState('')
  const [save, setSave] = useState(true)
  const [busy, setBusy] = useState<'asking' | 'saving' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [finished, setFinished] = useState(false)
  const [started, setStarted] = useState(false)

  const ask = async (done: Turn[]) => {
    if (done.length >= LIMIT) return setFinished(true)
    setBusy('asking')
    setError(null)
    try {
      setCurrent(await api.grill.nextGrillQuestion(pid, target, done.map((t) => ({ q: t.question, a: t.answer }))))
      setAnswer('')
      setSave(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The AI did not answer. Try again.')
    } finally {
      setBusy(null)
    }
  }

  const start = () => {
    setStarted(true)
    void ask([])
  }

  /** kind: 'answer' (save the typed answer), 'unknown' (I don't know) or 'skip'. */
  const respond = async (kind: 'answer' | 'unknown' | 'skip') => {
    if (!current) return
    let outcome = 'skipped'
    if (kind !== 'skip') {
      setBusy('saving')
      setError(null)
      try {
        outcome = await api.grill.saveGrillAnswer(pid, target, { question: current.question, answer: kind === 'answer' ? answer : '', factKey: current.factKey, save: kind === 'answer' && save && saves !== 'none' })
      } catch (e) {
        setBusy(null)
        return setError(e instanceof Error ? e.message : 'Could not save the answer.')
      }
    }
    const done = [...turns, { ...current, answer: kind === 'answer' ? answer.trim() : '', outcome }]
    setTurns(done)
    setCurrent(null)
    void ask(done)
  }

  const canSaveFact = saves !== 'none' && !!current?.factKey
  const saveText = saves === 'fact' ? `Also save it to the Fact Sheet as “${current?.factLabel}”` : `Also propose it as a Fact Sheet update for “${current?.factLabel}” (the PM accepts or rejects it)`

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={
        <span className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-brand" /> Grill me: {targetName}
        </span>
      }
      footer={
        finished ? (
          <>
            <Button
              onClick={() => {
                setTurns([])
                setFinished(false)
                void ask([])
              }}
            >
              <RotateCcw className="h-4 w-4" /> Start a new round
            </Button>
            <Button variant="primary" onClick={onClose}>
              Close
            </Button>
          </>
        ) : started ? (
          <Button variant="ghost" onClick={() => setFinished(true)} disabled={!turns.length && !current}>
            Finish
          </Button>
        ) : undefined
      }
    >
      {!started ? (
        <div className="space-y-4">
          <p className="text-base leading-relaxed">
            The AI reads {targetName} and asks you <b>one hard question at a time</b> about its weakest, vaguest or riskiest part: like a strict reviewer would, before anyone approves it. Up to {LIMIT} questions.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-base text-muted">
            <li>Answer in a sentence or two, or say <b>I don't know</b> (kept as an open question), or <b>Skip</b>.</li>
            {saves === 'fact' && <li>When a question is about a fact, your answer can go straight into the Fact Sheet.</li>}
            {saves === 'proposal' && <li>When a question is about a fact, your answer can be proposed as a Fact Sheet update; the PM accepts or rejects it on Changes &amp; decisions.</li>}
            {saves === 'none' && <li>The Fact Sheet is confirmed, so answers are recorded but do not change it.</li>}
            <li>Every question and answer is kept in the activity log.</li>
          </ul>
          <Button variant="primary" size="lg" onClick={start}>
            <Flame className="h-5 w-5" /> Start
          </Button>
          <AiNote agent="grill" compact />
        </div>
      ) : finished ? (
        <Summary turns={turns} />
      ) : (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3 text-sm text-muted">
            <span>
              Question {Math.min(turns.length + 1, LIMIT)} of up to {LIMIT}
            </span>
            {turns.length > 0 && <span>{turns.filter((t) => t.answer).length} answered so far</span>}
          </div>

          {busy === 'asking' && (
            <div className="flex items-center gap-3 rounded-2xl bg-canvas px-5 py-6 text-base text-muted">
              <Loader2 className="h-5 w-5 animate-spin" /> The AI is reading and thinking of a question… (a few seconds)
            </div>
          )}

          {error && (
            <Note tone="red">
              {error}{' '}
              <button className="font-medium underline" onClick={() => (current ? setError(null) : void ask(turns))}>
                Try again
              </button>
            </Note>
          )}

          {current && busy !== 'asking' && (
            <>
              <div className="rounded-2xl border-l-4 border-brand bg-paper px-5 py-4 ring-1 ring-line">
                <div className="mb-1 flex items-center gap-2">
                  <AiBadge label="AI question" />
                  {current.factLabel && <span className="text-sm text-muted">About: {current.factLabel}</span>}
                </div>
                <p className="text-xl leading-snug font-medium">{current.question}</p>
                {current.factValue && <p className="mt-2 text-sm text-muted">The Fact Sheet says now: “{current.factValue}”</p>}
              </div>
              <Textarea rows={3} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Your answer" autoFocus aria-label="Your answer" />
              {canSaveFact && answer.trim() && <Checkbox label={<span className="text-base">{saveText}</span>} checked={save} onChange={setSave} />}
              <div className="flex flex-wrap gap-3">
                <Button variant="primary" size="lg" disabled={!answer.trim() || busy === 'saving'} onClick={() => respond('answer')}>
                  {busy === 'saving' ? 'Saving…' : 'Save answer'}
                </Button>
                <Button size="lg" disabled={busy === 'saving'} onClick={() => respond('unknown')}>
                  I don't know
                </Button>
                <Button size="lg" variant="ghost" disabled={busy === 'saving'} onClick={() => respond('skip')}>
                  Skip
                </Button>
              </div>
            </>
          )}

          {turns.length > 0 && (
            <details className="rounded-xl bg-canvas px-4 py-3">
              <summary className="cursor-pointer text-base font-medium">Answered so far ({turns.length})</summary>
              <div className="mt-3">
                <Summary turns={turns} compact />
              </div>
            </details>
          )}
        </div>
      )}
    </Modal>
  )
}

function Summary({ turns, compact }: { turns: Turn[]; compact?: boolean }) {
  const answered = turns.filter((t) => t.answer)
  const unknown = turns.filter((t) => !t.answer && t.outcome !== 'skipped')
  const changed = turns.filter((t) => /saved|proposed/.test(t.outcome))
  return (
    <div className="space-y-4">
      {!compact && (
        <p className="text-base">
          <b>{turns.length}</b> question{turns.length === 1 ? '' : 's'}: {answered.length} answered, {unknown.length} not known yet{changed.length ? `, ${changed.length} improving the Fact Sheet` : ''}.
          {unknown.length > 0 && ' The ones not known yet are worth finding out before approval.'}
        </p>
      )}
      <ol className="space-y-3">
        {turns.map((t, i) => (
          <li key={i} className="rounded-xl bg-paper px-4 py-3 ring-1 ring-line">
            <div className="text-base font-medium">
              {i + 1}. {t.question}
            </div>
            <div className="mt-1 text-base">{t.answer || <span className="text-muted">{t.outcome === 'skipped' ? 'Skipped' : 'Not known yet'}</span>}</div>
            {/saved|proposed/.test(t.outcome) && <div className="mt-1 text-sm font-medium text-leaf">✓ {t.outcome.charAt(0).toUpperCase() + t.outcome.slice(1)}</div>}
          </li>
        ))}
      </ol>
    </div>
  )
}
