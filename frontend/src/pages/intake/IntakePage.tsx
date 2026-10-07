/**
 * Intake: what the stakeholders want, the Q/A agent's questions, the Fact Sheet and
 * (PM team only) similar past projects. SPEC.md "Q/A agent and the Project Fact Sheet", "RAG agent".
 */
import { useParams } from 'react-router-dom'
import { api } from '../../api'
import { useApi } from '../../api/hooks'
import { ErrorBox, Loading, PageHeader, Tabs, useTab } from '../../components/ui'
import { OverviewTab } from './OverviewTab'
import { QuestionsTab } from './QuestionsTab'
import { FactsTab } from './FactsTab'
import { RagTab } from './RagTab'

export type IntakeData = Awaited<ReturnType<typeof api.intake.getIntake>>

export function IntakePage() {
  const { pid = '' } = useParams()
  const [tab, setTab] = useTab('overview')
  const { data, isLoading, error } = useApi(['intake', pid], () => api.intake.getIntake(pid))
  if (isLoading) return <Loading />
  if (error || !data) return <ErrorBox error={error} />
  const openQ = data.questions.filter((q) => !q.answeredAt && data.openRounds.some((r) => r.id === q.roundId)).length
  return (
    <div>
      <PageHeader
        eyebrow={data.project.name}
        title="Intake and Fact Sheet"
        subtitle="Everything people provide becomes a confirmed Project Fact Sheet: the single source of truth every document is generated from."
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Description and files' },
          { id: 'questions', label: `Q/A questions${openQ ? ` (${openQ} open)` : ''}` },
          { id: 'facts', label: `Fact Sheet${data.conflicts.length ? ` · ${data.conflicts.length} conflict${data.conflicts.length > 1 ? 's' : ''}` : ''}` },
          { id: 'rag', label: 'Similar projects (PM team)', hidden: !data.perms.pmTeam },
        ]}
      />
      {tab === 'overview' && <OverviewTab data={data} goTo={setTab} />}
      {tab === 'questions' && <QuestionsTab data={data} />}
      {tab === 'facts' && <FactsTab data={data} />}
      {tab === 'rag' && data.perms.pmTeam && <RagTab data={data} />}
    </div>
  )
}
