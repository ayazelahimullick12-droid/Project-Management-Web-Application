/**
 * Login with email and password, plus a "demo users" list (development mode only, per
 * BUILD_PROMPT.md section 5) to switch quickly between roles.
 */
import { LogIn } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAction, useApi } from '../api/hooks'
import { brand } from '../theme/brand'
import { Avatar, Badge, Button, Field, Input } from '../components/ui'

const ROLE_HINTS: Record<string, string> = {
  'u-admin': 'Admin: templates, users, settings, import',
  'u-owner': 'Project Owner of every demo project',
  'u-pm': 'Project Manager (PM team head)',
  'u-pmdep': 'Deputy Project Manager',
  'u-pm1': 'PM team member',
  'u-pm2': 'PM team member',
  'u-tech': 'Tech head',
  'u-techdep': 'Deputy tech head',
  'u-dev1': 'Developer',
  'u-dev2': 'Developer',
  'u-sqa1': 'SQA tester',
  'u-sqa2': 'SQA tester',
  'u-sh': 'Stakeholder head (Away in Branch Cash)',
  'u-shdep': 'Deputy stakeholder head',
  'u-st1': 'Stakeholder (UAT tester)',
  'u-st2': 'Stakeholder (UAT tester)',
  'u-sp': 'Sponsor head (signs)',
  'u-spdep': 'Deputy sponsor head',
  'u-sp1': 'Sponsor (outside BRAC)',
  'u-mithila': 'PM of a past project (2024)',
  'u-anwar': 'Tech head of a past project',
  'u-dilruba': 'PM of a past project (2025)',
}

const GROUPS: [string, string[]][] = [
  ['Admin and Owner', ['u-admin', 'u-owner']],
  ['PM team', ['u-pm', 'u-pmdep', 'u-pm1', 'u-pm2']],
  ['Tech team', ['u-tech', 'u-techdep', 'u-dev1', 'u-dev2', 'u-sqa1', 'u-sqa2']],
  ['Stakeholders', ['u-sh', 'u-shdep', 'u-st1', 'u-st2']],
  ['Sponsors', ['u-sp', 'u-spdep', 'u-sp1']],
  ['Past projects', ['u-mithila', 'u-anwar', 'u-dilruba']],
]

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation() as { state?: { from?: string } }
  const { data: users } = useApi(['users'], api.projects.users)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('demo1234')
  const login = useAction(api.projects.login, { onDone: () => navigate(location.state?.from ?? '/') })
  const byId = new Map((users ?? []).map((u) => [u.id, u]))
  const listed = new Set(GROUPS.flatMap(([, ids]) => ids))
  const others = (users ?? []).filter((u) => !listed.has(u.id) && !u.deactivated)

  const submit = () => {
    const u = users?.find((x) => x.email.toLowerCase() === email.trim().toLowerCase())
    if (!u) {
      alert('No account with this email. Pick a demo user below.')
      return
    }
    login.run(u.id, password)
  }

  return (
    <div className="min-h-full bg-canvas">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <div className="mb-6 flex items-center gap-3">
            <img src="/favicon.svg" alt="" className="h-12 w-12" />
            <div>
              <div className="text-lg font-semibold">{brand.appName}</div>
              <div className="text-sm text-muted">{brand.unitName}</div>
            </div>
          </div>
          <h1 className="page-title mb-3 text-3xl leading-tight">From a stakeholder’s request to signed documents</h1>
          <p className="mb-6 text-sm leading-relaxed text-muted">
            AI agents gather the information and draft the Project Proposal, Charter, BRD and SRS. People review, comment, approve and sign. Then SQA and UAT test what was built.
          </p>
          <div className="mb-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
            <div className="mb-1 font-semibold">This is a clickable prototype</div>
            All people, projects and documents are fictional. The AI is simulated with pre-written results. Data is kept only in this browser; use <b>Reset demo data</b> in the clock menu to start over.
          </div>
          <div className="rounded-lg bg-white p-5 ring-1 ring-line">
            <Field label="Email">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@brac.example" />
            </Field>
            <Field label="Password" hint="Every demo account uses demo1234.">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
            </Field>
            <Button variant="primary" className="w-full" onClick={submit} disabled={login.pending}>
              <LogIn className="h-4 w-4" /> Sign in
            </Button>
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-sm font-semibold">Demo users</h2>
            <Badge tone="amber">development mode only</Badge>
          </div>
          <p className="mb-4 text-xs text-muted">Click a person to sign in as them. You can switch user at any time from the top bar, and each browser tab can be a different person.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {GROUPS.map(([group, ids]) => (
              <div key={group} className="rounded-lg bg-white p-3 ring-1 ring-line">
                <div className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{group}</div>
                {ids.map((id) => {
                  const u = byId.get(id)
                  if (!u) return null
                  return (
                    <button key={id} onClick={() => login.run(id, 'demo1234')} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-canvas">
                      <Avatar name={u.name} id={u.id} size={30} />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{u.name}</span>
                        <span className="block truncate text-[11px] text-muted">{ROLE_HINTS[id] ?? u.title}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
            {others.length > 0 && (
              <div className="rounded-lg bg-white p-3 ring-1 ring-line">
                <div className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Added in this demo</div>
                {others.map((u) => (
                  <button key={u.id} onClick={() => login.run(u.id, 'demo1234')} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-canvas">
                    <Avatar name={u.name} id={u.id} size={30} />
                    <span className="text-sm">{u.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
