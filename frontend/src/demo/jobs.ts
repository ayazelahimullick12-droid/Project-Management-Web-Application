/**
 * Background AI jobs.
 *
 * Every AI action runs as a job with visible progress steps and never blocks the page.
 *
 * - runAiJob(): real work with the local AI (LM Studio, src/ai). The steps move on as the
 *   work does; the result is applied at the end. If the AI is off or fails, the job fails
 *   with the reason and nothing is changed (no made-up fallback text).
 * - runJob(): the parts that are still SIMULATED (reading uploads with OCR, call
 *   transcription, importing old projects): timed steps, then the result.
 */
import type { AiJob, DemoState } from '../types'
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
        if (job) Object.assign(job, { status: 'done', step: spec.steps.length - 1, finishedAt: nowIso(), heartbeatReal: Date.now(), resultNote: note })
        s.aiCalls.unshift({ id: newId('ai'), projectId: spec.projectId, agent: spec.agent, title: spec.title, promptTokens: spec.promptTokens ?? 1500, durationMs: Date.now() - startedReal, success: true, createdAt: nowIso() })
        notify(s, { to: [spec.byUserId], type: 'ai', title: `AI finished: ${spec.title}`, body: note ?? 'The result is ready for your review.', link: spec.link ?? '/', projectId: spec.projectId, at: nowIso(), email: false })
      })
      spec.onDone?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      mutate((s) => {
        const job = s.jobs.find((j) => j.id === id)
        if (job) Object.assign(job, { status: 'failed', finishedAt: nowIso(), heartbeatReal: Date.now(), resultNote: message })
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

export interface AiJobSpec<T> {
  agent: string // key in explanations.ts
  title: string
  projectId?: string
  steps: string[]
  byUserId: string
  link?: string
  ref?: string
  /** Does the AI work. Call step(i) when the work moves on to steps[i]. */
  work: (step: (i: number) => void) => Promise<T>
  /** Applies the result to the data. Returns a short note shown when the job is done. */
  apply: (s: DemoState, result: T) => string | void
  /** Runs after the result was applied (for example to start the next job). */
  onDone?: () => void
}

/** Runs real AI work in the background and returns the job id at once. */
export function runAiJob<T>(spec: AiJobSpec<T>): string {
  const id = newId('job')
  const startedReal = Date.now()
  mutate((s) => {
    s.jobs.unshift({ id, projectId: spec.projectId, agent: spec.agent, title: spec.title, steps: spec.steps, step: 0, status: 'running', startedAt: nowIso(), startedReal, heartbeatReal: startedReal, byUserId: spec.byUserId, link: spec.link, ref: spec.ref })
    s.jobs = s.jobs.slice(0, 40)
  })
  const update = (fields: Partial<AiJob>) => (s: DemoState) => {
    const job = s.jobs.find((j) => j.id === id)
    if (job) Object.assign(job, { heartbeatReal: Date.now(), ...fields })
  }
  const step = (i: number) => mutate(update({ step: Math.max(0, Math.min(i, spec.steps.length - 1)) }))

  void (async () => {
    try {
      const result = await spec.work(step)
      mutate((s) => {
        const note = spec.apply(s, result) || undefined
        update({ status: 'done', step: spec.steps.length - 1, finishedAt: nowIso(), resultNote: note })(s)
        notify(s, { to: [spec.byUserId], type: 'ai', title: `AI finished: ${spec.title}`, body: note ?? 'The result is ready for your review.', link: spec.link ?? '/', projectId: spec.projectId, at: nowIso(), email: false })
      })
      spec.onDone?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      mutate((s) => {
        update({ status: 'failed', finishedAt: nowIso(), resultNote: message })(s)
        notify(s, { to: [spec.byUserId], type: 'ai', title: `AI could not finish: ${spec.title}`, body: message, link: spec.link ?? '/', projectId: spec.projectId, at: nowIso(), email: false })
      })
    }
  })()
  return id
}

/** Jobs left "running" by a closed tab can never finish: mark them so they can be run again. */
export function failInterruptedJobs() {
  // Real AI jobs report progress at least every few minutes (the AI timeout is 3 minutes).
  const stale = getState().jobs.filter((j) => j.status === 'running' && Date.now() - (j.heartbeatReal ?? j.startedReal ?? 0) > 4 * 60 * 1000)
  if (!stale.length) return
  mutate((s) => {
    for (const j of s.jobs) if (stale.some((x) => x.id === j.id)) Object.assign(j, { status: 'failed', resultNote: 'Interrupted: the app was closed while the AI was working. Please run it again.' })
  })
}
