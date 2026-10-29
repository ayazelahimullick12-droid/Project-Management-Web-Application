/**
 * Simple view · one document. Reading comes first:
 *   status sentence → your next step (if any) → at most one notice → what changed → the text.
 * The Proposal & Charter shows three tabs: Proposal · Charter · Slides (made automatically).
 * If the approval chain needs people who are not on the project yet, the notice says who and
 * offers "Add …" (for the Owner and the PM).
 * Comments open on request (select text to comment). Approve / Ask for changes / Send sit in the
 * bar at the bottom. Editing, history, compare, summaries and downloads are under More: they open
 * the full document tools on the same page address plus /tools.
 */
import { clsx } from 'clsx'
import { MessageSquare, MoreHorizontal } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { DocType } from '../types'
import { api } from '../api'
import { useAction, useApi, useNow, useSessionUserId } from '../api/hooks'
import { ApprovalActions } from '../components/ApprovalPanel'
import { Dropdown } from '../components/Dropdown'
import { downloadItems } from '../components/exports'
import { MissingPeople } from '../components/People'
import { sectionPart } from '../rules/pipeline'
import { SummariesTab } from '../pages/document/DocTabs'
import { ago } from '../components/format'
import { Button, ErrorBox, LinkButton, Loading } from '../components/ui'
import { Reader, type Selection } from '../pages/document/Reader'
import { AnnotateModal, CommentsPanel } from '../pages/document/CommentsPanel'
import { ActionBar, NextStep, SimplePage, StatusLine, ToneIcon } from './parts'
import { DOC_NAME, docStatusText, docTone, waited, type Tone } from './words'

/** "More" menu that opens upwards from the bottom bar. */
function MoreMenu({ items }: { items: { label: string; to?: string; href?: string; onClick?: () => void; hidden?: boolean }[] }) {
  const navigate = useNavigate()
  return (
    <Dropdown
      up
      width="w-72"
      label="More"
      button={() => (
        <span className="inline-flex h-12 items-center gap-2 rounded-lg px-4 text-base font-medium ring-1 ring-line hover:bg-canvas">
          <MoreHorizontal className="h-5 w-5" /> More
        </span>
      )}
    >
      {(close) => (
        <div className="p-1.5">
          {items
            .filter((i) => !i.hidden)
            .map((i) =>
              i.href ? (
                <a key={i.label} href={i.href} target="_blank" rel="noreferrer" onClick={close} className="block rounded-xl px-4 py-2.5 text-base hover:bg-canvas">
                  {i.label}
                </a>
              ) : (
                <button
                  key={i.label}
                  className="block w-full rounded-xl px-4 py-2.5 text-left text-base hover:bg-canvas"
                  onClick={() => {
                    close()
                    if (i.to) navigate(i.to)
                    i.onClick?.()
                  }}
                >
                  {i.label}
                </button>
              ),
            )}
        </div>
      )}
    </Dropdown>
  )
}

export function SimpleDocumentPage() {
  const { pid = '', type = 'PROPOSAL' } = useParams()
  const uid = useSessionUserId()
  const now = useNow()
  const [showComments, setShowComments] = useState(false)
  const [annotating, setAnnotating] = useState<{ kind: 'comment' | 'suggest'; sel: Selection | null } | null>(null)
  const [active, setActive] = useState<string | undefined>()
  const [tab, setTab] = useState<'proposal' | 'charter' | 'slides'>('proposal')
  const { data, isLoading, error } = useApi(['doc', pid, type, uid], () => api.documents.getDocument(pid, type as DocType))
  const generate = useAction(api.documents.generate, { success: 'The AI is writing it section by section. Progress is shown at the top of the page.' })
  const decideScope = useAction(api.documents.decideScope, { success: 'Decision recorded.' })
  if (isLoading) return <Loading />
  if (error || !data) return <ErrorBox error={error} />

  const name = DOC_NAME[type as DocType]
  const tools = `/projects/${pid}/docs/${type}/tools`
  const back = { to: `/projects/${pid}`, label: data.project.name }
  const nameOf = (id?: string) => data.members.find((m) => m.userId === id)?.name ?? 'someone'
  const { doc, current, draft } = data

  if (!doc || !current)
    return (
      <SimplePage back={back} title={name} subtitle="Not written yet.">
        {data.perms.pmTeam && data.perms.generate.ok ? (
          <NextStep
            actions={
              <Button variant="primary" size="lg" disabled={generate.pending} onClick={() => generate.run(pid, type as DocType)}>
                Write it with AI
              </Button>
            }
          >
            The AI writes a first draft from the project facts{type !== 'PROPOSAL' ? ' and the earlier documents' : ''}. Then people read it, comment and approve it.
          </NextStep>
        ) : (
          <StatusLine tone="todo">{data.perms.pmTeam ? data.perms.generate.reason : 'The PM team will write it when the earlier steps are done.'}</StatusLine>
        )}
        {data.perms.switchTemplate && (
          <p className="text-base text-muted">
            A newer template (version {data.latestTemplate}) exists. <Link to={tools} className="font-medium text-brand hover:underline">Switch to it</Link>
          </p>
        )}
      </SimplePage>
    )

  // ─── Where it stands and what this person can do ──────────────────────
  const chain = data.activeChain?.status === 'in_progress' ? data.activeChain : undefined
  const step = chain?.steps.find((s) => s.status === 'pending')
  const myTurn = !!chain && data.perms.act.ok
  const canSend = !chain && data.perms.send.ok
  const minorReady = !chain && !!data.perms.minor.requested && data.perms.minor.ok
  const someoneElse = !!data.lock && !data.lock.mine
  const pendingUpdates = data.factUpdates.filter((f) => f.status === 'pending').length
  const lastReviewed = data.lastChain?.status === 'changes_requested' ? data.versions.find((v) => v.id === data.lastChain!.versionId)?.number : undefined
  const since = data.status.since ? ` (for ${waited(data.status.since, now)})` : ''
  const statusText = myTurn
    ? `Waiting for your approval${data.perms.act.actingFor ? `, as deputy for ${nameOf(data.perms.act.actingFor)}, who is away` : ''}${since}.`
    : `${docStatusText(data.status, nameOf)}${data.status.key === 'in_review' ? since : ''}.`

  // At most one notice: the most important one.
  let notice: { tone: Tone; text: ReactNode; actions?: ReactNode } | undefined
  const needPeople = data.perms.pm && !chain && !current.frozen && data.missing.length > 0
  if (needPeople) notice = undefined // shown below as "Before it can be sent for approval, add …"
  else if (doc.outOfSync && data.perms.pm) notice = { tone: 'problem', text: `This document needs updating: ${doc.outOfSync.cause}.`, actions: <LinkButton to={tools} size="lg">Update it</LinkButton> }
  else if (current.scopeCheck?.flagged && !current.scopeCheck.decision && data.perms.decideScope)
    notice = {
      tone: 'problem',
      text: `The AI thinks the last change may change the project's scope: ${current.scopeCheck.reason}`,
      actions: (
        <>
          <Button size="lg" onClick={() => decideScope.run(doc.id, 'normal')}>It is a normal edit</Button>
          <Button size="lg" variant="ghost" onClick={() => decideScope.run(doc.id, 'scope_change')}>It changes the scope</Button>
        </>
      ),
    }
  else if (someoneElse) notice = { tone: 'waiting', text: `${data.lock!.name} is editing right now. You see the last saved version.` }
  else if (!data.lock && draft && data.perms.pmTeam) notice = { tone: 'action', text: 'There are unsaved edits to this document.', actions: <LinkButton to={tools} size="lg">Continue editing</LinkButton> }
  else if (pendingUpdates && data.perms.pmTeam) notice = { tone: 'action', text: `After the last edit, the AI suggested ${pendingUpdates} change${pendingUpdates > 1 ? 's' : ''} to the project facts.`, actions: <LinkButton to={`/projects/${pid}/changes?tab=updates`} size="lg">Review</LinkButton> }
  else if (data.perms.pm && !chain && !data.perms.send.ok && !current.frozen && !data.perms.minor.requested && data.perms.send.reason) notice = { tone: 'todo', text: `Before it can be sent for approval: ${data.perms.send.reason}` }

  // What changed since the version people last saw.
  const prevNo = lastReviewed ?? (current.number > 1 ? current.number - 1 : undefined)
  const prev = data.versions.find((v) => v.number === prevNo)
  const isPackage = current.sections.some((x) => sectionPart(x.key) === 'charter')
  const changed = prev
    ? current.sections.filter((x) => prev.sections.find((y) => y.key === x.key)?.content !== x.content).map((x) => (isPackage ? `${sectionPart(x.key) === 'charter' ? 'Charter' : 'Proposal'}: ${x.title}` : x.title))
    : []
  const shown = isPackage && tab !== 'slides' ? current.sections.filter((x) => sectionPart(x.key) === tab) : current.sections

  const openComments = data.comments.filter((c) => c.status === 'open' || c.status === 'pending_check').length
  const highlights = [
    ...data.comments.filter((c) => c.status === 'open' && c.versionId === current.id && c.quote).map((c) => ({ id: c.id, quote: c.quote, kind: 'comment' as const, sectionId: c.sectionId })),
    ...data.suggestions.filter((s) => s.status === 'open' && s.versionId === current.id).map((s) => ({ id: s.id, quote: s.quote, kind: 'suggest' as const, sectionId: s.sectionId })),
  ]
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
    compareLink: lastReviewed ? `${tools}?tab=compare&a=${lastReviewed}&b=${current.number}` : undefined,
  }

  return (
    <SimplePage back={back} title={name} wide>
      <StatusLine tone={docTone(data.status)}>
        <div>{statusText}</div>
        {chain && (
          <div className="mt-1 text-base text-muted">
            Approvals:{' '}
            {chain.steps.map((s, i) => (
              <span key={i}>
                {i > 0 && ' → '}
                <span className={clsx(s.status === 'approved' && 'text-leaf', s.status === 'pending' && 'font-medium text-ink')}>
                  {s.status === 'approved' ? '✓ ' : ''}
                  {s.assigneeName}
                  {s.sign ? ' (signs)' : ''}
                </span>
              </span>
            ))}
          </div>
        )}
      </StatusLine>

      {myTurn && step && (
        <NextStep title="Your turn">Read it, then use the buttons at the bottom of the screen to {step.sign ? 'approve and sign it' : 'approve it'}, or to ask for changes.</NextStep>
      )}
      {canSend && <NextStep>It is ready. Send it for approval with the button at the bottom of the screen.</NextStep>}
      {minorReady && <NextStep>The requested changes were made. If it was only a small fix, the approvals can continue from where they stopped (button at the bottom).</NextStep>}

      {needPeople && <MissingPeople pid={pid} missing={data.missing} canAdd={data.canAddPeople} before="Before it can be sent for approval" large />}

      {notice && (
        <div className="rounded-2xl bg-surface p-5 ring-1 ring-line">
          <StatusLineInner tone={notice.tone}>{notice.text}</StatusLineInner>
          {notice.actions && <div className="mt-4 flex flex-wrap gap-3">{notice.actions}</div>}
        </div>
      )}

      {prev && changed.length > 0 && (
        <section className="rounded-2xl bg-sky-50 p-5 text-base text-sky-950 ring-1 ring-sky-200">
          <div className="text-lg font-semibold">What changed since version {prevNo}</div>
          {current.message && <p className="mt-1">“{current.message}”</p>}
          <p className="mt-1">Changed parts: {changed.join(', ')}.</p>
          <Link to={`${tools}?tab=compare&a=${prevNo}&b=${current.number}`} className="mt-2 inline-block font-medium text-brand hover:underline">
            See the changes word by word
          </Link>
        </section>
      )}

      <div>
        {isPackage && (
          <div role="tablist" aria-label="Part" className="mb-4 inline-flex rounded-xl bg-ink/[0.06] p-1">
            {(['proposal', 'charter', 'slides'] as const).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={clsx('rounded-lg px-5 py-2 text-base font-medium transition', tab === t ? 'bg-surface text-ink shadow-sm dark:bg-ink/15' : 'text-muted hover:text-ink')}>
                {t === 'proposal' ? 'Proposal' : t === 'charter' ? 'Charter' : 'Slides'}
              </button>
            ))}
          </div>
        )}
        {tab === 'slides' && isPackage ? (
          <SummariesTab data={data} />
        ) : (
        <>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <span className="text-base text-muted">
            Version {current.number} · {current.authorId ? 'saved' : 'written by the AI'} {ago(current.createdAt, now)}
            {data.perms.comment.ok && ' · to comment, select some text'}
          </span>
          {data.type !== 'SQA_SIGNOFF' && data.type !== 'UAT_SIGNOFF' && (
            <Button size="lg" variant="ghost" className="ml-auto" onClick={() => setShowComments(!showComments)} aria-expanded={showComments}>
              <MessageSquare className="h-5 w-5" /> {showComments ? 'Hide comments' : `Comments${openComments ? ` (${openComments})` : ''}`}
            </Button>
          )}
        </div>
        <div className={clsx('grid gap-6', showComments && 'lg:grid-cols-[minmax(0,1fr)_360px]')}>
          <article className="min-w-0 rounded-2xl bg-surface px-6 py-8 text-[1.0625rem] ring-1 ring-line md:px-12 [&_.md]:text-[1.0625rem]">
            <Reader
              sections={shown}
              regenerated={current.regeneratedSectionIds}
              highlights={highlights}
              canAnnotate={data.perms.comment.ok}
              onAnnotate={(kind, sel) => setAnnotating({ kind, sel })}
              activeId={active}
              onHighlightClick={(id) => {
                setShowComments(true)
                setActive(id)
                setTimeout(() => document.getElementById(`c-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
              }}
            />
          </article>
          {showComments && (
            <aside className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto">
              <CommentsPanel data={data} activeId={active} onActivate={setActive} onGeneral={() => setAnnotating({ kind: 'comment', sel: null })} />
            </aside>
          )}
        </div>
        </>
        )}
      </div>

      <ActionBar
        more={
          <MoreMenu
            items={[
              { label: data.perms.pmTeam ? 'Edit, history and other tools' : 'History and other tools', to: tools },
              { label: 'Compare versions', to: `${tools}?tab=compare` },
              { label: 'Summary and slides', to: `${tools}?tab=summaries`, hidden: data.type.endsWith('SIGNOFF') || isPackage },
              { label: 'Requirements links (traceability)', to: `${tools}?tab=trace`, hidden: data.type !== 'SRS' },
              ...downloadItems(data, current),
              { label: 'Discuss in the document chat', to: `/messages/${data.chatId}`, hidden: !data.chatId },
            ]}
          />
        }
      >
        <ApprovalActions {...approvalProps} layout="row" plain size="lg" />
        {data.perms.pmTeam && data.perms.edit && !someoneElse && !myTurn && (
          <LinkButton to={tools} size="lg" variant={canSend || minorReady ? 'ghost' : 'secondary'}>
            Edit
          </LinkButton>
        )}
      </ActionBar>

      {annotating && <AnnotateModal data={data} kind={annotating.kind} sel={annotating.sel} onClose={() => setAnnotating(null)} />}
    </SimplePage>
  )
}

/** The status line's icon and text without its box (used inside the notice box). */
function StatusLineInner({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-lg">
      <ToneIcon tone={tone} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
