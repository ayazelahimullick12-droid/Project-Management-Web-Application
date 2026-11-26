/**
 * Simple view · one project's overview. The documents and other areas are the tabs in the project
 * header above (ProjectNav.tsx), so the overview shows what the tabs do not:
 * - your tasks in this project, each with its button;
 * - progress as one row of the six steps, with what is happening now;
 * - recent activity (the full log is under More → Activity log);
 * - an "About" panel (description, project type, people, start date).
 * Laid out to fit one laptop screen without scrolling the page (November 2026).
 */
import { clsx } from 'clsx'
import { Check, Users } from 'lucide-react'
import { Fragment } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { useApi, useNow } from '../api/hooks'
import type { DocType, Team } from '../types'
import { STAGES } from '../rules/pipeline'
import { ago, fmtDate } from '../components/format'
import { Avatar, ErrorBox, Loading } from '../components/ui'
import { StatusLine } from './parts'
import { projectStatus } from './ProjectsPage'
import { useTodo } from './todo'
import { docStatusText, STEP_NAME, waited } from './words'

/** The head of each team (who approves and signs is chosen by the PM for each document). */
const HEADS: [Team, string][] = [
  ['PM', 'PM'],
  ['TECH', 'Tech head'],
  ['STAKEHOLDER', 'Stakeholders'],
  ['SPONSOR', 'Sponsor'],
]

/** The document each step produces. */
const STEP_DOC: Partial<Record<(typeof STAGES)[number], DocType>> = { PROPOSAL: 'PROPOSAL', BRD: 'BRD', SRS: 'SRS', SQA: 'SQA_SIGNOFF', UAT: 'UAT_SIGNOFF' }

export function SimpleProjectPage() {
  const { pid = '' } = useParams()
  const now = useNow()
  const { data, isLoading, error } = useApi(['project', pid], () => api.projects.getProject(pid))
  const { items } = useTodo()
  if (isLoading) return <Loading />
  if (error || !data) return <ErrorBox error={error} />

  const { summary } = data
  const p = summary.project
  const mine = items.filter((i) => i.projectId === pid)
  const status = projectStatus(summary, mine, now)
  const nameOf = (id?: string) => data.members.find((m) => m.member.userId === id)?.name ?? 'someone'
  const people = new Set(data.members.map((m) => m.member.userId)).size
  const testingLine = (t: (typeof data.testing)['SQA']) =>
    t.points && t.version ? `Version ${t.version}: ${t.passed} of ${t.points} points passed${t.failed ? `, ${t.failed} failed` : ''}${t.toCheck ? `, ${t.toCheck} to check` : ''}` : t.status

  // The six steps for the timeline: done, now (with what is happening) or later.
  const at = summary.stage === 'COMPLETE' ? STAGES.length : STAGES.indexOf(summary.stage)
  const steps = STAGES.filter((st) => st !== 'COMPLETE').map((st, i) => {
    const state: 'done' | 'now' | 'later' = i < at ? 'done' : i === at ? 'now' : 'later'
    const type = STEP_DOC[st]
    const doc = type ? summary.docs.find((d) => d.type === type) : undefined
    let text = ''
    if (state === 'done') text = st === 'INTAKE' ? 'Project facts confirmed' : doc ? doc.status.label.replace(' (frozen)', '') : 'Done'
    else if (state === 'now') {
      if ((st === 'SQA' || st === 'UAT') && (!doc || doc.status.key === 'not_started')) text = testingLine(data.testing[st])
      else if (doc && doc.status.key !== 'not_started') text = `${docStatusText(doc.status, nameOf)}${doc.status.key === 'in_review' && doc.status.since ? ` · ${waited(doc.status.since, now)}` : ''}`
      else text = status.text
    }
    return { key: st, name: STEP_NAME[st], state, text }
  })

  const card = 'shadow-soft flex min-h-0 flex-col rounded-2xl p-5'
  const cardTitle = 'mb-3 flex shrink-0 items-baseline justify-between gap-2 text-lg font-semibold'
  const now_ = steps.find((x) => x.state === 'now')

  return (
    // Fits one screen on a laptop: progress across the top, then three columns that scroll inside
    // themselves if they are long (tasks · recent activity · about and people).
    <div className="flex flex-col gap-5 lg:h-[calc(100dvh-11.75rem)]">
      <div className="flex shrink-0 flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="page-title text-2xl">Overview</h1>
        <span className="text-base text-muted">Your role: {summary.myRole}</span>
        {p.intake.kind?.approvedBy && <span className="rounded-md bg-ink/[0.05] px-2 py-0.5 text-sm font-medium">{p.intake.kind.value === 'update' ? 'Update to an existing application' : 'New project'}</span>}
      </div>
      {p.status === 'archived' && <StatusLine tone="done">This project is archived. You can read everything, but nothing can be changed.</StatusLine>}

      {/* Progress: the six steps in one row, and what is happening now */}
      <section aria-label="Progress" className="shadow-soft shrink-0 rounded-2xl px-5 py-4">
        <ol className="flex items-start">
          {steps.map((st, i) => (
            <li key={st.key} className="relative flex min-w-0 flex-1 flex-col items-center text-center">
              {i > 0 && <span className={clsx('absolute top-3.5 right-1/2 h-0.5 w-full -translate-x-3.5', steps[i - 1].state === 'done' ? 'bg-leaf/60' : 'bg-line')} aria-hidden />}
              <span
                className={clsx(
                  'relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums',
                  st.state === 'done' ? 'bg-leaf text-white' : st.state === 'now' ? 'bg-brand text-white ring-4 ring-brand/15' : 'bg-paper text-muted ring-1 ring-line',
                )}
              >
                {st.state === 'done' ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className={clsx('mt-1.5 px-1 text-sm leading-tight', st.state === 'later' ? 'text-muted' : 'font-medium', st.state === 'now' ? 'text-brand' : 'hidden sm:block')}>{st.name}</span>
              <span className="sr-only">{st.state === 'done' ? `done: ${st.text}` : st.state === 'now' ? 'now' : 'later'}</span>
            </li>
          ))}
        </ol>
        {now_?.text && (
          <p className="mt-3 border-t border-line pt-3 text-base">
            <span className="mr-2 rounded-md bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">Now · {now_.name}</span>
            {now_.text}
          </p>
        )}
      </section>

      <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-3">
        {/* Everything waiting for you in this project, each with its button */}
        <section aria-label="Your tasks" className={card}>
          <h2 className={cardTitle}>Your tasks{mine.length ? <span className="text-base font-normal text-muted">{mine.length}</span> : null}</h2>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {p.status === 'archived' ? (
              <p className="text-base text-muted">Nothing: the project is archived.</p>
            ) : mine.length ? (
              <ul className="space-y-2">
                {mine.map((it, i) => (
                  <li key={it.key}>
                    <Link to={it.to} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 ring-1 ring-line transition hover:bg-ink/[0.025] dark:hover:bg-white/[0.03]">
                      <span className="min-w-0 flex-1">
                        <span className="block text-base leading-snug font-medium">{it.title}</span>
                        {it.since && <span className="mt-0.5 block text-sm text-muted">Waiting {waited(it.since, now)}{it.coveringFor ? ` · for ${it.coveringFor}, who is away` : ''}</span>}
                      </span>
                      <span className={clsx('inline-flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-medium transition', i === 0 ? 'glass-tint text-white group-hover:brightness-110' : 'glass-control')}>{it.button}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <StatusLine tone={status.tone}>
                <div>{status.tone === 'done' ? status.text : 'Nothing for you to do right now.'}</div>
                {status.tone !== 'done' && <div className="text-base text-muted">{status.text}</div>}
              </StatusLine>
            )}
          </div>
        </section>

        {/* What happened lately (the full log is under More → Activity log) */}
        <section aria-label="Recent activity" className={card}>
          <h2 className={cardTitle}>
            Recent activity
            <Link to={`/projects/${pid}/audit`} className="text-sm font-medium text-brand hover:underline">All</Link>
          </h2>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {data.recent.length ? (
              <ul className="space-y-3">
                {data.recent.map((a) => (
                  <li key={a.id} className="flex items-start gap-3">
                    <Avatar name={a.actorName} id={a.actorName} size={26} />
                    <div className="min-w-0 flex-1 text-[0.9375rem] leading-snug">
                      <span className="font-medium">{a.actorName}</span> <span className="text-muted">· {a.action.toLowerCase()}</span>
                      {a.details && <div className="truncate text-sm text-muted">{a.details}</div>}
                    </div>
                    <span className="shrink-0 text-sm whitespace-nowrap text-muted">{ago(a.createdAt, now)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-base text-muted">Nothing yet.</p>
            )}
          </div>
        </section>

        {/* About this project: what it is, who leads it and when it started */}
        <section aria-label="About" className={card}>
          <h2 className={cardTitle}>
            About
            <Link to={`/projects/${pid}/team`} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
              <Users className="h-4 w-4" /> Team ({people})
            </Link>
          </h2>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
            <p className="line-clamp-4 text-base leading-relaxed text-muted">{p.description || p.intake.description?.slice(0, 220) || 'No description yet.'}</p>
            <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2.5 text-[0.9375rem]">
              <dt className="text-sm text-muted">Owner</dt>
              <dd className="flex min-w-0 items-center gap-2 font-medium"><Avatar name={data.ownerName} id={p.ownerId} size={22} /> <span className="truncate">{data.ownerName}</span></dd>
              {HEADS.map(([team, label]) => {
                const head = data.members.find((m) => m.member.team === team && m.member.isHead)
                return (
                  <Fragment key={team}>
                    <dt className="text-sm text-muted">{label}</dt>
                    <dd className="flex min-w-0 items-center gap-2 font-medium">
                      {head ? (
                        <>
                          <Avatar name={head.name} id={head.member.userId} size={22} /> <span className="truncate">{head.name}</span>
                          {head.away && <span className="rounded bg-amber-50 px-1.5 text-xs font-medium text-amber-800">away</span>}
                        </>
                      ) : (
                        <span className="font-normal text-muted">Not added yet</span>
                      )}
                    </dd>
                  </Fragment>
                )
              })}
              <dt className="text-sm text-muted">Started</dt>
              <dd className="font-medium">{fmtDate(p.createdAt)}</dd>
            </dl>
          </div>
        </section>
      </div>
    </div>
  )
}
