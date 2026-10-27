/**
 * The switch between the two versions of the app:
 * - Simple: one job per page, plain words, large text (the default).
 * - Full: every tool on screen, for people who use the app all day.
 * Both show the same page, so switching never loses your place.
 */
import { clsx } from 'clsx'
import { LayoutGrid, Square } from 'lucide-react'
import { setPref, usePrefs } from './prefs'

export function ViewSwitch({ className, compact }: { className?: string; compact?: boolean }) {
  const { view } = usePrefs()
  const options = [
    { id: 'simple', label: 'Simple', hint: 'Simple view: one task per page, larger text', icon: <Square className="h-3.5 w-3.5" /> },
    { id: 'full', label: 'Full', hint: 'Full view: every tool on screen', icon: <LayoutGrid className="h-3.5 w-3.5" /> },
  ] as const
  return (
    <div role="radiogroup" aria-label="Choose the view" className={clsx('inline-flex shrink-0 rounded-lg bg-ink/[0.06] p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.id}
          role="radio"
          aria-checked={view === o.id}
          title={o.hint}
          onClick={() => setPref('view', o.id)}
          className={clsx('flex items-center gap-1.5 rounded-md font-medium transition', compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm', view === o.id ? 'bg-surface text-ink shadow-sm dark:bg-ink/15' : 'text-muted hover:text-ink')}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}
