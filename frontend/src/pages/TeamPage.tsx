/**
 * Team management (Owner): add, remove and replace people; heads, deputies, SQA tags; Away;
 * team templates; archive. SPEC.md "Project setup" → Reassigning, Deputies, Team templates; "Archive".
 */
import { Archive, Crown, Plane, Plus, Replace, Save, ShieldCheck, Trash2, UserCheck } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import type { Team } from '../types'
import { TEAMS } from '../types'
import { api } from '../api'
import { useAction, useApi } from '../api/hooks'
import { TEAM_LABEL } from '../rules/permissions'
import { fmtDate } from '../components/format'
import { OpenQuestion } from '../components/OpenQuestion'
import { Avatar, Badge, Button, Card, ErrorBox, Field, Input, Loading, Modal, Note, PageHeader, Select } from '../components/ui'

export function TeamPage() {
  const { pid = '' } = useParams()
  const { data, isLoading, error } = useApi(['project', pid], () => api.projects.getProject(pid))
  const { data: users } = useApi(['users'], api.projects.users)
  const [addTeam, setAddTeam] = useState<Team | null>(null)
  const [addUser, setAddUser] = useState('')
  const [replacing, setReplacing] = useState<string | null>(null)
  const [replaceWith, setReplaceWith] = useState('')
  const [awayFor, setAwayFor] = useState<string | null>(null)
  const [awayTo, setAwayTo] = useState('')
  const [templateName, setTemplateName] = useState('')
  const add = useAction(api.projects.addMember, { success: 'Member added and notified.', onDone: () => setAddTeam(null) })
  const remove = useAction(api.projects.removeMember, { success: 'Member removed.' })
  const head = useAction(api.projects.makeHead, { success: 'Head changed. Any pending approval moved to them on the same version.' })
  const deputy = useAction(api.projects.makeDeputy, { success: 'Deputy set.' })
  const sqa = useAction(api.projects.toggleSqa)
  const replace = useAction(api.projects.replacePerson, { success: 'Replaced. The new person was notified.', onDone: () => setReplacing(null) })
  const setAway = useAction(api.projects.setAway, { success: 'Away set. The deputy now receives approvals, questions and reminders.', onDone: () => setAwayFor(null) })
  const endAway = useAction(api.projects.endAway, { success: 'Away ended.' })
  const saveTemplate = useAction(api.projects.saveTeamTemplate, { success: 'Team template saved.' })
  const archive = useAction(api.projects.archive, { success: 'Project archived. It is now read-only.' })

  if (isLoading) return <Loading />
  if (error || !data) return <ErrorBox error={error} />
  const { me } = data
  const p = data.summary.project
  const canManage = me.canManageTeam
  const memberIds = new Set(data.members.map((m) => m.member.userId))

  return (
    <div>
      <PageHeader title="Team" subtitle="Four teams, one head each, one deputy per head. One person can hold only one role in a project." actions={<OpenQuestion id="sqa-team" />} />
      {!canManage && <Note className="mb-4">Only the Project Owner ({data.ownerName}) can change the team. Heads can mark themselves Away.</Note>}
      <div className="grid gap-4 md:grid-cols-2">
        {TEAMS.map((team) => (
          <Card key={team} title={TEAM_LABEL[team]} actions={canManage && <Button size="sm" onClick={() => setAddTeam(team)}><Plus className="h-3.5 w-3.5" /> Add</Button>}>
            <ul className="space-y-1">
              {data.members
                .filter((m) => m.member.team === team)
                .map((m) => {
                  const self = m.member.userId === me.id
                  const canAway = (m.member.isHead || m.member.isDeputy) && (self || canManage)
                  return (
                    <li key={m.member.userId} className="flex flex-wrap items-center gap-2 rounded-md px-1 py-1.5 hover:bg-canvas">
                      <Avatar name={m.name} id={m.member.userId} size={28} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {m.name} {m.external && <Badge>outside BRAC</Badge>}
                        </div>
                        <div className="truncate text-xs text-muted">
                          {m.role} · {m.title}
                        </div>
                      </div>
                      {m.away && (
                        <Badge tone="amber">
                          <Plane className="h-3 w-3" /> Away until {fmtDate(m.awayUntil)}
                        </Badge>
                      )}
                      {canAway && !m.away && (
                        <Button size="sm" variant="ghost" onClick={() => setAwayFor(m.member.userId)} title="Mark Away">
                          <Plane className="h-3.5 w-3.5" /> Away
                        </Button>
                      )}
                      {canAway && m.away && (
                        <Button size="sm" variant="ghost" onClick={() => endAway.run(pid, m.member.userId)}>
                          End Away
                        </Button>
                      )}
                      {canManage && (
                        <span className="flex items-center">
                          {!m.member.isHead && (
                            <button title="Make head" className="rounded p-1 text-muted hover:text-brand" onClick={() => head.run(pid, m.member.userId)}>
                              <Crown className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {!m.member.isHead && !m.member.isDeputy && (
                            <button title="Make deputy" className="rounded p-1 text-muted hover:text-brand" onClick={() => deputy.run(pid, m.member.userId)}>
                              <UserCheck className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {team === 'TECH' && !m.member.isHead && (
                            <button title="Toggle SQA tag" className="rounded p-1 text-muted hover:text-violet-700" onClick={() => sqa.run(pid, m.member.userId)}>
                              <ShieldCheck className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button title="Replace with someone else" className="rounded p-1 text-muted hover:text-brand" onClick={() => setReplacing(m.member.userId)}>
                            <Replace className="h-3.5 w-3.5" />
                          </button>
                          {!m.member.isHead && (
                            <button title="Remove" className="rounded p-1 text-muted hover:text-red-600" onClick={() => remove.run(pid, m.member.userId)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </span>
                      )}
                    </li>
                  )
                })}
            </ul>
          </Card>
        ))}
      </div>

      {canManage && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card title="Save as team template" subtitle="Reuse this team for the next project.">
            <div className="flex gap-2">
              <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Template name" />
              <Button onClick={() => saveTemplate.run(pid, templateName)}>
                <Save className="h-4 w-4" /> Save
              </Button>
            </div>
          </Card>
          <Card title={<span className="flex items-center gap-2">Archive the project <OpenQuestion id="archive-early" /></span>} subtitle="The project becomes read-only and leaves the active dashboard.">
            <Button
              variant="danger"
              disabled={p.status === 'archived'}
              onClick={() => {
                if (confirm(`Archive ${p.name}? It becomes read-only. (Reopening is an open question; the prototype assumes no.)`)) archive.run(pid)
              }}
            >
              <Archive className="h-4 w-4" /> {p.status === 'archived' ? 'Archived' : 'Archive project'}
            </Button>
          </Card>
        </div>
      )}

      <Modal
        open={!!addTeam}
        onClose={() => setAddTeam(null)}
        title={`Add to ${addTeam ? TEAM_LABEL[addTeam] : ''}`}
        footer={
          <Button variant="primary" disabled={!addUser} onClick={() => add.run(pid, addUser, addTeam!)}>
            Add and notify
          </Button>
        }
      >
        <Field label="Person" hint="People already in another team of this project cannot be added.">
          <Select value={addUser} onChange={(e) => setAddUser(e.target.value)}>
            <option value="">Choose…</option>
            {users?.filter((u) => !u.deactivated).map((u) => (
              <option key={u.id} value={u.id} disabled={memberIds.has(u.id)}>
                {u.name} — {u.title}
                {memberIds.has(u.id) ? ' (already in this project)' : ''}
              </option>
            ))}
          </Select>
        </Field>
      </Modal>

      <Modal open={!!replacing} onClose={() => setReplacing(null)} title="Replace a person" footer={<Button variant="primary" disabled={!replaceWith} onClick={() => replace.run(pid, replacing!, replaceWith)}>Replace</Button>}>
        <p className="mb-3 text-sm text-muted">The new person takes over the same position. If it is a head with a pending approval, the approval moves to them on the same version.</p>
        <Field label="Replace with">
          <Select value={replaceWith} onChange={(e) => setReplaceWith(e.target.value)}>
            <option value="">Choose…</option>
            {users?.filter((u) => !u.deactivated && !memberIds.has(u.id)).map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} — {u.title}
              </option>
            ))}
          </Select>
        </Field>
      </Modal>

      <Modal open={!!awayFor} onClose={() => setAwayFor(null)} title="Mark Away" footer={<Button variant="primary" disabled={!awayTo} onClick={() => setAway.run(pid, awayFor!, null, new Date(`${awayTo}T23:59:00+06:00`).toISOString())}>Mark Away</Button>}>
        <p className="mb-3 text-sm text-muted">While Away, approvals, signatures, Q/A questions and reminders go to the deputy, and every action records who acted for whom.</p>
        <Field label="Away until">
          <Input type="date" value={awayTo} onChange={(e) => setAwayTo(e.target.value)} />
        </Field>
      </Modal>
    </div>
  )
}
