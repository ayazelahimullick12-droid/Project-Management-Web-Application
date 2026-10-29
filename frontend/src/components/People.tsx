/**
 * Adding people when a step needs them (a project can start with one person).
 *
 * MissingPeople: "Before this can be sent for approval, add a tech head and a sponsor head",
 * with one "Add …" button per missing person (for the Owner and the PM; others are told who to ask).
 * AddPersonModal: pick someone from the user directory and add them in the right role. Someone who
 * already has a role in the project can be added again (several roles are allowed), with a warning.
 */
import { clsx } from 'clsx'
import { TriangleAlert, UserPlus } from 'lucide-react'
import { useState } from 'react'
import type { Team } from '../types'
import { api } from '../api'
import type { NewRole } from '../api/projects'
import { useAction, useApi } from '../api/hooks'
import { HEAD_LABEL, TEAM_LABEL } from '../rules/permissions'
import type { MissingRole } from '../rules/people'
import { Button, Field, Modal, Note, Select } from './ui'

export interface RoleToAdd {
  team: Team
  role?: NewRole // fixed role; when left out, the dialog lets you choose
  label?: string // "a tech head"
}

function roleFromMissing(m: MissingRole): RoleToAdd {
  return { team: m.team, role: m.head ? 'head' : m.sqa ? 'sqa' : 'member', label: m.label }
}

const ROLE_NAME = (team: Team, role: NewRole) => (role === 'head' ? HEAD_LABEL[team] : role === 'deputy' ? `Deputy ${HEAD_LABEL[team].toLowerCase()}` : role === 'sqa' ? 'SQA tester' : team === 'STAKEHOLDER' ? 'Stakeholder' : team === 'SPONSOR' ? 'Sponsor' : team === 'TECH' ? 'Developer' : 'PM team member')

export function AddPersonModal({ pid, toAdd, onClose }: { pid: string; toAdd: RoleToAdd; onClose: () => void }) {
  const { data: users } = useApi(['users'], api.projects.users)
  const { data: project } = useApi(['project', pid], () => api.projects.getProject(pid))
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState<NewRole>(toAdd.role ?? 'member')
  const add = useAction(api.projects.addMember, { success: 'Added. They were notified in the app and by email.', onDone: onClose })
  const rolesOf = (id: string) => (project?.members ?? []).filter((m) => m.member.userId === id)
  const already = rolesOf(userId)
  const alreadyInTeam = already.some((m) => m.member.team === toAdd.team)
  const title = toAdd.label ? `Add ${toAdd.label}` : `Add to the ${TEAM_LABEL[toAdd.team]}`

  return (
    <Modal
      open
      onClose={onClose}
      title={title.charAt(0).toUpperCase() + title.slice(1)}
      footer={
        <Button variant="primary" disabled={!userId || alreadyInTeam || add.pending} onClick={() => add.run(pid, userId, toAdd.team, role)}>
          <UserPlus className="h-4 w-4" /> Add and notify
        </Button>
      }
    >
      <Field label="Person">
        <Select value={userId} onChange={(e) => setUserId(e.target.value)} autoFocus>
          <option value="">Choose from the user directory…</option>
          {users
            ?.filter((u) => !u.deactivated)
            .map((u) => {
              const roles = rolesOf(u.id)
              const inThisTeam = roles.some((m) => m.member.team === toAdd.team)
              return (
                <option key={u.id} value={u.id} disabled={inThisTeam}>
                  {u.name} — {u.title}
                  {roles.length ? ` (already ${roles.map((m) => m.role).join(', ')})` : ''}
                  {u.external ? ' (outside BRAC)' : ''}
                </option>
              )
            })}
        </Select>
      </Field>
      {!toAdd.role && (
        <Field label="Role">
          <Select value={role} onChange={(e) => setRole(e.target.value as NewRole)}>
            {(['member', 'head', 'deputy', ...(toAdd.team === 'TECH' ? ['sqa'] : [])] as NewRole[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_NAME(toAdd.team, r)}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {toAdd.role && <p className="mb-3 text-sm text-muted">They will be added as <b>{ROLE_NAME(toAdd.team, role)}</b>.</p>}
      {role === 'head' && project?.members.some((m) => m.member.team === toAdd.team && m.member.isHead) && (
        <Note tone="blue" className="mb-3">The current head becomes a member of the team. Anything waiting for them moves to the new head.</Note>
      )}
      {already.length > 0 && !alreadyInTeam && (
        <Note tone="amber" icon={<TriangleAlert className="h-4 w-4" />}>
          {project?.members.find((m) => m.member.userId === userId)?.name} is already <b>{already.map((m) => m.role).join(', ')}</b> in this project. One person in several roles approves more than once, and could approve their own work.
        </Note>
      )}
    </Modal>
  )
}

/** "Before … add a tech head and a sponsor head", with an Add button for each missing person. */
export function MissingPeople({ pid, missing, canAdd, before, large, className }: { pid: string; missing: MissingRole[]; canAdd: boolean; before: string; large?: boolean; className?: string }) {
  const [adding, setAdding] = useState<RoleToAdd | null>(null)
  if (!missing.length) return null
  const list = missing.map((m) => m.label)
  const text = list.length === 1 ? list[0] : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`
  return (
    <div className={clsx('rounded-xl bg-amber-50 ring-1 ring-amber-200', large ? 'p-5 text-lg' : 'px-4 py-3 text-sm', className)}>
      <div className="flex items-start gap-2 text-amber-950">
        <UserPlus className={clsx('mt-0.5 shrink-0 text-amber-700', large ? 'h-6 w-6' : 'h-4 w-4')} />
        <div>
          {before}, add <b>{text}</b> to the project.
          {!canAdd && <span className="block text-amber-900/80">Ask the Project Owner or the Project Manager to add them.</span>}
        </div>
      </div>
      {canAdd && (
        <div className={clsx('flex flex-wrap gap-2', large ? 'mt-4' : 'mt-2.5')}>
          {missing.map((m) => (
            <Button key={m.need} size={large ? 'lg' : 'sm'} variant="primary" onClick={() => setAdding(roleFromMissing(m))}>
              <UserPlus className={large ? 'h-5 w-5' : 'h-3.5 w-3.5'} /> Add {m.label}
            </Button>
          ))}
        </div>
      )}
      {adding && <AddPersonModal pid={pid} toAdd={adding} onClose={() => setAdding(null)} />}
    </div>
  )
}
