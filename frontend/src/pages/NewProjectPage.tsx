/**
 * New project wizard: details → PM → teams, heads and deputies → invite.
 * SPEC.md "Project setup". The person creating the project becomes its Owner.
 */
import { Check } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import type { Member } from '../types'
import { api } from '../api'
import { useAction, useApi } from '../api/hooks'
import { validateTeam } from '../api/projects'
import { HEAD_LABEL, TEAM_LABEL } from '../rules/permissions'
import { OpenQuestion } from '../components/OpenQuestion'
import { Button, Card, Field, Input, Note, PageHeader, Select, Textarea } from '../components/ui'
import { TeamEditor } from './TeamEditor'

const STEPS = ['Details', 'Project Manager', 'Teams and heads', 'Review and invite']

export function NewProjectPage() {
  const navigate = useNavigate()
  const { data: users } = useApi(['users'], api.projects.users)
  const { data: templates } = useApi(['team-templates'], api.projects.teamTemplates)
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const create = useAction(api.projects.createProject, { success: 'Project created. Invitations sent in-app and by email.', onDone: (id) => navigate(`/projects/${id}`) })
  const pm = members.find((m) => m.team === 'PM' && m.isHead)
  const problems = validateTeam(members)
  const name_ = (id: string) => users?.find((u) => u.id === id)?.name ?? id

  const setPm = (id: string) => {
    const rest = members.filter((m) => !(m.team === 'PM' && m.isHead) && m.userId !== id)
    setMembers(id ? [{ userId: id, team: 'PM', isHead: true }, ...rest] : rest)
  }

  return (
    <div>
      <PageHeader title="New project" subtitle="You will be the Project Owner: you set up the team now and can change anyone later." actions={<OpenQuestion id="owner-member" />} />
      <ol className="mb-6 flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className={clsx('flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium', i === step ? 'bg-brand text-white' : i < step ? 'bg-leaf-soft text-leaf' : 'bg-surface text-muted ring-1 ring-line')}>
            {i < step ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>} {s}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <Card className="max-w-2xl">
          <Field label="Project name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mobile Savings Collection" autoFocus />
          </Field>
          <Field label="Short description" hint="One or two sentences. The stakeholders will write the full request on the Intake page.">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <div className="flex justify-end">
            <Button variant="primary" disabled={!name.trim()} onClick={() => setStep(1)}>
              Next
            </Button>
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card className="max-w-2xl">
          <Field label="Project Manager" hint="The PM is the head of the PM team and the first approver of every document.">
            <Select value={pm?.userId ?? ''} onChange={(e) => setPm(e.target.value)}>
              <option value="">Choose the PM…</option>
              {users?.filter((u) => !u.deactivated).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} — {u.title}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex justify-between">
            <Button onClick={() => setStep(0)}>Back</Button>
            <Button variant="primary" disabled={!pm} onClick={() => setStep(2)}>
              Next
            </Button>
          </div>
        </Card>
      )}

      {step === 2 && users && (
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted">Load a saved team template:</span>
            {templates?.map((t) => (
              <Button key={t.id} size="sm" onClick={() => setMembers(structuredClone(t.members))}>
                {t.name}
              </Button>
            ))}
            {!templates?.length && <span className="text-xs text-muted">none yet</span>}
          </div>
          <TeamEditor members={members} onChange={setMembers} users={users} />
          {problems.length > 0 && (
            <Note tone="amber" className="mt-4">
              Before continuing: {problems.join(' ')}
            </Note>
          )}
          <div className="mt-4 flex justify-between">
            <Button onClick={() => setStep(1)}>Back</Button>
            <Button variant="primary" disabled={problems.length > 0} onClick={() => setStep(3)}>
              Next
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <Card className="max-w-3xl" title="Review and invite">
          <div className="mb-4">
            <div className="text-lg font-semibold">{name}</div>
            <div className="text-sm text-muted">{description}</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(['PM', 'TECH', 'STAKEHOLDER', 'SPONSOR'] as const).map((team) => (
              <div key={team} className="rounded-md bg-canvas p-3 text-sm">
                <div className="mb-1 font-medium">{TEAM_LABEL[team]}</div>
                {members
                  .filter((m) => m.team === team)
                  .map((m) => (
                    <div key={m.userId} className="text-xs">
                      {name_(m.userId)} {m.isHead && <b>· {HEAD_LABEL[team]}</b>} {m.isDeputy && '· deputy'} {m.isSqa && '· SQA'}
                    </div>
                  ))}
              </div>
            ))}
          </div>
          <Note tone="blue" className="mt-4">
            Every member gets an in-app notification and an email (see the Mailbox). The project then appears on the dashboard at stage <b>Intake</b>.
          </Note>
          <div className="mt-4 flex justify-between">
            <Button onClick={() => setStep(2)}>Back</Button>
            <Button variant="primary" disabled={create.pending || problems.length > 0} onClick={() => create.run({ name, description, members })}>
              Create project and send invitations
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
