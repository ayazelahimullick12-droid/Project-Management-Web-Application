/**
 * Simple view · one project's overview. The documents and other areas are the tabs in the project
 * header above (ProjectNav.tsx), so the overview shows what the tabs do not:
 * - your tasks in this project, each with its button;
 * - progress as a timeline of the six steps (done, now with what is happening, later);
 * - recent activity (the full log is under More → Activity log);
 * - an "About" panel on the right (description, people, start date), as on GitHub.
 */
import { clsx } from 'clsx'
import { Check, Users } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { useApi, useNow } from '../api/hooks'
import type { DocType, Team } from '../types'
import { STAGES } from '../rules/pipeline'
import { ago, fmtDate } from '../components/format'
import { Avatar, ErrorBox, Loading } from '../components/ui'
import { Section, SimplePage, StatusLine } from './parts'
import { projectStatus } from './ProjectsPage'
import { useTodo } from './todo'
import { docStatusText, STEP_NAME, waited } from './words'

/** The head of each team, in the order they approve. */
const HEADS: [Team, string][] = [
  ['PM', 'Project Manager'],
  ['TECH', 'Tech head'],
  ['STAKEHOLDER', 'Stakeholder head'],
  ['SPONSOR', 'Sponsor head (signs)'],
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

  return (
    <SimplePage title="Overview" subtitle={`Your role: ${summary.myRole}`} wide>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0 space-y-9">
          {p.status === 'archived' && <StatusLine tone="done">This project is archived. You can read everything, but nothing can be changed.</StatusLine>}

          {/* Everything waiting for you in this project, each with its button */}
          {p.status !== 'archived' && (
            <Section title={mine.length ? `Your tasks here (${mine.length})` : 'Your tasks here'}>
              {mine.length ? (
                <ul className="shadow-soft divide-y divide-line overflow-hidden rounded-2xl">
                  {mine.map((it, i) => (
                    <li key={it.key}>
                      <Link to={it.to} className="group flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 transition hover:bg-ink/[0.025] dark:hover:bg-white/[0.03]">
                        <span className="min-w-0 flex-1">
                          <span className="block text-lg leading-snug font-medium">{it.title}</span>
                          {it.since && <span className="mt-0.5 block text-sm text-muted">Waiting {waited(it.since, now)}{it.coveringFor ? ` · for ${it.coveringFor}, who is away` : ''}</span>}
                        </span>
                        <span className={clsx('inline-flex h-10 items-center rounded-full px-5 text-base font-medium transition', i === 0 ? 'glass-tint text-white group-hover:brightness-110' : 'glass-control')}>{it.button}</span>
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
            </Section>
          )}

          {/* The six steps as a timeline: done, now (with what is happening), later */}
          <Section title="Progress">
            <ol className="relative">
              {steps.map((st, i) => (
                <li key={st.key} className="relative flex gap-4 pb-6 last:pb-0">
                  {i < steps.length - 1 && <span className={clsx('absolute top-7 bottom-0 left-[13px] w-0.5', st.state === 'done' ? 'bg-leaf/50' : 'bg-line')} aria-hidden />}
                  <span
                    className={clsx(
                      'relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums',
                      st.state === 'done' ? 'bg-leaf text-white' : st.state === 'now' ? 'bg-brand text-white ring-4 ring-brand/15' : 'bg-paper text-muted ring-1 ring-line',
                    )}
                  >
                    {st.state === 'done' ? <Check className="h-4 w-4" /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className={clsx('text-lg leading-snug', st.state === 'later' ? 'text-muted' : 'font-medium')}>
                      {st.name}
                      {st.state === 'now' && <span className="ml-2 rounded-md bg-brand-soft px-2 py-0.5 align-middle text-xs font-semibold tracking-[0.04em] text-brand uppercase">Now</span>}
                    </div>
                    {st.text && <div className={clsx('mt-0.5 text-base', st.state === 'now' ? 'text-ink' : 'text-muted')}>{st.text}</div>}
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          {/* What happened lately (the full log is under More → Activity log) */}
          {data.recent.length > 0 && (
            <Section title="Recent activity">
              <ul className="space-y-3">
                {data.recent.map((a) => (
                  <li key={a.id} className="flex items-start gap-3">
                    <Avatar name={a.actorName} id={a.actorName} size={28} />
                    <div className="min-w-0 flex-1 text-base leading-snug">
                      <span className="font-medium">{a.actorName}</span> <span className="text-muted">· {a.action.toLowerCase()}</span>
                      {a.details && <div className="truncate text-sm text-muted">{a.details}</div>}
                    </div>
                    <span className="shrink-0 text-sm whitespace-nowrap text-muted">{ago(a.createdAt, now)}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        {/* About this project: what it is, who leads it and when it started */}
        <aside className="min-w-0 space-y-5 lg:border-l lg:border-line lg:pl-8">
          <section>
            <h2 className="text-base font-semibold">About</h2>
            <p className="mt-2 text-base leading-relaxed text-muted">{p.description || p.intake.description?.slice(0, 220) || 'No description yet.'}</p>
          </section>
          <dl className="space-y-3 text-[15px]">
            <div>
              <dt className="text-sm text-muted">Project Owner</dt>
              <dd className="mt-1 flex items-center gap-2 font-medium">
                <Avatar name={data.ownerName} id={p.ownerId} size={24} /> {data.ownerName}
              </dd>
            </div>
            {HEADS.map(([team, label]) => {
              const head = data.members.find((m) => m.member.team === team && m.member.isHead)
              return (
                <div key={team}>
                  <dt className="text-sm text-muted">{label}</dt>
                  <dd className="mt-1 flex items-center gap-2 font-medium">
                    {head ? (
                      <>
                        <Avatar name={head.name} id={head.member.userId} size={24} /> {head.name}
                        {head.away && <span className="rounded bg-amber-50 px-1.5 text-xs font-medium text-amber-800">away</span>}
                      </>
                    ) : (
                      <span className="font-normal text-muted">Not added yet</span>
                    )}
                  </dd>
                </div>
              )
            })}
            <div>
              <dt className="text-sm text-muted">Started</dt>
              <dd className="mt-1 font-medium">{fmtDate(p.createdAt)}</dd>
            </div>
          </dl>
          <Link to={`/projects/${pid}/team`} className="inline-flex items-center gap-2 text-[15px] font-medium text-brand hover:underline">
            <Users className="h-4 w-4" /> Whole team ({people} people)
          </Link>
        </aside>
      </div>
    </SimplePage>
  )
}
