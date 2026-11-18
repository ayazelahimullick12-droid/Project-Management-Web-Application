/** Simple view · Projects: the projects you are part of, each with your role and one status sentence. */
import { Archive, ChevronRight, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import { useNow } from '../api/hooks'
import type { ProjectSummary } from '../api/projects'
import { STAGES } from '../rules/pipeline'
import { LinkButton, Loading, ProjectIcon } from '../components/ui'
import { SimplePage } from './parts'
import { plainStep, useTodo, type TodoItem } from './todo'
import { STEP_NAME, waited, type Tone } from './words'

/** Column layout of the project list (the header and every row use it, so they line up). */
const COLS = 'md:grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,13rem)_minmax(0,1fr)_1.25rem] md:items-center md:gap-5'

/** "Step 3 of 7" as a thin bar with the step name under it. */
function StepBar({ stage }: { stage: ProjectSummary['stage'] }) {
  const done = stage === 'COMPLETE' ? STAGES.length : STAGES.indexOf(stage) + 1
  return (
    <span className="block min-w-0">
      <span className="flex gap-0.5" aria-hidden>
        {STAGES.map((st, i) => (
          <span key={st} className={clsx('h-1.5 flex-1 rounded-full', i < done ? 'bg-brand' : 'bg-ink/10 dark:bg-white/12')} />
        ))}
      </span>
      <span className="mt-1.5 block text-sm text-muted">{stepText(stage)}</span>
    </span>
  )
}

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
    <SimplePage wide title="Projects" subtitle="The projects you are part of.">
      {dash.active.length ? (
        <div className="shadow-soft overflow-hidden rounded-2xl">
          <div className={clsx('hidden border-b border-line px-5 py-2.5 text-xs font-semibold text-muted', COLS)}>
            <span>Project</span>
            <span>Progress</span>
            <span>Status</span>
            <span />
          </div>
          <ul className="divide-y divide-line">
            {dash.active.map((s) => {
              const st = projectStatus(s, items.filter((i) => i.projectId === s.project.id), now)
              return (
                <li key={s.project.id}>
                  <Link to={`/projects/${s.project.id}`} className={clsx('flex flex-col gap-3 px-5 py-4 transition hover:bg-ink/[0.025] dark:hover:bg-white/[0.03]', COLS)}>
                    <span className="flex min-w-0 items-center gap-3">
                      <ProjectIcon id={s.project.id} name={s.project.name} size={36} />
                      <span className="min-w-0">
                        <span className="block text-lg leading-snug font-semibold">{s.project.name}</span>
                        <span className="block text-sm text-muted">Your role: {s.myRole}</span>
                      </span>
                    </span>
                    <StepBar stage={s.stage} />
                    <span className={clsx('text-base leading-snug', st.tone === 'action' ? 'font-medium text-brand' : 'text-muted')}>{st.text}</span>
                    <ChevronRight className="hidden h-5 w-5 text-muted md:block" />
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <p className="text-lg text-muted">You are not part of any active project yet.</p>
      )}
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
