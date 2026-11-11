/**
 * SQA and UAT testing, one page per stage (used by both the Simple and the Full view).
 *
 * 1. Pick the version being tested (or add a new one).
 * 2. Each testing point gets PASS or FAIL on that version, with an optional comment.
 * 3. The AI writes the points; testers add, edit, regenerate and delete them.
 * 4. When every point passes on a version, the sign-off report is made and sent for approval.
 */
import { BadgeCheck, Check, ChevronDown, ChevronRight, CircleX, ExternalLink, Package, Pencil, Plus, RotateCcw, Sparkles, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import type { CheckResult, TestStage } from '../../types'
import { api } from '../../api'
import { useAction, useApi } from '../../api/hooks'
import { AiBadge, AiNote } from '../../components/ai'
import { ApprovalPanel } from '../../components/ApprovalPanel'
import { DocStatusChip, PointChip } from '../../components/status'
import { fmtDateTime } from '../../components/format'
import { Markdown } from '../../components/Markdown'
import { Badge, Button, Card, EmptyState, ErrorBox, Field, Guarded, Input, Loading, Modal, Note, PageHeader, Segmented, Select, Tabs, Textarea, useTab } from '../../components/ui'
import { MissingPeople } from '../../components/People'

type TData = Awaited<ReturnType<typeof api.testing.getTesting>>
type Point = TData['points'][number]

// ─── The version being tested ───────────────────────────────────────────

function VersionBar({ d, onPick }: { d: TData; onPick: (id: string) => void }) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ version: '', link: '', notes: '' })
  const add = useAction(api.testing.addVersion, { success: 'Version added. The testers were told.', onDone: () => setAdding(false) })
  const v = d.version
  const n = d.counts
  return (
    <Card className="mb-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[180px]">
          <div className="mb-1 text-xs font-medium text-muted">Version being tested</div>
          {d.versions.length ? (
            <Select value={v?.id ?? ''} onChange={(e) => onPick(e.target.value)} className="!w-56">
              {[...d.versions].reverse().map((x, i) => (
                <option key={x.id} value={x.id}>
                  {x.version}
                  {i === 0 ? ' (newest)' : ''}
                  {d.stage === 'UAT' && x.passedSqa ? ' · passed SQA' : ''}
                </option>
              ))}
            </Select>
          ) : (
            <div className="text-sm text-muted">No version yet</div>
          )}
        </div>
        <Guarded check={d.perms.addVersion} onClick={() => { setForm({ version: '', link: '', notes: '' }); setAdding(true) }}>
          <Package className="h-4 w-4" /> Add a version
        </Guarded>
        {v && (
          <div className="ml-auto grid grid-cols-3 gap-4 text-center text-xs">
            <div><div className="text-xl font-semibold text-leaf">{n.pass}</div>PASS</div>
            <div><div className="text-xl font-semibold text-red-600">{n.fail}</div>FAIL</div>
            <div><div className="text-xl font-semibold text-muted">{n.toCheck}</div>to check</div>
          </div>
        )}
      </div>
      {v && (
        <>
          <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-canvas">
            <div className="bg-leaf" style={{ width: `${(n.pass / Math.max(1, n.total)) * 100}%` }} />
            <div className="bg-red-500" style={{ width: `${(n.fail / Math.max(1, n.total)) * 100}%` }} />
          </div>
          <div className="mt-2 text-xs text-muted">
            Version {v.version}, added by {v.addedByName} · {fmtDateTime(v.addedAt)}
            {v.link && (
              <a href={/^https?:\/\//.test(v.link) ? v.link : `https://${v.link}`} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-brand">
                Open it <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {v.notes && <div className="mt-0.5">Notes: {v.notes}</div>}
            {d.open && v.id !== d.versions.at(-1)?.id && <div className="mt-0.5 font-medium text-amber-700">This is not the newest version.</div>}
          </div>
        </>
      )}
      <Modal open={adding} onClose={() => setAdding(false)} title="Add a version to test" footer={<Button variant="primary" onClick={() => add.run(d.project.id, form)}>Add version</Button>}>
        <Field label="Version" hint="For example 1.2. Every point is checked again on a new version."><Input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="1.2" autoFocus /></Field>
        <Field label="Where testers open it (optional)"><Input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://test.brac.example/…" /></Field>
        <Field label="What changed (optional)" hint="For example which failed points it fixes."><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
      </Modal>
    </Card>
  )
}

// ─── One testing point ──────────────────────────────────────────────────

function PointRow({ d, pt, onEdit }: { d: TData; pt: Point; onEdit: (pt: Point) => void }) {
  const [comment, setComment] = useState('')
  const [checking, setChecking] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const record = useAction(api.testing.checkPoint, { onDone: () => { setComment(''); setChecking(false) } })
  const regenerate = useAction(api.testing.regeneratePoint, { success: 'Point rewritten by the AI. Check it again.' })
  const remove = useAction(api.testing.deletePoint, { success: 'Point deleted.' })
  const canCheck = d.perms.test.ok && d.open && !!d.version
  const showControls = canCheck && (pt.status === 'to_check' || checking)
  const mark = (result: CheckResult) => d.version && record.run(pt.id, d.version.id, result, comment)
  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-muted">{pt.key}</span>
        <PointChip status={pt.status} />
        <span className="flex-1" />
        <div className="flex shrink-0 items-center">
          {d.perms.test.ok && (
            <>
              <button className="rounded-full p-1.5 text-muted hover:bg-canvas hover:text-brand" title="Edit" aria-label={`Edit ${pt.key}`} onClick={() => onEdit(pt)}><Pencil className="h-3.5 w-3.5" /></button>
              <button className="rounded-full p-1.5 text-muted hover:bg-canvas hover:text-brand disabled:opacity-40" title="Regenerate with AI" aria-label={`Regenerate ${pt.key}`} disabled={regenerate.pending} onClick={() => regenerate.run(pt.id)}><Sparkles className="h-3.5 w-3.5" /></button>
              <button className="rounded-full p-1.5 text-muted hover:bg-canvas hover:text-red-600" title="Delete" aria-label={`Delete ${pt.key}`} onClick={() => confirm(`Delete ${pt.key}? Its results are deleted too.`) && remove.run(pt.id)}><Trash2 className="h-3.5 w-3.5" /></button>
            </>
          )}
        </div>
      </div>
      <div className="mt-0.5 text-[15px] leading-snug">{pt.text}</div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
        {pt.requirementIds.map((r) => <Badge key={r}>{r}</Badge>)}
        {pt.ai && <AiBadge label="AI" />}
        {pt.needsReview && <Badge tone="amber">Requirement changed: check again</Badge>}
        {pt.history.length > 0 && (
          <button className="inline-flex items-center gap-0.5 hover:text-brand" onClick={() => setShowHistory(!showHistory)}>
            {showHistory ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />} History ({pt.history.length})
          </button>
        )}
      </div>

      {pt.last && !checking && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>
            {pt.last.result === 'pass' ? 'PASS' : 'FAIL'} on {d.version?.version} by {pt.last.byName}
            {pt.last.coveredAs === 'OWNER' && ' (Project Owner)'} · {fmtDateTime(pt.last.at)}
          </span>
          {pt.last.comment && <span className="w-full rounded-xl bg-canvas px-3 py-1.5 text-sm text-ink">“{pt.last.comment}”</span>}
          {canCheck && <button className="inline-flex items-center gap-1 text-brand" onClick={() => setChecking(true)}><RotateCcw className="h-3 w-3" /> Check again</button>}
        </div>
      )}

      {showControls && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment (optional): what you saw" className="!w-auto min-w-0 flex-1 basis-60" aria-label={`Comment on ${pt.key}`} />
          <Button variant="success" disabled={record.pending} onClick={() => mark('pass')}><Check className="h-4 w-4" /> PASS</Button>
          <Button variant="danger" disabled={record.pending} onClick={() => mark('fail')}><X className="h-4 w-4" /> FAIL</Button>
          {checking && <Button variant="ghost" size="sm" onClick={() => setChecking(false)}>Cancel</Button>}
        </div>
      )}

      {showHistory && (
        <ul className="mt-2 space-y-1 rounded-xl bg-canvas px-3 py-2 text-xs">
          {pt.history.map((h) => (
            <li key={h.id} className={h.stale ? 'text-muted line-through' : undefined} title={h.stale ? 'Made before the point changed, so it no longer counts.' : undefined}>
              <b>{h.result === 'pass' ? 'PASS' : 'FAIL'}</b> on {h.versionLabel} · {h.byName} · {fmtDateTime(h.at)}
              {h.comment && <> · “{h.comment}”</>}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function PointModal({ d, pt, onClose }: { d: TData; pt: Partial<Point> | null; onClose: () => void }) {
  const [text, setText] = useState(pt?.text ?? '')
  const [req, setReq] = useState(pt?.requirementIds?.[0] ?? '')
  const save = useAction(api.testing.savePoint, { success: pt?.id ? 'Point saved. Check it again.' : 'Point added.', onDone: onClose })
  return (
    <Modal open onClose={onClose} title={pt?.id ? `Edit ${pt.key}` : 'Add a testing point'} footer={<Button variant="primary" onClick={() => save.run(d.project.id, d.stage, { id: pt?.id, text, requirementIds: req ? [req] : [] })}>Save</Button>}>
      <Field label="What to check" hint="One thing a tester can try and mark PASS or FAIL.">
        <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="A member can log in with the one-time code sent by SMS." autoFocus />
      </Field>
      <Field label="Requirement (optional)">
        <Select value={req} onChange={(e) => setReq(e.target.value)}>
          <option value="">—</option>
          {d.requirements.map((r) => <option key={r.id} value={r.id}>{r.id}: {r.text.slice(0, 70)}</option>)}
        </Select>
      </Field>
      {pt?.id && <p className="text-xs text-muted">Changing the wording means the point is checked again on this version.</p>}
    </Modal>
  )
}

function Points({ d }: { d: TData }) {
  const [filter, setFilter] = useState<'all' | 'to_check' | 'fail' | 'pass'>('all')
  const [editing, setEditing] = useState<Partial<Point> | null | undefined>(undefined)
  const [notTestable, setNotTestable] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const generate = useAction(api.testing.generatePoints, { success: 'The AI is writing the testing points…' })
  const mark = useAction(api.testing.setNotTestable, { onDone: () => setNotTestable(null) })
  const shown = d.points.filter((pt) => filter === 'all' || pt.status === filter)
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {d.perms.test.ok && (
            <>
              <Button variant="primary" disabled={generate.pending} onClick={() => generate.run(d.project.id, d.stage)}><Sparkles className="h-4 w-4" /> Write points with AI</Button>
              <Button onClick={() => setEditing(null)}><Plus className="h-4 w-4" /> Add a point</Button>
            </>
          )}
          <span className="ml-auto" />
          {d.points.length > 0 && (
            <Segmented
              value={filter}
              onChange={(x) => setFilter(x as typeof filter)}
              options={[
                { id: 'all', label: `All (${d.points.length})` },
                { id: 'to_check', label: `To check (${d.counts.toCheck})` },
                { id: 'fail', label: `FAIL (${d.counts.fail})` },
                { id: 'pass', label: `PASS (${d.counts.pass})` },
              ]}
            />
          )}
        </div>
        {!d.perms.test.ok && <Note className="!text-xs">{d.perms.test.reason}</Note>}
        {d.perms.asOwner && <Note className="!text-xs">You are the Project Owner: you can write and check points yourself (recorded as “Project Owner”).</Note>}
        {d.perms.test.ok && d.open && !d.version && d.points.length > 0 && <Note tone="amber">Add the version you are testing first (button above), then mark each point PASS or FAIL.</Note>}
        {d.points.length ? (
          shown.length ? (
            <ul className="shadow-soft divide-y divide-line/70 overflow-hidden rounded-3xl border border-line/70 bg-surface">
              {shown.map((pt) => <PointRow key={pt.id} d={d} pt={pt} onEdit={setEditing} />)}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nothing here.</p>
          )
        ) : (
          <EmptyState title="No testing points yet">
            {d.stage === 'SQA' ? 'The AI writes them from the SRS requirements. SQA testers can add, edit, regenerate and delete them.' : 'The AI writes them from the BRD requirements. Developers, stakeholders and the PM team can add, edit, regenerate and delete them.'}
          </EmptyState>
        )}
        <AiNote agent="testpoints" compact />
      </div>
      <Card title="Requirements covered" subtitle={`Every ${d.stage === 'SQA' ? 'SRS' : 'BRD'} requirement needs at least one point, or the PM marks it Not testable.`}>
        <ul className="space-y-2">
          {d.coverage.map(({ requirement: r, points }) => (
            <li key={r.id} className="text-sm">
              <div className="flex items-start gap-2">
                <b className="w-12 shrink-0 font-mono text-xs">{r.id}</b>
                <span className="flex-1">{r.text}</span>
              </div>
              <div className="mt-0.5 ml-14 flex flex-wrap items-center gap-1">
                {points.map((k) => <Badge key={k}>{k}</Badge>)}
                {!points.length && !r.notTestable && <Badge tone="red">no point</Badge>}
                {r.notTestable && <Badge tone="gray" title={r.notTestable.reason}>Not testable: {r.notTestable.reason.slice(0, 40)}</Badge>}
                {d.perms.pm && !points.length && (r.notTestable ? (
                  <button className="text-[11px] text-brand" onClick={() => mark.run(d.project.id, r.id, null)}>undo</button>
                ) : (
                  <button className="text-[11px] text-brand" onClick={() => { setNotTestable(r.id); setReason('') }}>mark Not testable</button>
                ))}
              </div>
            </li>
          ))}
          {!d.coverage.length && <li className="text-sm text-muted">No requirements yet. They come from the signed {d.stage === 'SQA' ? 'SRS' : 'BRD'}.</li>}
        </ul>
      </Card>
      {editing !== undefined && <PointModal d={d} pt={editing} onClose={() => setEditing(undefined)} />}
      <Modal open={!!notTestable} onClose={() => setNotTestable(null)} title={`Mark ${notTestable} Not testable`} footer={<Button variant="primary" onClick={() => mark.run(d.project.id, notTestable!, reason)}>Save</Button>}>
        <Field label="Why can it not be tested?" hint="Listed in the sign-off report instead of blocking it."><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </Modal>
    </div>
  )
}

// ─── Sign-off ───────────────────────────────────────────────────────────

function SignOff({ d }: { d: TData }) {
  const generate = useAction(api.testing.generateReport, { success: 'Making the report…' })
  const type = d.stage === 'SQA' ? 'SQA_SIGNOFF' : 'UAT_SIGNOFF'
  const { data: doc } = useApi(['doc', d.project.id, type], () => api.documents.getDocument(d.project.id, type))
  const v = d.version
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <Card title={v ? `Ready to sign off version ${v.version}?` : 'Ready to sign off?'} subtitle="All must be met before the report can be sent for approval.">
          <ul className="space-y-1.5 text-sm">
            {d.criteria.items.map((i) => (
              <li key={i.label} className="flex items-start gap-2">
                {i.ok ? <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-leaf" /> : <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />}
                <span>{i.label}{i.detail && <span className="block text-xs text-muted">{i.detail}</span>}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card
          title={<span className="flex flex-wrap items-center gap-2">Sign-off report {doc?.current && <span className="text-xs font-normal text-muted">v{doc.current.number}{d.signoff?.reportVersionLabel ? ` · for version ${d.signoff.reportVersionLabel}` : ''} · {fmtDateTime(doc.current.createdAt)}</span>} {doc?.status && <DocStatusChip status={doc.status} />}</span>}
          subtitle="Made by the app from the results; it cannot be edited by hand. Every number is counted by code."
          actions={<Guarded size="sm" variant="primary" check={!v ? { ok: false, reason: 'Choose a version on the Testing points tab.' } : d.perms.report} onClick={() => v && generate.run(d.project.id, d.stage, v.id)}><Sparkles className="h-3.5 w-3.5" /> {doc?.current ? 'Make it again' : 'Make the report'}{v ? ` for ${v.version}` : ''}</Guarded>}
        >
          {doc?.current ? doc.current.sections.map((s) => (
            <div key={s.id} className="mb-4">
              <h3 className="mb-1 font-semibold">{s.title}</h3>
              <Markdown text={s.content} />
            </div>
          )) : <p className="text-sm text-muted">No report yet.</p>}
          <AiNote agent="signoff" compact />
        </Card>
      </div>
      <div>
        {doc?.doc && doc.current ? (
          <ApprovalPanel docId={doc.doc.id} docType={doc.doc.type} versionId={doc.current.id} versionNumber={doc.current.number} activeChain={doc.activeChain} lastChain={doc.lastChain} chains={doc.chains} send={doc.perms.send} act={doc.perms.act} minor={{ ok: false }} outOfSync={!!doc.doc.outOfSync} frozen={doc.current.frozen} signatures={doc.signatures.filter((s) => s.versionId === doc.current!.id)} />
        ) : (
          <Note>Make the report first. {d.stage === 'SQA' ? 'An SQA tester makes it and sends it to the tech head for approval.' : 'The PM makes it and sends it through PM → tech head → stakeholder head; then the sponsor head signs.'}</Note>
        )}
      </div>
    </div>
  )
}

export function TestingPage() {
  const { pid = '', stage = 'SQA' } = useParams()
  const [tab, setTab] = useTab('points')
  const [params, setParams] = useSearchParams()
  const versionId = params.get('version') ?? undefined
  const { data, isLoading, error } = useApi(['testing', pid, stage, versionId ?? 'newest'], () => api.testing.getTesting(pid, stage as TestStage, versionId))
  if (isLoading) return <Loading />
  if (error || !data) return <ErrorBox error={error} />
  const pick = (id: string) =>
    setParams((p) => {
      const n = new URLSearchParams(p)
      n.set('version', id)
      return n
    }, { replace: true })
  return (
    <div>
      <PageHeader
        eyebrow={<Link to={`/projects/${pid}`}>{data.project.name}</Link>}
        title={stage === 'SQA' ? 'SQA: technical testing' : 'UAT: user testing'}
        subtitle={stage === 'SQA' ? 'SQA testers check the system against the SRS. Pick the version, then mark each point PASS or FAIL.' : 'Developers, stakeholders and the PM team check the system against the BRD. Starts after the SQA sign-off.'}
      />
      <MissingPeople pid={pid} missing={data.missing} canAdd={data.perms.canAddPeople} before={stage === 'SQA' ? 'Before technical testing (SQA) can run' : 'Before user testing (UAT) can run'} className="mb-4" />
      {!data.stageReady.ok && <Note tone="amber" className="mb-4">{stage === 'SQA' ? 'SQA starts after the SRS is signed.' : 'UAT starts after the SQA sign-off is approved.'} {data.stageReady.reason} The points can be written already.</Note>}
      {data.stageReady.ok && !data.open && <Note tone="green" className="mb-4">{stage} is signed off. The results are kept here to read.</Note>}
      <VersionBar d={data} onPick={pick} />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'points', label: `Testing points (${data.points.length})` },
          { id: 'signoff', label: 'Sign-off' },
        ]}
      />
      {tab === 'signoff' ? <SignOff d={data} /> : <Points d={data} />}
    </div>
  )
}
