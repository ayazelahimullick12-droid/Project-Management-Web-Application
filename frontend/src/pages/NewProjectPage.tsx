/**
 * Starting a project. One person is enough: whoever starts it becomes the Project Owner and the
 * Project Manager. Adding other people now is optional; the app asks for them when a step needs
 * them (questions, approvals, testing). They can also be added from the Team page at any time.
 */
import { ChevronDown, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import type { Member } from '../types'
import { api } from '../api'
import { useAction, useApi, useSessionUserId } from '../api/hooks'
import { validateTeam } from '../api/projects'
import { teamWarnings } from '../rules/permissions'
import { Button, Card, Field, Input, Note, PageHeader, Textarea } from '../components/ui'
import { TeamEditor } from './TeamEditor'

export function NewProjectPage() {
  const navigate = useNavigate()
  const uid = useSessionUserId()
  const { data: users } = useApi(['users'], api.projects.users)
  const { data: templates } = useApi(['team-templates'], api.projects.teamTemplates)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [withPeople, setWithPeople] = useState(false)
  const create = useAction(api.projects.createProject, { success: 'Project started. You are its Owner and Project Manager.', onDone: (id) => navigate(`/projects/${id}`) })
  const me = users?.find((u) => u.id === uid)
  // The starter is always the PM; anyone else chosen here joins too.
  const others = members.filter((m) => !(m.userId === uid && m.team === 'PM'))
  const problems = validateTeam(others)
  const warnings = teamWarnings([{ userId: uid ?? '', team: 'PM', isHead: true }, ...others])
  const nameOf = (id: string) => users?.find((u) => u.id === id)?.name ?? id

  return (
    <div className="max-w-3xl">
      <PageHeader title="Start a project" subtitle="You only need a name to start. Other people can join now or later." />
      <Card>
        <Field label="Project name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mobile Savings Collection" autoFocus />
        </Field>
        <Field label="Short description" hint="One or two sentences. The full request is written on the Intake page.">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Note tone="blue" icon={<UserRound className="h-4 w-4" />}>
          You ({me?.name}) will be the <b>Project Owner</b> and the <b>Project Manager</b>. When a step needs someone else (stakeholders to answer questions, heads to approve, testers), the app asks you to add them. You can hand the PM role to someone else later.
        </Note>

        <button type="button" onClick={() => setWithPeople(!withPeople)} className="mt-4 flex items-center gap-2 text-sm font-medium text-brand">
          <ChevronDown className={clsx('h-4 w-4 transition', !withPeople && '-rotate-90')} /> Add people now (optional)
        </button>
        {withPeople && users && (
          <div className="mt-3">
            {!!templates?.length && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted">Load a saved team:</span>
                {templates.map((t) => (
                  <Button key={t.id} size="sm" onClick={() => setMembers(structuredClone(t.members).map((m) => (m.team === 'PM' ? { ...m, isHead: false } : m)))}>
                    {t.name}
                  </Button>
                ))}
              </div>
            )}
            <TeamEditor members={others} onChange={setMembers} users={users} starterId={uid ?? undefined} />
          </div>
        )}
        {problems.length > 0 && (
          <Note tone="red" className="mt-4">
            Before starting: {problems.join(' ')}
          </Note>
        )}
        {warnings.length > 0 && (
          <Note tone="amber" className="mt-4">
            {warnings.map((w) => (
              <div key={w.userId}>
                {nameOf(w.userId)} would have several roles ({w.roles.join(', ')}). They would approve more than once, and could approve their own work.
              </div>
            ))}
          </Note>
        )}
        <div className="mt-5 flex justify-end">
          <Button variant="primary" disabled={!name.trim() || problems.length > 0 || create.pending} onClick={() => create.run({ name, description, members: others })}>
            Start the project
          </Button>
        </div>
      </Card>
    </div>
  )
}
