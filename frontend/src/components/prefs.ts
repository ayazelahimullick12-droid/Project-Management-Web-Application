/**
 * Per-viewer display preferences, kept in this browser (localStorage).
 *
 * showNotes: shows the prototype's explanations ("In the real app…" notes and Open question
 * markers). Off by default so the app looks like the real product; switch it on in the Demo menu
 * when reviewing the spec.
 *
 * theme: light, dark, or follow the computer's setting (system). Changed from the user menu.
 */
import { useEffect, useSyncExternalStore } from 'react'

const KEY = 'brac-pm-prototype:prefs'

export type Theme = 'light' | 'dark' | 'system'

interface Prefs {
  showNotes: boolean
  theme: Theme
}

const DEFAULTS: Prefs = { showNotes: false, theme: 'system' }

const listeners = new Set<() => void>()
let cache: Prefs | null = null

function read(): Prefs {
  if (cache) return cache
  try {
    cache = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    cache = { ...DEFAULTS }
  }
  return cache!
}

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
  cache = { ...read(), [key]: value }
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
    read,
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
