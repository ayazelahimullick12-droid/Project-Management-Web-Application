/**
 * Who is signed in, per browser tab (SIMULATED login).
 *
 * Kept in sessionStorage so two tabs can be two different people (for example the PM editing
 * in one tab while the tech head watches live in another). The real app uses a secure
 * HTTP-only session cookie from the backend instead.
 */
const KEY = 'brac-pm-prototype:user'
const listeners = new Set<() => void>()

export function getSessionUserId(): string | null {
  try {
    return sessionStorage.getItem(KEY) ?? localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setSessionUserId(id: string | null) {
  try {
    if (id) {
      sessionStorage.setItem(KEY, id)
      localStorage.setItem(KEY, id) // new tabs start as the last person used
    } else {
      sessionStorage.removeItem(KEY)
      localStorage.removeItem(KEY)
    }
  } catch {
    /* storage blocked: the session lasts until reload */
  }
  for (const fn of listeners) fn()
}

export function subscribeSession(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
