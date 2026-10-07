/**
 * Background AI jobs (SIMULATED).
 *
 * Every AI action runs as a job with visible progress steps and never blocks the page.
 * The result is applied when the last step finishes. Each job is logged like the real
 * `ai_calls` table (agent, prompt size, duration, success).
 *
 * In the real app the jobs table lives in PostgreSQL and a separate worker process
 * (`python -m app.worker`) runs one LLM job at a time against LM Studio.
 */
import type { DemoState } from '../types'
import { notify } from '../api/effects'
import { nowIso } from './clock'
import { newId } from './ids'
import { getState, mutate } from './store'

const MS_PER_STEP = { normal: 1100, fast: 300, instant: 20 } as const

export interface JobSpec {
  agent: string // key in explanations.ts
  title: string
  projectId?: string
  steps: string[]
  byUserId: string
  link?: string
  promptTokens?: number
  /** Applies the result to the data. Returns a short note shown when the job is done. */
  apply: (s: DemoState) => string | void
  /** Runs after the result was applied (for example to start the next job). */
  onDone?: () => void
}

export function runJob(spec: JobSpec): string {
  const id = newId('job')
  const startedReal = Date.now()
  mutate((s) => {
    s.jobs.unshift({ id, projectId: spec.projectId, agent: spec.agent, title: spec.title, steps: spec.steps, step: 0, status: 'running', startedAt: nowIso(), startedReal, byUserId: spec.byUserId, link: spec.link })
    s.jobs = s.jobs.slice(0, 40)
  })
  const perStep = MS_PER_STEP[getState().settings.aiSpeed] ?? 1100

  const finish = () => {
    try {
      mutate((s) => {
        const note = spec.apply(s) || undefined
        const job = s.jobs.find((j) => j.id === id)
        if (job) Object.assign(job, { status: 'done', step: spec.steps.length, finishedAt: nowIso(), resultNote: note })
        s.aiCalls.unshift({ id: newId('ai'), projectId: spec.projectId, agent: spec.agent, title: spec.title, promptTokens: spec.promptTokens ?? 1500, durationMs: Date.now() - startedReal, success: true, createdAt: nowIso() })
        notify(s, { to: [spec.byUserId], type: 'ai', title: `AI finished: ${spec.title}`, body: note ?? 'The result is ready for your review.', link: spec.link ?? '/', projectId: spec.projectId, at: nowIso(), email: false })
      })
      spec.onDone?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      mutate((s) => {
        const job = s.jobs.find((j) => j.id === id)
        if (job) Object.assign(job, { status: 'failed', finishedAt: nowIso(), resultNote: message })
        s.aiCalls.unshift({ id: newId('ai'), projectId: spec.projectId, agent: spec.agent, title: spec.title, promptTokens: spec.promptTokens ?? 1500, durationMs: Date.now() - startedReal, success: false, createdAt: nowIso() })
      })
    }
  }

  const advance = (i: number) => {
    if (i >= spec.steps.length) return finish()
    mutate((s) => {
      const job = s.jobs.find((j) => j.id === id)
      if (job) job.step = i
    })
    setTimeout(() => advance(i + 1), perStep)
  }
  setTimeout(() => advance(1), perStep)
  return id
}

/** Jobs left "running" by a closed tab can never finish: mark them so they can be run again. */
export function failInterruptedJobs() {
  const stale = getState().jobs.filter((j) => j.status === 'running' && Date.now() - (j.startedReal ?? 0) > 2 * 60 * 1000)
  if (!stale.length) return
  mutate((s) => {
    for (const j of s.jobs) if (stale.some((x) => x.id === j.id)) Object.assign(j, { status: 'failed', resultNote: 'Interrupted: the prototype was closed while the AI was working. Please run it again.' })
  })
}
