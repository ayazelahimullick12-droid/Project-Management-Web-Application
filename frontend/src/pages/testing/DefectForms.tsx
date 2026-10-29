/** Forms for raising defects (with the AI defect writer and duplicate check), moving them, and recording test results. */
import { Bug, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { DefectStatus, Severity, TestStage } from '../../types'
import { api } from '../../api'
import type { NewDefect } from '../../api/testing'
import { useAction, useApi, useSettled } from '../../api/hooks'
import { AiBadge, AiNote } from '../../components/ai'
import { FileButton } from '../../components/FileButton'
import { Button, Field, Input, Modal, Note, Select, Textarea } from '../../components/ui'

const SEVERITY_HELP: Record<Severity, string> = {
  Critical: 'Work stops, or money or data is wrong. No workaround.',
  High: 'A major function is broken, but there is a workaround.',
  Medium: 'A minor function is broken.',
  Low: 'Cosmetic: wording, layout, colours.',
}

export function DefectFields({ pid, stage, value, onChange, tests, fixedTestId }: { pid: string; stage: TestStage; value: NewDefect; onChange: (v: NewDefect) => void; tests: { id: string; key: string; title: string }[]; fixedTestId?: string }) {
  const [note, setNote] = useState('')
  const write = useAction(api.testing.writeDefect, { onDone: (r) => onChange({ ...value, ...r, ai: true }) })
  const text = useSettled(`${value.title} ${value.actual}`.trim(), 900)
  const { data: dupes } = useApi(['dupes', pid, stage, text], () => api.testing.possibleDuplicates(pid, stage, text), text.length > 8)
  return (
    <div>
      <div className="mb-3 rounded-md bg-violet-50/60 p-3 ring-1 ring-violet-200">
        <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-violet-900">
          <Sparkles className="h-3.5 w-3.5" /> Write it up with AI
        </div>
        <div className="flex gap-2">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Rough note, e.g. save doesn't work on the loan page" />
          <Button size="sm" disabled={write.pending} onClick={() => write.run(pid, note, fixedTestId ?? value.testCaseId)}>
            {write.pending ? 'Writing…' : 'Write'}
          </Button>
        </div>
      </div>
      {value.ai && <div className="mb-2"><AiBadge label="Written by the AI defect writer: check it" /></div>}
      <Field label="Title"><Input value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value })} /></Field>
      {dupes && dupes.length > 0 && (
        <Note tone="amber" className="mb-3 !text-xs">
          Possible duplicates (AI, similar meaning):{' '}
          {dupes.map((x) => (
            <a key={x.id} href={`/projects/${pid}/defects/${x.id}`} target="_blank" rel="noreferrer" className="mr-2 font-medium underline">
              {x.key} {x.title} ({Math.round(x.score * 100)}%)
            </a>
          ))}
          <div>If it is the same problem, link to that defect instead of raising a new one.</div>
        </Note>
      )}
      <Field label="Steps to reproduce"><Textarea rows={3} value={value.steps} onChange={(e) => onChange({ ...value, steps: e.target.value })} /></Field>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Expected result"><Textarea rows={2} value={value.expected} onChange={(e) => onChange({ ...value, expected: e.target.value })} /></Field>
        <Field label="Actual result"><Textarea rows={2} value={value.actual} onChange={(e) => onChange({ ...value, actual: e.target.value })} /></Field>
        <Field label="Severity" hint={SEVERITY_HELP[value.severity]}>
          <Select value={value.severity} onChange={(e) => onChange({ ...value, severity: e.target.value as Severity })}>
            {(['Critical', 'High', 'Medium', 'Low'] as const).map((s) => <option key={s}>{s}</option>)}
          </Select>
        </Field>
        {!fixedTestId && (
          <Field label="Test case (optional)">
            <Select value={value.testCaseId ?? ''} onChange={(e) => onChange({ ...value, testCaseId: e.target.value || undefined })}>
              <option value="">—</option>
              {tests.map((t) => <option key={t.id} value={t.id}>{t.key}: {t.title}</option>)}
            </Select>
          </Field>
        )}
      </div>
      <div className="flex items-center gap-2">
        <FileButton size="sm" accept="image/*,.pdf,.txt,.log" onPick={(f) => onChange({ ...value, files: [...(value.files ?? []), f.name] })}>Attach a screenshot</FileButton>
        <span className="text-xs text-muted">{(value.files ?? []).join(', ')}</span>
      </div>
      <div className="mt-3 space-y-2">
        <AiNote agent="defectwriter" compact />
        <AiNote agent="duplicates" compact />
      </div>
    </div>
  )
}

const EMPTY: NewDefect = { title: '', steps: '', expected: '', actual: '', severity: 'Medium' }

export function NewDefectModal({ pid, stage, tests, onClose }: { pid: string; stage: TestStage; tests: { id: string; key: string; title: string }[]; onClose: () => void }) {
  const [v, setV] = useState<NewDefect>(EMPTY)
  const create = useAction(api.testing.createDefect, { success: 'Defect raised. The PM and tech head were notified to triage it.', onDone: onClose })
  return (
    <Modal open onClose={onClose} title={`Raise a ${stage} defect`} wide footer={<Button variant="primary" onClick={() => create.run(pid, stage, v)}><Bug className="h-4 w-4" /> Raise defect</Button>}>
      <DefectFields pid={pid} stage={stage} value={v} onChange={setV} tests={tests} />
    </Modal>
  )
}

export function MoveDialog({ defectId, pid, to, needs, label, onClose }: { defectId: string; pid: string; to: DefectStatus; needs: string[]; label: string; onClose: () => void }) {
  const { data } = useApi(['defect', pid, defectId], () => api.testing.getDefect(pid, defectId))
  const [assigneeId, setAssigneeId] = useState('')
  const [buildId, setBuildId] = useState('')
  const [reason, setReason] = useState('')
  const [dup, setDup] = useState('')
  const [severity, setSeverity] = useState<Severity | ''>('')
  const move = useAction(api.testing.moveDefect, { success: `Moved to ${to}.`, onDone: onClose })
  useEffect(() => {
    if (data && !severity) setSeverity(data.defect.severity)
  }, [data, severity])
  if (!data) return null
  const nothingNeeded = !needs.length
  return (
    <Modal open onClose={onClose} title={`${data.defect.key}: ${label}`} footer={<Button variant="primary" onClick={() => move.run(defectId, to, { assigneeId: assigneeId || undefined, buildId: buildId || undefined, reason, duplicateOfId: dup || undefined, severity: severity || undefined })}>{label}</Button>}>
      {nothingNeeded && <p className="text-sm">Move {data.defect.key} from {data.defect.status} to {to}?</p>}
      {needs.includes('assignee') && (
        <>
          <Field label="Confirm severity">
            <Select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
              {data.severities.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Assign to a developer" hint="SQA testers cannot be assigned defects.">
            <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Choose…</option>
              {data.developers.map((dv) => <option key={dv.id} value={dv.id}>{dv.name}</option>)}
            </Select>
          </Field>
        </>
      )}
      {needs.includes('build') && (
        <Field label="Fixed in build" hint="Register the build first (Builds tab) if it is not listed.">
          <Select value={buildId} onChange={(e) => setBuildId(e.target.value)}>
            <option value="">Choose…</option>
            {data.builds.map((b) => <option key={b.id} value={b.id}>{b.version}</option>)}
          </Select>
        </Field>
      )}
      {needs.includes('original') && (
        <Field label="Original defect">
          <Select value={dup} onChange={(e) => setDup(e.target.value)}>
            <option value="">Choose…</option>
            {data.otherDefects.map((o) => <option key={o.id} value={o.id}>{o.key}: {o.title}</option>)}
          </Select>
        </Field>
      )}
      {needs.includes('reason') && (
        <Field label="Reason (required)">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      )}
      {to === 'Deferred' && <Note className="!text-xs">Only Medium and Low defects can be deferred. Deferred defects are listed as known issues in the sign-off report.</Note>}
      {to === 'Change request' && <Note className="!text-xs">This starts the change request flow; the defect is closed with a link to it.</Note>}
    </Modal>
  )
}

export function RecordResultModal({ execution, onClose }: { execution: { id: string; projectId: string; stage: TestStage; testCaseId: string; test?: { key: string; title: string; steps: string[]; expected: string; preconditions: string } }; onClose: () => void }) {
  const [result, setResult] = useState<'pass' | 'fail' | 'blocked'>('pass')
  const [actual, setActual] = useState('')
  const [notes, setNotes] = useState('')
  const [blockedReason, setBlockedReason] = useState('')
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [existing, setExisting] = useState('')
  const [defect, setDefect] = useState<NewDefect>(EMPTY)
  const [files, setFiles] = useState<string[]>([])
  const { data: testing } = useApi(['testing', execution.projectId, execution.stage], () => api.testing.getTesting(execution.projectId, execution.stage))
  const record = useAction(api.testing.recordResult, { success: 'Result recorded.', onDone: onClose })
  const t = execution.test
  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={`${t?.key}: ${t?.title}`}
      footer={
        <Button variant="primary" onClick={() => record.run(execution.id, { result, actual, notes, blockedReason, files, defectIds: result === 'fail' && mode === 'existing' && existing ? [existing] : [], newDefect: result === 'fail' && mode === 'new' ? { ...defect, actual: defect.actual || actual } : undefined })}>
          Record {result}
        </Button>
      }
    >
      {t && (
        <div className="mb-4 rounded-md bg-canvas p-3 text-sm">
          {t.preconditions && <div className="mb-1"><b>Before you start:</b> {t.preconditions}</div>}
          <ol className="mb-1 list-decimal pl-5">{t.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          <div><b>Expected:</b> {t.expected}</div>
        </div>
      )}
      <div className="mb-3 flex gap-2">
        {(['pass', 'fail', 'blocked'] as const).map((r) => (
          <button key={r} onClick={() => setResult(r)} className={`flex-1 rounded-md py-2 text-sm font-medium ring-1 ${result === r ? (r === 'pass' ? 'bg-leaf text-white ring-leaf' : r === 'fail' ? 'bg-red-600 text-white ring-red-600' : 'bg-amber-500 text-white ring-amber-500') : 'ring-line'}`}>
            {r === 'pass' ? 'Pass' : r === 'fail' ? 'Fail' : 'Blocked'}
          </button>
        ))}
      </div>
      <Field label="What actually happened"><Textarea rows={2} value={actual} onChange={(e) => setActual(e.target.value)} /></Field>
      <Field label="Notes"><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <div className="mb-3 flex items-center gap-2">
        <FileButton size="sm" accept="image/*,.pdf" onPick={(f) => setFiles([...files, f.name])}>Attach a screenshot</FileButton>
        <span className="text-xs text-muted">{files.join(', ')}</span>
      </div>
      {result === 'blocked' && <Field label="Why is it blocked? (required)"><Input value={blockedReason} onChange={(e) => setBlockedReason(e.target.value)} placeholder="e.g. blocked by UAT-4" /></Field>}
      {result === 'fail' && (
        <div className="rounded-md p-3 ring-1 ring-red-200">
          <div className="mb-2 text-sm font-medium">A failed test must link to a defect</div>
          <div className="mb-3 flex gap-3 text-sm">
            <label className="flex items-center gap-1.5"><input type="radio" checked={mode === 'new'} onChange={() => setMode('new')} /> Raise a new defect</label>
            <label className="flex items-center gap-1.5"><input type="radio" checked={mode === 'existing'} onChange={() => setMode('existing')} /> Link an existing one</label>
          </div>
          {mode === 'existing' ? (
            <Select value={existing} onChange={(e) => setExisting(e.target.value)}>
              <option value="">Choose…</option>
              {testing?.defects.filter((x) => !['Closed', 'Rejected', 'Duplicate'].includes(x.status)).map((x) => <option key={x.id} value={x.id}>{x.key}: {x.title}</option>)}
            </Select>
          ) : (
            <DefectFields pid={execution.projectId} stage={execution.stage} value={defect} onChange={setDefect} tests={[]} fixedTestId={execution.testCaseId} />
          )}
        </div>
      )}
    </Modal>
  )
}
