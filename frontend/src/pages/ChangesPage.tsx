/**
 * Change requests (scope changes) and Fact Sheet updates proposed from document edits.
 * SPEC.md "Change scope (change request)", "Restarting the pipeline", "Keeping the Fact Sheet and documents in step".
 */
import { Check, Plus, Sparkles, Workflow, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAction, useApi } from '../api/hooks'
import { AiBadge, AiNote } from '../components/ai'
import { SideBySide } from '../components/Diff'
import { fmtDateTime } from '../components/format'
import { Badge, Button, Card, Checkbox, EmptyState, ErrorBox, Field, Input, Loading, Modal, Note, PageHeader, Textarea } from '../components/ui'
import { AnswerBox } from './intake/QuestionsTab'
import { SubNav, changesNav } from '../components/SubNav'

const STEPS = ['questions', 'impact_review', 'regenerating', 'reapproval', 'closed'] as const

export function ChangesPage() {
  const { pid = '' } = useParams()
  const { data, isLoading, error } = useApi(['changes', pid], () => api.changes.listChanges(pid))
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', factKeys: [] as string[] })
  const [answering, setAnswering] = useState<string | null>(null)
  const create = useAction(api.changes.createChangeRequest, { success: 'Change request started. Questions about what changed were sent.', onDone: () => setCreating(false) })
  const impact = useAction(api.changes.runImpactAnalysis, { success: 'Running the impact analysis…' })
  const regen = useAction(api.changes.regenerateAffected, { success: 'Regenerating the affected sections…' })
  const decide = useAction(api.changes.decideCrProposal)
  const apply = useAction(api.changes.applyChangeRequest, { success: 'New versions created. The pipeline restarts from the Proposal.' })
  const decideFact = useAction(api.documents.decideFactUpdate, { success: 'Done.' })
  if (isLoading) return <Loading />
  if (error || !data) return <ErrorBox error={error} />
  const pendingUpdates = data.factUpdates.filter((f) => f.status === 'pending')
  return (
    <div>
      <PageHeader
        eyebrow={<Link to={`/projects/${pid}`}>{data.project.name}</Link>}
        title="Change requests"
        subtitle="A scope change: the Q/A agent asks only about what changed, the Fact Sheet is updated, affected sections are regenerated, and the pipeline restarts from the Proposal."
        actions={data.pm && data.project.status === 'active' && <Button variant="primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New change request</Button>}
      />
      <SubNav items={changesNav(pid)} />
      {pendingUpdates.length > 0 && (
        <Card title="Fact Sheet updates proposed from edits" subtitle="When a manual edit changes a fact, the AI proposes a matching Fact Sheet update. A PM team member accepts or rejects it." className="mb-6">
          <ul className="space-y-3">
            {pendingUpdates.map((f) => (
              <li key={f.id} className="rounded-md bg-canvas p-3">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-sm">
                  <b>{f.factLabel}</b> <AiBadge label="AI proposal" /> <span className="text-xs text-muted">from {f.docLabel} v{f.versionNumber} · {fmtDateTime(f.createdAt)}</span>
                </div>
                <div className="text-sm"><span className="diff-del">{f.oldValue}</span> → <span className="diff-add">{f.newValue}</span></div>
                {data.pmTeam && (
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="success" onClick={() => decideFact.run(f.id, true)}><Check className="h-3.5 w-3.5" /> Accept (new Fact Sheet version)</Button>
                    <Button size="sm" variant="danger" onClick={() => decideFact.run(f.id, false)}><X className="h-3.5 w-3.5" /> Reject</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-3"><AiNote agent="factchange" compact /></div>
        </Card>
      )}
      <div className="space-y-4">
        {data.changeRequests.map((c) => {
          const stepIdx = STEPS.indexOf(c.status)
          const unanswered = c.questions.filter((q) => !q.answeredAt).length
          return (
            <Card key={c.id} title={<span className="flex items-center gap-2"><Workflow className="h-4 w-4" /> {c.title}</span>} subtitle={`${c.sourceLabel} · started by ${c.createdByName} ${fmtDateTime(c.createdAt)}`} actions={<Badge tone={c.status === 'closed' ? 'green' : 'amber'}>{c.statusLabel}</Badge>}>
              <ol className="mb-4 flex flex-wrap gap-1 text-[11px]">
                {['Questions about the change', 'Impact analysis', 'Regenerate affected sections', 'Re-approve in order', 'Closed'].map((s, i) => (
                  <li key={s} className={`rounded-full px-2 py-0.5 ${i < stepIdx ? 'bg-leaf-soft text-leaf' : i === stepIdx ? 'bg-brand text-white' : 'bg-canvas text-muted'}`}>{s}</li>
                ))}
              </ol>
              {c.description && <p className="mb-3 text-sm">{c.description}</p>}
              {c.status === 'questions' && (
                <div className="space-y-2">
                  {c.questions.map((q) => (
                    <div key={q.id} className="rounded-md bg-canvas p-3 text-sm">
                      <div className="text-xs text-muted">To the {q.teamLabel}</div>
                      <div className="font-medium">{q.text}</div>
                      {q.answeredAt ? <div className="mt-1 text-sm">{q.answer} <span className="text-xs text-muted">— {q.answeredByName}</span></div> : answering === q.id ? <AnswerBox q={q} onDone={() => setAnswering(null)} /> : <Button size="sm" className="mt-1" onClick={() => setAnswering(q.id)}>Answer (if it is yours)</Button>}
                    </div>
                  ))}
                  {data.pm && <Button variant="primary" disabled={unanswered > 0} why="Wait for every answer." onClick={() => impact.run(c.id)}><Sparkles className="h-4 w-4" /> Update the Fact Sheet and run the impact analysis</Button>}
                </div>
              )}
              {c.status === 'impact_review' && (
                <div className="space-y-2">
                  {c.impactDocs.length ? (
                    <ul className="space-y-1 text-sm">
                      {c.impactDocs.map((i) => <li key={i.docId}><b>{i.label}:</b> {i.sections.join(', ')} <span className="text-xs text-muted">({i.reason})</span></li>)}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted">Run the impact analysis to list the affected documents and sections.</p>
                  )}
                  {data.pm && (
                    <div className="flex gap-2">
                      <Button onClick={() => impact.run(c.id)}>Run impact analysis</Button>
                      {c.impactDocs.length > 0 && <Button variant="primary" onClick={() => regen.run(c.id)}><Sparkles className="h-4 w-4" /> Regenerate affected sections</Button>}
                    </div>
                  )}
                  <AiNote agent="impact" compact />
                </div>
              )}
              {c.status === 'regenerating' && (
                <div className="space-y-3">
                  {c.proposals?.map((pp) => (
                    <div key={pp.sectionId} className="rounded-md p-3 ring-1 ring-line">
                      <div className="mb-2 flex items-center gap-2 text-sm font-medium">{pp.title} <AiBadge label="AI regenerated" /> {pp.status !== 'pending' && <Badge tone={pp.status === 'accepted' ? 'green' : 'gray'}>{pp.status}</Badge>}</div>
                      <SideBySide before={pp.before} after={pp.after} leftLabel="Current" rightLabel="Regenerated" />
                      {pp.status === 'pending' && data.pmTeam && (
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" variant="success" onClick={() => decide.run(c.id, pp.sectionId, true)}>Accept</Button>
                          <Button size="sm" variant="danger" onClick={() => decide.run(c.id, pp.sectionId, false)}>Reject</Button>
                        </div>
                      )}
                    </div>
                  ))}
                  {data.pmTeam && <Button variant="primary" onClick={() => apply.run(c.id)}>Create new versions and restart the pipeline</Button>}
                </div>
              )}
              {c.status === 'reapproval' && (
                <Note tone="blue">Re-approve the Proposal first (unchanged if it needs no edit), then each later document in order. The change request closes when every affected document is approved and signed again. <Link className="font-medium underline" to={`/projects/${pid}/docs/PROPOSAL`}>Go to the Proposal</Link></Note>
              )}
              {c.status === 'closed' && <Note tone="green">Closed {fmtDateTime(c.closedAt)}.</Note>}
            </Card>
          )
        })}
        {!data.changeRequests.length && <EmptyState title="No change requests" icon={<Workflow className="h-6 w-6" />}>They start when the PM marks a flagged edit, a confirmed decision or a defect as a scope change.</EmptyState>}
      </div>
      <Modal open={creating} onClose={() => setCreating(false)} title="New change request" footer={<Button variant="primary" onClick={() => create.run(pid, form)}>Start</Button>}>
        <Field label="What is changing?"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Pilot starts in 20 branches instead of 120" /></Field>
        <Field label="Details"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <Field label="Which facts change?" hint="The Q/A agent asks only about these, routed to the right team.">
          <div className="grid max-h-48 grid-cols-2 gap-1 overflow-y-auto rounded-md bg-canvas p-2">
            {data.catalog.map((f) => <Checkbox key={f.key} label={<span className="text-xs">{f.label}</span>} checked={form.factKeys.includes(f.key)} onChange={(c) => setForm({ ...form, factKeys: c ? [...form.factKeys, f.key] : form.factKeys.filter((k) => k !== f.key) })} />)}
          </div>
        </Field>
      </Modal>
    </div>
  )
}
