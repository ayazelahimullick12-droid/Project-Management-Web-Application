/**
 * Simple view · a document's summary, shown first to the people who approve it (supervisor's
 * request, November 2026): the short summary, the key points and the slides, a "Listen" button
 * (the voice summary is coming later), and an "Ask the AI" box that answers questions from the
 * summary and the full document. "Read the full document" opens the full text.
 */
import { clsx } from 'clsx'
import { ChevronLeft, ChevronRight, FileText, Send, Sparkles, Volume2 } from 'lucide-react'
import { useState } from 'react'
import { api } from '../api'
import { useAction } from '../api/hooks'
import { Markdown } from '../components/Markdown'
import { Button, Input } from '../components/ui'

type DocData = Awaited<ReturnType<typeof api.documents.getDocument>>

export function SummaryView({ data, onReadFull }: { data: DocData; onReadFull: () => void }) {
  const d = data.derived
  const v = data.current
  const make = useAction(api.documents.makeSummaries, { success: 'The AI is writing the summary and slides…' })
  const [slide, setSlide] = useState(0)

  if (!v) return null
  if (!d)
    return (
      <div className="shadow-soft rounded-2xl p-6">
        <h2 className="text-xl font-semibold">Summary</h2>
        <p className="mt-2 text-base text-muted">
          {data.summarizing ? 'The AI is writing the summary and slides. They appear here in a moment.' : `There is no summary of version ${v.number} yet.`}
          {data.summaryError && !data.summarizing && ` The last try did not work: ${data.summaryError}`}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {!data.summarizing && data.perms.summarize && (
            <Button variant="primary" disabled={make.pending} onClick={() => make.run(data.project.id, data.type)}>
              <Sparkles className="h-4 w-4" /> Make the summary
            </Button>
          )}
          <Button onClick={onReadFull}>
            <FileText className="h-4 w-4" /> Read the full document
          </Button>
        </div>
      </div>
    )

  const slides = d.slides
  const s = slides[Math.min(slide, slides.length - 1)]
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-6">
        {/* The summary */}
        <section className="shadow-soft rounded-2xl p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Summary</h2>
              <p className="mt-0.5 text-sm text-muted">Written by the AI from version {v.number}. You approve the full document, not the summary.</p>
            </div>
            {/* The voice summary is planned: the button shows where it will be */}
            <Button disabled title="The voice summary is coming soon" aria-label="Listen to the summary (coming soon)">
              <Volume2 className="h-4 w-4" /> Listen <span className="text-sm font-normal">(coming soon)</span>
            </Button>
          </div>
          <p className="mt-4 text-lg leading-relaxed font-medium">{d.short}</p>
          <div className="mt-4 text-base">
            <Markdown text={d.onePager} />
          </div>
          <div className="mt-5">
            <Button onClick={onReadFull}>
              <FileText className="h-4 w-4" /> Read the full document
            </Button>
          </div>
        </section>

        {/* Slides, one at a time */}
        {s && (
          <section aria-label="Slides" className="shadow-soft rounded-2xl p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Slides</h2>
              <span className="text-sm text-muted">
                {Math.min(slide, slides.length - 1) + 1} of {slides.length}
              </span>
            </div>
            <div className="mt-4 aspect-[16/9] max-w-full rounded-xl bg-gradient-to-br from-brand-soft to-paper p-6 ring-1 ring-line sm:p-10">
              <div className="text-2xl font-semibold text-balance">{s.title}</div>
              <ul className="mt-4 list-disc space-y-2 pl-6 text-lg">
                {s.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
            {slides.length > 1 && (
              <div className="mt-4 flex gap-3">
                <Button disabled={slide === 0} onClick={() => setSlide(slide - 1)}>
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <Button disabled={slide >= slides.length - 1} onClick={() => setSlide(slide + 1)}>
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </section>
        )}
      </div>

      {/* Ask the AI about the document */}
      <aside className="min-w-0 lg:sticky lg:top-40 lg:self-start">
        <AskDocument data={data} />
      </aside>
    </div>
  )
}

function AskDocument({ data }: { data: DocData }) {
  const [q, setQ] = useState('')
  const [turns, setTurns] = useState<{ q: string; a: string }[]>([])
  const askAi = useAction((question: string) => api.documents.askAboutDocument(data.project.id, data.type, question), {
    onDone: (r) => {
      setTurns((t) => [...t, { q: q.trim(), a: r.answer }])
      setQ('')
    },
  })
  const examples = ['What is the budget?', 'When does it go live?', 'What is out of scope?']
  return (
    <section className="shadow-soft rounded-2xl p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Sparkles className="h-5 w-5 text-brand" /> Ask the AI
      </h2>
      <p className="mt-1 text-sm text-muted">About this summary and the full document. Answers come only from the document.</p>
      {turns.length > 0 && (
        <ul className="mt-4 space-y-4">
          {turns.map((t, i) => (
            <li key={i} className="space-y-1.5">
              <div className="ml-6 rounded-xl rounded-tr-md bg-brand-soft px-3 py-2 text-base">{t.q}</div>
              <div className="mr-6 rounded-xl rounded-tl-md bg-paper px-3 py-2 text-base ring-1 ring-line">{t.a}</div>
            </li>
          ))}
        </ul>
      )}
      {askAi.pending && <p className="mt-3 text-base text-muted">The AI is reading the document… (a few seconds)</p>}
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (q.trim()) askAi.run(q)
        }}
      >
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a question" aria-label="Your question about the document" />
        <Button type="submit" variant="primary" disabled={!q.trim() || askAi.pending} aria-label="Ask">
          <Send className="h-4 w-4" />
        </Button>
      </form>
      {!turns.length && (
        <div className="mt-3 flex flex-wrap gap-2">
          {examples.map((x) => (
            <button key={x} type="button" onClick={() => setQ(x)} className={clsx('min-h-11 rounded-full px-3 text-sm ring-1 ring-line hover:bg-ink/[0.04]')}>
              {x}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
