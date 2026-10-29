/**
 * Editing the four teams: members, one head per team, one deputy per head, SQA tags.
 * Used when starting a project. A person may be in several teams (the page warns about it);
 * empty teams are fine, because people can be added when a step needs them.
 * starterId: the person starting the project, who is always the PM (shown, not editable).
 */
import { Crown, Plus, ShieldCheck, Trash2, UserCheck } from 'lucide-react'
import { useState } from 'react'
import type { Member, Team, User } from '../types'
import { TEAMS } from '../types'
import { HEAD_LABEL, TEAM_LABEL } from '../rules/permissions'
import { Avatar, Badge, Button, Select } from '../components/ui'

export function TeamEditor({ members, onChange, users, lockPm, starterId }: { members: Member[]; onChange: (m: Member[]) => void; users: User[]; lockPm?: boolean; starterId?: string }) {
  const [adding, setAdding] = useState<Record<Team, string>>({ PM: '', TECH: '', STAKEHOLDER: '', SPONSOR: '' })
  const name = (id: string) => users.find((u) => u.id === id)?.name ?? id
  const set = (fn: (m: Member[]) => Member[]) => onChange(fn(structuredClone(members)))
  const teamsOf = (id: string) => members.filter((m) => m.userId === id).map((m) => m.team)

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {TEAMS.map((team) => {
        const list = members.filter((m) => m.team === team)
        const starterHere = team === 'PM' && !!starterId
        return (
          <div key={team} className="rounded-xl bg-surface p-3 ring-1 ring-line">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold">{TEAM_LABEL[team]}</div>
              {!list.some((m) => m.isHead) && !starterHere && <Badge>no head yet</Badge>}
            </div>
            <ul className="mb-2 space-y-1">
              {starterHere && (
                <li className="flex items-center gap-2 rounded-md px-1 py-1">
                  <Avatar name={name(starterId!)} id={starterId} size={24} />
                  <span className="min-w-0 flex-1 truncate text-sm">{name(starterId!)} (you)</span>
                  <Badge tone="magenta"><Crown className="h-3 w-3" /> {HEAD_LABEL.PM}</Badge>
                </li>
              )}
              {list.map((m) => (
                <li key={`${m.userId}-${team}`} className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-canvas">
                  <Avatar name={name(m.userId)} id={m.userId} size={24} />
                  <span className="min-w-0 flex-1 truncate text-sm">{name(m.userId)}</span>
                  {m.isHead && <Badge tone="magenta"><Crown className="h-3 w-3" /> {HEAD_LABEL[team]}</Badge>}
                  {m.isDeputy && <Badge tone="blue">Deputy</Badge>}
                  {m.isSqa && <Badge tone="violet">SQA</Badge>}
                  {!m.isHead && !(lockPm && team === 'PM' && m.isHead) && (
                    <button title="Make head" className="rounded p-1 text-muted hover:text-brand" onClick={() => set((ms) => ms.map((x) => (x.team === team ? { ...x, isHead: x.userId === m.userId, isDeputy: x.userId === m.userId ? false : x.isDeputy, isSqa: x.userId === m.userId ? false : x.isSqa } : x)))}>
                      <Crown className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {!m.isHead && (
                    <button title={m.isDeputy ? 'Remove deputy' : 'Make deputy'} className="rounded p-1 text-muted hover:text-brand" onClick={() => set((ms) => ms.map((x) => (x.team === team ? { ...x, isDeputy: x.userId === m.userId ? !m.isDeputy : false } : x)))}>
                      <UserCheck className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {team === 'TECH' && !m.isHead && (
                    <button title="Toggle SQA tag" className="rounded p-1 text-muted hover:text-violet-700" onClick={() => set((ms) => ms.map((x) => (x.userId === m.userId && x.team === 'TECH' ? { ...x, isSqa: !x.isSqa } : x)))}>
                      <ShieldCheck className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {!(lockPm && team === 'PM' && m.isHead) && (
                    <button title="Remove" className="rounded p-1 text-muted hover:text-red-600" onClick={() => set((ms) => ms.filter((x) => !(x.userId === m.userId && x.team === team)))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Select value={adding[team]} onChange={(e) => setAdding({ ...adding, [team]: e.target.value })} className="text-xs">
                <option value="">Add from the user directory…</option>
                {users
                  .filter((u) => !u.deactivated)
                  .map((u) => {
                    const elsewhere = teamsOf(u.id).filter((t) => t !== team)
                    const here = teamsOf(u.id).includes(team) || (team === 'PM' && u.id === starterId)
                    return (
                      <option key={u.id} value={u.id} disabled={here}>
                        {u.name} — {u.title}
                        {elsewhere.length ? ` (also in ${elsewhere.map((t) => TEAM_LABEL[t]).join(', ')})` : ''}
                        {u.external ? ' (outside BRAC)' : ''}
                      </option>
                    )
                  })}
              </Select>
              <Button
                size="sm"
                disabled={!adding[team]}
                onClick={() => {
                  set((ms) => [...ms, { userId: adding[team], team, isHead: !(team === 'PM' && starterId) && !ms.some((x) => x.team === team && x.isHead) }])
                  setAdding({ ...adding, [team]: '' })
                }}
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
          </div>
        )
      })}
      <p className="text-xs text-muted md:col-span-2">
        <Crown className="inline h-3 w-3" /> make head · <UserCheck className="inline h-3 w-3" /> make deputy (acts for the head while they are Away) · <ShieldCheck className="inline h-3 w-3" /> tag a tech member as SQA tester. Someone can be in more than one team, but they then approve more than once.
      </p>
    </div>
  )
}
