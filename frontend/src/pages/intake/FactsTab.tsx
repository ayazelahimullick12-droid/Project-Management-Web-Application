import { BadgeCheck, GitCompare, MessageSquareWarning, Pencil, RotateCcw, Send } from 'lucide-react'
import { useState } from 'react'
import type { Fact } from '../../types'
import { api } from '../../api'
import { useAction } from '../../api/hooks'
import { AiBadge } from '../../components/ai'
import { FactChip } from '../../components/status'
import { fmtDateTime } from '../../components/format'
import { Badge, Button, Card, Field, Guarded, Input, Modal, Note, Select, Table, Td, Textarea } from '../../components/ui'
import type { IntakeData } from './IntakePage'
import { MissingPeople } from '../../components/People'

const ROUND_HINT: Record<string, string> = { brd_business: 'asked before the BRD', srs_technical: 'asked before the SRS' }

function Compare({ data }: { data: IntakeData }) {
  const versions = [...data.factSheets].sort((a, b) => a.number - b.number)
  const [a, setA] = useState(versions.at(-2)?.number ?? 1)
  const [b, setB] = useState(versions.at(-1)?.number ?? 1)
  const va = versions.find((v) => v.number === a)
  const vb = versions.find((v) => v.number === b)
  const keys = [...new Set([...(va?.facts ?? []), ...(vb?.facts ?? [])].map((f) => f.key))]
  const rows = keys
    .map((k) => ({ k, fa: va?.facts.find((f) => f.key === k), fb: vb?.facts.find((f) => f.key === k) }))
    .filter((r) => (r.fa?.value ?? '') !== (r.fb?.value ?? '') || r.fa?.status !== r.fb?.status)
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-sm">
        Compare
        <Select value={a} onChange={(e) => setA(Number(e.target.value))} className="w-24">
          {versions.map((v) => (
            <option key={v.number} value={v.number}>
              v{v.number}
            </option>
          ))}
        </Select>
        with
        <Select value={b} onChange={(e) => setB(Number(e.target.value))} className="w-24">
          {versions.map((v) => (
            <option key={v.number} value={v.number}>
              v{v.number}
            </option>
          ))}
        </Select>
      </div>
      {rows.length ? (
        <Table head={['Field', `v${a}`, `v${b}`]}>
          {rows.map((r) => (
            <tr key={r.k}>
              <Td className="font-medium">{r.fb?.label ?? r.fa?.label}</Td>
              <Td><span className="diff-del">{r.fa?.value || '—'}</span></Td>
              <Td><span className="diff-add">{r.fb?.value || '—'}</span></Td>
            </tr>
          ))}
        </Table>
      ) : (
        <p className="text-sm text-muted">No differences.</p>
      )}
    </div>
  )
}

export function FactsTab({ data }: { data: IntakeData }) {
  const p = data.project
  const [editing, setEditing] = useState<Fact | null>(null)
  const [value, setValue] = useState('')
  const [settling, setSettling] = useState<Fact | null>(null)
  const [choice, setChoice] = useState('')
  const [feedback, setFeedback] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [compare, setCompare] = useState(false)
  const edit = useAction(api.intake.editFact, { success: 'Fact updated.', onDone: () => setEditing(null) })
  const settle = useAction(api.intake.settle, { success: 'Conflict settled.', onDone: () => setSettling(null) })
  const request = useAction(api.intake.requestConfirmation, { success: 'Sent to the stakeholder head for confirmation.' })
  const confirm = useAction(api.intake.confirmFactSheet, { success: 'Fact Sheet confirmed. The Proposal can now be generated.' })
  const comment = useAction(api.intake.factSheetFeedback, { success: 'Comment sent to the PM team.', onDone: () => setFeedback(false) })
  const restore = useAction(api.intake.restoreFactSheet, { success: 'Restored as a new version.' })
  const latest = data.factSheets[0]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface p-4 ring-1 ring-line">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">
            {data.confirmed ? (
              <span className="flex items-center gap-1.5 text-leaf">
                <BadgeCheck className="h-4 w-4" /> Confirmed by the stakeholder head
              </span>
            ) : p.intake.confirmRequestedAt ? (
              'Waiting for the stakeholder head to confirm'
            ) : (
              'Draft Fact Sheet'
            )}
          </div>
          <div className="text-xs text-muted">
            {latest ? `Latest version: v${latest.number} (${latest.note})` : 'No saved version yet'} · {data.facts.filter((f) => f.status === 'filled').length} filled · {data.facts.filter((f) => f.status === 'missing').length} missing · {data.facts.filter((f) => f.status === 'assumed').length} assumed · {data.conflicts.length} conflicting
          </div>
        </div>
        {!data.confirmed && data.perms.pm && !p.intake.confirmRequestedAt && data.missingForConfirmation.length > 0 && (
          <MissingPeople pid={p.id} missing={data.missingForConfirmation} canAdd={data.perms.canAddPeople} before="Before the Fact Sheet can be sent for confirmation" />
        )}
        {!data.confirmed && data.perms.pm && !p.intake.confirmRequestedAt && !data.missingForConfirmation.length && (
          <Button variant="primary" onClick={() => request.run(p.id)}>
            <Send className="h-4 w-4" /> Send for confirmation
          </Button>
        )}
        {!data.confirmed && p.intake.confirmRequestedAt && (
          <>
            <Guarded variant="success" check={data.perms.confirm ? { ok: true } : { ok: false, reason: data.perms.confirmReason }} onClick={() => confirm.run(p.id)}>
              <BadgeCheck className="h-4 w-4" /> Confirm Fact Sheet{data.perms.actingFor ? ' (as deputy)' : ''}
            </Guarded>
            {data.perms.confirm && (
              <Button onClick={() => setFeedback(true)}>
                <MessageSquareWarning className="h-4 w-4" /> Comment on what is wrong
              </Button>
            )}
          </>
        )}
        {data.factSheets.length > 1 && (
          <Button variant="ghost" onClick={() => setCompare(true)}>
            <GitCompare className="h-4 w-4" /> Compare versions
          </Button>
        )}
      </div>

      {data.conflicts.length > 0 && (
        <Note tone="red">
          <div className="mb-2 font-medium">Conflicting answers: the PM picks the value</div>
          {data.conflicts.map((f) => (
            <div key={f.key} className="mb-1 flex flex-wrap items-center gap-2 text-sm">
              <b>{f.label}:</b>
              {f.conflict?.map((c, i) => (
                <span key={i}>
                  “{c.value}” <span className="text-xs">({c.source.label})</span>
                  {i < (f.conflict?.length ?? 0) - 1 && ' vs '}
                </span>
              ))}
              {data.perms.pm && (
                <Button size="sm" onClick={() => { setSettling(f); setChoice(f.conflict?.[0]?.value ?? '') }}>
                  Settle
                </Button>
              )}
            </div>
          ))}
        </Note>
      )}

      <Card padded={false}>
        <Table head={['Field', 'Value', 'Status', 'Source', 'Needed by', '']}>
          {data.facts.map((f) => (
            <tr key={f.key} className={f.status === 'missing' ? 'bg-canvas/50' : undefined}>
              <Td className="w-44">
                <div className="font-medium">{f.label}</div>
                <div className="text-[11px] text-muted">
                  {f.category}
                  {f.round && ROUND_HINT[f.round] ? ` · ${ROUND_HINT[f.round]}` : ''}
                </div>
              </Td>
              <Td>
                <div className="text-sm">{f.value || <span className="text-muted">—</span>}</div>
                {f.assumption && <div className="mt-1 text-xs text-amber-800">{f.assumption}</div>}
                {f.credit && <Badge tone="blue" className="mt-1">{f.credit}</Badge>}
                {f.ai && <span className="mt-1 ml-1 inline-block"><AiBadge label="AI-proposed, not yet confirmed" /></span>}
              </Td>
              <Td><FactChip status={f.status} /></Td>
              <Td className="text-xs text-muted">{f.source?.label ?? '—'}</Td>
              <Td className="text-xs text-muted">{f.requiredBy.length ? f.requiredBy.join(', ') : f.extra ? 'extra' : '—'}</Td>
              <Td>
                {data.perms.pmTeam && p.status === 'active' && (
                  <button className="rounded p-1 text-muted hover:text-brand" title="Edit" onClick={() => { setEditing(f); setValue(f.value) }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card title="Fact Sheet versions" subtitle="Every version is kept and can be compared and restored.">
        <ul className="divide-y divide-line">
          {data.factSheets.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <b>v{v.number}</b>
              <span className="flex-1">{v.note}</span>
              {v.confirmedBy && <Badge tone="green">Confirmed by {v.confirmedByName}</Badge>}
              <span className="text-xs text-muted">{fmtDateTime(v.createdAt)}</span>
              {data.perms.pm && v.number !== latest?.number && (
                <Button size="sm" variant="ghost" onClick={() => restore.run(p.id, v.number)}>
                  <RotateCcw className="h-3.5 w-3.5" /> Restore
                </Button>
              )}
            </li>
          ))}
          {!data.factSheets.length && <li className="py-2 text-sm text-muted">No version saved yet. The first version is created when the stakeholder head confirms.</li>}
        </ul>
      </Card>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit: ${editing?.label}`} footer={<Button variant="primary" onClick={() => edit.run(p.id, editing!.key, value)}>Save</Button>}>
        <Field label="Value">
          <Textarea rows={4} value={value} onChange={(e) => setValue(e.target.value)} />
        </Field>
      </Modal>
      <Modal open={!!settling} onClose={() => setSettling(null)} title={`Settle: ${settling?.label}`} footer={<Button variant="primary" onClick={() => settle.run(p.id, settling!.key, choice)}>Use this value</Button>}>
        <div className="space-y-2">
          {settling?.conflict?.map((c, i) => (
            <label key={i} className="flex cursor-pointer items-start gap-2 rounded-md p-2 ring-1 ring-line hover:bg-canvas">
              <input type="radio" checked={choice === c.value} onChange={() => setChoice(c.value)} className="mt-1 accent-[var(--brand-primary)]" />
              <span>
                <span className="block text-sm">{c.value}</span>
                <span className="text-xs text-muted">{c.source.label}</span>
              </span>
            </label>
          ))}
          <Field label="Or type the right value">
            <Input value={choice} onChange={(e) => setChoice(e.target.value)} />
          </Field>
        </div>
      </Modal>
      <Modal open={feedback} onClose={() => setFeedback(false)} title="What is wrong in the Fact Sheet?" footer={<Button variant="primary" onClick={() => comment.run(p.id, feedbackText)}>Send to the PM team</Button>}>
        <Textarea rows={4} value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} placeholder="e.g. The pilot will start in 20 branches, not 120." />
      </Modal>
      <Modal open={compare} onClose={() => setCompare(false)} title="Compare Fact Sheet versions" wide>
        <Compare data={data} />
      </Modal>
    </div>
  )
}
