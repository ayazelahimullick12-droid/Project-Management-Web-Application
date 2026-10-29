/**
 * The app's data. The server keeps it in one JSON file (server/api.mjs, default data/db.json);
 * this file keeps the browser's working copy in step with it.
 *
 * - At start the data is loaded from the server. If the file does not exist yet, the starting
 *   data is built (users, settings and templates, no projects) and saved.
 * - mutate(fn) changes the copy at once (so the screen updates immediately) and sends the whole
 *   data to the server a moment later, with the version it was based on.
 * - If another tab saved first, the server refuses; the change is then re-applied on top of the
 *   newer data and sent again. A change that is no longer allowed on the newer data is dropped.
 * - The server tells every open tab when the data changes (Server-Sent Events), and each tab
 *   loads the newer data.
 */
import type { DemoState } from '../types'
import { buildSeedState } from './seed'

type Change = (draft: DemoState) => unknown

let state: DemoState | null = null
let version = 0 // the server's version of the data this copy is based on
const unsaved: Change[] = [] // changes applied here but not yet saved on the server
let saving = false
let timer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<() => void>()
const errorListeners = new Set<(message: string | null) => void>()

export function getState(): DemoState {
  if (!state) throw new Error('The data is not loaded yet.')
  return state
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Hears about save problems (for example the server was stopped), and when they clear. */
export function onSaveError(fn: (message: string | null) => void): () => void {
  errorListeners.add(fn)
  return () => errorListeners.delete(fn)
}

function emit() {
  for (const fn of listeners) fn()
}

function reportError(message: string | null) {
  for (const fn of errorListeners) fn(message)
}

/**
 * Change the data. The function receives a full copy it may modify freely; the copy then
 * replaces the old state and is saved to the server shortly after.
 */
export function mutate<T>(fn: (draft: DemoState) => T): T {
  const draft = structuredClone(getState())
  const result = fn(draft)
  state = draft
  unsaved.push(fn as Change)
  emit()
  scheduleSave()
  return result
}

function scheduleSave(delay = 30) {
  if (!timer) timer = setTimeout(flush, delay)
}

async function flush() {
  timer = null
  if (saving || !unsaved.length) return
  saving = true
  const sending = unsaved.length
  try {
    const r = await fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseVersion: version, state }) })
    if (r.ok) {
      version = (await r.json()).version
      unsaved.splice(0, sending)
      reportError(null)
    } else if (r.status === 409) {
      rebase(await r.json())
    } else {
      throw new Error(`The server refused to save (status ${r.status}).`)
    }
  } catch (err) {
    reportError(`Your last change is not saved yet: ${err instanceof Error ? err.message : String(err)} Retrying…`)
    saving = false
    scheduleSave(3000)
    return
  }
  saving = false
  if (unsaved.length) scheduleSave()
}

/** Another tab saved first: re-apply our unsaved changes on top of the newer data. */
function rebase(latest: { version: number; state: DemoState }) {
  let next = latest.state
  const kept: Change[] = []
  for (const fn of unsaved) {
    const draft = structuredClone(next)
    try {
      fn(draft)
      next = draft
      kept.push(fn)
    } catch {
      /* no longer allowed on the newer data: dropped */
    }
  }
  version = latest.version
  state = next
  unsaved.length = 0
  unsaved.push(...kept)
  emit()
}

/** Loads the newer data another tab saved (only when this tab has nothing waiting to be saved). */
async function pull() {
  if (saving || unsaved.length) return
  const r = await fetch('/api/state')
  const latest = (await r.json()) as { version: number; state: DemoState | null }
  if (latest.state && latest.version > version && !unsaved.length) {
    version = latest.version
    state = latest.state
    emit()
  }
}

export async function initStore(): Promise<void> {
  localStorage.removeItem('brac-pm-prototype:state') // the old browser-only copy, no longer used
  const r = await fetch('/api/state').catch(() => null)
  if (!r?.ok) throw new Error('The app server is not running. Start the app with "npm run dev" (or "npm start").')
  const loaded = (await r.json()) as { version: number; state: DemoState | null }
  version = loaded.version
  if (loaded.state) state = loaded.state
  else {
    state = await buildSeedState()
    unsaved.push((d) => Object.assign(d, structuredClone(state)))
    await flush()
  }
  const events = new EventSource('/api/events')
  events.addEventListener('version', (e) => {
    if (Number((e as MessageEvent).data) > version) void pull()
  })
}

/** Starts again from empty data (users only), or with the demo projects loaded. */
export async function resetDemo(withProjects = false): Promise<void> {
  const fresh = await buildSeedState({ withProjects })
  mutate((d) => {
    for (const key of Object.keys(d)) delete (d as unknown as Record<string, unknown>)[key]
    Object.assign(d, structuredClone(fresh))
  })
}

export { newId } from './ids'
