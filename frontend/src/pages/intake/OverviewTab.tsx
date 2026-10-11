import { Check, FileText, Pencil, Play, ScanText } from 'lucide-react'
import { useState } from 'react'
import { clsx } from 'clsx'
import { api } from '../../api'
import { useAction } from '../../api/hooks'
import { AiNote } from '../../components/ai'
import { FileButton } from '../../components/FileButton'
import { fmtDateTime } from '../../components/format'
import { Badge, Button, Card, EmptyState, Guarded, Note, Textarea } from '../../components/ui'
import { ROUND_LABEL } from '../../api/intake'
import type { IntakeData } from './IntakePage'

export function OverviewTab({ data, goTo }: { data: IntakeData; goTo: (t: string) => void }) {
  const p = data.project
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(p.intake.description)
  const [openUpload, setOpenUpload] = useState<string | null>(null)
  const save = useAction(api.intake.saveDescription, { success: 'Description saved.', onDone: () => setEditing(false) })
  const upload = useAction((f: Parameters<typeof api.intake.upload>[1]) => api.intake.upload(p.id, f), { success: 'Reading the file in the background…' })
  const analyse = useAction(api.intake.runAnalysis, { success: 'The Q/A agent is reading everything. Then the RAG agent searches past projects.' })
  const startExtra = useAction(api.intake.startRound, { success: 'Questions are being written and routed.', onDone: () => goTo('questions') })

  const steps = [
    { label: 'Stakeholders describe what they want and upload files', done: !!p.intake.description.trim() },
    { label: 'The Q/A agent extracts facts', done: p.intake.analysed },
    { label: 'The RAG agent searches similar finished projects (PM team only)', done: !!p.intake.ragRunId },
    { label: 'Questions for missing fields, in rounds', done: data.rounds.some((r) => r.purpose === 'intake') },
    { label: 'The stakeholder head confirms the Fact Sheet', done: data.confirmed },
  ]

  return (
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <div className="space-y-4">
        {data.nextExtra && (
          <Note tone="blue">
            <div className="font-medium">Next: {ROUND_LABEL[data.nextExtra]} Q/A round</div>
            <div className="mb-2 text-sm">
              {data.nextExtra === 'brd_business' ? 'Before the BRD, the Q/A agent asks the stakeholders how the work is done today and how it should work.' : 'Before the SRS, the Q/A agent asks the tech team the technical questions.'}
            </div>
            {data.perms.pm && (
              <Button variant="primary" size="sm" onClick={() => startExtra.run(p.id, data.nextExtra!)}>
                <Play className="h-3.5 w-3.5" /> Start the round
              </Button>
            )}
          </Note>
        )}
        <Card
          title="What the stakeholders want"
          subtitle={data.descriptionByName ? `Written by ${data.descriptionByName}` : 'Not written yet'}
          actions={
            data.perms.editDescription &&
            !editing && (
              <Button size="sm" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            )
          }
        >
          {editing ? (
            <div>
              <Textarea rows={9} value={text} onChange={(e) => setText(e.target.value)} placeholder="Describe the problem, who is affected, what you want the system to do, numbers, places and dates…" />
              <div className="mt-2 flex justify-end gap-2">
                <Button onClick={() => setEditing(false)}>Cancel</Button>
                <Button variant="primary" onClick={() => save.run(p.id, text)}>
                  Save
                </Button>
              </div>
            </div>
          ) : p.intake.description ? (
            <div className="space-y-2 text-sm leading-relaxed whitespace-pre-line">{p.intake.description}</div>
          ) : (
            <EmptyState title="No description yet">A stakeholder writes what they need. The PM team can help.</EmptyState>
          )}
        </Card>
        <Card title="Uploaded files" subtitle="PDF, Word and images. Scanned pages are read with OCR (English and Bangla)." actions={data.perms.upload && <FileButton size="sm" onPick={(f) => upload.run(f)} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.tif,.tiff" />}>
          {data.uploads.length ? (
            <ul className="divide-y divide-line">
              {data.uploads.map((u) => (
                <li key={u.id} className="py-2">
                  <button className="flex w-full items-center gap-2 text-left" onClick={() => setOpenUpload(openUpload === u.id ? null : u.id)}>
                    <FileText className="h-4 w-4 text-muted" />
                    <span className="flex-1 text-sm font-medium">{u.name}</span>
                    {u.ocrUsed && (
                      <Badge tone="violet">
                        <ScanText className="h-3 w-3" /> OCR
                      </Badge>
                    )}
                    <span className="text-xs text-muted">
                      {u.pages} p · {u.byName} · {fmtDateTime(u.uploadedAt)}
                    </span>
                  </button>
                  {openUpload === u.id && (
                    <div className="mt-2 rounded bg-canvas p-3">
                      {u.dataUrl && <img src={u.dataUrl} alt="" className="mb-2 max-h-48 rounded" />}
                      <div className="mb-1 text-[11px] font-medium text-muted">Extracted text (simulated)</div>
                      <pre className="font-sans text-xs whitespace-pre-wrap">{u.extractedText}</pre>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No files yet. Try uploading any PDF or image: the prototype shows a pre-written OCR result.</p>
          )}
          <div className="mt-3">
            <AiNote agent="ocr" compact />
          </div>
        </Card>
        {data.feedback.length > 0 && (
          <Card title="Comments from the stakeholder head on the Fact Sheet">
            <ul className="space-y-2 text-sm">
              {data.feedback.map((f, i) => (
                <li key={i}>
                  “{f.text}” <span className="text-xs text-muted">— {f.byName}, {fmtDateTime(f.at)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
      <div className="space-y-4">
        <Card title="Progress">
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className={clsx('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px]', s.done ? 'bg-leaf text-white' : 'bg-canvas text-muted ring-1 ring-line')}>{s.done ? <Check className="h-3 w-3" /> : i + 1}</span>
                <span className={s.done ? '' : 'text-muted'}>{s.label}</span>
              </li>
            ))}
          </ol>
        </Card>
        <Card title="Intake analysis" subtitle="Run once the stakeholders have given their information.">
          <div className="space-y-3">
            {p.intake.analysed ? (
              <Note tone="green">Facts extracted. {data.facts.filter((f) => f.status !== 'missing').length} of {data.facts.length} fields have a value. See the Fact Sheet tab.</Note>
            ) : data.perms.pmTeam ? (
              <Guarded variant="primary" check={p.intake.description ? { ok: true } : { ok: false, reason: 'Waiting for the stakeholders’ description.' }} onClick={() => analyse.run(p.id)}>
                <Play className="h-4 w-4" /> Run intake analysis
              </Guarded>
            ) : (
              <p className="text-sm text-muted">Waiting for the PM team to run it.</p>
            )}
            {p.intake.analysed && data.perms.pmTeam && (
              <Button size="sm" variant="ghost" onClick={() => analyse.run(p.id)}>
                Run again (after new uploads)
              </Button>
            )}
            <AiNote agent="qa_extract" compact />
          </div>
        </Card>
      </div>
    </div>
  )
}
