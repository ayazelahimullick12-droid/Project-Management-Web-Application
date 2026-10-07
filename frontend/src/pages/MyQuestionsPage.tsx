/** My questions: Q/A questions routed to me (or to the head I am covering for), across projects. */
import { Inbox } from 'lucide-react'
import { useState } from 'react'
import { api } from '../api'
import { useApi } from '../api/hooks'
import { fmtDateTime } from '../components/format'
import { Badge, Button, Card, EmptyState, Loading, PageHeader } from '../components/ui'
import { AnswerBox } from './intake/QuestionsTab'

export function MyQuestionsPage() {
  const { data, isLoading } = useApi(['my-questions'], api.intake.myQuestions)
  const [answering, setAnswering] = useState<string | null>(null)
  if (isLoading) return <Loading />
  const open = (data ?? []).filter((q) => q.open)
  const done = (data ?? []).filter((q) => !q.open)
  return (
    <div>
      <PageHeader title="My questions" subtitle="Questions the Q/A agent routed to you. “Unknown” is a valid answer. Unanswered questions are reminded every 4 working hours." />
      {open.length ? (
        <div className="mb-6 space-y-3">
          {open.map((q) => (
            <Card key={q.id}>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <b className="text-ink">{q.projectName}</b> · {q.roundLabel} · for the {q.teamLabel} · {fmtDateTime(q.createdAt)}
              </div>
              <div className="mt-1 font-medium">{q.text}</div>
              {answering === q.id ? <AnswerBox q={q} onDone={() => setAnswering(null)} /> : <Button size="sm" variant="primary" className="mt-2" onClick={() => setAnswering(q.id)}>Answer</Button>}
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="No open questions" icon={<Inbox className="h-6 w-6" />}>When the PM starts a Q/A round, questions for your team appear here.</EmptyState>
      )}
      {done.length > 0 && (
        <Card title="Answered or closed">
          <ul className="divide-y divide-line">
            {done.map((q) => (
              <li key={q.id} className="py-2 text-sm">
                <div className="text-xs text-muted">{q.projectName} · {q.roundLabel}</div>
                <div>{q.text}</div>
                <div className="mt-0.5 text-xs">{q.answeredAt ? <>{q.unknown ? <Badge tone="amber">Unknown</Badge> : q.answer} — {q.answeredByName}</> : <span className="text-muted">Not answered; the round was closed.</span>}</div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
