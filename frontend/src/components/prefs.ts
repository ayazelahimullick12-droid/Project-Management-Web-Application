/**
 * Per-viewer display preferences, kept in this browser (localStorage).
 *
 * view: "simple" (the calm version: top bar, one job per page, plain words) or "full" (every tool
 * on screen). Both use the same page addresses, so switching keeps you on the same page.
 * Switched with the Simple / Full control in the top bar or sidebar.
 *
 * textSize: normal, large or larger. Everything measured in rem grows with it.
 *
 * theme: light (default), dark, or follow the computer's setting (system).
 *
 * showNotes: shows the prototype's explanations ("In the real app…" notes and Open question
 * markers). Off by default so the app looks like the real product; switch it on in the Demo menu
 * when reviewing the spec.
 */
import { useEffect, useSyncExternalStore } from 'react'

const KEY = 'brac-pm-prototype:prefs'

export type Theme = 'light' | 'dark' | 'system'
export type View = 'simple' | 'full'
export type TextSize = 'normal' | 'large' | 'larger'

interface Prefs {
  showNotes: boolean
  theme: Theme
  view: View
  textSize: TextSize
}

const DEFAULTS: Prefs = { showNotes: false, theme: 'light', view: 'simple', textSize: 'normal' }

const listeners = new Set<() => void>()
let cache: Prefs | null = null

/** The current preferences (also usable outside React components). */
export function readPrefs(): Prefs {
  if (cache) return cache
  try {
    cache = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    cache = { ...DEFAULTS }
  }
  return cache!
}

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
  cache = { ...readPrefs(), [key]: value }
  try {
    localStorage.setItem(KEY, JSON.stringify(cache))
  } catch {
    /* storage blocked: the preference lasts until reload */
  }
  for (const fn of listeners) fn()
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    readPrefs,
  )
}

/** Puts the "dark" class on <html> when dark mode is on (chosen, or the system's choice). */
export function useThemeClass(forceLight = false) {
  const { theme } = usePrefs()
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => document.documentElement.classList.toggle('dark', !forceLight && (theme === 'dark' || (theme === 'system' && media.matches)))
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme, forceLight])
}

const TEXT_SIZE: Record<TextSize, string> = { normal: '100%', large: '112.5%', larger: '125%' }

/** Applies the text size to the whole page (the print view always uses the normal size). */
export function useTextSize(forceNormal = false) {
  const { textSize } = usePrefs()
  useEffect(() => {
    document.documentElement.style.fontSize = forceNormal ? '' : TEXT_SIZE[textSize]
  }, [textSize, forceNormal])
}

function subscribeSystemTheme(fn: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', fn)
  return () => media.removeEventListener('change', fn)
}

/** True when the app is dark right now (chosen, or "System" and the computer is in dark mode). */
export function useIsDark(): boolean {
  const { theme } = usePrefs()
  const systemDark = useSyncExternalStore(subscribeSystemTheme, () => window.matchMedia('(prefers-color-scheme: dark)').matches)
  return theme === 'dark' || (theme === 'system' && systemDark)
}
