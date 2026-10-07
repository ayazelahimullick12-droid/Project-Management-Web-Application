/**
 * The browser copy of all demo data (SIMULATED backend storage).
 *
 * On first load the seed files are copied into the browser's localStorage. Every action
 * changes that copy. "Reset demo" puts the original seed back. Two tabs of the same browser
 * stay in sync through the browser's `storage` event.
 *
 * In the real app this file disappears: the data lives in PostgreSQL behind the FastAPI backend.
 */
import type { DemoState } from '../types'
import { buildSeedState, SEED_VERSION } from './seed'

const KEY = 'brac-pm-prototype:state'

let state: DemoState | null = null
const listeners = new Set<() => void>()

export function getState(): DemoState {
  if (!state) throw new Error('Demo data is not loaded yet.')
  return state
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function emit() {
  for (const fn of listeners) fn()
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch (err) {
    console.warn('Could not save demo data in the browser (storage full or blocked).', err)
  }
}

/**
 * Change the data. The function receives a full copy it may modify freely; the copy then
 * replaces the old state. (Copying keeps React and TanStack Query change detection simple.)
 */
export function mutate<T>(fn: (draft: DemoState) => T): T {
  const draft = structuredClone(getState())
  const result = fn(draft)
  state = draft
  persist()
  emit()
  return result
}

export async function initStore(): Promise<void> {
  let saved: DemoState | null = null
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) saved = JSON.parse(raw)
  } catch {
    saved = null
  }
  state = saved && saved.meta?.seedVersion === SEED_VERSION ? saved : await buildSeedState()
  persist()
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY || !e.newValue) return
    try {
      state = JSON.parse(e.newValue)
      emit()
    } catch {
      /* ignore half-written values */
    }
  })
}

export async function resetDemo(): Promise<void> {
  state = await buildSeedState()
  persist()
  emit()
}

export { newId } from './ids'
