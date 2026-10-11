/** Version history, compare, AI summaries and the SRS traceability matrix. */
import { Download, Eye, Flag, GitCompare, Network, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../api'
import { useAction } from '../../api/hooks'
import { AiBadge, AiNote } from '../../components/ai'
import { SideBySide, hasChanges } from '../../components/Diff'
import { exportPptx, printUrl, safeName } from '../../components/exports'
import { fmtDateTime } from '../../components/format'
import { Markdown } from '../../components/Markdown'
import { OpenQuestion } from '../../components/OpenQuestion'
import { Badge, Button, Card, EmptyState, Modal, Note, Select, Table, Td } from '../../components/ui'

type DocData = Awaited<ReturnType<typeof api.documents.getDocument>>

const KIND_LABEL: Record<string, string> = { ai_draft: 'AI draft', manual: 'Manual edit', ai_regen: 'Includes AI rewrite', restore: 'Restore', change_request: 'Change request', report: 'Generated report' }

export function HistoryTab({ data, onCompare }: { data: DocData; onCompare: (a: number, b: number) => void }) {
  const [viewing, setViewing] = useState<DocData['versions'][number] | null>(null)
  const restore = useAction(api.documents.restoreVersion, { success: 'Restored as a new version on top.' })
  const current = data.current!
  const chainFor = (vid: string) => data.chains.filter((c) => c.versionId === vid && c.status !== 'cancelled').at(-1)
  return (
    <div>
      <p className="mb-3 text-sm text-muted">Every saved version is kept, like a Git commit. Every member can see every version.</p>
      <ul className="space-y-2">
        {[...data.versions].reverse().map((v) => {
          const ch = chainFor(v.id)
          return (
            <li key={v.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-surface p-3 ring-1 ring-line">
              <div className="w-10 text-lg font-semibold">v{v.number}</div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{v.message}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                  {v.authorName} · {fmtDateTime(v.createdAt)}
                  <Badge>{KIND_LABEL[v.kind]}</Badge>
                  {v.authorId === null && <AiBadge />}
                  {v.minorCorrection && <Badge tone="violet">Minor correction (declared by {v.minorByName})</Badge>}
                  {v.scopeCheck?.flagged && <Badge tone="amber">Scope check flagged{v.scopeCheck.decision ? `: ${v.scopeCheck.decision === 'normal' ? 'normal edit' : 'scope change'}` : ': awaiting PM'}</Badge>}
                  {ch?.status === 'signed' && <Badge tone="green">Signed</Badge>}
                  {ch?.status === 'approved' && <Badge tone="green">Approved</Badge>}
                  {v.frozen && <Badge tone="dark">Frozen</Badge>}
                  {v.id === current.id && <Badge tone="magenta">Current</Badge>}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setViewing(v)}>
                <Eye className="h-3.5 w-3.5" /> View
              </Button>
              {v.number > 1 && (
                <Button size="sm" variant="ghost" onClick={() => onCompare(v.number - 1, v.number)}>
                  <GitCompare className="h-3.5 w-3.5" /> Changes
                </Button>
              )}
              {data.perms.pmTeam && v.id !== current.id && data.project.status === 'active' && (
                <Button size="sm" onClick={() => restore.run(data.doc!.id, v.id)}>
                  <RotateCcw className="h-3.5 w-3.5" /> Restore
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      {viewing && (
        <Modal open onClose={() => setViewing(null)} title={`${data.label} v${viewing.number}`} wide footer={<a className="text-sm font-medium text-brand" href={printUrl(viewing.id)} target="_blank" rel="noreferrer">Open as PDF</a>}>
          {viewing.sections.map((s) => (
            <div key={s.id} className="mb-4">
              <h3 className="mb-1 font-semibold">{s.title}</h3>
              <Markdown text={s.content} />
            </div>
          ))}
        </Modal>
      )}
    </div>
  )
}

export function CompareTab({ data }: { data: DocData }) {
  const [params, setParams] = useSearchParams()
  const nums = data.versions.map((v) => v.number)
  const a = Number(params.get('a') ?? Math.max(1, nums.at(-1)! - 1))
  const b = Number(params.get('b') ?? nums.at(-1))
  const va = data.versions.find((v) => v.number === a)
  const vb = data.versions.find((v) => v.number === b)
  const set = (k: 'a' | 'b', n: number) => setParams((p) => { const x = new URLSearchParams(p); x.set(k, String(n)); x.set('tab', 'compare'); return x }, { replace: true })
  if (nums.length < 2) return <EmptyState title="Only one version so far">Compare becomes useful after the next saved version.</EmptyState>
  const ids = [...new Set([...(va?.sections ?? []), ...(vb?.sections ?? [])].map((s) => s.id))]
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        Compare
        <Select value={a} onChange={(e) => set('a', Number(e.target.value))} className="w-24">
          {nums.map((n) => <option key={n} value={n}>v{n}</option>)}
        </Select>
        with
        <Select value={b} onChange={(e) => set('b', Number(e.target.value))} className="w-24">
          {nums.map((n) => <option key={n} value={n}>v{n}</option>)}
        </Select>
        <span className="text-xs text-muted">section by section, changed words highlighted</span>
      </div>
      <div className="space-y-4">
        {ids.map((id) => {
          const sa = va?.sections.find((s) => s.id === id)
          const sb = vb?.sections.find((s) => s.id === id)
          const changed = hasChanges(sa?.content ?? '', sb?.content ?? '')
          return (
            <div key={id}>
              <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
                {sb?.title ?? sa?.title}
                {changed ? <Badge tone="amber">changed</Badge> : <span className="text-xs font-normal text-muted">no changes</span>}
                {vb?.regeneratedSectionIds.includes(id) && <AiBadge label="regenerated by AI" />}
              </div>
              {changed && <SideBySide before={sa?.content ?? ''} after={sb?.content ?? ''} leftLabel={`v${a}`} rightLabel={`v${b}`} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function SummariesTab({ data }: { data: DocData }) {
  const d = data.derived
  const v = data.current
  if (!d || !v) return <EmptyState title="No summaries yet" />
  return (
    <div className="space-y-4">
      <Note tone="violet">
        <b>AI summary of version {v.number}</b> — for quick understanding; the full document is the approved text. Approval and signing apply only to the full document. Summaries are regenerated for every saved version.
      </Note>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card title="One-page summary" actions={<a href={printUrl(v.id, 'onepager')} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-brand"><Download className="h-3.5 w-3.5" /> PDF</a>}>
          <AiBadge label={`AI summary of version ${v.number}`} />
          <Markdown text={d.onePager} className="mt-2" />
        </Card>
        <div className="space-y-4">
          <Card title="Very short summary">
            <AiBadge label={`AI summary of version ${v.number}`} />
            <p className="mt-2 text-sm">{d.short}</p>
          </Card>
          <AiNote agent="summary" compact />
        </div>
      </div>
      <Card
        title="Presentation"
        subtitle={`${d.slides.length} slides`}
        actions={
          <Button size="sm" onClick={() => exportPptx({ project: data.project.name, title: data.label, versionLabel: `version ${v.number}`, slides: d.slides, fileName: `${safeName(data.project.name)}-${safeName(data.label)}-v${v.number}-summary.pptx` })}>
            <Download className="h-3.5 w-3.5" /> Download PPTX
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {d.slides.map((s, i) => (
            <div key={i} className={`aspect-video overflow-hidden rounded-md p-3 text-xs ring-1 ring-line ${i === 0 ? 'bg-brand text-white' : 'bg-surface'}`}>
              <div className={`mb-1.5 font-semibold ${i === 0 ? 'text-base' : 'text-sm'}`}>{s.title}</div>
              {i > 0 && <div className="mb-1.5 h-0.5 w-8 bg-brand" />}
              <ul className={i > 0 ? 'list-disc space-y-0.5 pl-4' : 'space-y-0.5'}>
                {s.bullets.map((b, j) => <li key={j} className="line-clamp-2">{b}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

export function TraceTab({ data }: { data: DocData }) {
  const build = useAction(api.documents.buildTraceability, { success: 'Building the matrix…' })
  const reqs = data.requirements
  const srs = reqs.filter((r) => r.docType === 'SRS')
  const byId = (id?: string) => reqs.find((r) => r.id === id)
  const tests = (id: string, stage: 'SQA' | 'UAT') => data.testCases.filter((t) => t.stage === stage && t.requirementIds.includes(id))
  if (!data.traceBuilt)
    return (
      <div className="space-y-3">
        <EmptyState title="Traceability matrix not built yet" icon={<Network className="h-6 w-6" />}>
          Each SRS requirement is linked to a BRD requirement, and each BRD requirement to a Charter objective. Requirements without a link are flagged.
        </EmptyState>
        {data.perms.pmTeam && (
          <Button variant="primary" onClick={() => build.run(data.project.id)}>
            <Network className="h-4 w-4" /> Build the matrix
          </Button>
        )}
        <AiNote agent="trace" compact />
      </div>
    )
  const brdWithoutSrs = reqs.filter((r) => r.docType === 'BRD' && !srs.some((s) => s.parentId === r.id))
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <AiBadge label="Links proposed by AI (simulated)" /> <OpenQuestion id="traceability" />
      </div>
      <Card padded={false}>
        <Table head={['SRS requirement', 'BRD requirement', 'Charter objective', 'SQA tests', 'UAT tests', '']}>
          {srs.map((r) => {
            const brd = byId(r.parentId)
            const obj = byId(brd?.parentId)
            const flagged = !brd || !obj
            return (
              <tr key={r.id} className={flagged ? 'bg-red-50/50' : undefined}>
                <Td><b>{r.id}</b> {r.text}</Td>
                <Td>{brd ? <><b>{brd.id}</b> {brd.text}</> : <span className="text-red-700">No link</span>}</Td>
                <Td>{obj ? <><b>{obj.id}</b> {obj.text}</> : <span className="text-red-700">No link</span>}</Td>
                <Td className="text-xs">{tests(r.id, 'SQA').map((t) => t.key).join(', ') || '—'}</Td>
                <Td className="text-xs">{brd ? tests(brd.id, 'UAT').map((t) => t.key).join(', ') || '—' : '—'}</Td>
                <Td>{flagged && <Badge tone="red"><Flag className="h-3 w-3" /> flagged</Badge>}</Td>
              </tr>
            )
          })}
        </Table>
      </Card>
      {brdWithoutSrs.length > 0 && <Note tone="amber">BRD requirements with no SRS requirement: {brdWithoutSrs.map((r) => r.id).join(', ')}.</Note>}
    </div>
  )
}
