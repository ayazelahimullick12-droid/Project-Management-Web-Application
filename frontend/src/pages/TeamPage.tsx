/**
 * The project team. A project can start with one person (the Owner, who is also the PM); people
 * are added when a step needs them, or here at any time.
 * - The Owner or the PM: add people, make someone head or deputy, tag SQA testers, save a template.
 * - The Owner: replace or remove people, archive the project.
 * - Heads mark themselves Away; a deputy is needed first (the deputy acts for them).
 * One person may hold several roles; the page warns about it.
 */
import { Archive, Crown, Plane, Plus, Replace, Save, ShieldCheck, Trash2, TriangleAlert, UserCheck } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import type { Team } from '../types'
import { TEAMS } from '../types'
import { api } from '../api'
import { useAction, useApi } from '../api/hooks'
import { TEAM_LABEL } from '../rules/permissions'
import { fmtDate } from '../components/format'
import { OpenQuestion } from '../components/OpenQuestion'
import { AddPersonModal, type RoleToAdd } from '../components/People'
import { Avatar, Badge, Button, Card, ErrorBox, Field, Input, Loading, Modal, Note, PageHeader, Select } from '../components/ui'
import { SubNav, teamNav } from '../components/SubNav'

export function TeamPage() {
  const { pid = '' } = useParams()
  const { data, isLoading, error } = useApi(['project', pid], () => api.projects.getProject(pid))
  const { data: users } = useApi(['users'], api.projects.users)
  const [adding, setAdding] = useState<RoleToAdd | null>(null)
  const [replacing, setReplacing] = useState<{ userId: string; team: Team } | null>(null)
  const [replaceWith, setReplaceWith] = useState('')
  const [awayFor, setAwayFor] = useState<{ userId: string; team: Team } | null>(null)
  const [awayTo, setAwayTo] = useState('')
  const [templateName, setTemplateName] = useState('')
  const remove = useAction(api.projects.removeMember, { success: 'Removed from the team.' })
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
  const canManage = me.canManageTeam // replace, remove, archive
  const canAdd = me.canAddPeople // add, heads, deputies, SQA tags
  const hasDeputy = (team: Team) => data.members.some((m) => m.member.team === team && m.member.isDeputy)

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle="A project can start with one person. Add people here, or when a step needs them. Each team has at most one head and one deputy."
        actions={<OpenQuestion id="sqa-team" />}
      />
      <SubNav items={teamNav(pid)} />
      {!canAdd && <Note className="mb-4">The Project Owner ({data.ownerName}) and the Project Manager add people. Heads can mark themselves Away.</Note>}
      {data.warnings.length > 0 && (
        <Note tone="amber" icon={<TriangleAlert className="h-4 w-4" />} className="mb-4">
          {data.warnings.map((w) => (
            <div key={w.userId}>
              <b>{w.name}</b> has several roles: {w.roles.join(', ')}. They approve more than once, and could approve their own work.
            </div>
          ))}
        </Note>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {TEAMS.map((team) => {
          const list = data.members.filter((m) => m.member.team === team)
          return (
            <Card key={team} title={TEAM_LABEL[team]} actions={canAdd && <Button size="sm" onClick={() => setAdding({ team })}><Plus className="h-3.5 w-3.5" /> Add</Button>}>
              {!list.length && <p className="text-sm text-muted">Nobody yet. The app asks for someone when a step needs this team.</p>}
              <ul className="space-y-1">
                {list.map((m) => {
                  const self = m.member.userId === me.id
                  const canAway = (m.member.isHead || m.member.isDeputy) && (self || canManage)
                  const who = { userId: m.member.userId, team }
                  return (
                    <li key={`${m.member.userId}-${team}`} className="flex flex-wrap items-center gap-2 rounded-md px-1 py-1.5 hover:bg-canvas">
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
                      {canAway && !m.away && m.member.isHead && (
                        <Button size="sm" variant="ghost" onClick={() => setAwayFor(who)} title="Mark Away">
                          <Plane className="h-3.5 w-3.5" /> Away
                        </Button>
                      )}
                      {canAway && m.away && (
                        <Button size="sm" variant="ghost" onClick={() => endAway.run(pid, m.member.userId)}>
                          End Away
                        </Button>
                      )}
                      {(canAdd || canManage) && (
                        <span className="flex items-center">
                          {canAdd && !m.member.isHead && (
                            <button title="Make head" className="rounded p-1 text-muted hover:text-brand" onClick={() => head.run(pid, m.member.userId, team)}>
                              <Crown className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {canAdd && !m.member.isHead && !m.member.isDeputy && (
                            <button title="Make deputy" className="rounded p-1 text-muted hover:text-brand" onClick={() => deputy.run(pid, m.member.userId, team)}>
                              <UserCheck className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {canAdd && team === 'TECH' && !m.member.isHead && (
                            <button title="Toggle SQA tag" className="rounded p-1 text-muted hover:text-violet-700" onClick={() => sqa.run(pid, m.member.userId)}>
                              <ShieldCheck className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {canManage && (
                            <button title="Replace with someone else" className="rounded p-1 text-muted hover:text-brand" onClick={() => setReplacing(who)}>
                              <Replace className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {canManage && !m.member.isHead && (
                            <button title="Remove" className="rounded p-1 text-muted hover:text-red-600" onClick={() => remove.run(pid, m.member.userId, team)}>
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
          )
        })}
      </div>

      {(canAdd || canManage) && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {canAdd && (
            <Card title="Save as team template" subtitle="Reuse this team for the next project.">
              <div className="flex gap-2">
                <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Template name" />
                <Button onClick={() => saveTemplate.run(pid, templateName)}>
                  <Save className="h-4 w-4" /> Save
                </Button>
              </div>
            </Card>
          )}
          {canManage && (
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
          )}
        </div>
      )}

      {adding && <AddPersonModal pid={pid} toAdd={adding} onClose={() => setAdding(null)} />}

      <Modal
        open={!!replacing}
        onClose={() => setReplacing(null)}
        title="Replace a person"
        footer={<Button variant="primary" disabled={!replaceWith} onClick={() => replace.run(pid, replacing!.userId, replaceWith, replacing!.team)}>Replace</Button>}
      >
        <p className="mb-3 text-sm text-muted">The new person takes over the same position. If it is a head with a pending approval, the approval moves to them on the same version.</p>
        <Field label="Replace with">
          <Select value={replaceWith} onChange={(e) => setReplaceWith(e.target.value)}>
            <option value="">Choose…</option>
            {users
              ?.filter((u) => !u.deactivated && !data.members.some((m) => m.member.userId === u.id && m.member.team === replacing?.team))
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} — {u.title}
                </option>
              ))}
          </Select>
        </Field>
      </Modal>

      <Modal
        open={!!awayFor}
        onClose={() => setAwayFor(null)}
        title="Mark Away"
        footer={
          awayFor && hasDeputy(awayFor.team) ? (
            <Button variant="primary" disabled={!awayTo} onClick={() => setAway.run(pid, awayFor.userId, null, new Date(`${awayTo}T23:59:00+06:00`).toISOString())}>
              Mark Away
            </Button>
          ) : undefined
        }
      >
        {awayFor && !hasDeputy(awayFor.team) ? (
          <div>
            <Note tone="amber" className="mb-3">
              The {TEAM_LABEL[awayFor.team]} has no deputy yet. While a head is Away, the deputy approves, signs and answers for them, so add a deputy first.
            </Note>
            {canAdd ? (
              <Button variant="primary" onClick={() => setAdding({ team: awayFor.team, role: 'deputy', label: `a deputy for the ${TEAM_LABEL[awayFor.team]}` })}>
                <UserCheck className="h-4 w-4" /> Add a deputy
              </Button>
            ) : (
              <p className="text-sm text-muted">Ask the Project Owner or the Project Manager to add a deputy.</p>
            )}
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted">While Away, approvals, signatures, Q/A questions and reminders go to the deputy, and every action records who acted for whom.</p>
            <Field label="Away until">
              <Input type="date" value={awayTo} onChange={(e) => setAwayTo(e.target.value)} />
            </Field>
          </>
        )}
      </Modal>
    </div>
  )
}
