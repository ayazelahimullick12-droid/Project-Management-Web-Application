/**
 * Home: what is waiting on me, my projects with their next step, and (for the Owner and Admin)
 * the portfolio's stalled items. SPEC.md "Dashboard". Layout ideas from Asana Home and GitHub.
 */
import { ArrowRight, CircleCheck, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import { api } from '../api'
import { useApi, useNow, useSessionUserId } from '../api/hooks'
import type { NextStep, ProjectSummary } from '../api/projects'
import { STAGES, STAGE_LABEL } from '../rules/pipeline'
import { duration } from '../components/format'
import { OpenQuestion } from '../components/OpenQuestion'
import { EmptyState, ErrorBox, LinkButton, Loading } from '../components/ui'

const TONE_DOT: Record<NextStep['tone'], string> = { action: 'bg-brand', waiting: 'bg-sky-500', done: 'bg-leaf', problem: 'bg-red-500' }

/** A thin progress bar: one segment per stage. */
export function StageBar({ stage, className }: { stage: ProjectSummary['stage']; className?: string }) {
  const at = STAGES.indexOf(stage)
  return (
    <div className={clsx('flex gap-0.5', className)} title={`Stage: ${STAGE_LABEL[stage]}`}>
      {STAGES.slice(0, -1).map((s, i) => (
        <span key={s} className={clsx('h-1.5 flex-1 rounded-full', stage === 'COMPLETE' || i < at ? 'bg-leaf' : i === at ? 'bg-brand' : 'bg-black/10')} />
      ))}
    </div>
  )
}

export function NextStepLine({ next, now, compact }: { next: NextStep; now: Date; compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <span className={clsx('mt-1.5 h-2 w-2 shrink-0 rounded-full', TONE_DOT[next.tone])} />
      <div className="min-w-0">
        <div className={clsx('truncate', compact ? 'text-sm' : 'font-medium')}>{next.title}</div>
        {(next.waitingOnName || next.detail) && (
          <div className="truncate text-xs text-muted">
            {next.waitingOnName ? (
              <>
                Waiting on {next.waitingOnName}
                {next.coveringName && ` (Away; ${next.coveringName} covering)`}
                {next.since && ` · ${duration(now.getTime() - new Date(next.since).getTime())}`}
              </>
            ) : (
              next.detail
            )}
          </div>
        )}
      </div>
    </div>
  )
}

type Task = Awaited<ReturnType<typeof api.projects.dashboard>>['myTasks'][number]
const GROUP_TITLE: Record<string, (n: number) => string> = {
  decision: (n) => `${n} decisions are waiting for your confirmation`,
  question: (n) => `${n} Q/A questions are waiting for your answer`,
  'fact-update': (n) => `${n} Fact Sheet updates were proposed from edits`,
  defect: (n) => `${n} new defects to triage`,
  retest: (n) => `${n} defects are ready for your retest`,
  tests: (n) => `${n} test runs have tests assigned to you`,
}

/** Groups many items of the same kind in the same project into one row ("3 decisions…"). */
export function groupTasks(tasks: Task[]): (Task & { count: number })[] {
  const out: (Task & { count: number })[] = []
  for (const t of tasks) {
    const same = GROUP_TITLE[t.type] && out.find((o) => o.projectId === t.projectId && o.type === t.type)
    if (same) {
      same.count += 1
      same.title = GROUP_TITLE[t.type](same.count)
      if (t.since < same.since) same.since = t.since
    } else out.push({ ...t, count: 1 })
  }
  return out
}

function greeting(now: Date) {
  const h = Number(now.toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Dhaka' }))
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export function DashboardPage() {
  const now = useNow()
  const uid = useSessionUserId()
  const { data, isLoading, error } = useApi(['dashboard'], api.projects.dashboard)
  const { data: me } = useApi(['whoami', uid], api.projects.whoami)
  const [allStalled, setAllStalled] = useState(false)
  if (isLoading) return <Loading />
  if (error || !data) return <ErrorBox error={error} />
  const tasks = groupTasks(data.myTasks)
  const stalled = allStalled ? data.stalled : data.stalled.slice(0, 6)
  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title text-[26px]">
            {greeting(now)}, {me?.name.split(' ')[0]}
          </h1>
          <p className="mt-1 text-sm text-muted">{tasks.length ? `${tasks.length} thing${tasks.length > 1 ? 's are' : ' is'} waiting on you.` : 'Nothing is waiting on you right now.'}</p>
        </div>
        <LinkButton to="/projects/new" variant="primary">
          <Plus className="h-4 w-4" /> New project
        </LinkButton>
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Waiting on you</h2>
          {tasks.length > 5 && (
            <Link to="/my-work" className="text-xs font-medium text-brand">
              See all {tasks.length} in My work
            </Link>
          )}
        </div>
        {tasks.length ? (
          <ul className="divide-y divide-line/70 overflow-hidden rounded-xl border border-line/80 bg-white">
            {tasks.slice(0, 5).map((t) => (
              <li key={t.key}>
                <Link to={t.link} className="flex items-center gap-3 px-4 py-3 hover:bg-canvas">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-brand" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{t.title}</div>
                    <div className="truncate text-xs text-muted">
                      {t.projectName}
                      {t.recipients.find((r) => r.to === uid && r.forUserId) && ' · covering for an Away head'}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-muted">{duration(now.getTime() - new Date(t.since).getTime())}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-line/80 bg-white px-4 py-4 text-sm text-muted">
            <CircleCheck className="h-4 w-4 text-leaf" /> You are all caught up.
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Your projects</h2>
        {data.active.length ? (
          <ul className="divide-y divide-line/70 overflow-hidden rounded-xl border border-line/80 bg-white">
            {data.active.map((s) => (
              <li key={s.project.id}>
                <Link to={`/projects/${s.project.id}`} className="grid gap-x-6 gap-y-2 px-4 py-3.5 hover:bg-canvas md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_120px]">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{s.project.name}</div>
                    <div className="truncate text-xs text-muted">{s.myRole}</div>
                  </div>
                  <NextStepLine next={s.next} now={now} compact />
                  <div className="self-center">
                    <StageBar stage={s.stage} />
                    <div className="mt-1 text-[11px] text-muted">{STAGE_LABEL[s.stage]}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No active projects">Create one with New project.</EmptyState>
        )}
      </section>

      {data.portfolio && (
        <section>
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-sm font-semibold">Stalled across the portfolio</h2>
            <span className="text-xs text-muted">longest waiting first</span>
            <OpenQuestion id="escalation" />
          </div>
          {data.stalled.length ? (
            <ul className="divide-y divide-line/70 overflow-hidden rounded-xl border border-line/80 bg-white">
              {stalled.map((t) => (
                <li key={t.key}>
                  <Link to={t.link} className="grid items-center gap-x-4 px-4 py-2.5 text-sm hover:bg-canvas md:grid-cols-[90px_minmax(0,1fr)_200px]">
                    <span className="font-medium">{duration(now.getTime() - new Date(t.since).getTime())}</span>
                    <span className="truncate">
                      {t.title} <span className="text-muted">· {t.projectName}</span>
                    </span>
                    <span className="truncate text-xs text-muted">
                      {t.waitingOnName}
                      {t.recipients.some((r) => r.forUserId) && ' (deputy covering)'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nothing is stalled.</p>
          )}
          {data.stalled.length > 6 && (
            <button className="mt-2 text-xs font-medium text-brand" onClick={() => setAllStalled(!allStalled)}>
              {allStalled ? 'Show fewer' : `Show all ${data.stalled.length}`}
            </button>
          )}
        </section>
      )}
    </div>
  )
}

export function ArchivePage() {
  const now = useNow()
  const { data } = useApi(['dashboard'], api.projects.dashboard)
  const rows = [...(data?.archived ?? []), ...(data?.finished ?? [])]
  return (
    <div>
      <h1 className="page-title mb-1 text-[22px]">Archived and finished projects</h1>
      <p className="mb-6 text-sm text-muted">
        Archived projects are read-only. Finished projects are indexed so the RAG agent can suggest from them. <OpenQuestion id="archive-reopen" />
      </p>
      {rows.length ? (
        <ul className="divide-y divide-line/70 overflow-hidden rounded-xl border border-line/80 bg-white">
          {rows.map((s) => (
            <li key={s.project.id}>
              <Link to={`/projects/${s.project.id}`} className="grid gap-x-6 px-4 py-3 hover:bg-canvas md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="min-w-0">
                  <div className="truncate font-medium">{s.project.name}</div>
                  <div className="truncate text-xs text-muted">{s.project.finished ? `Finished ${s.project.finishedYear ?? s.project.legacy?.year ?? ''}` : 'Archived'}</div>
                </div>
                <NextStepLine next={s.next} now={now} compact />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Nothing here yet" />
      )}
    </div>
  )
}
