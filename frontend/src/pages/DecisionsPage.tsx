/**
 * The PM's decision queue: candidate decisions from meeting transcripts (AI) and chat messages
 * marked as decisions. The PM confirms each into the Fact Sheet, starts a change request, or dismisses it.
 */
import { Gavel, Workflow } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { CandidateDecision } from '../types'
import { api } from '../api'
import { useAction, useApi } from '../api/hooks'
import { AiBadge, AiNote } from '../components/ai'
import { fmtDateTime } from '../components/format'
import { Badge, Button, Card, EmptyState, ErrorBox, Field, Loading, Modal, Note, PageHeader, Select, Textarea } from '../components/ui'
import { SubNav, changesNav } from '../components/SubNav'

export function DecisionsPage() {
  const { pid = '' } = useParams()
  const { data, isLoading, error } = useApi(['decisions', pid], () => api.changes.listDecisions(pid))
  const [confirming, setConfirming] = useState<CandidateDecision | null>(null)
  const [factKey, setFactKey] = useState('')
  const [value, setValue] = useState('')
  const confirm = useAction(api.changes.confirmDecision, { success: 'Decision confirmed.', onDone: () => setConfirming(null) })
  const dismiss = useAction(api.changes.dismissDecision, { success: 'Dismissed.' })
  if (isLoading) return <Loading />
  if (error || !data) return <ErrorBox error={error} />
  const pending = data.decisions.filter((d) => d.status === 'pending')
  const done = data.decisions.filter((d) => d.status !== 'pending')
  return (
    <div>
      <PageHeader eyebrow={<Link to={`/projects/${pid}`}>{data.project.name}</Link>} title="Decisions" subtitle="Candidate decisions from meetings and chats. Nothing enters the Fact Sheet until the PM confirms it." />
      <SubNav items={changesNav(pid)} />
      {!data.pm && <Note className="mb-4">Only the PM confirms or dismisses decisions. Any member can mark a chat message as a decision.</Note>}
      <div className="space-y-3">
        {pending.map((d) => (
          <Card key={d.id}>
            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted">
              {d.ai ? <AiBadge label="AI candidate from a transcript" /> : <Badge tone="blue">Marked by {d.markedByName}</Badge>}
              <span>{d.chatTitle} · {fmtDateTime(d.createdAt)}</span>
              <Link to={`/messages/${d.chatId}`} className="text-brand">open chat</Link>
            </div>
            <div className="text-sm font-medium">“{d.text}”</div>
            {data.pm && data.project.status === 'active' && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="success" onClick={() => { setConfirming(d); setFactKey(d.factKey ?? ''); setValue(d.text) }}>Confirm into the Fact Sheet</Button>
                <Button size="sm" onClick={() => confirm.run(d.id, { kind: 'change_request' })}><Workflow className="h-3.5 w-3.5" /> It changes scope: start a change request</Button>
                <Button size="sm" variant="danger" onClick={() => dismiss.run(d.id)}>Dismiss</Button>
              </div>
            )}
          </Card>
        ))}
        {!pending.length && <EmptyState title="No decisions waiting" icon={<Gavel className="h-6 w-6" />}>Mark a chat message as a decision, or switch transcription on in a call.</EmptyState>}
      </div>
      {done.length > 0 && (
        <Card title="Decided" className="mt-6">
          <ul className="divide-y divide-line">
            {done.map((d) => (
              <li key={d.id} className="py-2 text-sm">
                “{d.text}” <Badge tone={d.status === 'confirmed' ? 'green' : 'gray'}>{d.status === 'confirmed' ? (d.outcome === 'fact' ? `into the Fact Sheet (${data.catalog.find((c) => c.key === d.factKey)?.label ?? d.factKey})` : 'change request') : 'dismissed'}</Badge>
                <span className="text-xs text-muted"> — {d.decidedByName}, {fmtDateTime(d.decidedAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <div className="mt-6"><AiNote agent="decisions" compact /></div>
      <Modal open={!!confirming} onClose={() => setConfirming(null)} title="Confirm into the Fact Sheet" footer={<Button variant="primary" disabled={!factKey} onClick={() => confirm.run(confirming!.id, { kind: 'fact', factKey, value })}>Confirm</Button>}>
        <Field label="Which fact does it set?">
          <Select value={factKey} onChange={(e) => { setFactKey(e.target.value); }}>
            <option value="">Choose…</option>
            {data.catalog.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </Select>
        </Field>
        {factKey && <div className="mb-2 text-xs text-muted">Current value: {data.facts.find((f) => f.key === factKey)?.value || '—'}</div>}
        <Field label="New value" hint="A new Fact Sheet version is saved, with a link to the decision as its source.">
          <Textarea rows={3} value={value} onChange={(e) => setValue(e.target.value)} />
        </Field>
      </Modal>
    </div>
  )
}
