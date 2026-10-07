/** GitHub-style word diffs (jsdiff), inline or side by side. */
import { diffWords } from 'diff'

export function InlineDiff({ before, after }: { before: string; after: string }) {
  const parts = diffWords(before ?? '', after ?? '')
  return (
    <div className="whitespace-pre-wrap text-sm leading-relaxed">
      {parts.map((p, i) => (
        <span key={i} className={p.added ? 'diff-add' : p.removed ? 'diff-del' : undefined}>
          {p.value}
        </span>
      ))}
    </div>
  )
}

export function SideBySide({ before, after, leftLabel, rightLabel }: { before: string; after: string; leftLabel: string; rightLabel: string }) {
  const parts = diffWords(before ?? '', after ?? '')
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-md bg-red-50/30 p-3 ring-1 ring-line">
        <div className="mb-1 text-[11px] font-medium text-muted">{leftLabel}</div>
        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {parts.filter((p) => !p.added).map((p, i) => (
            <span key={i} className={p.removed ? 'diff-del' : undefined}>
              {p.value}
            </span>
          ))}
        </div>
      </div>
      <div className="rounded-md bg-green-50/30 p-3 ring-1 ring-line">
        <div className="mb-1 text-[11px] font-medium text-muted">{rightLabel}</div>
        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {parts.filter((p) => !p.removed).map((p, i) => (
            <span key={i} className={p.added ? 'diff-add' : undefined}>
              {p.value}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export function hasChanges(before: string, after: string) {
  return (before ?? '').replace(/\s+/g, ' ').trim() !== (after ?? '').replace(/\s+/g, ' ').trim()
}
