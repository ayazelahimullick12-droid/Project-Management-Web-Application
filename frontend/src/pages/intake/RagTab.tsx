import { Check, Eye, MessageCircle, Replace, TriangleAlert, X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { RagSuggestion } from '../../types'
import { api } from '../../api'
import { useAction, useApi } from '../../api/hooks'
import { DOC_LABEL } from '../../rules/pipeline'
import { AiBadge, AiNote } from '../../components/ai'
import { Markdown } from '../../components/Markdown'
import { OpenQuestion } from '../../components/OpenQuestion'
import { fmtDate } from '../../components/format'
import { openChat } from '../../components/chat/dock'
import { Avatar, Badge, Button, Card, EmptyState, Input, Loading, Modal, Note } from '../../components/ui'
import type { IntakeData } from './IntakePage'

function DocViewer({ pid, pastId, docId, onClose }: { pid: string; pastId: string; docId: string; onClose: () => void }) {
  const { data } = useApi(['rag-doc', pid, docId], () => api.intake.ragDocument(pid, pastId, docId))
  return (
    <Modal open onClose={onClose} title={data ? `${data.projectName} — ${data.title}` : 'Loading…'} wide>
      {!data ? (
        <Loading />
      ) : (
        <div>
          <Note tone="green" className="mb-4">
            {data.signed ? `Signed version ${data.version.number} (signed ${fmtDate(data.signedAt)})` : `Approved version ${data.version.number}`}. Old-project details may not apply to your project.
          </Note>
          {data.version.sections.map((s) => (
            <div key={s.id} className="mb-4">
              <h3 className="mb-1 font-semibold">{s.title}</h3>
              <Markdown text={s.content} />
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

/** The suggestion text with old-project details highlighted (and replacements shown). */
function HighlightedText({ g }: { g: RagSuggestion }) {
  let parts: (string | { h: number })[] = [g.text]
  g.highlights.forEach((h, i) => {
    parts = parts.flatMap((p) => (typeof p !== 'string' ? [p] : p.split(h.text).flatMap((x, j, arr) => (j < arr.length - 1 ? [x, { h: i }] : [x]))))
  })
  return (
    <p className="text-sm leading-relaxed">
      {parts.map((p, i) => {
        if (typeof p === 'string') return <span key={i}>{p}</span>
        const h = g.highlights[p.h]
        if (h.status === 'replaced') return <span key={i}><span className="diff-del">{h.text}</span> <span className="diff-add">{h.replacement}</span></span>
        return <span key={i} className={h.status === 'confirmed' ? 'rounded bg-leaf-soft px-0.5' : 'old-detail'}>{h.text}</span>
      })}
    </p>
  )
}

function SuggestionCard({ g, pid, active }: { g: NonNullable<IntakeData['rag']>['suggestions'][number]; pid: string; active: boolean }) {
  const [replacing, setReplacing] = useState<number | null>(null)
  const [value, setValue] = useState('')
  const hl = useAction(api.intake.decideHighlight)
  const decide = useAction(api.intake.decideSuggestion, { success: (r) => (r === undefined ? 'Done.' : 'Done.') })
  const pending = g.highlights.filter((h) => h.status === 'pending').length
  return (
    <div className="rounded-xl bg-surface p-4 ring-1 ring-line">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge tone="blue">{g.kind}</Badge>
        <span className="text-xs text-muted">
          → Fact: <b>{g.factLabel}</b>
        </span>
        <AiBadge label="AI suggestion" />
        <span className="ml-auto text-xs text-muted">
          From {g.sourceName} · {DOC_LABEL[g.sourceDocType]} · {g.sectionTitle}
        </span>
      </div>
      <HighlightedText g={g} />
      {g.status === 'pending' && g.highlights.length > 0 && (
        <div className="mt-3 rounded-md bg-amber-50/60 p-2.5 ring-1 ring-amber-200">
          <div className="mb-1.5 text-xs font-medium text-amber-900">Old-project details: confirm each one or replace it before accepting</div>
          {g.highlights.map((h, i) => (
            <div key={i} className="mb-1 flex flex-wrap items-center gap-2 text-sm">
              <span className="old-detail">{h.text}</span>
              {h.status === 'pending' ? (
                replacing === i ? (
                  <>
                    <Input value={value} onChange={(e) => setValue(e.target.value)} className="!w-48 !py-1" placeholder="Value for this project" />
                    <Button size="sm" onClick={() => { hl.run(pid, g.id, i, 'replace', value); setReplacing(null); setValue('') }}>
                      Save
                    </Button>
                  </>
                ) : (
                  active && (
                    <>
                      <Button size="sm" onClick={() => hl.run(pid, g.id, i, 'confirm')}>
                        <Check className="h-3 w-3" /> Still true here
                      </Button>
                      <Button size="sm" onClick={() => setReplacing(i)}>
                        <Replace className="h-3 w-3" /> Replace
                      </Button>
                    </>
                  )
                )
              ) : (
                <Badge tone="green">{h.status === 'confirmed' ? 'confirmed' : `replaced with “${h.replacement}”`}</Badge>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center gap-2">
        {g.status === 'pending' ? (
          active && (
            <>
              <Button size="sm" variant="success" disabled={pending > 0} why="Confirm or replace every highlighted detail first." onClick={() => decide.run(pid, g.id, true)}>
                <Check className="h-3.5 w-3.5" /> Accept into the Fact Sheet
              </Button>
              <Button size="sm" variant="danger" onClick={() => decide.run(pid, g.id, false)}>
                <X className="h-3.5 w-3.5" /> Reject
              </Button>
            </>
          )
        ) : (
          <Badge tone={g.status === 'accepted' ? 'green' : 'gray'}>
            {g.status === 'accepted' ? `Accepted — credited “From ${g.sourceName} (PM: ${g.sourcePm})”` : 'Rejected (kept in the log)'}
          </Badge>
        )}
      </div>
    </div>
  )
}

export function RagTab({ data }: { data: IntakeData }) {
  const navigate = useNavigate()
  const p = data.project
  const [viewing, setViewing] = useState<{ pastId: string; docId: string } | null>(null)
  const ack = useAction(api.intake.acknowledgeDuplicate, { success: 'Warning acknowledged and logged.' })
  const dm = useAction(api.chat.startRagDm, { onDone: (id) => openChat(id, navigate) }) // opens in the chat dock, so the PM stays on this page
  const rag = data.rag
  if (!rag) return <EmptyState title="No search yet">The RAG agent runs once, right after the intake analysis. Results are visible to the PM team only.</EmptyState>
  const dup = rag.run.duplicate
  const dupMatch = rag.matches.find((m) => m.projectId === dup?.projectId)
  const active = p.status === 'active'
  return (
    <div className="space-y-5">
      <Note tone="gray">
        Only the PM team sees this page. Stakeholders, the tech team and sponsors never see RAG results or old documents. <OpenQuestion id="rag-tests" />
      </Note>
      {dup && (
        <Note tone={p.intake.duplicateAck ? 'gray' : 'red'} icon={<TriangleAlert className="h-4 w-4" />}>
          <div className="font-medium">Possible duplicate: {dupMatch?.project.name} matches {Math.round(dup.score * 100)}%</div>
          <div className="mb-2 text-sm">
            Talk to its PM, {dupMatch?.members.find((m) => m.isPm)?.name}, before going further. {p.intake.duplicateAck ? 'Acknowledged.' : 'The PM must acknowledge this warning before the project continues.'}
          </div>
          {!p.intake.duplicateAck && data.perms.pm && (
            <Button size="sm" variant="primary" onClick={() => ack.run(p.id)}>
              Acknowledge
            </Button>
          )}
        </Note>
      )}
      <div>
        <h2 className="mb-2 text-sm font-semibold">Similar finished projects</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {rag.matches.map((m) => (
            <Card
              key={m.projectId}
              title={
                <span className="flex items-center gap-2">
                  {m.project.name} <span className="text-xs font-normal text-muted">{m.project.year}</span>
                </span>
              }
              actions={<Badge tone={m.score >= 0.9 ? 'red' : 'blue'}>{Math.round(m.score * 100)}% match</Badge>}
            >
              <p className="mb-2 text-sm text-muted">{m.project.summary}</p>
              <div className="mb-2 text-xs font-medium">Why it matched</div>
              <ul className="mb-3 list-disc pl-5 text-sm">
                {m.why.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
              {m.sections.length > 0 && (
                <>
                  <div className="mb-1 text-xs font-medium">Matching sections</div>
                  <ul className="mb-3 space-y-1.5">
                    {m.sections.map((sec, i) => (
                      <li key={i} className="rounded bg-canvas p-2 text-xs">
                        <b>
                          {DOC_LABEL[sec.docType]} · {sec.title}:
                        </b>{' '}
                        {sec.excerpt}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <div className="mb-3 flex flex-wrap gap-1.5">
                {m.docs.map((d) => (
                  <Button key={d.id} size="sm" onClick={() => setViewing({ pastId: m.projectId, docId: d.id })}>
                    <Eye className="h-3 w-3" /> {DOC_LABEL[d.type]}
                  </Button>
                ))}
              </div>
              <div className="mb-1 text-xs font-medium">Project members</div>
              <ul className="space-y-1">
                {m.members.map((mm) => (
                  <li key={mm.userId} className="flex items-center gap-2 text-sm">
                    <Avatar name={mm.name} id={mm.userId} size={22} />
                    <span className="flex-1">
                      {mm.name} <span className="text-xs text-muted">· {mm.role}</span>
                    </span>
                    {mm.deactivated ? (
                      <Badge>unavailable</Badge>
                    ) : (
                      active && (
                        <Button size="sm" variant="ghost" onClick={() => dm.run(p.id, mm.userId)}>
                          <MessageCircle className="h-3.5 w-3.5" /> Message
                        </Button>
                      )
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </div>
      <div>
        <h2 className="mb-1 text-sm font-semibold">Suggestions for the Q/A agent</h2>
        <p className="mb-3 text-xs text-muted">Items from the similar projects that the stakeholders did not mention. Adding anything is optional. Accepted items become proposed facts, credited to the source project; accepted items can mean fewer questions.</p>
        <div className="space-y-3">
          {rag.suggestions.map((g) => (
            <SuggestionCard key={g.id} g={g} pid={p.id} active={active} />
          ))}
          {!rag.suggestions.length && <p className="text-sm text-muted">No suggestions.</p>}
        </div>
      </div>
      <AiNote agent="rag" />
      {viewing && <DocViewer pid={p.id} pastId={viewing.pastId} docId={viewing.docId} onClose={() => setViewing(null)} />}
    </div>
  )
}
