/**
 * Comment sidebar: open comments, comments pending check, suggestions, and the resolved log.
 * SPEC.md "Comments and suggestions".
 */
import { AtSign, Check, CircleCheck, MessageSquare, PenLine, RotateCcw, X } from 'lucide-react'
import { useState } from 'react'
import { clsx } from 'clsx'
import { api } from '../../api'
import { useAction, useNow } from '../../api/hooks'
import { ago, fmtDateTime } from '../../components/format'
import { Avatar, Badge, Button, Card, Checkbox, Field, Modal, Note, Textarea } from '../../components/ui'
import type { Selection } from './Reader'

type DocData = Awaited<ReturnType<typeof api.documents.getDocument>>

export function MentionPicker({ members, value, onChange }: { members: { userId: string; name: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)} className="inline-flex items-center gap-1 text-xs font-medium text-brand">
        <AtSign className="h-3.5 w-3.5" /> Tag people {value.length > 0 && `(${value.length})`}
      </button>
      {open && (
        <div className="mt-1 grid max-h-40 grid-cols-2 gap-1 overflow-y-auto rounded-md bg-canvas p-2">
          {members.map((m) => (
            <Checkbox key={m.userId} label={<span className="text-xs">{m.name}</span>} checked={value.includes(m.userId)} onChange={(c) => onChange(c ? [...value, m.userId] : value.filter((x) => x !== m.userId))} />
          ))}
        </div>
      )}
    </div>
  )
}

/** The form for a new comment or suggestion on selected text (or a general comment). */
export function AnnotateModal({ data, kind, sel, onClose }: { data: DocData; kind: 'comment' | 'suggest'; sel: Selection | null; onClose: () => void }) {
  const [body, setBody] = useState(kind === 'suggest' ? sel?.quote ?? '' : '')
  const [mentions, setMentions] = useState<string[]>([])
  const add = useAction(api.documents.addComment, { success: 'Comment added.', onDone: onClose })
  const suggest = useAction(api.documents.addSuggestion, { success: 'Suggestion sent to the PM team.', onDone: onClose })
  const docId = data.doc!.id
  return (
    <Modal
      open
      onClose={onClose}
      title={kind === 'comment' ? (sel ? 'Comment on the selected text' : 'General comment on the document') : 'Suggest new wording'}
      footer={
        <Button
          variant="primary"
          onClick={() => (kind === 'comment' ? add.run(docId, { sectionId: sel?.sectionId ?? null, quote: sel?.quote ?? '', prefix: sel?.prefix ?? '', suffix: sel?.suffix ?? '', body, mentions }) : suggest.run(docId, { sectionId: sel!.sectionId, quote: sel!.quote, prefix: sel!.prefix, suffix: sel!.suffix, proposed: body }))}
        >
          {kind === 'comment' ? 'Add comment' : 'Send suggestion'}
        </Button>
      }
    >
      {sel && (
        <div className="mb-3 rounded-md bg-canvas p-2 text-sm">
          <div className="text-[11px] text-muted">{sel.sectionTitle}</div>“{sel.quote}”
        </div>
      )}
      <Field label={kind === 'comment' ? 'Comment' : 'Replacement text'} hint={kind === 'suggest' ? 'A PM team member accepts (it becomes an edit) or rejects (it stays in the log).' : 'Comments are visible to everyone and never appear in chat.'}>
        <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} autoFocus />
      </Field>
      {kind === 'comment' && <MentionPicker members={data.members} value={mentions} onChange={setMentions} />}
    </Modal>
  )
}

export function CommentsPanel({ data, activeId, onActivate, onGeneral }: { data: DocData; activeId?: string; onActivate: (id: string) => void; onGeneral: () => void }) {
  const now = useNow()
  const [showResolved, setShowResolved] = useState(false)
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const tick = useAction(api.documents.tickComment, { success: 'Comment resolved.' })
  const check = useAction(api.documents.checkPending)
  const sendReply = useAction(api.documents.replyToComment, { onDone: () => { setReplyTo(null); setReply('') } })
  const decide = useAction(api.documents.decideSuggestion, { success: 'Done. Accepted suggestions are applied to the draft; save a version to publish them.' })
  const sectionTitle = (id: string | null) => data.current?.sections.find((s) => s.id === id)?.title ?? 'Whole document'
  const open = data.comments.filter((c) => c.status === 'open')
  const pending = data.comments.filter((c) => c.status === 'pending_check')
  const resolved = data.comments.filter((c) => c.status === 'resolved')
  const sugs = data.suggestions.filter((s) => s.status === 'open')
  const decidedSugs = data.suggestions.filter((s) => s.status !== 'open')

  const card = (c: (typeof data.comments)[number]) => (
    <li key={c.id} id={`c-${c.id}`} className={clsx('rounded-md p-2.5 ring-1', activeId === c.id ? 'bg-brand-soft/60 ring-brand' : 'bg-white ring-line')} onClick={() => onActivate(c.id)}>
      <div className="mb-1 flex items-center gap-1.5">
        <Avatar name={c.authorName} id={c.authorId} size={20} />
        <span className="text-xs font-medium">{c.authorName}</span>
        <span className="text-[11px] text-muted">· {c.teamLabel} · {ago(c.createdAt, now)}</span>
      </div>
      <div className="mb-1 text-[11px] text-muted">
        {sectionTitle(c.sectionId)} · v{c.createdOnNumber}
        {c.fromRequestChanges && <Badge tone="amber" className="ml-1">Request changes</Badge>}
        {c.reopenCount > 0 && <Badge className="ml-1">reopened</Badge>}
      </div>
      {c.quote && <div className={clsx('mb-1 border-l-2 pl-2 text-xs italic', c.status === 'pending_check' ? 'border-amber-400 text-muted line-through' : 'border-brand text-ink/80')}>“{c.quote}”</div>}
      <div className="text-sm whitespace-pre-line">{c.body}</div>
      {c.mentions.length > 0 && <div className="mt-1 text-[11px] text-brand">Tagged: {c.mentions.map((m) => data.members.find((x) => x.userId === m)?.name).join(', ')}</div>}
      {c.replies.map((r) => (
        <div key={r.id} className="mt-1.5 rounded bg-canvas px-2 py-1 text-xs">
          <b>{r.authorName}:</b> {r.body}
        </div>
      ))}
      {c.status === 'pending_check' && (
        <Note tone="amber" className="mt-2 !py-1.5 !text-xs">
          Auto-resolved: its text was {c.pendingReason === 'regenerated' ? 'regenerated by AI' : 'edited'} in v{c.resolvedOnNumber}. A member of the author’s team confirms or reopens it.
          {c.canCheck && (
            <div className="mt-1.5 flex gap-1.5">
              <Button size="sm" variant="success" onClick={(e) => { e.stopPropagation(); check.run(c.id, true) }}>
                <Check className="h-3 w-3" /> Confirm
              </Button>
              <Button size="sm" onClick={(e) => { e.stopPropagation(); check.run(c.id, false) }}>
                <RotateCcw className="h-3 w-3" /> Reopen
              </Button>
            </div>
          )}
        </Note>
      )}
      {c.status === 'open' && (
        <div className="mt-1.5 flex flex-wrap gap-2">
          {data.perms.tick && (
            <button className="inline-flex items-center gap-1 text-[11px] font-medium text-leaf hover:underline" onClick={(e) => { e.stopPropagation(); tick.run(c.id) }}>
              <CircleCheck className="h-3 w-3" /> Resolve
            </button>
          )}
          <button className="text-[11px] font-medium text-muted hover:text-ink" onClick={(e) => { e.stopPropagation(); setReplyTo(replyTo === c.id ? null : c.id) }}>
            Reply
          </button>
        </div>
      )}
      {replyTo === c.id && (
        <div className="mt-2 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Textarea rows={1} value={reply} onChange={(e) => setReply(e.target.value)} className="!py-1 text-xs" />
          <Button size="sm" onClick={() => sendReply.run(c.id, reply)}>
            Send
          </Button>
        </div>
      )}
    </li>
  )

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" /> Comments
          {open.length > 0 && <Badge tone="magenta">{open.length} open</Badge>}
          {pending.length > 0 && <Badge tone="amber">{pending.length} pending check</Badge>}
        </span>
      }
      actions={
        data.perms.comment.ok && (
          <Button size="sm" variant="ghost" onClick={onGeneral}>
            + General
          </Button>
        )
      }
    >
      {!data.perms.comment.ok && data.perms.comment.reason && <Note className="mb-2 !text-xs">{data.perms.comment.reason}</Note>}
      {data.perms.comment.ok && <p className="mb-2 text-[11px] text-muted">Select text in the document to comment or suggest wording.</p>}
      <ul className="space-y-2">
        {pending.map(card)}
        {open.map(card)}
      </ul>
      {!open.length && !pending.length && <p className="text-sm text-muted">No open comments.</p>}

      {(sugs.length > 0 || decidedSugs.length > 0) && (
        <div className="mt-4 border-t border-line pt-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
            <PenLine className="h-3.5 w-3.5" /> Suggested wording
          </div>
          <ul className="space-y-2">
            {sugs.map((s) => (
              <li key={s.id} className="rounded-md bg-white p-2.5 ring-1 ring-green-200" onClick={() => onActivate(s.id)}>
                <div className="mb-1 text-[11px] text-muted">
                  {s.authorName} · {sectionTitle(s.sectionId)} · {fmtDateTime(s.createdAt)}
                </div>
                <div className="text-xs">
                  <span className="diff-del">{s.quote}</span> → <span className="diff-add">{s.proposed}</span>
                </div>
                {data.perms.decideSuggestion && (
                  <div className="mt-1.5 flex gap-1.5">
                    <Button size="sm" variant="success" onClick={() => decide.run(s.id, true)}>
                      <Check className="h-3 w-3" /> Accept
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => decide.run(s.id, false)}>
                      <X className="h-3 w-3" /> Reject
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {decidedSugs.length > 0 && <div className="mt-2 text-[11px] text-muted">{decidedSugs.length} decided suggestion(s) in the log.</div>}
        </div>
      )}

      {resolved.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <button className="text-xs font-medium text-muted hover:text-ink" onClick={() => setShowResolved(!showResolved)}>
            {showResolved ? 'Hide' : 'Show'} resolved comments log ({resolved.length})
          </button>
          {showResolved && (
            <ul className="mt-2 space-y-1.5">
              {resolved.map((c) => (
                <li key={c.id} className="rounded bg-canvas px-2 py-1.5 text-xs">
                  <div className="text-muted">
                    {c.authorName} · {sectionTitle(c.sectionId)} · resolved in v{c.resolvedOnNumber ?? '?'} {c.resolvedHow === 'ticked' ? `(ticked by ${c.resolvedByName})` : `(text changed; confirmed by ${c.resolvedByName})`}
                  </div>
                  {c.quote && <div className="italic">“{c.quote}”</div>}
                  <div>{c.body}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  )
}
