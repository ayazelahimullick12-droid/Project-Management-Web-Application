/**
 * Admin: document templates (versioned), users, settings, legacy project import, AI activity log
 * and the global audit log.
 */
import { ArrowDown, ArrowUp, Bot, Plus, Trash2, Upload, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { DocType, Settings, TemplateSection } from '../types'
import { MAIN_DOCS } from '../types'
import { api } from '../api'
import { useAction, useApi } from '../api/hooks'
import { DOC_LABEL } from '../rules/pipeline'
import { AiNote } from '../components/ai'
import { FileButton } from '../components/FileButton'
import { fmtDateTime } from '../components/format'
import { OpenQuestion } from '../components/OpenQuestion'
import { Badge, Button, Card, Checkbox, ErrorBox, Field, Input, Loading, Note, PageHeader, Select, Table, Tabs, Td, Textarea, useTab } from '../components/ui'

type AdminData = Awaited<ReturnType<typeof api.admin.getAdmin>>

function Templates({ d }: { d: AdminData }) {
  const [type, setType] = useState<DocType>('PROPOSAL')
  const versions = d.templates.filter((t) => t.docType === type).sort((a, b) => b.version - a.version)
  const latest = versions[0]
  const [sections, setSections] = useState<TemplateSection[]>(latest.sections)
  const [note, setNote] = useState('')
  useEffect(() => {
    setSections(d.templates.filter((t) => t.docType === type).sort((a, b) => b.version - a.version)[0].sections)
  }, [type, d.templates])
  const save = useAction(api.admin.saveTemplate, { success: 'Saved as a new template version. Projects keep their version until the PM switches.' })
  const set = (i: number, patch: Partial<TemplateSection>) => setSections(sections.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  const move = (i: number, dir: -1 | 1) => {
    const next = [...sections]
    const [x] = next.splice(i, 1)
    next.splice(i + dir, 0, x)
    setSections(next)
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {MAIN_DOCS.map((t) => <Button key={t} variant={t === type ? 'primary' : 'secondary'} size="sm" onClick={() => setType(t)}>{DOC_LABEL[t]}</Button>)}
      </div>
      {latest.placeholder && <Note tone="amber">This is a draft placeholder template. Replace it with BRAC’s real {DOC_LABEL[type]} template.</Note>}
      <div className="text-xs text-muted">Versions: {versions.map((v) => `v${v.version}${v.placeholder ? ' (placeholder)' : ''} — ${fmtDateTime(v.createdAt)}`).join(' · ')}</div>
      {sections.map((s, i) => (
        <Card key={i} title={<span className="flex items-center gap-2">Section {i + 1}: {s.title || 'Untitled'} {s.scopeSensitive && <Badge tone="amber">scope-sensitive</Badge>}</span>} actions={<>
          <button disabled={i === 0} className="rounded p-1 text-muted hover:text-ink disabled:opacity-30" onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></button>
          <button disabled={i === sections.length - 1} className="rounded p-1 text-muted hover:text-ink disabled:opacity-30" onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></button>
          <button className="rounded p-1 text-muted hover:text-red-600" onClick={() => setSections(sections.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></button>
        </>}>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
            <Field label="Title"><Input value={s.title} onChange={(e) => set(i, { title: e.target.value })} /></Field>
            <Field label="Key" hint="lowercase_with_underscores, stable across versions"><Input value={s.key} onChange={(e) => set(i, { key: e.target.value })} /></Field>
            <div className="md:col-span-2"><Field label="Writing instructions for the AI"><Textarea rows={2} value={s.guidance} onChange={(e) => set(i, { guidance: e.target.value })} /></Field></div>
            <div className="md:col-span-2">
              <div className="mb-1 text-xs font-medium">Required facts (the Q/A agent asks for any that are missing)</div>
              <div className="grid grid-cols-2 gap-1 md:grid-cols-4">
                {d.catalog.map((f) => <Checkbox key={f.key} label={<span className="text-xs">{f.label}</span>} checked={s.factKeys.includes(f.key)} onChange={(c) => set(i, { factKeys: c ? [...s.factKeys, f.key] : s.factKeys.filter((k) => k !== f.key) })} />)}
              </div>
            </div>
            <Checkbox label="Touches objectives, deliverables, budget or timeline (scope check)" checked={!!s.scopeSensitive} onChange={(c) => set(i, { scopeSensitive: c })} />
          </div>
        </Card>
      ))}
      <div className="flex flex-wrap items-end gap-3">
        <Button onClick={() => setSections([...sections, { key: `section_${sections.length + 1}`, title: '', guidance: '', factKeys: [] }])}><Plus className="h-4 w-4" /> Add section</Button>
        <div className="min-w-64 flex-1"><Field label="Note for this version"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field></div>
        <Button variant="primary" onClick={() => save.run(type, sections, note)}>Save as v{latest.version + 1}</Button>
      </div>
    </div>
  )
}

function Users({ d }: { d: AdminData }) {
  const [form, setForm] = useState({ name: '', email: '', title: '', department: '', external: false })
  const add = useAction(api.admin.addUser, { success: 'User added.', onDone: () => setForm({ name: '', email: '', title: '', department: '', external: false }) })
  const toggle = useAction(api.admin.toggleDeactivated)
  return (
    <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
      <Card padded={false}>
        <Table head={['Name', 'Email', 'Title', '', '']}>
          {d.users.map((u) => (
            <tr key={u.id}>
              <Td className="font-medium">{u.name}</Td>
              <Td className="text-xs">{u.email}</Td>
              <Td className="text-xs">{u.title} · {u.department}</Td>
              <Td>{u.isAdmin && <Badge tone="dark">Admin</Badge>} {u.external && <Badge>outside BRAC</Badge>} {u.deactivated && <Badge tone="red">deactivated</Badge>}</Td>
              <Td>{!u.isAdmin && <Button size="sm" variant="ghost" onClick={() => toggle.run(u.id)}>{u.deactivated ? 'Reactivate' : 'Deactivate'}</Button>}</Td>
            </tr>
          ))}
        </Table>
      </Card>
      <Card title={<span className="flex items-center gap-2"><UserPlus className="h-4 w-4" /> Add a user <OpenQuestion id="external" /></span>} subtitle="Email and password login. BRAC sign-in (Microsoft Entra ID) can be added later.">
        <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Title"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Department"><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></Field>
        <Checkbox label="Outside BRAC (signs with an email one-time code)" checked={form.external} onChange={(c) => setForm({ ...form, external: c })} />
        <Button variant="primary" className="mt-3" onClick={() => add.run(form)}>Add user</Button>
      </Card>
    </div>
  )
}

function SettingsTab({ d }: { d: AdminData }) {
  const [s, setS] = useState<Settings>(d.settings)
  const save = useAction(api.admin.saveSettings, { success: 'Settings saved.' })
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return (
    <Card className="max-w-3xl" title="Settings" actions={<Button variant="primary" onClick={() => save.run(s)}>Save</Button>}>
      <div className="mb-4">
        <div className="mb-1 flex items-center gap-2 text-xs font-medium">Working days (reminders are sent only in working hours) <OpenQuestion id="working-hours" /></div>
        <div className="flex flex-wrap gap-3">{days.map((dn, i) => <Checkbox key={dn} label={dn} checked={s.workDays.includes(i)} onChange={(c) => setS({ ...s, workDays: c ? [...s.workDays, i].sort() : s.workDays.filter((x) => x !== i) })} />)}</div>
      </div>
      <div className="grid gap-x-4 md:grid-cols-3">
        <Field label="Work starts (hour, Bangladesh time)"><Input type="number" value={s.workStart} onChange={(e) => setS({ ...s, workStart: Number(e.target.value) })} /></Field>
        <Field label="Work ends (hour)"><Input type="number" value={s.workEnd} onChange={(e) => setS({ ...s, workEnd: Number(e.target.value) })} /></Field>
        <Field label="Reminder interval (working hours)"><Input type="number" value={s.reminderHours} onChange={(e) => setS({ ...s, reminderHours: Number(e.target.value) })} /></Field>
        <Field label="Edit lock idle timeout (minutes)"><Input type="number" value={s.lockIdleMinutes} onChange={(e) => setS({ ...s, lockIdleMinutes: Number(e.target.value) })} /></Field>
        <Field label="Q/A rounds before the PM decides"><Input type="number" value={s.qaRoundLimit} onChange={(e) => setS({ ...s, qaRoundLimit: Number(e.target.value) })} /></Field>
        <Field label="Similar projects shown (RAG top K)"><Input type="number" value={s.ragTopK} onChange={(e) => setS({ ...s, ragTopK: Number(e.target.value) })} /></Field>
        <Field label="Duplicate warning threshold"><Input type="number" step="0.01" value={s.ragDuplicateThreshold} onChange={(e) => setS({ ...s, ragDuplicateThreshold: Number(e.target.value) })} /></Field>
        <Field label="Defect duplicate threshold (0–1)"><Input type="number" step="0.01" value={s.defectDuplicateThreshold} onChange={(e) => setS({ ...s, defectDuplicateThreshold: Number(e.target.value) })} /></Field>
        <Field label="Speed of simulated steps (prototype)">
          <Select value={s.aiSpeed} onChange={(e) => setS({ ...s, aiSpeed: e.target.value as Settings['aiSpeed'] })}>
            <option value="normal">normal</option><option value="fast">fast</option><option value="instant">instant</option>
          </Select>
        </Field>
      </div>
      <div className="mb-3">
        <div className="mb-1 flex items-center gap-2 text-xs font-medium">Severities that block sign-off and cannot be deferred <OpenQuestion id="blocking" /></div>
        <div className="flex gap-3">{(['Critical', 'High', 'Medium', 'Low'] as const).map((sev) => <Checkbox key={sev} label={sev} checked={s.signoffBlocking.includes(sev)} onChange={(c) => setS({ ...s, signoffBlocking: c ? [...s.signoffBlocking, sev] : s.signoffBlocking.filter((x) => x !== sev) })} />)}</div>
      </div>
      <Field label="Holidays (YYYY-MM-DD, one per line)" hint="No reminders on these days (Eid and other public holidays).">
        <Textarea rows={3} value={s.holidays.join('\n')} onChange={(e) => setS({ ...s, holidays: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })} />
      </Field>
      <AiModels value={s.ai} onChange={(ai) => setS({ ...s, ai })} />
    </Card>
  )
}

/** Which models in LM Studio the app uses. The list comes from LM Studio itself. */
function AiModels({ value, onChange }: { value: Settings['ai']; onChange: (v: Settings['ai']) => void }) {
  const { data: st, refetch, isFetching } = useApi(['ai-status'], api.admin.aiStatus)
  const models = st?.models ?? []
  const options = (current: string, embed: boolean) => [...new Set([current, ...models.filter((m) => embed === /embed/i.test(m))])]
  return (
    <div className="mt-2 border-t border-line pt-4">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm font-medium">
        AI models (LM Studio)
        {st && (st.ok ? <Badge tone="green">connected</Badge> : <Badge tone="red">not reachable</Badge>)}
        <Button size="sm" disabled={isFetching} onClick={() => refetch()}>Check again</Button>
      </div>
      {st && !st.ok && <Note tone="amber" className="mb-3">{st.error ?? 'LM Studio is not reachable.'} Start LM Studio, load a model and start its server (Developer tab).</Note>}
      <div className="grid gap-x-4 md:grid-cols-2">
        <Field label="Model that writes" hint="Small models answer fastest. Answers are kept short on purpose.">
          <Select value={value.model} onChange={(e) => onChange({ ...value, model: e.target.value })}>
            {options(value.model, false).map((m) => <option key={m} value={m}>{m}{models.length > 0 && !models.includes(m) ? ' (not in LM Studio)' : ''}</option>)}
          </Select>
        </Field>
        <Field label="Model that compares (embeddings)" hint="Used for similar projects and possible duplicate defects.">
          <Select value={value.embedModel} onChange={(e) => onChange({ ...value, embedModel: e.target.value })}>
            {options(value.embedModel, true).map((m) => <option key={m} value={m}>{m}{models.length > 0 && !models.includes(m) ? ' (not in LM Studio)' : ''}</option>)}
          </Select>
        </Field>
      </div>
    </div>
  )
}

function Import({ d }: { d: AdminData }) {
  const [f, setF] = useState({ name: '', year: 2020, department: 'Microfinance Programme', summary: '', members: '', files: [] as string[] })
  const run = useAction(api.admin.importLegacy, { success: 'Importing and indexing in the background…' })
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <Card title={<span className="flex items-center gap-2"><Upload className="h-4 w-4" /> Import a pre-app project <OpenQuestion id="legacy-import" /></span>} subtitle="Imported projects are treated as finished and indexed for the RAG agent.">
        <Field label="Project name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Year"><Input type="number" value={f.year} onChange={(e) => setF({ ...f, year: Number(e.target.value) })} /></Field>
          <Field label="Department"><Input value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })} /></Field>
        </div>
        <Field label="Short summary"><Textarea value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} /></Field>
        <Field label="Project members (names, comma separated)" hint="Linked to user accounts where they exist."><Input value={f.members} onChange={(e) => setF({ ...f, members: e.target.value })} placeholder="Mithila Sarker, Anwar Hossain" /></Field>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <FileButton size="sm" accept=".pdf,.doc,.docx" onPick={(x) => setF({ ...f, files: [...f.files, x.name] })}>Add a document</FileButton>
          {f.files.map((x) => <Badge key={x}>{x}</Badge>)}
        </div>
        <Button variant="primary" onClick={() => run.run({ name: f.name, year: f.year, department: f.department, summary: f.summary, memberNames: f.members.split(',').map((x) => x.trim()).filter(Boolean), files: f.files })}>Import and index</Button>
      </Card>
      <Card title="Imported projects">
        {d.legacy.length ? <ul className="space-y-1 text-sm">{d.legacy.map((p) => <li key={p.id}><b>{p.name}</b> ({p.legacy?.year}, {p.legacy?.department}) · {p.legacy?.files.length} files</li>)}</ul> : <p className="text-sm text-muted">None yet.</p>}
        <div className="mt-3"><AiNote agent="rag" compact /></div>
      </Card>
    </div>
  )
}

export function AdminPage() {
  const [tab, setTab] = useTab('templates')
  const { data, isLoading, error } = useApi(['admin'], api.admin.getAdmin)
  if (isLoading) return <Loading />
  if (error || !data) return <ErrorBox error={error} />
  return (
    <div>
      <PageHeader title="Admin" subtitle="Templates, users, settings, the archive import tool and the AI activity log." />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'templates', label: 'Templates' }, { id: 'users', label: 'Users' }, { id: 'settings', label: 'Settings' }, { id: 'import', label: 'Import past projects' }, { id: 'ai', label: 'AI activity' }, { id: 'audit', label: 'Audit log' }]} />
      {tab === 'templates' && <Templates d={data} />}
      {tab === 'users' && <Users d={data} />}
      {tab === 'settings' && <SettingsTab d={data} />}
      {tab === 'import' && <Import d={data} />}
      {tab === 'ai' && (
        <Card title={<span className="flex items-center gap-2"><Bot className="h-4 w-4" /> Every AI call</span>} subtitle="Each request to LM Studio: the model, tokens in and out, how long it took, and any error. The last 300 are kept." padded={false}>
          <Table head={['When', 'Agent', 'Task', 'Project', 'Model', 'Tokens in / out', 'Duration', 'OK']}>
            {data.aiCalls.map((c) => (
              <tr key={c.id}>
                <Td className="text-xs text-muted">{fmtDateTime(c.createdAt)}</Td>
                <Td className="text-xs">{c.agent}</Td>
                <Td className="text-sm">{c.title}</Td>
                <Td className="text-xs">{c.projectName ?? '—'}</Td>
                <Td className="text-xs">{c.model ?? 'simulated'}</Td>
                <Td className="text-xs">{c.promptTokens.toLocaleString()} / {c.completionTokens?.toLocaleString() ?? '—'}</Td>
                <Td className="text-xs">{(c.durationMs / 1000).toFixed(1)} s</Td>
                <Td>{c.success ? <Badge tone="green">yes</Badge> : <span title={c.error}><Badge tone="red">failed</Badge></span>}</Td>
              </tr>
            ))}
          </Table>
          {!data.aiCalls.length && <p className="p-4 text-sm text-muted">No AI calls yet.</p>}
        </Card>
      )}
      {tab === 'audit' && (
        <Card padded={false}>
          <Table head={['When', 'Who', 'Project', 'Action', 'Details']}>
            {data.audit.map((a) => (
              <tr key={a.id}>
                <Td className="whitespace-nowrap text-xs text-muted">{fmtDateTime(a.createdAt)}</Td>
                <Td className="text-xs">{a.actorName}</Td>
                <Td className="text-xs">{a.projectName ?? '—'}</Td>
                <Td className="text-sm font-medium">{a.action}</Td>
                <Td className="text-sm">{a.details}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </div>
  )
}
