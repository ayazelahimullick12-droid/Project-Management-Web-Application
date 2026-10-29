/**
 * SQA and UAT (SPEC_SQA_UAT.md): overview, test cases, builds, test runs, the defect board and sign-off.
 */
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { BadgeCheck, Bug, CheckCheck, CircleX, Columns3, List, Package, Pencil, Play, Plus, Rocket, Sparkles, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { clsx } from 'clsx'
import type { DefectStatus, Severity, TestCase, TestStage } from '../../types'
import { api } from '../../api'
import { useAction, useApi, useSessionUserId } from '../../api/hooks'
import { BOARD_COLUMNS, OUTCOMES } from '../../rules/testing'
import { AiBadge, AiNote } from '../../components/ai'
import { ApprovalPanel } from '../../components/ApprovalPanel'
import { DefectStatusChip, DocStatusChip, ResultChip, SeverityChip } from '../../components/status'
import { fmtDateTime } from '../../components/format'
import { Markdown } from '../../components/Markdown'
import { OpenQuestion } from '../../components/OpenQuestion'
import { Badge, Button, Card, EmptyState, ErrorBox, Field, Guarded, Input, Loading, Modal, Note, PageHeader, Select, Table, Tabs, Td, Textarea, useTab } from '../../components/ui'
import { useToast } from '../../components/toast'
import { MoveDialog, NewDefectModal } from './DefectForms'
import { MissingPeople } from '../../components/People'

type TData = Awaited<ReturnType<typeof api.testing.getTesting>>

// ─── Overview ───────────────────────────────────────────────────────────

function Overview({ d }: { d: TData }) {
  const st = d.stats
  const bySev = d.severities.map((sev) => ({ sev, n: d.defects.filter((x) => x.severity === sev && ['New', 'Open', 'In progress', 'Fixed', 'Ready for retest', 'Reopened'].includes(x.status)).length }))
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Test progress">
        <div className="mb-2 flex h-3 overflow-hidden rounded bg-canvas">
          <div className="bg-leaf" style={{ width: `${(st.pass / Math.max(1, st.total)) * 100}%` }} />
          <div className="bg-red-500" style={{ width: `${(st.fail / Math.max(1, st.total)) * 100}%` }} />
          <div className="bg-amber-400" style={{ width: `${(st.blocked / Math.max(1, st.total)) * 100}%` }} />
        </div>
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          {[['Passed', st.pass, 'text-leaf'], ['Failed', st.fail, 'text-red-600'], ['Blocked', st.blocked, 'text-amber-600'], ['Not run', st.notRun, 'text-muted']].map(([l, n, c]) => (
            <div key={l as string}>
              <div className={`text-xl font-semibold ${c}`}>{n}</div>
              {l}
            </div>
          ))}
        </div>
        <div className="mt-3 text-xs text-muted">Coverage: {st.covered} of {st.requirements} {d.stage === 'SQA' ? 'SRS' : 'BRD'} requirements have a test case.</div>
      </Card>
      <Card title="Unresolved defects by severity">
        <ul className="space-y-1.5">
          {bySev.map(({ sev, n }) => (
            <li key={sev} className="flex items-center justify-between">
              <SeverityChip severity={sev} />
              <span className="font-semibold">{n}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 text-xs text-muted">{d.blocking.join(' and ')} defects block sign-off. <OpenQuestion id="blocking" /></div>
      </Card>
      <Card title="Exit criteria">
        <ul className="space-y-1.5 text-sm">
          {d.criteria.items.map((i) => (
            <li key={i.label} className="flex items-start gap-2">
              {i.ok ? <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-leaf" /> : <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />}
              <span>
                {i.label}
                {i.detail && <span className="block text-xs text-muted">{i.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

// ─── Test cases ─────────────────────────────────────────────────────────

function TestCaseModal({ d, tc, onClose }: { d: TData; tc: Partial<TestCase> | null; onClose: () => void }) {
  const [v, setV] = useState<Partial<TestCase>>(tc ?? { steps: [], requirementIds: [], priority: 'Medium' })
  const save = useAction(api.testing.saveTestCase, { success: 'Test case saved.', onDone: onClose })
  return (
    <Modal open onClose={onClose} title={tc?.id ? `Edit ${tc.key}` : 'New test case'} wide footer={<Button variant="primary" onClick={() => save.run(d.project.id, d.stage, v)}>Save{tc?.ai && !tc.acceptedBy ? ' and accept' : ''}</Button>}>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <Field label="Title"><Input value={v.title ?? ''} onChange={(e) => setV({ ...v, title: e.target.value })} /></Field>
        </div>
        <Field label="Preconditions"><Textarea rows={2} value={v.preconditions ?? ''} onChange={(e) => setV({ ...v, preconditions: e.target.value })} /></Field>
        <Field label="Expected result"><Textarea rows={2} value={v.expected ?? ''} onChange={(e) => setV({ ...v, expected: e.target.value })} /></Field>
        <div className="md:col-span-2">
          <Field label="Steps (one per line)"><Textarea rows={4} value={(v.steps ?? []).join('\n')} onChange={(e) => setV({ ...v, steps: e.target.value.split('\n').filter(Boolean) })} /></Field>
        </div>
        <Field label="Requirement">
          <Select value={v.requirementIds?.[0] ?? ''} onChange={(e) => setV({ ...v, requirementIds: e.target.value ? [e.target.value] : [] })}>
            <option value="">—</option>
            {d.requirements.map((r) => <option key={r.id} value={r.id}>{r.id}: {r.text.slice(0, 60)}</option>)}
          </Select>
        </Field>
        <Field label="Priority">
          <Select value={v.priority} onChange={(e) => setV({ ...v, priority: e.target.value as TestCase['priority'] })}>
            {['High', 'Medium', 'Low'].map((p) => <option key={p}>{p}</option>)}
          </Select>
        </Field>
      </div>
    </Modal>
  )
}

function Cases({ d }: { d: TData }) {
  const [editing, setEditing] = useState<Partial<TestCase> | null | undefined>(undefined)
  const [notTestable, setNotTestable] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const draft = useAction(api.testing.draftTests, { success: 'The AI is drafting test cases…' })
  const accept = useAction(api.testing.acceptTestCases, { success: 'All AI drafts accepted.' })
  const confirm = useAction(api.testing.confirmList, { success: 'List confirmed. Testing can start.' })
  const mark = useAction(api.testing.setNotTestable, { onDone: () => setNotTestable(null) })
  const unaccepted = d.tests.filter((t) => t.ai && !t.acceptedBy).length
  return (
    <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {d.perms.writeTests.ok && (
            <>
              <Button variant="primary" onClick={() => draft.run(d.project.id, d.stage)}><Sparkles className="h-4 w-4" /> Draft test cases with AI</Button>
              <Button onClick={() => setEditing(null)}><Plus className="h-4 w-4" /> New</Button>
              {unaccepted > 0 && <Button onClick={() => accept.run(d.project.id, d.stage)}><CheckCheck className="h-4 w-4" /> Accept all {unaccepted} AI drafts</Button>}
            </>
          )}
          <span className="ml-auto" />
          {d.confirmation ? (
            <Badge tone="green"><BadgeCheck className="h-3 w-3" /> List confirmed by {d.confirmation.byName}{d.confirmation.actingForName ? ` (for ${d.confirmation.actingForName})` : ''}</Badge>
          ) : (
            <Guarded variant="success" check={d.tests.length ? d.perms.confirmList : { ok: false, reason: 'No test cases yet.' }} onClick={() => confirm.run(d.project.id, d.stage)}>
              <BadgeCheck className="h-4 w-4" /> Confirm the list ({d.stage === 'SQA' ? 'tech head' : 'stakeholder head'})
            </Guarded>
          )}
        </div>
        {!d.perms.writeTests.ok && <Note className="!text-xs">{d.perms.writeTests.reason}</Note>}
        {d.tests.length ? (
          <Card padded={false}>
            <Table head={['Key', 'Test case', 'Requirement', 'Priority', 'Latest', '']}>
              {d.tests.map((t) => (
                <tr key={t.id}>
                  <Td className="font-mono text-xs">{t.key}</Td>
                  <Td>
                    <div className="font-medium">{t.title}</div>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      <Badge>{t.type}</Badge>
                      {t.ai && !t.acceptedBy && <AiBadge label="AI draft" />}
                      {t.needsReview && <Badge tone="red">Needs review</Badge>}
                    </div>
                  </Td>
                  <Td className="text-xs">{t.requirementIds.join(', ')}</Td>
                  <Td className="text-xs">{t.priority}</Td>
                  <Td><ResultChip result={t.needsReview ? 'not_run' : t.latest?.result} /></Td>
                  <Td>{d.perms.writeTests.ok && <button className="rounded p-1 text-muted hover:text-brand" onClick={() => setEditing(t)} title="Edit"><Pencil className="h-3.5 w-3.5" /></button>}</Td>
                </tr>
              ))}
            </Table>
          </Card>
        ) : (
          <EmptyState title="No test cases yet">{d.stage === 'SQA' ? 'SQA tests come from the SRS requirements.' : 'UAT tests come from the BRD requirements, as business scenarios.'}</EmptyState>
        )}
        <AiNote agent="testcases" compact />
      </div>
      <Card title="Coverage" subtitle={`Every ${d.stage === 'SQA' ? 'SRS' : 'BRD'} requirement needs at least one test, or the PM marks it Not testable.`}>
        <ul className="space-y-2">
          {d.coverage.map(({ requirement: r, tests }) => (
            <li key={r.id} className="text-sm">
              <div className="flex items-start gap-2">
                <b className="w-12 shrink-0 font-mono text-xs">{r.id}</b>
                <span className="flex-1">{r.text}</span>
              </div>
              <div className="mt-0.5 ml-14 flex flex-wrap items-center gap-1">
                {tests.map((t) => <Badge key={t.id}>{t.key}</Badge>)}
                {!tests.length && !r.notTestable && <Badge tone="red">no test</Badge>}
                {r.notTestable && <Badge tone="gray" title={r.notTestable.reason}>Not testable: {r.notTestable.reason.slice(0, 40)}…</Badge>}
                {d.perms.pm && !tests.length && (r.notTestable ? (
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
      {editing !== undefined && <TestCaseModal d={d} tc={editing} onClose={() => setEditing(undefined)} />}
      <Modal open={!!notTestable} onClose={() => setNotTestable(null)} title={`Mark ${notTestable} Not testable`} footer={<Button variant="primary" onClick={() => mark.run(d.project.id, notTestable!, reason)}>Save</Button>}>
        <Field label="Why can it not be tested?" hint="Listed in the sign-off report instead of blocking it."><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </Modal>
    </div>
  )
}

// ─── Builds ─────────────────────────────────────────────────────────────

function Builds({ d }: { d: TData }) {
  const [registering, setRegistering] = useState(false)
  const [form, setForm] = useState({ version: '', envUrl: '', notes: '', fixesDefectIds: [] as string[] })
  const register = useAction(api.testing.registerBuild, { success: 'Build registered. The SQA team was notified.', onDone: () => setRegistering(false) })
  const release = useAction(api.testing.releaseToUat, { success: 'Released to UAT. Testers and reporters were notified.' })
  const verify = useAction(api.testing.verifyFix, { success: 'Fix checked.' })
  const { data: all } = useApi(['testing', d.project.id, 'SQA', 'for-builds'], () => api.testing.getTesting(d.project.id, 'SQA'))
  const { data: uat } = useApi(['testing', d.project.id, 'UAT', 'for-builds'], () => api.testing.getTesting(d.project.id, 'UAT'))
  const fixable = [...(all?.defects ?? []), ...(uat?.defects ?? [])].filter((x) => ['Open', 'In progress', 'Reopened'].includes(x.status))
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {d.perms.registerBuild && <Button variant="primary" onClick={() => setRegistering(true)}><Package className="h-4 w-4" /> Register a build</Button>}
        <span className="text-xs text-muted">A new build goes to SQA first. Only SQA can release it to UAT, after checking it.</span>
      </div>
      {[...d.builds].reverse().map((b) => (
        <Card
          key={b.id}
          title={<span className="flex items-center gap-2"><Package className="h-4 w-4" /> Build {b.version} {b.releasedToUatAt ? <Badge tone="green">in UAT</Badge> : <Badge tone="blue">in SQA</Badge>}</span>}
          subtitle={`Registered by ${b.registeredByName} · ${fmtDateTime(b.registeredAt)}${b.releasedToUatAt ? ` · released to UAT ${fmtDateTime(b.releasedToUatAt)} by ${b.releasedByName}` : ''}`}
          actions={!b.releasedToUatAt && <Guarded size="sm" variant="primary" check={b.release} onClick={() => release.run(b.id)}><Rocket className="h-3.5 w-3.5" /> Release to UAT</Guarded>}
        >
          <div className="text-sm">{b.notes}</div>
          {b.envUrl && <div className="mt-1 text-xs text-muted">Test environment: {b.envUrl}</div>}
          {b.fixes.length > 0 && (
            <div className="mt-2">
              <div className="mb-1 text-xs font-medium">Claims to fix</div>
              <ul className="space-y-1">
                {b.fixes.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <Link to={`/projects/${d.project.id}/defects/${f.id}`} className="font-mono text-xs text-brand">{f.key}</Link>
                    <DefectStatusChip status={f.status} />
                    {f.stage === 'UAT' && (f.verified ? <Badge tone="green">checked by SQA</Badge> : f.status === 'Fixed' && !b.releasedToUatAt && <Badge tone="amber">SQA check needed</Badge>)}
                    {f.stage === 'UAT' && f.status === 'Fixed' && !f.verified && !b.releasedToUatAt && d.perms.sqa && (
                      <>
                        <Button size="sm" onClick={() => verify.run(f.id, true)}>Fix works</Button>
                        <Button size="sm" variant="danger" onClick={() => { const r = prompt('What still fails?'); if (r) verify.run(f.id, false, r) }}>Still fails</Button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      ))}
      {!d.builds.length && <EmptyState title="No builds yet">Developers register a build when it is ready to test.</EmptyState>}
      <Modal open={registering} onClose={() => setRegistering(false)} title="Register a build" footer={<Button variant="primary" onClick={() => register.run(d.project.id, form)}>Register</Button>}>
        <Field label="Version"><Input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="e.g. 1.2" /></Field>
        <Field label="Test environment link"><Input value={form.envUrl} onChange={(e) => setForm({ ...form, envUrl: e.target.value })} placeholder="https://test.brac.example/…" /></Field>
        <Field label="Release notes"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        <Field label="Defects this build fixes" hint="They are marked Fixed in this build.">
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-md bg-canvas p-2">
            {fixable.map((x) => (
              <label key={x.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.fixesDefectIds.includes(x.id)} onChange={(e) => setForm({ ...form, fixesDefectIds: e.target.checked ? [...form.fixesDefectIds, x.id] : form.fixesDefectIds.filter((i) => i !== x.id) })} />
                <span className="font-mono text-xs">{x.key}</span> {x.title}
              </label>
            ))}
            {!fixable.length && <span className="text-xs text-muted">No open defects.</span>}
          </div>
        </Field>
      </Modal>
    </div>
  )
}

// ─── Runs ───────────────────────────────────────────────────────────────

function Runs({ d }: { d: TData }) {
  const [creating, setCreating] = useState(false)
  const [open, setOpen] = useState<string | null>(d.runs[0]?.id ?? null)
  const testers = d.members.filter((m) => (d.stage === 'SQA' ? m.isSqa : m.team === 'STAKEHOLDER' || m.team === 'PM'))
  const available = d.builds.filter((b) => b.available)
  const [form, setForm] = useState({ buildId: available.at(-1)?.id ?? '', name: '', picks: {} as Record<string, string> })
  const create = useAction(api.testing.createRun, { success: 'Run created. Testers were notified.', onDone: () => setCreating(false) })
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {d.perms.createRun && (
          <Guarded variant="primary" check={d.confirmation ? { ok: true } : { ok: false, reason: 'Confirm the test case list first.' }} onClick={() => { setForm({ buildId: available.at(-1)?.id ?? '', name: '', picks: Object.fromEntries(d.tests.map((t, i) => [t.id, testers[i % Math.max(1, testers.length)]?.userId ?? ''])) }); setCreating(true) }}>
            <Play className="h-4 w-4" /> New test run
          </Guarded>
        )}
      </div>
      {d.runs.map((r) => (
        <Card key={r.id} title={<button className="text-left" onClick={() => setOpen(open === r.id ? null : r.id)}>{r.name}</button>} subtitle={`Build ${r.buildVersion} · by ${r.createdByName} · ${fmtDateTime(r.createdAt)}`} actions={<span className="text-xs text-muted">{r.done}/{r.total} run · {r.pass} pass · {r.fail} fail · {r.blocked} blocked</span>} padded={open === r.id ? false : true}>
          {open === r.id ? (
            <Table head={['Test', 'Tester', 'Result', 'Defects', 'When']}>
              {r.executions.map((e) => (
                <tr key={e.id}>
                  <Td><span className="font-mono text-xs">{e.testKey}</span> {e.testTitle}</Td>
                  <Td className="text-xs">{e.assigneeName}</Td>
                  <Td><ResultChip result={e.result} />{e.blockedReason && <div className="text-[11px] text-muted">{e.blockedReason}</div>}</Td>
                  <Td className="text-xs">{e.defectKeys.join(', ')}</Td>
                  <Td className="text-xs text-muted">{fmtDateTime(e.executedAt)}</Td>
                </tr>
              ))}
            </Table>
          ) : (
            <div className="h-2 overflow-hidden rounded bg-canvas"><div className="h-full bg-leaf" style={{ width: `${(r.done / Math.max(1, r.total)) * 100}%` }} /></div>
          )}
        </Card>
      ))}
      {!d.runs.length && <EmptyState title="No runs yet">A run is one round of testing on one build. Testers find their tests in My tests.</EmptyState>}
      <Modal open={creating} onClose={() => setCreating(false)} title="New test run" wide footer={<Button variant="primary" onClick={() => create.run(d.project.id, d.stage, { buildId: form.buildId, name: form.name, assignments: Object.entries(form.picks).filter(([, u]) => u).map(([testCaseId, userId]) => ({ testCaseId, userId })) })}>Create run</Button>}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Build" hint={d.stage === 'UAT' ? 'Only builds released to UAT.' : undefined}>
            <Select value={form.buildId} onChange={(e) => setForm({ ...form, buildId: e.target.value })}>
              {available.map((b) => <option key={b.id} value={b.id}>{b.version}</option>)}
            </Select>
          </Field>
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Regression on build 1.1" /></Field>
        </div>
        <div className="mb-1 text-xs font-medium">Test cases and testers (leave a tester empty to skip a test)</div>
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {d.tests.map((t) => (
            <div key={t.id} className="flex items-center gap-2 text-sm">
              <span className="w-24 font-mono text-xs">{t.key}</span>
              <span className="flex-1 truncate">{t.title}</span>
              <Select value={form.picks[t.id] ?? ''} onChange={(e) => setForm({ ...form, picks: { ...form.picks, [t.id]: e.target.value } })} className="!w-48 !py-1 text-xs">
                <option value="">skip</option>
                {testers.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
              </Select>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}

// ─── Defects (board and list) ───────────────────────────────────────────

type DefectRow = TData['defects'][number]

function DefectCard({ x, pid, draggable }: { x: DefectRow; pid: string; draggable: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: x.id, disabled: !draggable })
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined} className={clsx('rounded-md bg-surface p-2 text-xs shadow-sm ring-1 ring-line', draggable && 'cursor-grab', isDragging && 'z-50 opacity-80 shadow-lg')}>
      <div className="mb-1 flex items-center gap-1.5">
        <Link to={`/projects/${pid}/defects/${x.id}`} className="font-mono font-medium text-brand" onPointerDown={(e) => e.stopPropagation()}>{x.key}</Link>
        <SeverityChip severity={x.severity} />
        {x.ai && <Sparkles className="h-3 w-3 text-violet-600" />}
      </div>
      <div className="mb-1 line-clamp-2 font-medium">{x.title}</div>
      <div className="text-muted">{x.assigneeName ?? 'unassigned'}</div>
    </div>
  )
}

function Column({ status, children, can }: { status: DefectStatus; children: React.ReactNode; can: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <div ref={setNodeRef} className={clsx('flex w-52 shrink-0 flex-col rounded-lg p-2', isOver ? (can ? 'bg-leaf-soft ring-2 ring-leaf' : 'bg-red-50 ring-2 ring-red-300') : 'bg-canvas')}>
      <div className="mb-2 flex items-center justify-between px-1">
        <DefectStatusChip status={status} />
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}

function Defects({ d }: { d: TData }) {
  const uid = useSessionUserId()
  const toast = useToast()
  const navigate = useNavigate()
  const [view, setView] = useState<'board' | 'list'>('board')
  const [filter, setFilter] = useState<'all' | 'mine' | 'raised' | 'retest' | 'untriaged'>('all')
  const [severity, setSeverity] = useState<Severity | ''>('')
  const [showOutcomes, setShowOutcomes] = useState(false)
  const outcomeCount = d.defects.filter((x) => OUTCOMES.includes(x.status)).length
  const [raising, setRaising] = useState(false)
  const [moving, setMoving] = useState<{ defect: DefectRow; to: DefectStatus } | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const list = useMemo(
    () =>
      d.defects.filter((x) => {
        if (severity && x.severity !== severity) return false
        if (filter === 'mine') return x.assigneeId === uid
        if (filter === 'raised') return x.reporterId === uid
        if (filter === 'retest') return x.status === 'Ready for retest' && x.reporterId === uid
        if (filter === 'untriaged') return x.status === 'New'
        return true
      }),
    [d.defects, filter, severity, uid],
  )
  const onDragEnd = (e: DragEndEvent) => {
    const x = d.defects.find((y) => y.id === e.active.id)
    const to = e.over?.id as DefectStatus | undefined
    if (!x || !to || to === x.status) return
    const move = x.moves.find((m) => m.to === to)
    if (!move) return toast.error(`You cannot move ${x.key} from ${x.status} to ${to}. Allowed for you: ${x.moves.map((m) => m.to).join(', ') || 'nothing'}.`)
    setMoving({ defect: x, to })
  }
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Guarded variant="primary" check={d.perms.raise} onClick={() => setRaising(true)}><Bug className="h-4 w-4" /> Raise a defect</Guarded>
        <div className="ml-2 flex overflow-hidden rounded-md ring-1 ring-line">
          <button onClick={() => setView('board')} className={clsx('px-2.5 py-1.5', view === 'board' ? 'bg-ink text-canvas' : 'bg-surface')}><Columns3 className="h-4 w-4" /></button>
          <button onClick={() => setView('list')} className={clsx('px-2.5 py-1.5', view === 'list' ? 'bg-ink text-canvas' : 'bg-surface')}><List className="h-4 w-4" /></button>
        </div>
        {([['all', 'All'], ['mine', 'Assigned to me'], ['raised', 'Raised by me'], ['retest', 'Waiting for my retest'], ['untriaged', 'Untriaged']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={clsx('rounded-full px-2.5 py-1 text-xs ring-1', filter === k ? 'bg-brand-soft text-brand ring-brand' : 'bg-surface ring-line')}>{l}</button>
        ))}
        <Select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)} className="!w-36 !py-1 text-xs">
          <option value="">All severities</option>
          {d.severities.map((s) => <option key={s}>{s}</option>)}
        </Select>
        {view === 'board' && (
          <button onClick={() => setShowOutcomes(!showOutcomes)} className={clsx('rounded-full px-2.5 py-1 text-xs ring-1', showOutcomes ? 'bg-brand-soft text-brand ring-brand' : 'bg-surface ring-line')}>
            {showOutcomes ? 'Hide' : 'Show'} rejected, duplicate, deferred ({outcomeCount})
          </button>
        )}
        {d.stage === 'SQA' && <OpenQuestion id="sqa-visible" />}
      </div>
      {view === 'board' ? (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-3">
            {(showOutcomes ? [...BOARD_COLUMNS, ...OUTCOMES] : BOARD_COLUMNS).map((col) => {
              const items = list.filter((x) => x.status === col)
              if (OUTCOMES.includes(col) && !items.length) return <Column key={col} status={col} can={false}><div className="px-1 text-[11px] text-muted">PM only. Drop here with a reason.</div></Column>
              return (
                <Column key={col} status={col} can>
                  {items.map((x) => <DefectCard key={x.id} x={x} pid={d.project.id} draggable={x.moves.length > 0} />)}
                  {!items.length && <div className="px-1 text-[11px] text-muted">empty</div>}
                </Column>
              )
            })}
          </div>
          <p className="text-xs text-muted">Drag a card to move it. Only the moves you are allowed to make are accepted; anything else snaps back with the reason.</p>
        </DndContext>
      ) : (
        <Card padded={false}>
          <Table head={['Key', 'Title', 'Severity', 'Status', 'Reporter', 'Assignee', 'Updated']}>
            {list.map((x) => (
              <tr key={x.id} className="cursor-pointer hover:bg-canvas" onClick={() => navigate(`/projects/${d.project.id}/defects/${x.id}`)}>
                <Td className="font-mono text-xs text-brand">{x.key}</Td>
                <Td>{x.title}</Td>
                <Td><SeverityChip severity={x.severity} /></Td>
                <Td><DefectStatusChip status={x.status} /></Td>
                <Td className="text-xs">{x.reporterName}</Td>
                <Td className="text-xs">{x.assigneeName ?? '—'}</Td>
                <Td className="text-xs text-muted">{fmtDateTime(x.updatedAt)}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
      {raising && <NewDefectModal pid={d.project.id} stage={d.stage} tests={d.tests} onClose={() => setRaising(false)} />}
      {moving && <MoveDialog defectId={moving.defect.id} pid={d.project.id} to={moving.to} needs={moving.defect.moves.find((m) => m.to === moving.to)!.needs} label={moving.defect.moves.find((m) => m.to === moving.to)!.label} onClose={() => setMoving(null)} />}
    </div>
  )
}

// ─── Sign-off ───────────────────────────────────────────────────────────

function SignOff({ d }: { d: TData }) {
  const generate = useAction(api.testing.generateReport, { success: 'Generating the report…' })
  const { data: doc } = useApi(['doc', d.project.id, d.stage === 'SQA' ? 'SQA_SIGNOFF' : 'UAT_SIGNOFF'], () => api.documents.getDocument(d.project.id, d.stage === 'SQA' ? 'SQA_SIGNOFF' : 'UAT_SIGNOFF'))
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <Card title="Exit criteria" subtitle="All must be met before the sign-off can be sent.">
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
          title={<span className="flex items-center gap-2">Sign-off report {doc?.current && <span className="text-xs font-normal text-muted">v{doc.current.number} · {fmtDateTime(doc.current.createdAt)}</span>} {doc?.status && <DocStatusChip status={doc.status} />}</span>}
          subtitle="Generated by the app; it cannot be edited by hand. Every number is counted by code."
          actions={<Guarded size="sm" variant="primary" check={d.perms.generateReport ? { ok: true } : { ok: false, reason: d.stage === 'SQA' ? 'An SQA tester generates it.' : 'The PM generates it.' }} onClick={() => generate.run(d.project.id, d.stage)}><Sparkles className="h-3.5 w-3.5" /> {doc?.current ? 'Regenerate' : 'Generate'} report</Guarded>}
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
          <Note>Generate the report first. {d.stage === 'SQA' ? 'An SQA tester sends it to the tech head for approval.' : 'The PM sends it through PM → tech head → stakeholder head, then the sponsor head signs.'}</Note>
        )}
      </div>
    </div>
  )
}

export function TestingPage() {
  const { pid = '', stage = 'SQA' } = useParams()
  const [tab, setTab] = useTab('overview')
  const { data, isLoading, error } = useApi(['testing', pid, stage], () => api.testing.getTesting(pid, stage as TestStage))
  if (isLoading) return <Loading />
  if (error || !data) return <ErrorBox error={error} />
  const unresolved = data.defects.filter((x) => ['New', 'Open', 'In progress', 'Fixed', 'Ready for retest', 'Reopened'].includes(x.status)).length
  return (
    <div>
      <PageHeader
        eyebrow={<Link to={`/projects/${pid}`}>{data.project.name}</Link>}
        title={stage === 'SQA' ? 'SQA: testing by the SQA team' : 'UAT: testing by business users'}
        subtitle={stage === 'SQA' ? 'Checks the system was built correctly against the SRS. Comes first; business users only get builds that SQA has passed.' : 'Checks the system works for real business tasks, against the BRD. Starts after the SQA sign-off.'}
      />
      <MissingPeople pid={pid} missing={data.missing} canAdd={data.perms.canAddPeople} before={stage === 'SQA' ? 'Before technical testing (SQA) can run' : 'Before user testing (UAT) can run'} className="mb-4" />
      {!data.stageReady.ok && <Note tone="amber" className="mb-4">{stage === 'SQA' ? 'SQA starts after the SRS is signed.' : 'UAT starts after the SQA sign-off is approved.'} {data.stageReady.reason} {stage === 'UAT' && 'UAT test cases can be prepared and confirmed already.'}</Note>}
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'cases', label: `Test cases (${data.tests.length})` },
          { id: 'builds', label: `Builds (${data.builds.length})` },
          { id: 'runs', label: `Runs (${data.runs.length})` },
          { id: 'defects', label: `Defects (${unresolved} unresolved)` },
          { id: 'signoff', label: 'Sign-off' },
        ]}
      />
      {tab === 'overview' && <Overview d={data} />}
      {tab === 'cases' && <Cases d={data} />}
      {tab === 'builds' && <Builds d={data} />}
      {tab === 'runs' && <Runs d={data} />}
      {tab === 'defects' && <Defects d={data} />}
      {tab === 'signoff' && <SignOff d={data} />}
    </div>
  )
}

export { X }
