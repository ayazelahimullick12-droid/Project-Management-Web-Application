/**
 * Labels and notes for AI work (BUILD_PROMPT.md section 4: every AI action shows progress,
 * never blocks the page, and every AI result is labelled until a person confirms it).
 */
import { Bot, ChevronDown, CircleCheck, Info, Sparkles, TriangleAlert, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AI_AGENTS, SECURITY_NOTE } from '../demo/explanations'
import { api } from '../api'
import { useApi, useSessionUserId } from '../api/hooks'
import { usePrefs } from './prefs'
import { Spinner } from './ui'

/** A quiet label on anything the AI produced, until a person confirms it. */
export function AiBadge({ label = 'AI' }: { label?: string }) {
  return (
    <span className="ai-gradient inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-violet-700 ring-1 ring-violet-200/60 ring-inset" title="Produced by the AI. A person must check it.">
      <Sparkles className="h-3 w-3" />
      {label}
    </span>
  )
}

/** "In the real app…" explanation for one agent. Shown only when prototype notes are on (Demo menu). */
export function AiNote({ agent, compact }: { agent: string; compact?: boolean }) {
  const [open, setOpen] = useState(!compact)
  const { showNotes } = usePrefs()
  const a = AI_AGENTS[agent]
  if (!a || !showNotes) return null
  return (
    <div className="rounded-md bg-violet-50/70 px-3 py-2 text-xs text-violet-950 ring-1 ring-violet-200">
      <button type="button" className="flex w-full items-center gap-1.5 text-left font-medium" onClick={() => setOpen(!open)}>
        <Info className="h-3.5 w-3.5 shrink-0" /> In the real app: {a.name}
        <ChevronDown className={`ml-auto h-3.5 w-3.5 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-1.5 space-y-1 leading-relaxed">
          <p>{a.realApp}</p>
          {a.prototype && <p className="text-violet-800/80">In this prototype: {a.prototype}</p>}
          <p className="text-violet-800/80">{SECURITY_NOTE}</p>
        </div>
      )}
    </div>
  )
}

/** Floating tray with the current user's AI jobs and their progress. */
export function JobTray() {
  const uid = useSessionUserId()
  const { data: jobs } = useApi(['jobs', uid], api.notifications.myJobs, !!uid)
  const [hidden, setHidden] = useState<string[]>([])
  const [, setTick] = useState(0)
  const since = (j: { heartbeatReal?: number; startedReal: number }) => Date.now() - (j.heartbeatReal ?? j.startedReal ?? 0)
  const visible = (jobs ?? []).filter((j) => !hidden.includes(j.id) && (j.status === 'running' || since(j) < (j.status === 'failed' ? 600_000 : 45_000))).slice(0, 3)
  const running = visible.some((j) => j.status === 'running')
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [running])
  if (!visible.length) return null
  return (
    <div className="fixed bottom-4 left-4 z-40 flex w-80 flex-col gap-2 no-print md:left-[17rem]">
      {visible.map((j) => (
        <div key={j.id} className="rounded-xl bg-surface p-3 text-sm shadow-xl ring-1 ring-violet-200">
          <div className="flex items-start gap-2">
            {j.status === 'running' ? <Spinner className="mt-0.5 border-violet-600" /> : j.status === 'done' ? <CircleCheck className="mt-0.5 h-4 w-4 text-leaf" /> : <TriangleAlert className="mt-0.5 h-4 w-4 text-red-600" />}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 font-medium">
                <Bot className="h-3.5 w-3.5 text-violet-700" /> <span className="truncate">{j.title}</span>
              </div>
              <div className="mt-0.5 text-xs text-muted">
                {j.status === 'running' ? `${j.steps[j.step]} (${j.step + 1}/${j.steps.length}) · ${Math.round((Date.now() - j.startedReal) / 1000)} s` : j.resultNote ?? (j.status === 'done' ? 'Done.' : 'Failed.')}
              </div>
              {j.status === 'running' && (
                <div className="mt-2 h-1 overflow-hidden rounded bg-violet-100">
                  <div className="h-full bg-violet-600 transition-all" style={{ width: `${((j.step + 1) / j.steps.length) * 100}%` }} />
                </div>
              )}
              {j.status === 'done' && j.link && (
                <Link to={j.link} className="mt-1 inline-block text-xs font-medium text-brand hover:underline">
                  Open
                </Link>
              )}
            </div>
            <button className="text-muted hover:text-ink" onClick={() => setHidden((h) => [...h, j.id])} aria-label="Hide">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
