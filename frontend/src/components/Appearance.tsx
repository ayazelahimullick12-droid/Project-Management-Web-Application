/** Appearance settings shared by both views: light / dark / system, and text size. */
import { clsx } from 'clsx'
import { Monitor, Moon, Sun } from 'lucide-react'
import type { ReactNode } from 'react'
import { setPref, usePrefs, type TextSize, type Theme } from './prefs'

const THEMES: { id: Theme; label: string; icon: ReactNode }[] = [
  { id: 'light', label: 'Light', icon: <Sun className="h-3.5 w-3.5" /> },
  { id: 'dark', label: 'Dark', icon: <Moon className="h-3.5 w-3.5" /> },
  { id: 'system', label: 'System', icon: <Monitor className="h-3.5 w-3.5" /> },
]

const SIZES: { id: TextSize; label: string; className: string }[] = [
  { id: 'normal', label: 'A', className: 'text-sm' },
  { id: 'large', label: 'A+', className: 'text-base' },
  { id: 'larger', label: 'A++', className: 'text-lg' },
]

function Choice<T extends string>({ items, value, onPick }: { items: { id: T; label: ReactNode; className?: string; icon?: ReactNode }[]; value: T; onPick: (v: T) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl bg-ink/[0.05] p-1">
      {items.map((t) => (
        <button key={t.id} onClick={() => onPick(t.id)} className={clsx('flex items-center justify-center gap-1.5 rounded-lg py-1.5', t.className ?? 'text-xs', value === t.id ? 'bg-surface font-semibold shadow-sm dark:bg-ink/15' : 'text-muted hover:text-ink')}>
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function AppearanceSettings() {
  const { theme, textSize } = usePrefs()
  return (
    <div className="space-y-3 px-4 pt-3 pb-2">
      <div>
        <div className="mb-1.5 text-xs font-medium text-muted">Text size</div>
        <Choice items={SIZES} value={textSize} onPick={(v) => setPref('textSize', v)} />
      </div>
      <div>
        <div className="mb-1.5 text-xs font-medium text-muted">Colours</div>
        <Choice items={THEMES} value={theme} onPick={(v) => setPref('theme', v)} />
      </div>
    </div>
  )
}
