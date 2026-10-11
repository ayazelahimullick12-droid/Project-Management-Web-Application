/**
 * My work: everything waiting on me in one place (idea from Asana's My Tasks):
 * approvals and sign-offs, Q/A questions (SPEC.md "My questions") and assigned tests
 * (SPEC_SQA_UAT.md "My tests").
 */
import { ArrowRight, CircleCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useApi, useNow, useSessionUserId } from '../api/hooks'
import { duration } from '../components/format'
import { Loading, Segmented, useTab } from '../components/ui'
import { groupTasks } from './DashboardPage'
import { MyQuestionsPage } from './MyQuestionsPage'
import { MyTestsPage } from './MyTestsPage'

export function MyWorkPage() {
  const now = useNow()
  const uid = useSessionUserId()
  const [tab, setTab] = useTab('all')
  const { data, isLoading } = useApi(['dashboard'], api.projects.dashboard)
  const { data: questions } = useApi(['my-questions'], api.intake.myQuestions)
  const { data: tests } = useApi(['my-tests'], api.testing.myTests)
  if (isLoading || !data) return <Loading />
  const qOpen = (questions ?? []).filter((q) => q.open).length
  const tOpen = (tests ?? []).filter((e) => e.result === 'not_run').length
  return (
    <div>
      <h1 className="page-title text-2xl">My work</h1>
      <p className="mt-1 mb-5 text-sm text-muted">Everything waiting on you. Items are reminded every 4 working hours until they are done.</p>
      <div className="mb-5">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { id: 'all', label: `Everything (${data.myTasks.length})` },
            { id: 'questions', label: `Q/A questions (${qOpen})` },
            { id: 'tests', label: `Tests (${tOpen})` },
          ]}
        />
      </div>
      {tab === 'all' &&
        (data.myTasks.length ? (
          <ul className="divide-y divide-line/70 overflow-hidden shadow-soft rounded-2xl border border-line/70 bg-surface">
            {groupTasks(data.myTasks).map((t) => (
              <li key={t.key}>
                <Link to={t.link === '/inbox/questions' ? '/my-work?tab=questions' : t.link === '/inbox/tests' ? '/my-work?tab=tests' : t.link} className="flex items-center gap-3 px-4 py-3 hover:bg-canvas">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-brand" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{t.title}</div>
                    <div className="truncate text-xs text-muted">
                      {t.projectName}
                      {t.recipients.find((r) => r.to === uid && r.forUserId) && ' · you are covering for an Away head'}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-muted">waiting {duration(now.getTime() - new Date(t.since).getTime())}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-2 shadow-soft rounded-2xl border border-line/70 bg-surface px-4 py-4 text-sm text-muted">
            <CircleCheck className="h-4 w-4 text-leaf" /> You are all caught up.
          </div>
        ))}
      {tab === 'questions' && <MyQuestionsPage embedded />}
      {tab === 'tests' && <MyTestsPage embedded />}
    </div>
  )
}
