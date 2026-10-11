/**
 * Per-viewer display preferences, kept in this browser (localStorage).
 *
 * showNotes: shows the prototype's explanations ("In the real app…" notes and Open question
 * markers). Off by default so the app looks like the real product; switch it on in the Demo menu
 * when reviewing the spec.
 */
import { useSyncExternalStore } from 'react'

const KEY = 'brac-pm-prototype:prefs'

interface Prefs {
  showNotes: boolean
}

const listeners = new Set<() => void>()
let cache: Prefs | null = null

function read(): Prefs {
  if (cache) return cache
  try {
    cache = { showNotes: false, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    cache = { showNotes: false }
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
