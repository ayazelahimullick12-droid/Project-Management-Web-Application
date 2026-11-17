/**
 * Simple view · one project's overview: your next step, the documents so far and the other areas
 * that matter at this stage, with an "About" panel on the right (people and dates), as in GitHub's
 * repository page. The project name, the step and the tabs are in the project header above
 * (ProjectNav.tsx); team, changes and the activity log are under its More tab.
 */
import { clsx } from 'clsx'
import { ClipboardList, FlaskConical, Gavel, MessageCircle, Users } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { useApi, useNow, useSessionUserId } from '../api/hooks'
import type { DocType, Team } from '../types'
import { STAGES } from '../rules/pipeline'
import { fmtDate } from '../components/format'
import { Avatar, ErrorBox, LinkButton, Loading } from '../components/ui'
import { NextStep, Row, Rows, Section, SimplePage, StatusLine, ToneIcon } from './parts'
import { projectStatus, stepText } from './ProjectsPage'
import { useTodo } from './todo'
import { DOC_NAME, docStatusText, docTone, waited } from './words'

function StepBar({ stage }: { stage: (typeof STAGES)[number] }) {
  const at = STAGES.indexOf(stage)
  return (
    <div>
      <div className="text-lg font-medium">{stepText(stage)}</div>
      <div className="mt-2 flex gap-1" aria-hidden>
        {STAGES.map((s, i) => (
          <span key={s} className={clsx('h-2 flex-1 rounded-full', stage === 'COMPLETE' || i < at ? 'bg-leaf' : i === at ? 'bg-brand' : 'bg-ink/10')} />
        ))}
      </div>
    </div>
  )
}

/** The head of each team, in the order they approve. */
const HEADS: [Team, string][] = [
  ['PM', 'Project Manager'],
  ['TECH', 'Tech head'],
  ['STAKEHOLDER', 'Stakeholder head'],
  ['SPONSOR', 'Sponsor head (signs)'],
]

export function SimpleProjectPage() {
  const { pid = '' } = useParams()
  const now = useNow()
  const uid = useSessionUserId()
  const { data, isLoading, error } = useApi(['project', pid], () => api.projects.getProject(pid))
  const { items } = useTodo()
  const { data: chats } = useApi(['conversations', uid], api.chat.conversations, !!uid)
  if (isLoading) return <Loading />
  if (error || !data) return <ErrorBox error={error} />

  const { summary } = data
  const p = summary.project
  const mine = items.filter((i) => i.projectId === pid)
  const status = projectStatus(summary, mine, now)
  const nameOf = (id?: string) => data.members.find((m) => m.member.userId === id)?.name ?? 'someone'
  const myTeam = data.members.find((m) => m.member.userId === uid)?.member.team
  const stageDoc: Record<string, DocType> = { PROPOSAL: 'PROPOSAL', BRD: 'BRD', SRS: 'SRS', SQA: 'SQA_SIGNOFF', UAT: 'UAT_SIGNOFF' }
  const docs = summary.docs.filter((d) => d.status.key !== 'not_started' || stageDoc[summary.stage] === d.type)
  const later = summary.docs.filter((d) => !docs.includes(d))
  const docLink = (type: DocType) => (type.endsWith('SIGNOFF') ? `/projects/${pid}/testing/${type === 'SQA_SIGNOFF' ? 'SQA' : 'UAT'}?tab=signoff` : `/projects/${pid}/docs/${type}`)
  const testingStage = summary.stage === 'SQA' || summary.stage === 'UAT' ? summary.stage : summary.stage === 'COMPLETE' ? 'UAT' : undefined
  const showIntake = summary.stage === 'INTAKE' || summary.unansweredQuestions > 0
  const chatUnread = chats?.channels.find((c) => c.id === `${pid}-chat`)?.unread ?? 0
  const decisions = summary.pendingDecisions + summary.openChangeRequests
  const people = new Set(data.members.map((m) => m.member.userId)).size

  const testingLine = (t: (typeof data.testing)['SQA']) => `${t.status}${t.points && t.version ? ` · version ${t.version}: ${t.passed} of ${t.points} points passed${t.failed ? `, ${t.failed} failed` : ''}` : ''}`

  return (
    <SimplePage title="Overview" subtitle={`Your role: ${summary.myRole}`} wide>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0 space-y-8">
          <div className="md:hidden">
            <StepBar stage={summary.stage} />
          </div>

          {p.status === 'archived' ? (
            <StatusLine tone="done">This project is archived. You can read everything, but nothing can be changed.</StatusLine>
          ) : mine.length ? (
            <NextStep
              title="Your turn"
              actions={
                <LinkButton to={mine[0].to} variant="primary" size="lg">
                  {mine[0].button}
                </LinkButton>
              }
            >
              {mine[0].title}
              {mine.length > 1 && <div className="mt-1 text-base text-muted">and {mine.length - 1} more thing{mine.length > 2 ? 's' : ''} in your To do list</div>}
            </NextStep>
          ) : (
            <StatusLine tone={status.tone}>
              <div>{status.tone === 'done' ? status.text : 'Nothing for you to do right now.'}</div>
              {status.tone !== 'done' && <div className="text-base text-muted">{status.text}</div>}
            </StatusLine>
          )}

          <Section title="Documents">
            <Rows>
              {docs.map((d) => (
                <Row
                  key={d.type}
                  to={docLink(d.type)}
                  icon={<ToneIcon tone={docTone(d.status)} />}
                  title={DOC_NAME[d.type]}
                  subtitle={`${docStatusText(d.status, nameOf)}${d.status.key === 'in_review' && d.status.since ? ` · ${waited(d.status.since, now)}` : ''}`}
                />
              ))}
            </Rows>
            {later.length > 0 && <p className="mt-3 text-base text-muted">Later: {later.map((d) => DOC_NAME[d.type]).join(', ')}.</p>}
          </Section>

          {(showIntake || testingStage || decisions > 0 || chatUnread > 0) && (
            <Section title="Also needs attention">
              <Rows>
                {showIntake && (
                  <Row
                    to={`/projects/${pid}/intake`}
                    icon={<ClipboardList className="h-6 w-6 text-muted" />}
                    title={summary.stage === 'INTAKE' && myTeam === 'STAKEHOLDER' ? 'Describe what you need' : 'Questions and project facts'}
                    subtitle={summary.unansweredQuestions ? `${summary.unansweredQuestions} question${summary.unansweredQuestions > 1 ? 's' : ''} waiting for answers` : 'What the project needs to know, and the answers so far'}
                  />
                )}
                {testingStage && (
                  <Row to={`/projects/${pid}/testing/${testingStage}`} icon={<FlaskConical className="h-6 w-6 text-muted" />} title={testingStage === 'SQA' ? 'Technical testing' : 'User testing'} subtitle={testingLine(data.testing[testingStage])} />
                )}
                {decisions > 0 && <Row to={`/projects/${pid}/changes`} icon={<Gavel className="h-6 w-6 text-muted" />} title="Changes and decisions" subtitle={`${decisions} waiting`} />}
                {chatUnread > 0 && <Row to={`/messages/${pid}-chat`} icon={<MessageCircle className="h-6 w-6 text-muted" />} title="Team chat" subtitle={`${chatUnread} new message${chatUnread > 1 ? 's' : ''}`} right="Read" />}
              </Rows>
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
