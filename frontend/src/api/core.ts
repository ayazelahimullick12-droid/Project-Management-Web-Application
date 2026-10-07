/**
 * Shared plumbing for the api layer.
 *
 * The api layer plays the part of the backend: every action checks permissions with the
 * rules in src/rules and refuses with an ApiError, exactly as the FastAPI backend will.
 * Today it reads and writes the browser copy of the data (src/demo/store); later these
 * functions become HTTP calls and the screens do not change.
 */
import type { DemoState, ID, Project, User } from '../types'
import { now } from '../demo/clock'
import { getSessionUserId } from '../demo/session'
import { getState, mutate } from '../demo/store'
import type { Check } from '../rules/permissions'
import type { PipelineCtx } from '../rules/pipeline'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

/** Refuse when a rule check fails (like an HTTP 403). */
export function ensure(check: Check): Check {
  if (!check.ok) throw new ApiError(403, check.reason ?? 'You cannot do this.')
  return check
}

export function fail(message: string, status = 400): never {
  throw new ApiError(status, message)
}

export function currentUserId(): ID | null {
  return getSessionUserId()
}

export function me(s: DemoState = getState()): User {
  const id = getSessionUserId()
  const user = id ? s.users.find((u) => u.id === id) : undefined
  if (!user) throw new ApiError(401, 'Please sign in.')
  return user
}

export function projectOf(s: DemoState, pid: ID): Project {
  const p = s.projects.find((x) => x.id === pid)
  if (!p) throw new ApiError(404, 'Project not found.')
  return p
}

export function pipelineCtx(s: DemoState, pid: ID): PipelineCtx {
  return {
    project: projectOf(s, pid),
    docs: s.docs.filter((d) => d.projectId === pid),
    versions: s.versions.filter((v) => v.projectId === pid),
    chains: s.chains.filter((c) => c.projectId === pid),
    factSheets: s.factSheets.filter((f) => f.projectId === pid),
    rounds: s.rounds.filter((r) => r.projectId === pid),
  }
}

/** A read: runs against the current data. Async so screens treat it like a network call. */
export async function read<T>(fn: (s: DemoState, at: Date) => T): Promise<T> {
  return fn(getState(), now())
}

/** A change: runs against a copy of the data that replaces the old one when done. */
export async function act<T>(fn: (s: DemoState, at: Date, iso: string) => T): Promise<T> {
  const t = now()
  return mutate((s) => fn(s, t, t.toISOString()))
}

/** Wait a little, like a short AI call (used for quick, inline AI help). */
export function aiPause(): Promise<void> {
  const speed = getState().settings.aiSpeed
  return new Promise((r) => setTimeout(r, speed === 'instant' ? 30 : speed === 'fast' ? 300 : 1400))
}

export function nameOf(s: DemoState, id: ID | null | undefined): string {
  if (!id) return 'AI'
  return s.users.find((u) => u.id === id)?.name ?? 'Unknown'
}
