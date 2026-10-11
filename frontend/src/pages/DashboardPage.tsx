/**
 * Home, laid out as a "bento" grid like current work apps (Linear, Asana Home, Monday):
 * - Numbers at a glance (waiting on you, in review, open questions, defects, decisions).
 * - What is waiting on you, with how long it has waited; recent conversations beside it.
 * - Project cards: health, progress ring, next step and the heads on it.
 * - Activity over the last two weeks, and for the Owner and Admin the pipeline and stalled items.
 * SPEC.md "Dashboard".
 */
import { Activity, ArrowRight, Bug, CircleCheck, FileText, Gavel, MessageCircle, MessageCircleQuestion, Plus, SquareCheckBig, TriangleAlert } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { api } from '../api'
import { useApi, useNow, useSessionUserId } from '../api/hooks'
import type { NextStep, ProjectSummary } from '../api/projects'
import { STAGES, STAGE_LABEL } from '../rules/pipeline'
import { ChannelIcon } from '../components/chat/ConversationList'
import { openChat } from '../components/chat/dock'
import { duration, shortAgo } from '../components/format'
import { OpenQuestion } from '../components/OpenQuestion'
import { Avatar, AvatarStack, Badge, EmptyState, ErrorBox, LinkButton, Loading, ProgressRing, ProjectIcon, type Tone } from '../components/ui'

const TONE_DOT: Record<NextStep['tone'], string> = { action: 'bg-brand', waiting: 'bg-sky-500', done: 'bg-leaf', problem: 'bg-red-500' }

/** A thin progress bar: one segment per stage. */
export function StageBar({ stage, className }: { stage: ProjectSummary['stage']; className?: string }) {
  const at = STAGES.indexOf(stage)
  return (
    <div className={clsx('flex gap-0.5', className)} title={`Stage: ${STAGE_LABEL[stage]}`}>
      {STAGES.slice(0, -1).map((s, i) => (
        <span key={s} className={clsx('h-1.5 flex-1 rounded-full', stage === 'COMPLETE' || i < at ? 'bg-leaf' : i === at ? 'bg-brand' : 'bg-ink/10')} />
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

type Dash = Awaited<ReturnType<typeof api.projects.dashboard>>
type Task = Dash['myTasks'][number]
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

/** How long something has waited, coloured: under a day grey, up to 3 days amber, longer red. */
function AgeChip({ since, now }: { since: string; now: Date }) {
  const ms = now.getTime() - new Date(since).getTime()
  const tone = ms < 86_400_000 ? 'bg-ink/[0.05] text-muted' : ms < 3 * 86_400_000 ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-700'
  const label = ms < 86_400_000 ? shortAgo(since, now) : `${Math.round(ms / 86_400_000)}d`
  return <span className={clsx('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums', tone)} title={`Waiting since ${new Date(since).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' })}`}>{label}</span>
}

function Tile({ icon, tone, value, label, sub, to }: { icon: ReactNode; tone: string; value: number; label: string; sub?: ReactNode; to?: string }) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <span className={clsx('flex h-8 w-8 items-center justify-center rounded-xl [&>svg]:h-4 [&>svg]:w-4', tone)}>{icon}</span>
        {to && <ArrowRight className="h-3.5 w-3.5 text-muted opacity-0 transition group-hover:opacity-100" />}
      </div>
      <div className="mt-3 text-[26px] leading-none font-semibold tracking-tight tabular-nums">{value}</div>
      <div className="mt-1.5 text-xs text-muted">{label}</div>
      {sub && <div className="mt-0.5 text-[11px]">{sub}</div>}
    </>
  )
  const cls = 'group shadow-soft rounded-2xl border border-line/70 bg-surface p-4 transition'
  return to ? (
    <Link to={to} className={clsx(cls, 'hover:-translate-y-0.5 hover:shadow-md')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

function Panel({ title, action, children, className }: { title: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx('shadow-soft flex min-w-0 flex-col rounded-2xl border border-line/70 bg-surface', className)}>
      <header className="flex items-center justify-between gap-2 px-5 pt-4 pb-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">{title}</h2>
        {action}
      </header>
      <div className="min-h-0 flex-1 px-2 pb-2">{children}</div>
    </section>
  )
}

const HEALTH_TONE: Record<ProjectSummary['health']['tone'], Tone> = { green: 'green', blue: 'blue', amber: 'amber', red: 'red', gray: 'gray' }

function ProjectCard({ s, now }: { s: ProjectSummary; now: Date }) {
  return (
    <Link to={`/projects/${s.project.id}`} className="group shadow-soft flex min-w-0 flex-col rounded-2xl border border-line/70 bg-surface p-5 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start gap-3">
        <ProjectIcon id={s.project.id} name={s.project.name} size={38} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{s.project.name}</div>
          <div className="truncate text-xs text-muted">{s.myRole}</div>
        </div>
        <ProgressRing value={s.progress} size={40} />
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Badge tone={HEALTH_TONE[s.health.tone]}>
          <span className={clsx('h-1.5 w-1.5 rounded-full', { green: 'bg-leaf', blue: 'bg-sky-500', amber: 'bg-amber-500', red: 'bg-red-500', gray: 'bg-gray-400' }[s.health.tone])} />
          {s.health.label}
        </Badge>
        <span className="text-xs text-muted">{STAGE_LABEL[s.stage]}</span>
      </div>
      <div className="mt-3 rounded-xl bg-canvas px-3 py-2.5">
        <div className="mb-0.5 text-[10px] font-semibold tracking-wide text-muted uppercase">Next step</div>
        <NextStepLine next={s.next} now={now} compact />
      </div>
      <div className="mt-4 flex items-center justify-between">
        <AvatarStack people={s.heads} size={24} max={5} />
        <div className="flex items-center gap-3 text-xs text-muted">
          {s.unansweredQuestions > 0 && <span className="flex items-center gap-1" title="Open Q/A questions"><MessageCircleQuestion className="h-3.5 w-3.5" />{s.unansweredQuestions}</span>}
          {s.openDefects > 0 && <span className="flex items-center gap-1" title="Open defects"><Bug className="h-3.5 w-3.5" />{s.openDefects}</span>}
          {s.pendingDecisions > 0 && <span className="flex items-center gap-1" title="Decisions to confirm"><Gavel className="h-3.5 w-3.5" />{s.pendingDecisions}</span>}
        </div>
      </div>
    </Link>
  )
}

/** Bars for the last 14 days of activity (like GitHub's contribution graph, compressed). */
function Sparkline({ days }: { days: Dash['activityByDay'] }) {
  const max = Math.max(1, ...days.map((d) => d.count))
  return (
    <div className="flex h-12 items-end gap-1">
      {days.map((d, i) => (
        <span key={d.day} title={`${d.day}: ${d.count} updates`} className={clsx('flex-1 rounded-sm', i === days.length - 1 ? 'bg-brand' : 'bg-brand/25')} style={{ height: `${Math.max(6, (d.count / max) * 100)}%` }} />
      ))}
    </div>
  )
}

function Conversations() {
  const uid = useSessionUserId()
  const now = useNow()
  const navigate = useNavigate()
  const { data } = useApi(['conversations', uid], api.chat.conversations, !!uid)
  const list = [...(data?.channels ?? []), ...(data?.direct ?? [])].filter((c) => c.last).sort((a, b) => b.unread - a.unread || (b.last?.createdAt ?? '').localeCompare(a.last?.createdAt ?? '')).slice(0, 5)
  return (
    <Panel
      title={
        <>
          <MessageCircle className="h-4 w-4 text-muted" /> Conversations
          {!!data?.unread && <span className="rounded-full bg-brand px-1.5 text-[10px] leading-4 font-semibold text-white">{data.unread}</span>}
        </>
      }
      action={<Link to="/messages" className="text-xs font-medium text-brand hover:underline">All messages</Link>}
    >
      <ul>
        {list.map((c) => {
          const direct = c.kind === 'direct' || c.kind === 'rag_dm'
          return (
            <li key={c.id}>
              <button onClick={() => openChat(c.id, navigate)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-ink/[0.04]">
                {direct ? <Avatar name={c.title} id={c.otherUserId} size={32} status={c.away ? 'away' : undefined} /> : <ChannelIcon c={c} size={32} />}
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className={clsx('min-w-0 flex-1 truncate text-sm', c.unread ? 'font-semibold' : 'font-medium')}>{direct ? c.title : `${c.title} · ${c.projectName}`}</span>
                    <span className="shrink-0 text-[11px] text-muted">{shortAgo(c.last?.createdAt, now)}</span>
                  </span>
                  <span className={clsx('block truncate text-xs', c.unread ? 'text-ink' : 'text-muted')}>{c.last ? `${c.last.mine ? 'You: ' : c.last.authorName ? `${c.last.authorName.split(' ')[0]}: ` : ''}${c.last.body}` : 'No messages yet'}</span>
                </span>
                {c.unread > 0 && <span className="h-2 w-2 shrink-0 rounded-full bg-brand" />}
              </button>
            </li>
          )
        })}
        {!list.length && <li className="px-3 py-6 text-center text-sm text-muted">No conversations yet.</li>}
      </ul>
    </Panel>
  )
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
  const stalled = allStalled ? data.stalled : data.stalled.slice(0, 5)
  const pipeMax = Math.max(1, ...data.pipeline.map((p) => p.count))
  const totalActivity = data.activityByDay.reduce((n, d) => n + d.count, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-muted">{now.toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka', weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1 className="page-title mt-1 text-[28px] leading-tight">
            {greeting(now)}, {me?.name.split(' ')[0]}
          </h1>
          <p className="mt-1 text-sm text-muted">{tasks.length ? `${tasks.length} thing${tasks.length > 1 ? 's are' : ' is'} waiting on you across ${data.active.length} active project${data.active.length === 1 ? '' : 's'}.` : 'Nothing is waiting on you right now.'}</p>
        </div>
        <LinkButton to="/projects/new" variant="primary">
          <Plus className="h-4 w-4" /> New project
        </LinkButton>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Tile icon={<SquareCheckBig />} tone="bg-brand-soft text-brand" value={tasks.length} label="Waiting on you" to="/my-work" />
        <Tile icon={<FileText />} tone="bg-sky-50 text-sky-700" value={data.kpis.inReview} label="Documents in review" />
        <Tile icon={<MessageCircleQuestion />} tone="bg-amber-50 text-amber-700" value={data.kpis.questionsOpen} label="Open Q/A questions" to="/my-work?tab=questions" />
        <Tile
          icon={<Bug />}
          tone="bg-red-50 text-red-700"
          value={data.kpis.defectsOpen}
          label="Open defects"
          sub={data.kpis.criticalDefects > 0 && <span className="inline-flex items-center gap-1 font-medium text-red-700"><TriangleAlert className="h-3 w-3" />{data.kpis.criticalDefects} critical</span>}
        />
        <Tile icon={<Gavel />} tone="bg-violet-50 text-violet-700" value={data.kpis.decisionsPending} label="Decisions to confirm" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title={
            <>
              <SquareCheckBig className="h-4 w-4 text-muted" /> Waiting on you
            </>
          }
          action={tasks.length > 6 && <Link to="/my-work" className="text-xs font-medium text-brand hover:underline">See all {tasks.length}</Link>}
        >
          {tasks.length ? (
            <ul>
              {tasks.slice(0, 6).map((t) => (
                <li key={t.key}>
                  <Link to={t.link} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-ink/[0.04]">
                    <ProjectIcon id={t.projectId} name={t.projectName} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{t.title}</div>
                      <div className="truncate text-xs text-muted">
                        {t.projectName}
                        {t.recipients.find((r) => r.to === uid && r.forUserId) && ' · covering for an Away head'}
                      </div>
                    </div>
                    <AgeChip since={t.since} now={now} />
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted transition group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-leaf-soft text-leaf">
                <CircleCheck className="h-5 w-5" />
              </span>
              <div className="text-sm font-medium">You are all caught up</div>
              <div className="text-xs text-muted">New approvals, questions and tests will show up here.</div>
            </div>
          )}
        </Panel>
        <Conversations />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Your projects</h2>
          {(data.archived.length > 0 || data.finished.length > 0) && <Link to="/archive" className="text-xs font-medium text-muted hover:text-ink">Archived &amp; finished</Link>}
        </div>
        {data.active.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.active.map((s) => (
              <ProjectCard key={s.project.id} s={s} now={now} />
            ))}
            <Link to="/projects/new" className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line text-sm text-muted transition hover:border-brand/50 hover:text-brand">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink/[0.05]">
                <Plus className="h-5 w-5" />
              </span>
              New project
            </Link>
          </div>
        ) : (
          <EmptyState title="No active projects">Create one with New project.</EmptyState>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          className={data.portfolio ? undefined : 'lg:col-span-3'}
          title={
            <>
              <Activity className="h-4 w-4 text-muted" /> Activity
            </>
          }
          action={<span className="text-xs text-muted">{totalActivity} updates · 14 days</span>}
        >
          <div className="px-3 pb-2">
            <Sparkline days={data.activityByDay} />
          </div>
          <ul className={clsx('mt-1', !data.portfolio && 'md:grid md:grid-cols-2 md:gap-x-4')}>
            {data.activity.slice(0, data.portfolio ? 6 : 8).map((a) => (
              <li key={a.id} className="flex items-start gap-2.5 rounded-xl px-3 py-2">
                {a.actorId ? <Avatar name={a.actorName} id={a.actorId} size={26} /> : <span className="ai-gradient flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-violet-700">AI</span>}
                <div className="min-w-0 flex-1 text-[13px] leading-snug">
                  <div className="truncate">
                    <span className="font-medium">{a.actorName}</span> <span className="text-muted">· {a.action}</span>
                  </div>
                  <div className="truncate text-xs text-muted">
                    {a.projectName}
                    {a.details && ` · ${a.details}`}
                  </div>
                </div>
                <span className="shrink-0 text-[11px] text-muted">{shortAgo(a.createdAt, now)}</span>
              </li>
            ))}
            {!data.activity.length && <li className="px-3 py-6 text-center text-sm text-muted">No activity yet.</li>}
          </ul>
        </Panel>

        {data.portfolio && (
          <div className="grid min-w-0 gap-4 lg:col-span-2">
            <Panel title="Pipeline" action={<span className="text-xs text-muted">active projects by stage</span>}>
              <div className="flex items-end gap-2 px-3 pt-2 pb-3">
                {data.pipeline
                  .filter((p) => p.stage !== 'COMPLETE')
                  .map((p) => (
                    <div key={p.stage} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                      <span className="text-xs font-semibold tabular-nums">{p.count}</span>
                      <div className="flex h-16 w-full items-end rounded-lg bg-ink/[0.04]">
                        <div className={clsx('w-full rounded-lg', p.count ? 'bg-brand' : '')} style={{ height: `${(p.count / pipeMax) * 100}%`, opacity: p.count ? 0.35 + (p.count / pipeMax) * 0.65 : 0 }} />
                      </div>
                      <span className="w-full truncate text-center text-[10px] text-muted" title={p.label}>{p.label}</span>
                    </div>
                  ))}
              </div>
            </Panel>
            <Panel
              title={
                <>
                  Stalled across the portfolio <OpenQuestion id="escalation" />
                </>
              }
              action={<span className="text-xs text-muted">longest waiting first</span>}
            >
              {data.stalled.length ? (
                <ul>
                  {stalled.map((t) => (
                    <li key={t.key}>
                      <Link to={t.link} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-ink/[0.04]">
                        <AgeChip since={t.since} now={now} />
                        <span className="min-w-0 flex-1 truncate">
                          {t.title} <span className="text-muted">· {t.projectName}</span>
                        </span>
                        <span className="hidden shrink-0 truncate text-xs text-muted md:block">
                          {t.waitingOnName}
                          {t.recipients.some((r) => r.forUserId) && ' (deputy covering)'}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-3 pb-3 text-sm text-muted">Nothing is stalled.</p>
              )}
              {data.stalled.length > 5 && (
                <button className="px-3 pb-2 text-xs font-medium text-brand" onClick={() => setAllStalled(!allStalled)}>
                  {allStalled ? 'Show fewer' : `Show all ${data.stalled.length}`}
                </button>
              )}
            </Panel>
          </div>
        )}
      </div>
    </div>
  )
}

export function ArchivePage() {
  const now = useNow()
  const { data } = useApi(['dashboard'], api.projects.dashboard)
  const rows = [...(data?.archived ?? []), ...(data?.finished ?? [])]
  return (
    <div>
      <h1 className="page-title mb-1 text-2xl">Archived and finished projects</h1>
      <p className="mb-6 text-sm text-muted">
        Archived projects are read-only. Finished projects are indexed so the RAG agent can suggest from them. <OpenQuestion id="archive-reopen" />
      </p>
      {rows.length ? (
        <ul className="shadow-soft divide-y divide-line/70 overflow-hidden rounded-2xl border border-line/70 bg-surface">
          {rows.map((s) => (
            <li key={s.project.id}>
              <Link to={`/projects/${s.project.id}`} className="grid items-center gap-x-6 px-5 py-3.5 hover:bg-canvas md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="flex min-w-0 items-center gap-3">
                  <ProjectIcon id={s.project.id} name={s.project.name} size={32} />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{s.project.name}</div>
                    <div className="truncate text-xs text-muted">{s.project.finished ? `Finished ${s.project.finishedYear ?? s.project.legacy?.year ?? ''}` : 'Archived'}</div>
                  </div>
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
