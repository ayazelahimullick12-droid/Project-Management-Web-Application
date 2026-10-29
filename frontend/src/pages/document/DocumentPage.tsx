/**
 * One document (Proposal, Charter, BRD or SRS): read view with comments, the editor, versions,
 * compare, AI summaries, traceability (SRS) and the approval panel.
 * SPEC.md "Document pipeline", "Approval and signing", "Editing, versions…", "Comments…".
 */
import { Info, Lock, MoreHorizontal, Pencil, RefreshCw, Save, Sparkles, TriangleAlert } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { DocType } from '../../types'
import { api } from '../../api'
import { useAction, useApi, useNow, useSessionUserId } from '../../api/hooks'
import { ApprovalActions, ApprovalTimeline } from '../../components/ApprovalPanel'
import { AiBadge, AiNote } from '../../components/ai'
import { DiscussButton } from '../../components/chat/ChatThread'
import { openChat } from '../../components/chat/dock'
import { DocStatusChip } from '../../components/status'
import { downloadItems } from '../../components/exports'
import { ago } from '../../components/format'
import { Button, Checkbox, ErrorBox, Field, Guarded, Input, Loading, MenuButton, Modal, Note, Segmented, Spinner, useTab } from '../../components/ui'
import { useToast } from '../../components/toast'
import { Reader, type Selection } from './Reader'
import { DocEditor } from './Editor'
import { AnnotateModal, CommentsPanel } from './CommentsPanel'
import { CompareTab, HistoryTab, SummariesTab, TraceTab } from './DocTabs'
import { MissingPeople } from '../../components/People'

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
        <Button variant="primary" disabled={!preview || !message.trim() || save.pending || (preview.flagged && data.perms.pm && !decision)} onClick={() => save.run(data.doc!.id, message, decision || undefined)}>
          <Save className="h-4 w-4" /> Save version
        </Button>
      }
    >
      <Field label="Short message" hint="Shown in the version history, like a commit message.">
        <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. Updated the budget split" autoFocus />
      </Field>
      {!preview && (
        <div className="flex items-center gap-2 text-sm text-violet-800">
          <Spinner className="border-violet-600" /> Checking whether the edit changes scope…
        </div>
      )}
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

type NoticeTone = 'red' | 'amber' | 'blue' | 'violet' | 'gray'
const NOTICE: Record<NoticeTone, string> = {
  red: 'border-red-200 bg-red-50/70 text-red-900',
  amber: 'border-amber-200 bg-amber-50/70 text-amber-900',
  blue: 'border-sky-200 bg-sky-50/70 text-sky-900',
  violet: 'border-violet-200 bg-violet-50/70 text-violet-900',
  gray: 'border-line bg-surface text-ink/80',
}

/** A slim callout (like Notion): one line of text and an optional action. */
function Notice({ tone, icon, children, actions }: { tone: NoticeTone; icon: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3 py-2 text-sm ${NOTICE[tone]}`}>
      <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <span className="min-w-0 flex-1">{children}</span>
      {actions && <span className="flex flex-wrap items-center gap-2">{actions}</span>}
    </div>
  )
}

export function DocumentPage() {
  const { pid = '', type = 'PROPOSAL' } = useParams()
  const uid = useSessionUserId()
  const now = useNow()
  const toast = useToast()
  const navigate = useNavigate()
  const [tab, setTab] = useTab('document')
  const [, setParams] = useSearchParams()
  const [rail, setRail] = useState<'comments' | 'approval' | null>(null)
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
  const breadcrumb = (
    <div className="mb-1 text-xs text-muted">
      <Link to={`/projects/${pid}`} className="hover:text-brand">
        {data.project.name}
      </Link>{' '}
      / Documents
    </div>
  )

  if (!doc || !current)
    return (
      <div>
        {breadcrumb}
        <h1 className="page-title mb-8 text-2xl">{data.label}</h1>
        <div className="mx-auto max-w-lg shadow-soft rounded-2xl border border-line/70 bg-surface px-8 py-10 text-center">
          <Sparkles className="mx-auto mb-3 h-6 w-6 text-violet-600" />
          <div className="font-semibold">Not drafted yet</div>
          <p className="mt-1 mb-5 text-sm text-muted">
            The AI writes it section by section from the confirmed Fact Sheet{type !== 'PROPOSAL' ? ' and the earlier approved documents' : ''}. People then review, comment and approve.
          </p>
          <Guarded variant="primary" check={data.perms.pmTeam ? data.perms.generate : { ok: false, reason: 'The PM team generates documents.' }} onClick={() => generate.run(pid, type as DocType)}>
            <Sparkles className="h-4 w-4" /> Generate with AI
          </Guarded>
          {data.perms.switchTemplate && (
            <button className="mt-4 block w-full text-xs text-brand" onClick={() => switchTemplate.run(pid, type as DocType)}>
              A newer template (v{data.latestTemplate}) exists. Switch to it.
            </button>
          )}
          <div className="mt-4 text-left">
            <AiNote agent="docgen" compact />
          </div>
        </div>
      </div>
    )

  const editing = !!data.lock?.mine && !!draft
  const someoneElse = !!data.lock && !data.lock.mine
  const openComments = data.comments.filter((c) => c.status === 'open' || c.status === 'pending_check').length
  const comments = data.comments.filter((c) => c.status === 'open' && c.versionId === current.id && c.quote)
  const highlights = [
    ...comments.map((c) => ({ id: c.id, quote: c.quote, kind: 'comment' as const, sectionId: c.sectionId })),
    ...data.suggestions.filter((s) => s.status === 'open' && s.versionId === current.id).map((s) => ({ id: s.id, quote: s.quote, kind: 'suggest' as const, sectionId: s.sectionId })),
  ]
  const showLive = someoneElse && draft && liveView
  const lastReviewed = data.lastChain?.status === 'changes_requested' ? data.versions.find((v) => v.id === data.lastChain!.versionId)?.number : undefined
  const pendingUpdates = data.factUpdates.filter((f) => f.status === 'pending').length
  const chainRunning = data.activeChain?.status === 'in_progress'
  const railTab = rail ?? (chainRunning && data.perms.act.ok ? 'approval' : 'comments')
  const approvalProps = {
    docId: doc.id,
    docType: doc.type,
    versionId: current.id,
    versionNumber: current.number,
    activeChain: data.activeChain,
    lastChain: data.lastChain,
    chains: data.chains,
    send: data.perms.send,
    act: data.perms.act,
    minor: data.perms.minor,
    outOfSync: !!doc.outOfSync,
    frozen: current.frozen,
    signatures: data.signatures.filter((s) => s.versionId === current.id),
    compareLink: lastReviewed ? `/projects/${pid}/docs/${type}?tab=compare&a=${lastReviewed}&b=${current.number}` : undefined,
  }
  const sendHint = data.perms.pm && !chainRunning && !data.perms.send.ok && !current.frozen && !data.perms.minor.requested ? data.perms.send.reason : undefined

  return (
    <div>
      {/* Header: title, status and one main action (other actions behind "…") */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {breadcrumb}
          <h1 className="page-title flex items-center gap-2 text-2xl">
            {data.label}
            <button className="rounded-md px-1.5 text-sm font-normal text-muted hover:bg-ink/5" onClick={() => setTab('history')} title="Version history">
              v{current.number}
            </button>
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted">
            <DocStatusChip status={data.status} />
            {current.authorId === null && <AiBadge label="AI draft" />}
            <span>
              {current.authorId ? 'Saved' : 'Generated'} {ago(current.createdAt, now)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editing ? (
            <>
              <Button onClick={() => release.run(doc.id)}>Stop editing</Button>
              <Button variant="primary" onClick={() => setSaving(true)}>
                <Save className="h-4 w-4" /> Save version
              </Button>
            </>
          ) : (
            <>
              {data.perms.pmTeam && !someoneElse && data.project.status === 'active' && (
                <Button onClick={() => lock.run(doc.id)} disabled={!data.perms.edit} why={data.perms.editReason}>
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
              )}
              <ApprovalActions {...approvalProps} layout="row" />
            </>
          )}
          {data.chatId && <DiscussButton onClick={() => openChat(data.chatId!, navigate)} />}
          <MenuButton
            label={<MoreHorizontal className="h-4 w-4" />}
            items={[
              ...downloadItems(data, current),
              'divider',
              { label: 'Open the discussion in Messages', onClick: () => navigate(`/messages/${data.chatId}`), hidden: !data.chatId },
              { label: 'Version history', onClick: () => setTab('history') },
              { label: 'Summaries and slides', onClick: () => setTab('summaries') },
              { label: 'Switch to the newer template', onClick: () => switchTemplate.run(pid, type as DocType), hidden: !data.perms.switchTemplate },
              { label: 'Regenerate out-of-sync sections', onClick: () => setSyncing(true), hidden: !(doc.outOfSync && data.perms.pm && !editing) },
              { label: `Force-unlock (${data.lock?.name ?? ''} is editing)`, onClick: () => forceUnlock.run(doc.id), hidden: !data.perms.forceUnlock, danger: true },
            ]}
          />
        </div>
      </div>

      {/* Only what matters right now */}
      <div className="mb-5 space-y-2">
        {doc.outOfSync && (
          <Notice
            tone="red"
            icon={<TriangleAlert />}
            actions={data.perms.pm && !editing && <Button size="sm" onClick={() => setSyncing(true)}><RefreshCw className="h-3.5 w-3.5" /> Choose sections to regenerate</Button>}
          >
            Out of sync: {doc.outOfSync.cause}. It must be approved again, after the documents before it{current.frozen ? ' (unchanged is fine)' : ''}.
          </Notice>
        )}
        {current.scopeCheck?.flagged && !current.scopeCheck.decision && (
          <Notice
            tone="amber"
            icon={<Sparkles />}
            actions={
              data.perms.decideScope && (
                <>
                  <Button size="sm" onClick={() => decideScope.run(doc.id, 'normal')}>Normal edit</Button>
                  <Button size="sm" variant="primary" onClick={() => decideScope.run(doc.id, 'scope_change')}>Scope change</Button>
                </>
              )
            }
          >
            Scope check on v{current.number}: {current.scopeCheck.reason} {!data.perms.decideScope && 'The PM decides: normal edit or scope change.'}
          </Notice>
        )}
        {someoneElse && (
          <Notice
            tone="blue"
            icon={<Lock />}
            actions={draft && <button className="text-xs font-medium underline" onClick={() => setLiveView(!liveView)}>{liveView ? 'Show last saved version' : 'Show live edits'}</button>}
          >
            <b>{data.lock!.name}</b> is editing (since {ago(data.lock!.acquiredAt, now)}). You see the changes live, read-only.
          </Notice>
        )}
        {!data.lock && draft && data.perms.pmTeam && (
          <Notice
            tone="amber"
            icon={<Pencil />}
            actions={
              <>
                <Button size="sm" onClick={() => lock.run(doc.id)}>Continue editing</Button>
                <Button size="sm" variant="primary" onClick={() => setSaving(true)}>Save version</Button>
                <Button size="sm" variant="ghost" onClick={() => lock.run(doc.id).then(() => discard.run(doc.id))}>Discard</Button>
              </>
            }
          >
            Unsaved draft, autosaved {ago(draft.updatedAt, now)}.
          </Notice>
        )}
        {pendingUpdates > 0 && data.perms.pmTeam && (
          <Notice tone="violet" icon={<Sparkles />} actions={<Link to={`/projects/${pid}/changes?tab=updates`} className="text-xs font-medium underline">Review</Link>}>
            The AI proposed {pendingUpdates} Fact Sheet update{pendingUpdates > 1 ? 's' : ''} from edits to this document.
          </Notice>
        )}
        {sendHint && data.missing.length > 0 && !current.frozen ? (
          <MissingPeople pid={pid} missing={data.missing} canAdd={data.canAddPeople} before="Before it can be sent for approval" />
        ) : (
          sendHint && (
            <Notice tone="gray" icon={<Info />}>
              Before sending for approval: {sendHint}
            </Notice>
          )
        )}
      </div>

      <div className="mb-4">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { id: 'document', label: editing ? 'Editing' : 'Document' },
            { id: 'history', label: 'History' },
            { id: 'compare', label: 'Compare' },
            { id: 'summaries', label: 'Summary' },
            { id: 'trace', label: 'Traceability', hidden: type !== 'SRS' },
          ]}
        />
      </div>

      {tab === 'document' && (
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
          <article className="min-w-0 rounded-xl border border-line/70 bg-surface px-6 py-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)] md:px-12">
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
                  setRail('comments')
                  setActive(id)
                  setTimeout(() => document.getElementById(`c-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
                }}
              />
            )}
            {current.authorId === null && !editing && <AiNote agent="docgen" compact />}
          </article>

          <aside className="xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto">
            <div className="mb-3 flex gap-1 border-b border-line">
              {(
                [
                  ['comments', `Comments${openComments ? ` (${openComments})` : ''}`],
                  ['approval', 'Approval'],
                ] as const
              ).map(([id, label]) => (
                <button key={id} onClick={() => setRail(id)} className={`-mb-px border-b-2 px-2.5 py-2 text-sm ${railTab === id ? 'border-brand font-medium' : 'border-transparent text-muted hover:text-ink'}`}>
                  {label}
                </button>
              ))}
            </div>
            {railTab === 'comments' ? (
              <CommentsPanel data={data} activeId={active} onActivate={setActive} onGeneral={() => setAnnotating({ kind: 'comment', sel: null })} />
            ) : (
              <ApprovalTimeline {...approvalProps} />
            )}
          </aside>
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
