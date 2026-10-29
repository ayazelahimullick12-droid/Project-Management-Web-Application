/**
 * Simple view · one project: where it stands, your next step, the documents so far, and only the
 * other areas that matter at this stage. Team, changes, decisions and the activity log are under More.
 */
import { clsx } from 'clsx'
import { ClipboardList, FlaskConical, Gavel, History, MessageCircle, Users } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { api } from '../api'
import { useApi, useNow, useSessionUserId } from '../api/hooks'
import type { DocType } from '../types'
import { STAGES } from '../rules/pipeline'
import { ErrorBox, LinkButton, Loading } from '../components/ui'
import { More, NextStep, Row, Rows, Section, SimplePage, StatusLine, ToneIcon } from './parts'
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

  const intakeRow = (
    <Row
      to={`/projects/${pid}/intake`}
      icon={<ClipboardList className="h-6 w-6 text-muted" />}
      title={summary.stage === 'INTAKE' && myTeam === 'STAKEHOLDER' ? 'Describe what you need' : 'Questions and project facts'}
      subtitle={summary.unansweredQuestions ? `${summary.unansweredQuestions} question${summary.unansweredQuestions > 1 ? 's' : ''} waiting for answers` : 'What the project needs to know, and the answers so far'}
    />
  )
  const testingRow = testingStage && (
    <Row
      to={`/projects/${pid}/testing/${testingStage}`}
      icon={<FlaskConical className="h-6 w-6 text-muted" />}
      title={testingStage === 'SQA' ? 'Technical testing' : 'User testing'}
      subtitle={`${data.testing[testingStage].status}${data.testing[testingStage].tests ? ` · ${data.testing[testingStage].passed} of ${data.testing[testingStage].tests} tests passing · ${data.testing[testingStage].defectsOpen} problems open` : ''}`}
    />
  )

  return (
    <SimplePage back={{ to: '/projects', label: 'All projects' }} title={p.name} subtitle={`Your role: ${summary.myRole}`}>
      <StepBar stage={summary.stage} />

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

      <Section title="Also in this project">
        <Rows>
          {showIntake && intakeRow}
          {testingRow}
          <Row
            to={`/messages/${pid}-chat`}
            icon={<MessageCircle className="h-6 w-6 text-muted" />}
            title="Team chat"
            subtitle={chatUnread ? `${chatUnread} new message${chatUnread > 1 ? 's' : ''}` : 'Talk with everyone on the project'}
            right={chatUnread ? 'Read' : undefined}
          />
        </Rows>
      </Section>

      <More>
        <Rows>
          {!showIntake && intakeRow}
          <Row to={`/projects/${pid}/team`} icon={<Users className="h-6 w-6 text-muted" />} title="Team" subtitle={`Who is on the project · Owner: ${data.ownerName}`} />
          <Row to={`/projects/${pid}/changes`} icon={<Gavel className="h-6 w-6 text-muted" />} title="Changes and decisions" subtitle={decisions ? `${decisions} waiting` : 'Scope changes and decisions made in meetings and chat'} />
          <Row to={`/projects/${pid}/audit`} icon={<History className="h-6 w-6 text-muted" />} title="Activity log" subtitle="Everything that happened, by whom and when" />
        </Rows>
      </More>
    </SimplePage>
  )
}
