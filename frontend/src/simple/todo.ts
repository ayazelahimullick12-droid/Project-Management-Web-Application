/**
 * Everything the signed-in person needs to do, as plain sentences with one button each.
 * Used by the To do page and the count in the top bar.
 *
 * Two sources:
 * 1. Items waiting on this person (approvals, questions, tests, defects…), from the dashboard.
 * 2. A project's next step when it belongs to this person's team (for example "Write the
 *    Proposal with AI" for the PM team, or "Describe what you need" for stakeholders).
 */
import { useMemo } from 'react'
import { api } from '../api'
import { useApi, useSessionUserId } from '../api/hooks'
import { groupTasks } from '../pages/DashboardPage'
import { plainTask } from './words'

export interface TodoItem {
  key: string
  title: string
  button: string
  to: string
  projectId: string
  projectName: string
  since?: string
  coveringFor?: string // "for Rokeya Begum (away)"
}

/** Next-step titles from the project summary, in plain words. */
export function plainStep(title: string): string {
  return title
    .replace(/^Generate the (.+)$/, 'Write the $1 with AI')
    .replace(/^PM team updates the (.+)$/, 'Update the $1 (changes were asked for)')
    .replace(/^Business processes Q\/A round$/, 'Ask the stakeholders how the work is done')
    .replace(/^Technical Q\/A round \(tech team\)$/, 'Ask the tech team the technical questions')
    .replace(/^Settle (\d+) conflicting facts?$/, 'Choose the right value where answers disagree')
    .replace(/^Complete the Fact Sheet$/, 'Complete the project facts')
    .replace(/^All questions answered: close the round$/, 'All questions are answered: close the round')
    .replace(/^Stakeholders describe what they need$/, 'Describe what you need')
    .replace(/^Run the intake analysis$/, 'Let the AI read the request and files')
    .replace(/Q\/A/g, 'question')
}

export function useTodo() {
  const uid = useSessionUserId()
  const { data: dash, isLoading } = useApi(['dashboard'], api.projects.dashboard, !!uid)
  const items = useMemo<TodoItem[]>(() => {
    if (!dash || !uid) return []
    const out: TodoItem[] = groupTasks(dash.myTasks).map((t) => {
      const covering = t.recipients.find((r) => r.to === uid && r.forUserId)
      return { key: t.key, ...plainTask(t), projectId: t.projectId, projectName: t.projectName, since: t.since, coveringFor: covering ? t.waitingOnName : undefined }
    })
    for (const s of dash.active) {
      const step = s.next
      if (step.tone !== 'action' && step.tone !== 'problem') continue
      const m = s.project.members.find((x) => x.userId === uid)
      if (!m) continue
      const testing = s.stage === 'SQA' || s.stage === 'UAT'
      let mine: boolean
      if (step.title.startsWith('Stakeholders describe')) mine = m.team === 'STAKEHOLDER'
      else if (testing) mine = step.title.startsWith('Prepare') && (s.stage === 'SQA' ? !!m.isSqa : m.team === 'PM')
      else mine = m.team === 'PM'
      if (mine) out.push({ key: `next:${s.project.id}`, title: plainStep(step.title), button: step.action?.startsWith('Open') ? 'Open' : step.action ?? 'Open', to: step.link, projectId: s.project.id, projectName: s.project.name, since: step.since })
    }
    // Longest waiting first; items without a date at the end.
    return out.sort((a, b) => (a.since ?? '9').localeCompare(b.since ?? '9'))
  }, [dash, uid])
  return { items, dash, isLoading }
}
