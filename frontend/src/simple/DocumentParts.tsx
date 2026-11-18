/**
 * Pieces of the Simple view's document page:
 * - ApprovalBar: where it stands and the approval steps, in one slim bar above the document.
 * - Contents: the numbered sections, with markers for changed, commented and AI-written ones.
 * - Paper: the document as a sheet with a BRAC letterhead, a status stamp and the approval record.
 * - ChangesBody: the text with the changes since an earlier version marked in place
 *   (added words green, removed words struck through), like Track Changes in Word.
 */
import { clsx } from 'clsx'
import { diffArrays } from 'diff'
import { Check, MessageSquare, Sparkles } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import type { Section } from '../types'
import { fmtDate } from '../components/format'
import { Markdown } from '../components/Markdown'
import { brand } from '../theme/brand'
import type { StatusKey } from '../rules/pipeline'
import { ToneIcon } from './parts'
import type { Tone } from './words'

// ─── The slim bar above the document ────────────────────────────────────

export interface BarStep {
  name: string
  role: string
  status: string // approved | pending | waiting | …
  sign?: boolean
}

export function ApprovalBar({ tone, status, steps, prompt }: { tone: Tone; status: ReactNode; steps?: BarStep[]; prompt?: ReactNode }) {
  return (
    <div className="shadow-soft rounded-2xl px-5 py-3.5">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-start gap-2.5 text-base font-medium">
          <ToneIcon tone={tone} />
          <span className="min-w-0 pt-0.5">{status}</span>
        </div>
        {steps && steps.length > 0 && (
          <ol className="flex flex-wrap items-center gap-1.5" aria-label="Approval steps">
            {steps.map((s, i) => (
              <li key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="h-px w-3 bg-line" aria-hidden />}
                <span
                  title={`${s.role}${s.sign ? ' (signs)' : ''}`}
                  className={clsx(
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm whitespace-nowrap ring-1',
                    s.status === 'approved' ? 'bg-leaf-soft text-leaf ring-transparent' : s.status === 'pending' ? 'bg-paper font-semibold text-ink ring-brand' : 'text-muted ring-line',
                  )}
                >
                  {s.status === 'approved' && <Check className="h-3.5 w-3.5" />}
                  {s.name}
                  {s.sign && <span className="text-xs font-normal opacity-75">· signs</span>}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
      {prompt && <div className="mt-2.5 border-t border-line pt-2.5 text-base font-medium text-brand">{prompt}</div>}
    </div>
  )
}

// ─── Contents ───────────────────────────────────────────────────────────

export interface ContentsItem {
  id: string
  title: string
  changed?: boolean
  comments?: number
  ai?: boolean
}

/** Which section is on screen now, for the contents list. `mode` changes when the text is drawn again. */
export function useActiveSection(ids: string[], mode = ''): string | undefined {
  const [active, setActive] = useState<string | undefined>(ids[0])
  const key = ids.join('|') + mode
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(`sec-${id}`)).filter((x): x is HTMLElement => !!x)
    if (!els.length || typeof IntersectionObserver === 'undefined') return
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id.slice(4))
      },
      { rootMargin: '-110px 0px -60% 0px' },
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps -- the list of ids is the key
  return active && ids.includes(active) ? active : ids[0]
}

export function jumpTo(id: string) {
  document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function Contents({ items, active, onPick }: { items: ContentsItem[]; active?: string; onPick?: () => void }) {
  return (
    <nav aria-label="Contents">
      <div className="mb-2 px-2 text-xs font-semibold text-muted">Contents</div>
      <ol className="space-y-0.5">
        {items.map((it, i) => (
          <li key={it.id}>
            <button
              type="button"
              onClick={() => {
                jumpTo(it.id)
                onPick?.()
              }}
              className={clsx('flex min-h-11 w-full items-start gap-2 rounded-lg px-2 py-2.5 text-left text-[0.9375rem] leading-snug transition', active === it.id ? 'bg-ink/[0.06] font-medium text-ink dark:bg-white/10' : 'text-muted hover:bg-ink/[0.04] hover:text-ink')}
            >
              <span className="w-5 shrink-0 tabular-nums">{i + 1}.</span>
              <span className="min-w-0 flex-1">
                {it.title}
                {(it.changed || !!it.comments || it.ai) && (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {it.changed && <span className="rounded bg-sky-50 px-1.5 text-xs font-medium text-sky-700">changed</span>}
                    {!!it.comments && (
                      <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1.5 text-xs font-medium text-amber-800">
                        <MessageSquare className="h-3 w-3" /> {it.comments}
                      </span>
                    )}
                    {it.ai && (
                      <span className="inline-flex items-center gap-0.5 rounded bg-violet-50 px-1.5 text-xs font-medium text-violet-700">
                        <Sparkles className="h-3 w-3" /> AI
                      </span>
                    )}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  )
}

// ─── The paper sheet ────────────────────────────────────────────────────

const STAMP: Record<StatusKey, [string, string]> = {
  not_started: ['Not started', 'text-muted ring-line'],
  draft: ['Draft', 'text-muted ring-ink/25'],
  in_review: ['In review', 'text-sky-700 ring-sky-300'],
  changes_requested: ['Changes requested', 'text-amber-800 ring-amber-300'],
  approved: ['Approved', 'text-leaf ring-leaf/50'],
  signed: ['Signed', 'text-leaf ring-leaf/50'],
  out_of_sync: ['Needs updating', 'text-amber-800 ring-amber-300'],
}

export interface RecordRow {
  role: string
  name: string
  decision: string
  date?: string
  note?: string
}

export function Paper({ docTitle, projectName, version, date, aiWritten, status, record, signatures, children }: {
  docTitle: string
  projectName: string
  version: number
  date: string
  aiWritten: boolean
  status: StatusKey
  record: RecordRow[]
  signatures: { name: string; at: string; hash: string; note?: string }[]
  children: ReactNode
}) {
  const [label, cls] = STAMP[status]
  return (
    <article className="min-w-0 overflow-hidden rounded-md bg-paper shadow-[0_1px_2px_rgb(0_0_0/0.05),0_12px_32px_-18px_rgb(16_16_32/0.28)] ring-1 ring-line">
      <div className="h-1.5 bg-brand" aria-hidden />
      <div className="px-6 pt-7 pb-10 md:px-14 md:pt-9">
        {/* Letterhead */}
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="" className="h-9 w-9 rounded-lg" />
            <div className="leading-tight">
              <div className="text-xs font-semibold text-brand">BRAC</div>
              <div className="text-sm font-medium text-muted">{brand.appName}</div>
            </div>
          </div>
          <span className={clsx('rounded-md px-3 py-1 text-sm font-semibold ring-2', cls)}>{label}</span>
        </header>
        <div className="mt-6">
          <h2 className="page-title text-[1.75rem] leading-tight">{docTitle}</h2>
          <div className="mt-1 text-lg text-muted">{projectName}</div>
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr_auto_1fr]">
            <dt className="text-muted">Version</dt>
            <dd className="font-medium tabular-nums">{version}</dd>
            <dt className="text-muted">Date</dt>
            <dd className="font-medium">{fmtDate(date)}</dd>
            {aiWritten && (
              <>
                <dt className="text-muted">Written by</dt>
                <dd className="font-medium sm:col-span-3">The AI, not edited by a person yet</dd>
              </>
            )}
          </dl>
        </div>

        {/* The text */}
        <div className="mt-8 text-[1.0625rem] leading-relaxed [&_.md]:text-[1.0625rem]">{children}</div>

        {/* Approval record, as on the last page of a printed document */}
        {record.length > 0 && (
          <footer className="mt-10 border-t border-line pt-6">
            <h3 className="text-base font-semibold">Approval record</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="py-1.5 pr-4 font-semibold">Role</th>
                    <th className="py-1.5 pr-4 font-semibold">Name</th>
                    <th className="py-1.5 pr-4 font-semibold">Decision</th>
                    <th className="py-1.5 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {record.map((r, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-4 text-muted">{r.role}</td>
                      <td className="py-2 pr-4 font-medium">
                        {r.name}
                        {r.note && <span className="block text-xs font-normal text-muted">{r.note}</span>}
                      </td>
                      <td className="py-2 pr-4">{r.decision}</td>
                      <td className="py-2 whitespace-nowrap tabular-nums text-muted">{r.date ? fmtDate(r.date) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {signatures.map((s, i) => (
              <p key={i} className="mt-4 text-sm text-muted">
                Signed electronically by <span className="font-medium text-ink">{s.name}</span>
                {s.note ? ` (${s.note})` : ''} on {fmtDate(s.at)}. Fingerprint (SHA-256): <span className="font-mono text-xs break-all">{s.hash.slice(0, 24)}…</span>
                <span className="mt-1 block text-xs">An electronic approval record with an audit trail, not a CCA-certified digital signature.</span>
              </p>
            ))}
          </footer>
        )}
      </div>
    </article>
  )
}

// ─── Changes shown in the text ──────────────────────────────────────────

/** Markdown made readable for a word diff: no ** or #, list items as bullets. */
const readable = (md: string) =>
  (md ?? '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .trim()

/** Whole words and the spaces between them, so a changed time or number is marked as one word. */
const words = (t: string) => t.split(/(\s+)/).filter((x) => x !== '')

/** The sections with changes marked in place. Unchanged sections read as usual. */
export function ChangesBody({ sections, previous, headingClass }: { sections: Section[]; previous: Section[]; headingClass: string }) {
  const removed = previous.filter((p) => !sections.some((s) => s.key === p.key))
  return (
    <div>
      {sections.map((s, i) => {
        const before = previous.find((p) => p.key === s.key)
        const same = before && readable(before.content) === readable(s.content)
        return (
          <section key={s.id} id={`sec-${s.id}`} className="mb-8 scroll-mt-40" data-section={s.id}>
            <h2 className={headingClass}>
              <span className="tabular-nums text-muted">{i + 1}.</span>
              {s.title}
              {!before && <span className="rounded bg-green-50 px-1.5 py-0.5 text-xs font-medium text-leaf ring-1 ring-green-200">new section</span>}
            </h2>
            {same ? (
              <Markdown text={s.content} />
            ) : (
              <div className="whitespace-pre-wrap">
                {diffArrays(words(before ? readable(before.content) : ''), words(readable(s.content))).map((p, j) => (
                  <span key={j} className={p.added ? 'diff-add' : p.removed ? 'diff-del' : undefined}>
                    {p.value.join('')}
                  </span>
                ))}
              </div>
            )}
          </section>
        )
      })}
      {removed.map((p) => (
        <section key={p.id} className="mb-8">
          <h2 className={clsx(headingClass, 'text-muted line-through')}>{p.title}</h2>
          <p className="text-sm text-muted">This section was removed.</p>
        </section>
      ))}
    </div>
  )
}
