/** One-click light / dark switch (the profile menu also offers "System"). */
import { Moon, Sun } from 'lucide-react'
import { clsx } from 'clsx'
import { setPref, useIsDark } from './prefs'

export function ThemeToggle({ className }: { className?: string }) {
  const dark = useIsDark()
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode'
  return (
    <button type="button" onClick={() => setPref('theme', dark ? 'light' : 'dark')} title={label} aria-label={label} className={clsx('rounded-lg p-1.5 text-ink/70 transition hover:bg-ink/5 hover:text-ink', className)}>
      {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  )
}
