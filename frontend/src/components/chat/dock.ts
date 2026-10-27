/**
 * State of the chat dock (the Messages bar at the bottom right, like LinkedIn and Facebook
 * Messenger): whether its list is open, which chat windows are open next to it, which of them
 * are minimised, and which call is on screen. Kept per browser tab (sessionStorage).
 */
import { useSyncExternalStore } from 'react'
import { readPrefs } from '../prefs'

interface DockState {
  open: boolean // the conversation list is expanded
  windows: string[] // open chat windows, newest first
  minimized: string[]
  callChatId: string | null // the chat whose call screen is showing
}

const KEY = 'brac-pm-prototype:dock'
const MAX_WINDOWS = 2
const listeners = new Set<() => void>()

let state: DockState = load()

function load(): DockState {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) ?? '{}')
    return { open: !!saved.open, windows: saved.windows ?? [], minimized: saved.minimized ?? [], callChatId: null }
  } catch {
    return { open: false, windows: [], minimized: [], callChatId: null }
  }
}

function set(next: Partial<DockState>) {
  state = { ...state, ...next }
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...state, callChatId: null }))
  } catch {
    /* storage blocked: the dock forgets its windows on reload */
  }
  for (const fn of listeners) fn()
}

export function useDock(): DockState {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => state,
  )
}

/** True on phones and small windows, where chats open as a page instead of a floating window. */
const small = () => window.matchMedia('(max-width: 767px)').matches

/**
 * Opens a chat in a floating window (or on the Messages page on small screens and in the Simple view).
 * `navigate` is passed in because this file is not a React component.
 */
export function openChat(chatId: string, navigate?: (to: string) => void) {
  if (small() || readPrefs().view === 'simple' || location.pathname.startsWith('/messages')) {
    navigate?.(`/messages/${chatId}`)
    return
  }
  set({ windows: [chatId, ...state.windows.filter((id) => id !== chatId)].slice(0, MAX_WINDOWS), minimized: state.minimized.filter((id) => id !== chatId) })
}

export function closeChat(chatId: string) {
  set({ windows: state.windows.filter((id) => id !== chatId), minimized: state.minimized.filter((id) => id !== chatId) })
}

export function toggleMinimized(chatId: string) {
  set({ minimized: state.minimized.includes(chatId) ? state.minimized.filter((id) => id !== chatId) : [...state.minimized, chatId] })
}

export function setDockOpen(open: boolean) {
  set({ open })
}

export function showCall(chatId: string | null) {
  set({ callChatId: chatId })
}
