/** One defect, Jira-style: fields, allowed moves, comments with @tags, files and full history. */
import { ArrowRight, Eye, EyeOff, History, Paperclip } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { DefectStatus, Severity } from '../../types'
import { api } from '../../api'
import { useAction, useApi } from '../../api/hooks'
import { AiBadge } from '../../components/ai'
import { DefectStatusChip, SeverityChip } from '../../components/status'
import { FileButton } from '../../components/FileButton'
import { fmtDateTime } from '../../components/format'
import { Avatar, Badge, Button, Card, ErrorBox, KV, Loading, Note, PageHeader, Select, Textarea } from '../../components/ui'
import { MentionPicker } from '../document/CommentsPanel'
import { MoveDialog } from './DefectForms'

export function DefectPage() {
  const { pid = '', defectId = '' } = useParams()
  const { data, isLoading, error } = useApi(['defect', pid, defectId], () => api.testing.getDefect(pid, defectId))
  const [moving, setMoving] = useState<{ to: DefectStatus; needs: string[]; label: string } | null>(null)
  const [comment, setComment] = useState('')
  const [mentions, setMentions] = useState<string[]>([])
  const post = useAction(api.testing.commentOnDefect, { onDone: () => { setComment(''); setMentions([]) } })
  const update = useAction(api.testing.updateDefect, { success: 'Updated.' })
  const watch = useAction(api.testing.toggleWatch)
  const attach = useAction(api.testing.attachToDefect, { success: 'File attached.' })
  const verify = useAction(api.testing.verifyFix, { success: 'Fix checked by SQA.' })
  if (isLoading) return <Loading />
  if (error || !data) return <ErrorBox error={error} />
  const d = data.defect
  return (
    <div>
      <PageHeader
        eyebrow={<Link to={`/projects/${pid}/testing/${d.stage}?tab=defects`}>{data.project.name} · {d.stage} defects</Link>}
        title={<span className="normal-case">{d.key}: {d.title}</span>}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <DefectStatusChip status={d.status} /> <SeverityChip severity={d.severity} /> {d.ai && <AiBadge label="Written with the AI defect writer" />}
            {d.reopenCount > 0 && <Badge tone="red">reopened {d.reopenCount}×</Badge>}
          </span>
        }
        actions={
          <Button variant="ghost" onClick={() => watch.run(d.id)}>
            {data.watching ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} {data.watching ? 'Stop watching' : 'Watch'}
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <Card title="Details">
            <div className="space-y-3 text-sm">
              <div><div className="text-xs font-medium text-muted">Steps to reproduce</div><div className="whitespace-pre-line">{d.steps || '—'}</div></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><div className="text-xs font-medium text-muted">Expected</div>{d.expected || '—'}</div>
                <div><div className="text-xs font-medium text-muted">Actual</div>{d.actual || '—'}</div>
              </div>
              {d.outcomeReason && <Note tone="gray"><b>{d.status}:</b> {d.outcomeReason}</Note>}
              {data.duplicateOf && <div>Duplicate of <Link className="font-medium text-brand" to={`/projects/${pid}/defects/${data.duplicateOf.id}`}>{data.duplicateOf.key}</Link></div>}
              {data.changeRequest && <div>Change request: <Link className="font-medium text-brand" to={`/projects/${pid}/changes`}>{data.changeRequest.title}</Link></div>}
              <div>
                <div className="mb-1 flex items-center gap-2 text-xs font-medium text-muted"><Paperclip className="h-3.5 w-3.5" /> Files</div>
                <div className="flex flex-wrap items-center gap-2">
                  {d.files.map((f) => <Badge key={f}>{f}</Badge>)}
                  {data.canComment && <FileButton size="sm" onPick={(f) => attach.run(d.id, f.name)}>Attach</FileButton>}
                </div>
              </div>
            </div>
          </Card>
          <Card title="Comments" subtitle="Separate from document comments; they never appear in chat.">
            <ul className="mb-3 space-y-2">
              {data.comments.map((c) => (
                <li key={c.id} className="flex gap-2">
                  <Avatar name={c.authorName} id={c.authorId} size={24} />
                  <div className="min-w-0 flex-1 rounded-md bg-canvas px-3 py-2 text-sm">
                    <div className="text-xs text-muted"><b className="text-ink">{c.authorName}</b> · {fmtDateTime(c.createdAt)}</div>
                    {c.body}
                    {c.mentions.length > 0 && <div className="text-[11px] text-brand">Tagged: {c.mentions.map((m) => data.members.find((x) => x.id === m)?.name).join(', ')}</div>}
                  </div>
                </li>
              ))}
              {!data.comments.length && <li className="text-sm text-muted">No comments yet.</li>}
            </ul>
            {data.canComment && (
              <div>
                <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment…" />
                <div className="mt-2 flex items-center justify-between">
                  <MentionPicker members={data.members.map((m) => ({ userId: m.id, name: m.name }))} value={mentions} onChange={setMentions} />
                  <Button size="sm" variant="primary" onClick={() => post.run(d.id, comment, mentions)}>Comment</Button>
                </div>
              </div>
            )}
          </Card>
          <Card title={<span className="flex items-center gap-2"><History className="h-4 w-4" /> History</span>}>
            <ol className="space-y-2">
              {[...data.history].reverse().map((h, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-line" />
                  <div>
                    {h.text}
                    <div className="text-xs text-muted">{h.byName} · {fmtDateTime(h.at)}</div>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Actions" subtitle="Only the moves you are allowed to make are shown.">
            {data.moves.length ? (
              <div className="flex flex-col gap-2">
                {data.moves.map((m) => (
                  <Button key={m.to} variant={['Rejected', 'Duplicate', 'Deferred', 'Change request'].includes(m.to) ? 'secondary' : 'primary'} onClick={() => setMoving(m)}>
                    <ArrowRight className="h-4 w-4" /> {m.label}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">Nothing for you to do on this defect right now.</p>
            )}
            {data.canVerify && (
              <div className="mt-3 rounded-md bg-canvas p-2.5 text-sm">
                <div className="mb-1 font-medium">SQA check of this UAT fix</div>
                <p className="mb-2 text-xs text-muted">Fixes during UAT go through SQA first. Check it on build {data.fixedIn?.version} before it is released to UAT.</p>
                <Button size="sm" variant="success" onClick={() => verify.run(d.id, true)}>Fix works</Button>
              </div>
            )}
          </Card>
          <Card title="Fields">
            <KV
              items={[
                ['Stage', d.stage],
                ['Severity', data.canTriage ? (
                  <Select value={d.severity} onChange={(e) => update.run(d.id, { severity: e.target.value as Severity })} className="!w-32 !py-1 text-xs">
                    {data.severities.map((s) => <option key={s}>{s}</option>)}
                  </Select>
                ) : <SeverityChip severity={d.severity} />],
                ['Reporter', data.reporterName],
                ['Assignee', data.canTriage && d.status !== 'New' ? (
                  <Select value={d.assigneeId ?? ''} onChange={(e) => update.run(d.id, { assigneeId: e.target.value })} className="!w-44 !py-1 text-xs">
                    <option value="">—</option>
                    {data.developers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </Select>
                ) : data.assigneeName ?? '—'],
                ['Test case', data.testCase ? `${data.testCase.key}: ${data.testCase.title}` : '—'],
                ['Requirement', data.requirement ? `${data.requirement.id}: ${data.requirement.text}` : d.requirementId ?? '—'],
                ['Found in', data.foundIn?.version ?? '—'],
                ['Fixed in', data.fixedIn ? `${data.fixedIn.version}${data.fixedIn.releasedToUatAt ? ' (in UAT)' : ' (in SQA)'}` : '—'],
                ['SQA check', d.sqaVerified ? `Checked ${fmtDateTime(d.sqaVerified.at)}` : d.stage === 'UAT' ? 'Not yet' : 'n/a'],
                ['Watchers', data.watchers.map((w) => w.name).join(', ')],
                ['Raised', fmtDateTime(d.createdAt)],
              ]}
            />
          </Card>
        </div>
      </div>
      {moving && <MoveDialog defectId={d.id} pid={pid} to={moving.to} needs={moving.needs} label={moving.label} onClose={() => setMoving(null)} />}
    </div>
  )
}
