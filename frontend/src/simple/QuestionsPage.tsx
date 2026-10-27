/**
 * Simple view · Questions: one question at a time ("Question 2 of 5"), a large answer box, and
 * "I don't know" (stored as an assumption with the agreed default, as the spec says).
 * Answered questions are listed under More.
 */
import { CircleCheck } from 'lucide-react'
import { useState } from 'react'
import { api } from '../api'
import { useAction, useApi, useSessionUserId } from '../api/hooks'
import { Button, Loading, LinkButton } from '../components/ui'
import { Empty, More, SimplePage } from './parts'

export function SimpleQuestionsPage() {
  const uid = useSessionUserId()
  const { data, isLoading } = useApi(['my-questions', uid], api.intake.myQuestions)
  const [index, setIndex] = useState(0)
  const [text, setText] = useState('')
  const [done, setDone] = useState(0) // answered during this visit, so the count reads 2 of 2 rather than 1 of 1
  const answer = useAction(api.intake.answerQuestion, {
    success: 'Answer saved. Thank you.',
    onDone: () => {
      setText('')
      setDone((d) => d + 1)
    },
  })
  if (isLoading || !data) return <Loading />

  const open = data.filter((q) => q.open)
  const answered = data.filter((q) => q.answeredAt)
  const i = open.length ? index % open.length : 0
  const q = open[i]

  return (
    <SimplePage back={{ to: '/', label: 'To do' }} title="Questions for you" subtitle="The project team needs these answers to write the documents.">
      {q ? (
        <section className="rounded-2xl bg-surface p-6 ring-1 ring-line md:p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-base text-muted">
            <span>
              Question {done + i + 1} of {done + open.length}
            </span>
            <span>{q.projectName}</span>
          </div>
          <div className="mt-2 flex gap-1" aria-hidden>
            {Array.from({ length: done + open.length }, (_, n) => (
              <span key={n} className={`h-1.5 flex-1 rounded-full ${n < done ? 'bg-leaf' : n === done + i ? 'bg-brand' : 'bg-ink/10'}`} />
            ))}
          </div>
          <h2 className="mt-6 text-2xl leading-snug font-semibold">{q.text}</h2>
          <label className="mt-5 block">
            <span className="mb-2 block text-base font-medium">Your answer</span>
            <textarea
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full rounded-xl bg-surface px-4 py-3 text-lg leading-relaxed ring-1 ring-line placeholder:text-muted/70 focus:ring-2 focus:ring-brand/70 focus:outline-none"
              placeholder="Write in your own words. Bangla or English is fine."
            />
          </label>
          {q.sampleAnswer && (
            <button className="mt-2 text-base font-medium text-brand hover:underline" onClick={() => setText(q.sampleAnswer!)}>
              Use a sample answer (demo)
            </button>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button variant="primary" size="lg" disabled={!text.trim() || answer.pending} onClick={() => answer.run(q.id, { text, unknown: false })}>
              Save answer
            </Button>
            <Button size="lg" disabled={answer.pending} onClick={() => answer.run(q.id, { text: '', unknown: true })}>
              I don't know
            </Button>
            {open.length > 1 && (
              <button
                className="ml-auto text-base font-medium text-muted hover:text-ink"
                onClick={() => {
                  setText('')
                  setIndex(i + 1)
                }}
              >
                Skip for now
              </button>
            )}
          </div>
          <p className="mt-4 text-base text-muted">
            “I don't know” is a fine answer.{q.defaultValue ? ` The team will assume “${q.defaultValue}” for now.` : ' The team will note it as an assumption.'}
          </p>
        </section>
      ) : (
        <Empty icon={<CircleCheck />} title="No questions waiting for you">
          Thank you. We will email you if the team needs more answers.
        </Empty>
      )}

      {!q && (
        <div>
          <LinkButton to="/" size="lg">
            Back to To do
          </LinkButton>
        </div>
      )}

      {answered.length > 0 && (
        <More label={`Your earlier answers (${answered.length})`}>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
            {answered.map((a) => (
              <li key={a.id} className="px-5 py-4">
                <div className="text-base font-medium">{a.text}</div>
                <div className="mt-1 text-base text-muted">
                  {a.unknown ? 'You did not know' : a.answer} · {a.projectName}
                </div>
              </li>
            ))}
          </ul>
        </More>
      )}
    </SimplePage>
  )
}
