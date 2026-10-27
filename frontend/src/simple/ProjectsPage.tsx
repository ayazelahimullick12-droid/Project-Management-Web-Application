/** Simple view · Projects: the projects you are part of, each with your role and one status sentence. */
import { Archive, Plus } from 'lucide-react'
import { useNow } from '../api/hooks'
import type { ProjectSummary } from '../api/projects'
import { STAGES } from '../rules/pipeline'
import { LinkButton, Loading, ProjectIcon } from '../components/ui'
import { Row, Rows, SimplePage } from './parts'
import { plainStep, useTodo, type TodoItem } from './todo'
import { STEP_NAME, waited, type Tone } from './words'

/** Where a project stands for this person: their turn, or who it is waiting for. */
export function projectStatus(s: ProjectSummary, mine: TodoItem[], now: Date): { tone: Tone; text: string } {
  if (mine.length) return { tone: 'action', text: `Your turn: ${mine[0].title}${mine.length > 1 ? ` (and ${mine.length - 1} more)` : ''}` }
  if (s.next.tone === 'done') return { tone: 'done', text: plainStep(s.next.title) }
  if (s.next.waitingOnName) return { tone: 'waiting', text: `Waiting for ${s.next.waitingOnName}${s.next.coveringName ? ` (away; ${s.next.coveringName} is covering)` : ''}${s.next.since ? ` · ${waited(s.next.since, now)}` : ''}` }
  return { tone: s.next.tone === 'problem' ? 'problem' : 'waiting', text: plainStep(s.next.title) }
}

export function stepText(stage: ProjectSummary['stage']) {
  return stage === 'COMPLETE' ? 'Finished' : `Step ${STAGES.indexOf(stage) + 1} of ${STAGES.length}: ${STEP_NAME[stage]}`
}

export function ProjectsPage() {
  const now = useNow()
  const { items, dash, isLoading } = useTodo()
  if (isLoading || !dash) return <Loading />
  const past = dash.archived.length + dash.finished.length
  return (
    <SimplePage title="Projects" subtitle="The projects you are part of.">
      <Rows>
        {dash.active.map((s) => {
          const st = projectStatus(s, items.filter((i) => i.projectId === s.project.id), now)
          return (
            <Row
              key={s.project.id}
              to={`/projects/${s.project.id}`}
              icon={<ProjectIcon id={s.project.id} name={s.project.name} size={44} />}
              title={s.project.name}
              subtitle={
                <>
                  <span className="block">Your role: {s.myRole} · {stepText(s.stage)}</span>
                  <span className={st.tone === 'action' ? 'block font-medium text-brand' : 'block'}>{st.text}</span>
                </>
              }
            />
          )
        })}
        {!dash.active.length && <p className="text-lg text-muted">You are not part of any active project yet.</p>}
      </Rows>
      <div className="flex flex-wrap gap-3">
        <LinkButton to="/projects/new" size="lg">
          <Plus className="h-5 w-5" /> Start a new project
        </LinkButton>
        {past > 0 && (
          <LinkButton to="/archive" size="lg" variant="ghost">
            <Archive className="h-5 w-5" /> Finished and archived ({past})
          </LinkButton>
        )}
      </div>
    </SimplePage>
  )
}
