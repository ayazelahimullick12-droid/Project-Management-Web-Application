/**
 * Simple view · one document. Reading comes first:
 *   one slim bar (where it stands, the approval steps, your turn) → at most one notice → the
 *   document as a paper sheet, with a contents list beside it (src/simple/DocumentParts.tsx).
 * "Show changes since version N" marks the edits in the text itself (green added, struck removed).
 * The Proposal & Charter shows three tabs: Proposal · Charter · Slides (made automatically).
 * If the approval chain needs people who are not on the project yet, the notice says who and
 * offers "Add …" (for the Owner and the PM).
 * Comments open on request (select text to comment). Approve / Ask for changes / Send sit in the
 * bar at the bottom. Editing, history, compare, summaries and downloads are under More: they open
 * the full document tools on the same page address plus /tools.
 */
import { clsx } from 'clsx'
import { ListOrdered, MessageSquare, MoreHorizontal } from 'lucide-react'
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
import { Button, ErrorBox, LinkButton, Loading, Segmented } from '../components/ui'
import { Reader, type Selection } from '../pages/document/Reader'
import { AnnotateModal, CommentsPanel } from '../pages/document/CommentsPanel'
import { ActionBar, NextStep, SimplePage, StatusLine, ToneIcon } from './parts'
import { ApprovalBar, ChangesBody, Contents, Paper, useActiveSection, type RecordRow } from './DocumentParts'
import { GrillMeButton } from '../components/GrillMe'
import { SummaryView } from './SummaryView'
import { DocSteps } from './DocSteps'
import { DocQuestions } from './IntakeChat'

/** The document's formal name on its letterhead. */
const FORMAL_NAME: Partial<Record<DocType, string>> = {
  BRD: 'Business Requirements Document',
  SRS: 'Software Requirements Specification',
  SQA_SIGNOFF: 'SQA Sign-off Report',
  UAT_SIGNOFF: 'UAT Sign-off Report',
}
const HEADING = 'mb-2 flex flex-wrap items-baseline gap-2 border-b border-line pb-1.5 text-xl font-semibold'
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
        <span className="glass-control inline-flex h-12 items-center gap-2 rounded-full px-5 text-base font-medium">
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
  const [showChanges, setShowChanges] = useState(false)
  // Summary or full text. Approvers start on the summary (supervisor's request); everyone else on the text.
  const [docView, setDocView] = useState<'summary' | 'full' | null>(null)
  const [contentsOpen, setContentsOpen] = useState(false)
  const { data, isLoading, error } = useApi(['doc', pid, type, uid], () => api.documents.getDocument(pid, type as DocType))
  const generate = useAction(api.documents.generate, { success: 'The AI is writing it section by section. Progress is shown at the top of the page.' })
  const decideScope = useAction(api.documents.decideScope, { success: 'Decision recorded.' })
  // The sections on screen (the Proposal & Charter shows one part at a time), for the contents list.
  const allSections = data?.current?.sections ?? []
  const onePart = allSections.some((x) => sectionPart(x.key) === 'charter')
  const onScreen = onePart && tab !== 'slides' ? allSections.filter((x) => sectionPart(x.key) === tab) : allSections
  const activeSection = useActiveSection(onScreen.map((x) => x.id), `${showChanges}${showComments}`)
  if (isLoading) return <Loading />
  if (error || !data) return <ErrorBox error={error} />

  const name = DOC_NAME[type as DocType]
  const tools = `/projects/${pid}/docs/${type}/tools`
  const nameOf = (id?: string) => data.members.find((m) => m.userId === id)?.name ?? 'someone'
  const { doc, current, draft } = data
  // The document's own steps: questions → AI writes it → summary & slides → approvers → signed
  const main = type === 'PROPOSAL' || type === 'BRD' || type === 'SRS'
  const steps = main && (
    <DocSteps
      pid={pid}
      type={type}
      questionsDone={data.questionsDone}
      written={!!current}
      summarised={!!data.derived}
      sent={!!data.activeChain && data.activeChain.status !== 'changes_requested'}
      signed={data.complete}
    />
  )

  if (!doc || !current)
    return (
      <SimplePage title={name} subtitle="Not written yet.">
        {steps}
        {/* Step 1 for the BRD and the SRS: their own questions, here in the document's tab */}
        {(type === 'BRD' || type === 'SRS') && <DocQuestions pid={pid} stage={type === 'BRD' ? 'brd_business' : 'srs_technical'} />}
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
  const myTurn = !!chain && data.perms.act.ok && !data.perms.act.coveredAs
  // The Owner or PM may approve any step in the head's place; it is still that head's turn.
  const canCover = !!chain && data.perms.act.ok && !!data.perms.act.coveredAs
  const hasSummary = data.type === 'PROPOSAL' || data.type === 'BRD' || data.type === 'SRS'
  const approver = !!chain && (myTurn || canCover || chain.steps.some((st) => st.assigneeId === uid))
  const view = !hasSummary ? 'full' : (docView ?? (approver ? 'summary' : 'full'))
  const canSend = !chain && data.perms.send.ok
  const minorReady = !chain && !!data.perms.minor.requested && data.perms.minor.ok
  const someoneElse = !!data.lock && !data.lock.mine
  const pendingUpdates = data.factUpdates.filter((f) => f.status === 'pending').length
  const lastReviewed = data.lastChain?.status === 'changes_requested' ? data.versions.find((v) => v.id === data.lastChain!.versionId)?.number : undefined
  const since = data.status.since ? ` (for ${waited(data.status.since, now)})` : ''
  const statusText = myTurn
    ? `Waiting for your approval${data.perms.act.actingFor ? `, as deputy for ${nameOf(data.perms.act.actingFor)}, who is away` : ''}${since}.`
    : `${docStatusText(data.status, nameOf).replace(/ to approve$/, step?.sign ? ' to approve and sign' : ' to approve')}${data.status.key === 'in_review' ? since : ''}.${canCover && step ? ` You can also ${step.sign ? 'approve and sign' : 'approve'} it in ${step.role === 'PERSON' ? `${step.assigneeName}’s` : `the ${step.roleLabel.toLowerCase()}'s`} place.` : ''}`

  // At most one notice: the most important one.
  let notice: { tone: Tone; text: ReactNode; actions?: ReactNode } | undefined
  const needPeople = data.perms.pm && !chain && !current.frozen && data.missing.length > 0
  if (doc.outOfSync && data.perms.pm) notice = { tone: 'problem', text: `This document needs updating: ${doc.outOfSync.cause}.`, actions: <LinkButton to={tools} size="lg">Update it</LinkButton> }
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
  const prevShown = prev ? (isPackage && tab !== 'slides' ? prev.sections.filter((x) => sectionPart(x.key) === tab) : prev.sections) : []
  const changedKeys = new Set(prev ? current.sections.filter((x) => prev.sections.find((y) => y.key === x.key)?.content !== x.content).map((x) => x.key) : [])
  const contentsItems = shown.map((x) => ({
    id: x.id,
    title: x.title,
    changed: changedKeys.has(x.key),
    comments: data.comments.filter((c) => c.sectionId === x.id && (c.status === 'open' || c.status === 'pending_check')).length + data.suggestions.filter((g) => g.sectionId === x.id && g.status === 'open').length,
    ai: current.regeneratedSectionIds.includes(x.id) || !current.authorId,
  }))
  const docTitle = isPackage ? (tab === 'charter' ? 'Project Charter' : 'Project Proposal') : (FORMAL_NAME[data.type] ?? name)
  // The approval record on the sheet: the latest approval round of this version.
  const round = [...data.chains].reverse().find((c) => c.versionId === current.id && c.status !== 'cancelled')
  const record: RecordRow[] = (round?.steps ?? []).map((st) => ({
    role: st.roleLabel,
    name: st.actedByName ?? (st.vacant ? '—' : st.assigneeName),
    decision: st.status === 'approved' ? (st.sign ? 'Approved and signed' : 'Approved') : st.status === 'changes_requested' ? 'Asked for changes' : st.status === 'pending' ? 'Waiting' : st.status === 'carried_over' ? 'Approved (carried over)' : 'Not yet',
    date: st.status === 'approved' || st.status === 'changes_requested' ? st.actedAt : undefined,
    note: st.actedNote || undefined,
  }))
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
    <SimplePage title={name} wide>
      {steps}
      <ApprovalBar
        tone={myTurn ? 'action' : docTone(data.status)}
        status={statusText}
        steps={chain?.steps.map((s) => ({ name: s.vacant && s.status !== 'approved' ? `no ${s.roleLabel.toLowerCase()} yet` : (s.actedByName ?? s.assigneeName), role: s.roleLabel, status: s.status, sign: s.sign }))}
        prompt={
          myTurn && step
            ? `Your turn: read it, then ${step.sign ? 'approve and sign it' : 'approve it'} or ask for changes with the buttons at the bottom.`
            : canSend
              ? 'It is ready. Send it for approval with the button at the bottom.'
              : minorReady
                ? 'The requested changes were made. If it was a small fix, the approvals can continue where they stopped (button at the bottom).'
                : undefined
        }
      />

      {needPeople && !notice && <MissingPeople pid={pid} missing={data.missing} canAdd={data.canAddPeople} optional="You (the Project Owner or the Project Manager) approve that step in their place. You can add them now if you like." large />}

      {notice && (
        <div className="shadow-soft rounded-2xl p-5">
          <StatusLineInner tone={notice.tone}>{notice.text}</StatusLineInner>
          {notice.actions && <div className="mt-4 flex flex-wrap gap-3">{notice.actions}</div>}
        </div>
      )}

      {hasSummary && (
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            value={view}
            onChange={(x) => setDocView(x as 'summary' | 'full')}
            options={[
              { id: 'summary', label: 'Summary' },
              { id: 'full', label: 'Full document' },
            ]}
          />
          {view === 'summary' && approver && <span className="text-sm text-muted">Start with the summary; open the full document whenever you want.</span>}
        </div>
      )}

      {view === 'summary' && <SummaryView data={data} onReadFull={() => setDocView('full')} />}

      {view === 'full' && (
      <div>
        {/* Tools above the sheet: part tabs, contents (narrow screens), changes, comments */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {isPackage && (
            <div role="tablist" aria-label="Part" className="inline-flex rounded-full bg-canvas p-1">
              {(['proposal', 'charter', 'slides'] as const).map((t) => (
                <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={clsx('rounded-full px-5 py-2 text-base font-medium transition', tab === t ? 'bg-paper text-ink shadow-sm dark:bg-white/15' : 'text-muted hover:text-ink')}>
                  {t === 'proposal' ? 'Proposal' : t === 'charter' ? 'Charter' : 'Slides'}
                </button>
              ))}
            </div>
          )}
          {!(tab === 'slides' && isPackage) && (
            <>
              <div className={clsx('relative', !showComments && 'lg:hidden')}>
                <Button size="lg" variant="ghost" onClick={() => setContentsOpen(!contentsOpen)} aria-expanded={contentsOpen}>
                  <ListOrdered className="h-5 w-5" /> Contents
                </Button>
                {contentsOpen && (
                  <div className="glass-strong absolute top-full left-0 z-30 mt-2 max-h-[60vh] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl p-2">
                    <Contents items={contentsItems} active={activeSection} onPick={() => setContentsOpen(false)} />
                  </div>
                )}
              </div>
              {prev && changed.length > 0 && (
                <label className="inline-flex cursor-pointer items-center gap-2.5 rounded-full px-3 py-2 text-base font-medium hover:bg-ink/[0.04]">
                  <input type="checkbox" className="peer sr-only" checked={showChanges} onChange={(e) => setShowChanges(e.target.checked)} />
                  <span className="relative h-6 w-10 shrink-0 rounded-full bg-ink/15 transition peer-checked:bg-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-4 dark:bg-white/20" aria-hidden />
                  <span>
                    Show changes since version {prevNo} <span className="text-sm font-normal text-muted">({changed.length} part{changed.length > 1 ? 's' : ''})</span>
                  </span>
                </label>
              )}
              <span className="ml-auto" />
              {data.perms.comment.ok && !showChanges && <span className="hidden text-sm text-muted md:inline">To comment, select some text</span>}
              {(data.type === 'PROPOSAL' || data.type === 'BRD' || data.type === 'SRS') && <GrillMeButton pid={pid} target={data.type} size="lg" />}
              {data.type !== 'SQA_SIGNOFF' && data.type !== 'UAT_SIGNOFF' && (
                <Button size="lg" variant="ghost" onClick={() => setShowComments(!showComments)} aria-expanded={showComments}>
                  <MessageSquare className="h-5 w-5" /> {showComments ? 'Hide comments' : `Comments${openComments ? ` (${openComments})` : ''}`}
                </Button>
              )}
            </>
          )}
        </div>

        {tab === 'slides' && isPackage ? (
          <SummariesTab data={data} />
        ) : (
          <div className={clsx('grid gap-6', showComments ? 'lg:grid-cols-[minmax(0,1fr)_340px]' : 'lg:grid-cols-[13rem_minmax(0,1fr)]')}>
            {!showComments && (
              <aside className="hidden lg:block">
                <div className="sticky top-36 max-h-[calc(100vh-11rem)] overflow-y-auto pb-4">
                  <Contents items={contentsItems} active={activeSection} />
                </div>
              </aside>
            )}
            <Paper
              docTitle={docTitle}
              projectName={data.project.name}
              version={current.number}
              date={current.createdAt}
              aiWritten={!current.authorId}
              status={data.status.key}
              record={record}
              signatures={data.signatures.filter((x) => x.versionId === current.id).map((x) => ({ name: x.signerName, at: x.signedAt, hash: x.docHash, note: x.onBehalf || undefined }))}
            >
              {showChanges && prev ? (
                <>
                  <p className="mb-6 rounded-lg bg-sky-50 px-4 py-2.5 text-base text-sky-950">
                    Changes since version {prevNo}: <span className="diff-add px-1">added</span> and <span className="diff-del px-1">removed</span> words are marked.
                    {current.message && <> The editor wrote: “{current.message}”</>}
                  </p>
                  <ChangesBody sections={shown} previous={prevShown} headingClass={HEADING} />
                </>
              ) : (
                <Reader
                  sections={shown}
                  numbered
                  headingClass={HEADING}
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
              )}
            </Paper>
            {showComments && (
              <aside className="lg:sticky lg:top-36 lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto">
                <CommentsPanel data={data} activeId={active} onActivate={setActive} onGeneral={() => setAnnotating({ kind: 'comment', sel: null })} />
              </aside>
            )}
          </div>
        )}
      </div>
      )}

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
