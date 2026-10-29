/**
 * Talking to the local AI (LM Studio), through the app server (/api/ai/...; see server/api.mjs).
 *
 * - ask():      a short text answer (a token limit keeps it short and fast). The agents ask for
 *               plain labelled lines and read them back (agents.ts).
 * - embed():    turns texts into number vectors for "how similar are these?" (similar projects,
 *               possible duplicate defects). Vectors are kept in memory for this session.
 *
 * Every call is logged (Admin → AI activity) with the model, tokens, time and any error.
 * When LM Studio is off or does not answer, an AiError is thrown: the action stops with that
 * message (no made-up fallback text).
 */
import type { AiCall } from '../types'
import { getState, mutate } from '../demo/store'
import { newId } from '../demo/ids'
import { nowIso } from '../demo/clock'
import { SYSTEM } from './prompts'

export class AiError extends Error {}

export interface AskOptions {
  agent: string // which agent, for the log (e.g. "docgen")
  title: string // what it is doing, for the log
  projectId?: string
  prompt: string
  maxTokens: number
  temperature?: number
}

function log(call: Omit<AiCall, 'id' | 'createdAt'>) {
  mutate((s) => {
    s.aiCalls.unshift({ id: newId('ai'), createdAt: nowIso(), ...call })
    s.aiCalls = s.aiCalls.slice(0, 300)
  })
}

async function post(route: string, body: unknown): Promise<Record<string, unknown>> {
  let r: Response
  try {
    r = await fetch(route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  } catch {
    throw new AiError('The app server is not running.')
  }
  const json = (await r.json().catch(() => ({}))) as Record<string, unknown>
  if (!r.ok) throw new AiError(String(json.error ?? `The AI request failed (status ${r.status}).`))
  return json
}

/** A short text answer. */
export async function ask(o: AskOptions): Promise<string> {
  const model = getState().settings.ai.model
  const started = Date.now()
  try {
    const json = await post('/api/ai/chat', {
      model,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: o.prompt },
      ],
      max_tokens: o.maxTokens,
      temperature: o.temperature ?? 0.3,
    })
    const choice = (json.choices as { message?: { content?: string } }[] | undefined)?.[0]
    const usage = json.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined
    const text = (choice?.message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').trim()
    log({ projectId: o.projectId, agent: o.agent, title: o.title, model, promptTokens: usage?.prompt_tokens ?? 0, completionTokens: usage?.completion_tokens ?? 0, durationMs: Date.now() - started, success: !!text })
    if (!text) throw new AiError('The AI returned an empty answer. Try again.')
    return text
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (!(err instanceof AiError && message.startsWith('The AI returned'))) log({ projectId: o.projectId, agent: o.agent, title: o.title, model, promptTokens: 0, durationMs: Date.now() - started, success: false, error: message })
    throw err instanceof AiError ? err : new AiError(message)
  }
}

const vectors = new Map<string, number[]>()

/** Vectors for texts (cached for this session). */
export async function embed(texts: string[], log_?: { agent: string; title: string; projectId?: string }): Promise<number[][]> {
  const model = getState().settings.ai.embedModel
  const missing = [...new Set(texts.filter((t) => !vectors.has(`${model}|${t}`)))]
  if (missing.length) {
    const started = Date.now()
    try {
      const json = await post('/api/ai/embed', { model, input: missing })
      const data = json.data as { embedding: number[]; index: number }[]
      data.forEach((d) => vectors.set(`${model}|${missing[d.index]}`, d.embedding))
      const usage = json.usage as { prompt_tokens?: number } | undefined
      log({ projectId: log_?.projectId, agent: log_?.agent ?? 'embed', title: log_?.title ?? 'Comparing texts', model, promptTokens: usage?.prompt_tokens ?? 0, durationMs: Date.now() - started, success: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log({ projectId: log_?.projectId, agent: log_?.agent ?? 'embed', title: log_?.title ?? 'Comparing texts', model, promptTokens: 0, durationMs: Date.now() - started, success: false, error: message })
      throw err instanceof AiError ? err : new AiError(message)
    }
  }
  return texts.map((t) => vectors.get(`${model}|${t}`)!)
}

/** How similar two vectors are: 1 = same meaning, 0 = unrelated. */
export function cosine(a: number[], b: number[]): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0
}

/** Is LM Studio reachable, and which models does it have? */
export async function aiStatus(): Promise<{ ok: boolean; url: string; models: string[]; error?: string }> {
  const r = await fetch('/api/ai/status').catch(() => null)
  if (!r?.ok) return { ok: false, url: '', models: [], error: 'The app server is not running.' }
  return r.json()
}
