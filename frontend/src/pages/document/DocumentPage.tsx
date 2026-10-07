/**
 * One document (Proposal, Charter, BRD or SRS): read view with comments, the editor, versions,
 * compare, AI summaries, traceability (SRS) and the approval panel.
 * SPEC.md "Document pipeline", "Approval and signing", "Editing, versions…", "Comments…".
 */
import { Download, FileDown, Lock, MessagesSquare, Pencil, RefreshCw, Save, Sparkles, TriangleAlert, Unlock } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import type { DocType } from '../../types'
import { api } from '../../api'
import { useAction, useApi, useNow, useSessionUserId } from '../../api/hooks'
import { ApprovalPanel } from '../../components/ApprovalPanel'
import { AiBadge, AiNote } from '../../components/ai'
import { DocStatusChip } from '../../components/status'
import { exportDocx, printUrl, safeName } from '../../components/exports'
import { ago, fmtDateTime } from '../../components/format'
import { Badge, Button, Card, Checkbox, EmptyState, ErrorBox, Field, Guarded, Input, Loading, Modal, Note, PageHeader, Tabs, useTab } from '../../components/ui'
import { useToast } from '../../components/toast'
import { Reader, type Selection } from './Reader'
import { DocEditor } from './Editor'
import { AnnotateModal, CommentsPanel } from './CommentsPanel'
import { CompareTab, HistoryTab, SummariesTab, TraceTab } from './DocTabs'

type DocData = Awaited<ReturnType<typeof api.documents.getDocument>>

function SaveVersionModal({ data, onClose }: { data: DocData; onClose: () => void }) {
  const [message, setMessage] = useState('')
  const [decision, setDecision] = useState<'normal' | 'scope_change' | ''>('')
  const { data: preview } = useApi(['preview-save', data.doc!.id, data.draft?.updatedAt], () => api.documents.previewSave(data.doc!.id))
  const save = useAction(api.documents.saveVersion, { success: (n) => `Version ${n} saved. Everyone was notified.`, onDone: onClose })
  return (
    <Modal
      open
      onClose={onClose}
      title="Save version"
      footer={
        <Button variant="primary" disabled={!message.trim() || save.pending || (preview?.flagged && data.perms.pm && !decision)} onClick={() => save.run(data.doc!.id, message, decision || undefined)}>
          <Save className="h-4 w-4" /> Save version
        </Button>
      }
    >
      <Field label="Short message" hint="Shown in the version history, like a commit message.">
        <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. Updated the budget split" autoFocus />
      </Field>
      {preview && (
        <div className="space-y-2">
          <div className="text-xs text-muted">Changed sections: {preview.changedTitles.join(', ') || 'none'}</div>
          <Note tone={preview.flagged ? 'amber' : 'green'} icon={<Sparkles className="h-4 w-4" />}>
            <div className="font-medium">Scope check: {preview.flagged ? 'touches scope' : 'no scope change'}</div>
            <div className="text-xs">{preview.reason}</div>
            {preview.flagged && data.perms.pm && (
              <div className="mt-2 space-y-1">
                <label className="flex items-center gap-2 text-sm"><input type="radio" checked={decision === 'normal'} onChange={() => setDecision('normal')} /> Normal edit</label>
                <label className="flex items-center gap-2 text-sm"><input type="radio" checked={decision === 'scope_change'} onChange={() => setDecision('scope_change')} /> Scope change (starts a change request)</label>
              </div>
            )}
            {preview.flagged && !data.perms.pm && <div className="mt-1 text-xs">The PM will decide whether it is a normal edit or a scope change. Sending for approval waits for that decision.</div>}
          </Note>
          {preview.factChanges.length > 0 && (
            <Note tone="violet">
              <div className="font-medium">The Fact Sheet may need updating</div>
              {preview.factChanges.map((f) => (
                <div key={f.factKey} className="text-xs">
                  {f.factLabel}: <span className="diff-del">{f.oldValue}</span> → <span className="diff-add">{f.newValue}</span>
                </div>
              ))}
              <div className="mt-1 text-xs">These become proposals the PM team accepts or rejects on the Change requests page.</div>
            </Note>
          )}
          <AiNote agent="scope" compact />
          <p className="text-xs text-muted">Saving cancels any approvals of earlier versions, carries comments forward (or marks them Pending check), regenerates the summaries and marks later documents Out of sync.</p>
        </div>
      )}
    </Modal>
  )
}

function OutOfSyncModal({ data, onClose }: { data: DocData; onClose: () => void }) {
  const [picked, setPicked] = useState<string[]>(data.doc!.outOfSync!.suggestedSectionIds)
  const regen = useAction(api.documents.regenerateOutOfSync, { success: 'Regenerating. Review the diffs in the editor, then save a version.', onDone: onClose })
  return (
    <Modal open onClose={onClose} title="Choose sections to regenerate" footer={<Button variant="primary" disabled={!picked.length} onClick={() => regen.run(data.doc!.id, picked)}><Sparkles className="h-4 w-4" /> Regenerate {picked.length}</Button>}>
      <p className="mb-3 text-sm text-muted">{data.doc!.outOfSync!.cause}. Sections written from facts that changed are pre-selected. Each result is shown as a diff to accept or reject.</p>
      <div className="space-y-1.5">
        {data.current!.sections.map((s) => (
          <Checkbox key={s.id} label={s.title} checked={picked.includes(s.id)} onChange={(c) => setPicked(c ? [...picked, s.id] : picked.filter((x) => x !== s.id))} />
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">If nothing needs to change, close this and use “Send for re-approval (unchanged)” instead.</p>
    </Modal>
  )
}

export function DocumentPage() {
  const { pid = '', type = 'PROPOSAL' } = useParams()
  const uid = useSessionUserId()
  const now = useNow()
  const toast = useToast()
  const [tab, setTab] = useTab('document')
  const [, setParams] = useSearchParams()
  const [annotating, setAnnotating] = useState<{ kind: 'comment' | 'suggest'; sel: Selection | null } | null>(null)
  const [active, setActive] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [liveView, setLiveView] = useState(true)
  const { data, isLoading, error } = useApi(['doc', pid, type, uid], () => api.documents.getDocument(pid, type as DocType))
  const generate = useAction(api.documents.generate, { success: 'The AI is drafting the document section by section…' })
  const lock = useAction(api.documents.acquireLock)
  const release = useAction(api.documents.releaseLock)
  const forceUnlock = useAction(api.documents.forceUnlock, { success: 'Unlocked. The editor’s work was autosaved as a draft.' })
  const discard = useAction(api.documents.discardDraft, { success: 'Draft discarded.' })
  const decideScope = useAction(api.documents.decideScope, { success: 'Decision recorded.' })
  const switchTemplate = useAction(api.documents.switchTemplate, { success: 'Switched to the newer template for the next generation.' })

  if (isLoading) return <Loading />
  if (error || !data) return <ErrorBox error={error} />
  const { doc, current, draft } = data
  const editing = !!data.lock?.mine && !!draft
  const someoneElse = data.lock && !data.lock.mine

  const header = (
    <PageHeader
      eyebrow={<Link to={`/projects/${pid}`}>{data.project.name}</Link>}
      title={data.label}
      subtitle={
        current ? (
          <span className="flex flex-wrap items-center gap-2">
            <DocStatusChip status={data.status} /> Version {current.number} · {current.authorId ? 'saved' : 'generated by AI'} {fmtDateTime(current.createdAt)} · template v{current.templateVersion}
          </span>
        ) : undefined
      }
      actions={
        current && (
          <>
            {data.chatId && (
              <Link to={`/projects/${pid}/chat/${data.chatId}`} className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm hover:bg-black/5">
                <MessagesSquare className="h-4 w-4" /> Document chat
              </Link>
            )}
            <a href={printUrl(current.id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md bg-white px-3 py-2 text-sm ring-1 ring-line hover:bg-canvas">
              <FileDown className="h-4 w-4" /> PDF
            </a>
            <Button onClick={() => exportDocx({ project: data.project.name, title: data.label, versionLabel: `Version ${current.number}`, status: data.status.label, sections: current.sections, fileName: `${safeName(data.project.name)}-${safeName(data.label)}-v${current.number}.docx` })}>
              <Download className="h-4 w-4" /> DOCX
            </Button>
          </>
        )
      }
    />
  )

  if (!doc || !current)
    return (
      <div>
        {header}
        <EmptyState title={`The ${data.label} has not been generated yet`} icon={<Sparkles className="h-6 w-6" />}>
          It is generated section by section from the confirmed Fact Sheet{type !== 'PROPOSAL' ? ' and the earlier approved documents' : ''}, using template v{data.project.templateVersions[type as DocType] ?? 1}.
        </EmptyState>
        <div className="mx-auto mt-4 flex max-w-md flex-col items-center gap-3">
          <Guarded variant="primary" check={data.perms.pmTeam ? data.perms.generate : { ok: false, reason: 'The PM team generates documents.' }} onClick={() => generate.run(pid, type as DocType)}>
            <Sparkles className="h-4 w-4" /> Generate with AI
          </Guarded>
          {data.perms.switchTemplate && (
            <Note tone="blue">
              A newer template (v{data.latestTemplate}) exists. <button className="font-medium underline" onClick={() => switchTemplate.run(pid, type as DocType)}>Switch to it</button>
            </Note>
          )}
          <AiNote agent="docgen" />
        </div>
      </div>
    )

  const comments = data.comments.filter((c) => c.status === 'open' && c.versionId === current.id && c.quote)
  const highlights = [
    ...comments.map((c) => ({ id: c.id, quote: c.quote, kind: 'comment' as const, sectionId: c.sectionId })),
    ...data.suggestions.filter((s) => s.status === 'open' && s.versionId === current.id).map((s) => ({ id: s.id, quote: s.quote, kind: 'suggest' as const, sectionId: s.sectionId })),
  ]
  const showLive = someoneElse && draft && liveView
  const lastReviewed = data.lastChain?.status === 'changes_requested' ? data.versions.find((v) => v.id === data.lastChain!.versionId)?.number : undefined

  return (
    <div>
      {header}
      <div className="mb-4 space-y-2">
        {doc.outOfSync && (
          <Note tone="red" icon={<TriangleAlert className="h-4 w-4" />}>
            <div className="font-medium">Out of sync since {fmtDateTime(doc.outOfSync.since)}: {doc.outOfSync.cause}.</div>
            <div className="text-sm">It must go through approval{data.status.key === 'out_of_sync' && data.signatures.length ? ' and signing' : ''} again, after the documents before it. The PM picks which affected sections to regenerate, or re-approves it unchanged.</div>
            {data.perms.pm && !editing && (
              <Button size="sm" className="mt-2" onClick={() => setSyncing(true)}>
                <RefreshCw className="h-3.5 w-3.5" /> Choose sections to regenerate
              </Button>
            )}
          </Note>
        )}
        {current.scopeCheck?.flagged && !current.scopeCheck.decision && (
          <Note tone="amber" icon={<Sparkles className="h-4 w-4" />}>
            <div className="font-medium">Scope check on v{current.number}: {current.scopeCheck.reason}</div>
            {data.perms.decideScope ? (
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => decideScope.run(doc.id, 'normal')}>Normal edit</Button>
                <Button size="sm" variant="primary" onClick={() => decideScope.run(doc.id, 'scope_change')}>Scope change</Button>
              </div>
            ) : (
              <div className="text-sm">Waiting for the PM to decide: normal edit or scope change.</div>
            )}
          </Note>
        )}
        {data.factUpdates.some((f) => f.status === 'pending') && (
          <Note tone="violet">
            The AI proposed {data.factUpdates.filter((f) => f.status === 'pending').length} Fact Sheet update(s) from edits to this document. <Link to={`/projects/${pid}/changes`} className="font-medium underline">Review them</Link>
          </Note>
        )}
        {someoneElse && (
          <Note tone="blue" icon={<Lock className="h-4 w-4" />}>
            <b>{data.lock!.name}</b> is editing (since {ago(data.lock!.acquiredAt, now)}). Everyone else sees it live, read-only.
            {draft && (
              <button className="ml-2 font-medium underline" onClick={() => setLiveView(!liveView)}>
                {liveView ? 'Show the last saved version' : 'Show live edits'}
              </button>
            )}
            {data.perms.forceUnlock && (
              <Button size="sm" className="ml-2" onClick={() => forceUnlock.run(doc.id)}>
                <Unlock className="h-3.5 w-3.5" /> Force-unlock
              </Button>
            )}
          </Note>
        )}
        {!data.lock && draft && data.perms.pmTeam && (
          <Note tone="amber">
            An unsaved draft exists (autosaved {fmtDateTime(draft.updatedAt)}).
            <span className="ml-2 inline-flex gap-2">
              <Button size="sm" onClick={() => lock.run(doc.id)}>Continue editing</Button>
              <Button size="sm" variant="primary" onClick={() => setSaving(true)}>Save version</Button>
              <Button size="sm" variant="danger" onClick={() => lock.run(doc.id).then(() => discard.run(doc.id))}>Discard</Button>
            </span>
          </Note>
        )}
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'document', label: editing ? 'Editing' : 'Document' },
          { id: 'history', label: `History (${data.versions.length})` },
          { id: 'compare', label: 'Compare' },
          { id: 'summaries', label: 'Summaries and slides' },
          { id: 'trace', label: 'Traceability', hidden: type !== 'SRS' },
        ]}
      />

      {tab === 'document' && (
        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {editing ? (
                <>
                  <Badge tone="blue"><Pencil className="h-3 w-3" /> You are editing</Badge>
                  <Button size="sm" variant="primary" onClick={() => setSaving(true)}>
                    <Save className="h-3.5 w-3.5" /> Save version
                  </Button>
                  <Button size="sm" onClick={() => release.run(doc.id)}>Stop editing (keep draft)</Button>
                </>
              ) : (
                <>
                  {current.authorId === null && <AiBadge label={`AI draft v${current.number}: check before approving`} />}
                  {data.perms.pmTeam && !someoneElse && (
                    <Guarded size="sm" check={{ ok: data.perms.edit && data.project.status === 'active', reason: data.perms.editReason }} onClick={() => lock.run(doc.id)}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Guarded>
                  )}
                </>
              )}
            </div>
            <div className="rounded-lg bg-white p-6 ring-1 ring-line">
              {editing ? (
                <DocEditor key={draft!.baseVersionId} docId={doc.id} draft={draft!} onStop={() => toast.error('You no longer hold the edit lock. Your draft is saved.')} />
              ) : showLive ? (
                <Reader sections={draft!.sections} highlights={[]} canAnnotate={false} onAnnotate={() => {}} />
              ) : (
                <Reader
                  sections={current.sections}
                  regenerated={current.regeneratedSectionIds}
                  highlights={highlights}
                  canAnnotate={data.perms.comment.ok}
                  onAnnotate={(kind, sel) => setAnnotating({ kind, sel })}
                  activeId={active}
                  onHighlightClick={(id) => {
                    setActive(id)
                    document.getElementById(`c-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }}
                />
              )}
            </div>
            {current.authorId === null && !editing && <div className="mt-3"><AiNote agent="docgen" compact /></div>}
          </div>
          <div className="space-y-4">
            <ApprovalPanel
              docId={doc.id}
              docType={doc.type}
              versionId={current.id}
              versionNumber={current.number}
              activeChain={data.activeChain}
              lastChain={data.lastChain}
              chains={data.chains}
              send={data.perms.send}
              act={data.perms.act}
              minor={data.perms.minor}
              outOfSync={!!doc.outOfSync}
              frozen={current.frozen}
              signatures={data.signatures.filter((s) => s.versionId === current.id)}
              compareLink={lastReviewed ? `/projects/${pid}/docs/${type}?tab=compare&a=${lastReviewed}&b=${current.number}` : undefined}
            />
            <CommentsPanel data={data} activeId={active} onActivate={setActive} onGeneral={() => setAnnotating({ kind: 'comment', sel: null })} />
            {data.perms.switchTemplate && (
              <Card title="Template">
                <p className="text-sm text-muted">This project uses template v{data.project.templateVersions[type as DocType]}. v{data.latestTemplate} is available.</p>
                <Button size="sm" className="mt-2" onClick={() => switchTemplate.run(pid, type as DocType)}>Switch for the next generation</Button>
              </Card>
            )}
          </div>
        </div>
      )}
      {tab === 'history' && <HistoryTab data={data} onCompare={(a, b) => setParams({ tab: 'compare', a: String(a), b: String(b) })} />}
      {tab === 'compare' && <CompareTab data={data} />}
      {tab === 'summaries' && <SummariesTab data={data} />}
      {tab === 'trace' && <TraceTab data={data} />}

      {annotating && <AnnotateModal data={data} kind={annotating.kind} sel={annotating.sel} onClose={() => setAnnotating(null)} />}
      {saving && <SaveVersionModal data={data} onClose={() => setSaving(false)} />}
      {syncing && <OutOfSyncModal data={data} onClose={() => setSyncing(false)} />}
    </div>
  )
}
