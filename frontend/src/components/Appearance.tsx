/** Appearance settings shared by both views: text size, light / dark / system, and transparency. */
import { clsx } from 'clsx'
import { Layers, Monitor, Moon, Square, Sun } from 'lucide-react'
import type { ReactNode } from 'react'
import { setPref, usePrefs, type TextSize, type Theme, type Transparency } from './prefs'

const THEMES: { id: Theme; label: string; icon: ReactNode }[] = [
  { id: 'light', label: 'Light', icon: <Sun className="h-3.5 w-3.5" /> },
  { id: 'dark', label: 'Dark', icon: <Moon className="h-3.5 w-3.5" /> },
  { id: 'system', label: 'System', icon: <Monitor className="h-3.5 w-3.5" /> },
]

const LOOKS: { id: Transparency; label: string; icon: ReactNode }[] = [
  { id: 'glass', label: 'Glass', icon: <Layers className="h-3.5 w-3.5" /> },
  { id: 'reduced', label: 'Solid', icon: <Square className="h-3.5 w-3.5" /> },
]

const SIZES: { id: TextSize; label: string; className: string }[] = [
  { id: 'normal', label: 'A', className: 'text-sm' },
  { id: 'large', label: 'A+', className: 'text-base' },
  { id: 'larger', label: 'A++', className: 'text-lg' },
]

function Choice<T extends string>({ items, value, onPick }: { items: { id: T; label: ReactNode; className?: string; icon?: ReactNode }[]; value: T; onPick: (v: T) => void }) {
  return (
    <div className={clsx('grid gap-1 rounded-full bg-canvas p-1', items.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
      {items.map((t) => (
        <button key={t.id} onClick={() => onPick(t.id)} className={clsx('flex items-center justify-center gap-1.5 rounded-full py-1.5 transition', t.className ?? 'text-xs', value === t.id ? 'bg-paper font-semibold shadow-sm dark:bg-white/15' : 'text-muted hover:text-ink')}>
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function AppearanceSettings() {
  const { theme, textSize, transparency } = usePrefs()
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
      <div>
        <div className="mb-1.5 text-xs font-medium text-muted">Look</div>
        <Choice items={LOOKS} value={transparency} onPick={(v) => setPref('transparency', v)} />
      </div>
    </div>
  )
}
