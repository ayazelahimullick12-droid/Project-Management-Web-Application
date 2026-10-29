/**
 * Projects, teams and dashboards.
 *
 * Spec: SPEC.md "Project setup" (wizard, one team per person, heads, deputies, reassigning,
 * Away, team templates), "Dashboard" and "Archive".
 */
import type { DemoState, ID, Member, Project, Team, TestStage } from '../types'
import { MAIN_DOCS } from '../types'
import { newId } from '../demo/ids'
import { now } from '../demo/clock'
import { getSessionUserId, setSessionUserId } from '../demo/session'
import { reassign } from '../rules/approval'
import { blockingCounts } from '../rules/comments'
import { actAsHead, can, HEAD_LABEL, headOf, headRecipient, inTeam, isAway, isDeveloper, isOwner, isSqa, memberLabel, memberOf, membershipIn, membershipsOf, roleLabel, TEAM_LABEL, teamProblems, teamWarnings } from '../rules/permissions'
import { docOf, docStatus, factSheetConfirmed, projectStage, STAGE_LABEL, STAGES, type DocStatus } from '../rules/pipeline'
import { UNRESOLVED } from '../rules/testing'
import { act, ApiError, ensure, fail, me, nameOf, pipelineCtx, projectOf, read } from './core'
import { audit, notify } from './effects'
import { waitingItems, type WaitingItem } from './waiting'

// ─── Session ────────────────────────────────────────────────────────────

export async function login(userId: ID, password: string) {
  return act((s, _t, at) => {
    const user = s.users.find((u) => u.id === userId)
    if (!user) fail('Unknown user.')
    if (user.deactivated) fail('This account is deactivated.')
    if (!password.trim()) fail('Enter your password.')
    setSessionUserId(user.id)
    audit(s, { actorId: user.id, action: 'Login', details: `${user.name} signed in`, at })
    return user
  })
}

export async function switchUser(userId: ID) {
  setSessionUserId(userId)
}

export async function logout() {
  setSessionUserId(null)
}

export async function users() {
  return read((s) => s.users)
}

/** The signed-in user of this tab, or null. */
export async function whoami() {
  return read((s) => {
    const id = getSessionUserId()
    return s.users.find((u) => u.id === id && !u.deactivated) ?? null
  })
}

/** Short list of projects for the sidebar and pickers. */
export async function myProjects() {
  return read((s) => {
    const user = me(s)
    return visibleProjects(s, user.id).map((p) => ({ id: p.id, name: p.name, status: p.status, finished: !!p.finished, role: roleLabel(p, user.id) }))
  })
}

// ─── Summaries for lists and dashboards ─────────────────────────────────

export interface DocCard {
  type: (typeof MAIN_DOCS)[number] | 'SQA_SIGNOFF' | 'UAT_SIGNOFF'
  docId?: ID
  status: DocStatus
  versionNumber?: number
  openComments: number
  pendingComments: number
}

export interface ProjectSummary {
  project: Project
  stage: ReturnType<typeof projectStage>
  docs: DocCard[]
  unansweredQuestions: number
  openChangeRequests: number
  pendingDecisions: number
  openDefects: number
  myRole: string
  next: NextStep
  progress: number // 0–100, by stage
  health: { label: string; tone: 'green' | 'blue' | 'amber' | 'red' | 'gray' }
  heads: { id: ID; name: string }[]
}

/** The one thing that should happen next in a project, and who is responsible. */
export interface NextStep {
  title: string
  detail?: string
  link: string
  action?: string
  waitingOn?: ID
  waitingOnName?: string
  coveringName?: string
  since?: string
  tone: 'action' | 'waiting' | 'done' | 'problem'
}

function visibleProjects(s: DemoState, userId: ID): Project[] {
  const user = s.users.find((u) => u.id === userId)
  return s.projects.filter((p) => user?.isAdmin || isOwner(p, userId) || memberOf(p, userId))
}

export function summarize(s: DemoState, p: Project, userId: ID, t: Date): ProjectSummary {
  const ctx = pipelineCtx(s, p.id)
  const docs: DocCard[] = (['PROPOSAL', 'BRD', 'SRS', 'SQA_SIGNOFF', 'UAT_SIGNOFF'] as const).map((type) => {
    const doc = docOf(ctx, type)
    const counts = doc ? blockingCounts(s.comments, doc.id) : { open: 0, pending: 0 }
    return {
      type,
      docId: doc?.id,
      status: docStatus(ctx, doc),
      versionNumber: s.versions.find((v) => v.id === doc?.currentVersionId)?.number,
      openComments: counts.open,
      pendingComments: counts.pending,
    }
  })
  const openRounds = new Set(s.rounds.filter((r) => r.projectId === p.id && r.status === 'open').map((r) => r.id))
  return {
    project: p,
    stage: projectStage(ctx),
    docs,
    unansweredQuestions: s.questions.filter((q) => q.projectId === p.id && !q.answeredAt && openRounds.has(q.roundId)).length,
    openChangeRequests: s.changeRequests.filter((c) => c.projectId === p.id && c.status !== 'closed').length,
    pendingDecisions: s.decisions.filter((d) => d.projectId === p.id && d.status === 'pending').length,
    openDefects: s.defects.filter((d) => d.projectId === p.id && UNRESOLVED.includes(d.status)).length,
    myRole: roleLabel(p, userId),
    next: nextStep(s, p, projectStage(ctx), docs, t),
    progress: Math.round((STAGES.indexOf(projectStage(ctx)) / (STAGES.length - 1)) * 100),
    health: healthOf(nextStep(s, p, projectStage(ctx), docs, t), t),
    heads: p.members.filter((m) => m.isHead).map((m) => ({ id: m.userId, name: nameOf(s, m.userId) })),
  }
}

/** A simple health label, like project tools show: on track, waiting, delayed, needs attention. */
function healthOf(next: NextStep, t: Date): ProjectSummary['health'] {
  if (next.tone === 'done') return { label: 'Complete', tone: 'gray' }
  if (next.tone === 'problem') return { label: 'Needs attention', tone: 'red' }
  if (next.tone === 'waiting') {
    const days = next.since ? (t.getTime() - new Date(next.since).getTime()) / 86_400_000 : 0
    return days > 2 ? { label: 'Delayed', tone: 'amber' } : { label: 'Waiting', tone: 'blue' }
  }
  return { label: 'On track', tone: 'green' }
}

const DOC_NAME: Record<string, string> = { PROPOSAL: 'Proposal & Charter', BRD: 'BRD', SRS: 'SRS', SQA_SIGNOFF: 'SQA sign-off', UAT_SIGNOFF: 'UAT sign-off' }
const STAGE_DOC: Record<string, DocCard['type']> = { PROPOSAL: 'PROPOSAL', BRD: 'BRD', SRS: 'SRS', SQA: 'SQA_SIGNOFF', UAT: 'UAT_SIGNOFF' }

/** What should happen next, from the project's stage and the status of its current document. */
function nextStep(s: DemoState, p: Project, stage: ReturnType<typeof projectStage>, docs: DocCard[], t: Date): NextStep {
  const base = `/projects/${p.id}`
  if (p.status === 'archived') return { title: 'Archived', detail: 'The project is read-only.', link: base, tone: 'done' }
  if (stage === 'COMPLETE') return { title: 'Documentation complete', detail: p.finished ? 'All four documents are signed.' : 'UAT is signed off. The Owner may archive the project.', link: base, tone: 'done' }
  const waiting = (headId: ID, title: string, link: string, since?: string, detail?: string): NextStep => {
    const r = headRecipient(p, headId, t)
    return { title, detail, link, waitingOn: headId, waitingOnName: nameOf(s, headId), coveringName: r.forUserId ? nameOf(s, r.to) : undefined, since, tone: 'waiting' }
  }
  if (stage === 'INTAKE') {
    const intake = `${base}/intake`
    const openRound = s.rounds.find((r) => r.projectId === p.id && r.status === 'open' && r.purpose === 'intake')
    const run = s.ragRuns.find((r) => r.id === p.intake.ragRunId)
    const conflictsN = p.facts.filter((f) => f.status === 'conflicting').length
    if (!p.intake.description.trim()) return { title: 'Stakeholders describe what they need', detail: 'Write the request and upload any forms or reports.', link: intake, action: 'Open intake', tone: 'action' }
    if (!p.intake.analysed) return { title: 'Run the intake analysis', detail: 'The Q/A agent reads the description and files and extracts the facts (PM team).', link: intake, action: 'Open intake', tone: 'action' }
    if (run?.duplicate && !p.intake.duplicateAck) return { title: 'Check a possible duplicate project', detail: `A finished project matches ${Math.round(run.duplicate.score * 100)}%. The PM must acknowledge it.`, link: `${intake}?tab=rag`, action: 'Review', tone: 'problem' }
    if (openRound) {
      const n = s.questions.filter((q) => q.roundId === openRound.id && !q.answeredAt).length
      return n
        ? { title: `${n} Q/A question${n > 1 ? 's' : ''} waiting for answers`, detail: 'Stakeholders, sponsors and the tech team answer them in My work.', link: `${intake}?tab=questions`, action: 'See questions', tone: 'waiting', since: openRound.startedAt }
        : { title: 'All questions answered: close the round', detail: 'The PM closes the round and checks again.', link: `${intake}?tab=questions`, action: 'See questions', tone: 'action' }
    }
    if (conflictsN) return { title: `Settle ${conflictsN} conflicting fact${conflictsN > 1 ? 's' : ''}`, detail: 'Two sources disagree; the PM picks the value.', link: `${intake}?tab=facts`, action: 'Open Fact Sheet', tone: 'problem' }
    if (p.intake.confirmRequestedAt) return waiting(headOf(p, 'STAKEHOLDER')!.userId, 'Stakeholder head confirms the Fact Sheet', `${intake}?tab=facts`, p.intake.confirmRequestedAt)
    return { title: 'Complete the Fact Sheet', detail: 'Ask the Q/A questions for missing fields, then send it to the stakeholder head.', link: `${intake}?tab=questions`, action: 'Open intake', tone: 'action' }
  }
  const type = STAGE_DOC[stage]
  const card = docs.find((d) => d.type === type)!
  const name = DOC_NAME[type]
  const link = type.endsWith('SIGNOFF') ? `${base}/testing/${stage}?tab=signoff` : `${base}/docs/${type}`
  if (card.status.key === 'in_review' && card.status.waitingOn) return waiting(card.status.waitingOn, `${card.status.waitingRole} reviews the ${name}`, link, card.status.since)
  if (card.status.key === 'changes_requested') return { title: `PM team updates the ${name}`, detail: 'Changes were requested. A new version restarts the approval chain (a minor correction resumes it).', link, action: `Open ${name}`, tone: 'action', since: card.status.since }
  if (card.status.key === 'out_of_sync') return { title: `Re-approve the ${name}`, detail: 'An earlier document changed. Documents are re-approved in order.', link, action: `Open ${name}`, tone: 'problem' }
  if (stage === 'SQA' || stage === 'UAT') {
    const tests = s.testCases.filter((x) => x.projectId === p.id && x.stage === stage).length
    const open = s.defects.filter((d) => d.projectId === p.id && d.stage === stage && UNRESOLVED.includes(d.status)).length
    return tests
      ? { title: `${stage} testing in progress`, detail: `${tests} test cases · ${open} unresolved defect${open === 1 ? '' : 's'}`, link: `${base}/testing/${stage}`, action: `Open ${stage}`, tone: 'action' }
      : { title: `Prepare the ${stage} test cases`, detail: stage === 'SQA' ? 'SQA tests come from the signed SRS.' : 'UAT tests come from the signed BRD.', link: `${base}/testing/${stage}`, action: `Open ${stage}`, tone: 'action' }
  }
  if (card.status.key === 'not_started') {
    const round = type === 'BRD' ? 'brd_business' : type === 'SRS' ? 'srs_technical' : undefined
    if (round && !s.rounds.some((r) => r.projectId === p.id && r.purpose === round && r.status === 'closed'))
      return { title: type === 'BRD' ? 'Business processes Q/A round' : 'Technical Q/A round (tech team)', detail: `Needed before the ${name} is drafted.`, link: `${base}/intake`, action: 'Open intake', tone: 'action' }
    return { title: `Generate the ${name}`, detail: 'The AI drafts it section by section from the Fact Sheet (PM team).', link, action: `Open ${name}`, tone: 'action' }
  }
  const c = card.openComments + card.pendingComments
  return { title: `Review the ${name} and send it for approval`, detail: c ? `${c} comment${c > 1 ? 's' : ''} to resolve first.` : 'Comment and edit; then the PM sends it for approval.', link, action: `Open ${name}`, tone: 'action' }
}

export interface Dashboard {
  active: ProjectSummary[]
  archived: ProjectSummary[]
  finished: ProjectSummary[]
  myTasks: (WaitingItem & { projectName: string; waitingOnName: string })[]
  stalled: (WaitingItem & { projectName: string; waitingOnName: string })[]
  portfolio: boolean // Owner or Admin
  kpis: { inReview: number; questionsOpen: number; defectsOpen: number; criticalDefects: number; decisionsPending: number }
  pipeline: { stage: string; label: string; count: number }[]
  activity: { id: ID; actorId?: ID | null; actorName: string; action: string; details: string; projectId?: ID; projectName?: string; createdAt: string }[]
  activityByDay: { day: string; count: number }[]
}

export async function dashboard(): Promise<Dashboard> {
  return read((s, t) => {
    const user = me(s)
    const projects = visibleProjects(s, user.id)
    const all = projects.map((p) => summarize(s, p, user.id, t))
    const activeSummaries = all.filter((x) => x.project.status === 'active' && !x.project.finished)
    const activeIds = new Set(activeSummaries.map((x) => x.project.id))
    const items = waitingItems(s, t).map((i) => ({ ...i, projectName: projectOf(s, i.projectId).name, waitingOnName: nameOf(s, i.waitingOn) }))
    const visibleIds = new Set(projects.map((p) => p.id))
    const portfolio = !!user.isAdmin || s.projects.some((p) => p.ownerId === user.id)
    return {
      active: all.filter((x) => x.project.status === 'active' && !x.project.finished),
      archived: all.filter((x) => x.project.status === 'archived'),
      finished: all.filter((x) => x.project.finished),
      myTasks: items.filter((i) => i.recipients.some((r) => r.to === user.id)),
      stalled: portfolio ? items.filter((i) => visibleIds.has(i.projectId) && i.reminders) : [],
      portfolio,
      kpis: {
        inReview: activeSummaries.reduce((n, x) => n + x.docs.filter((d) => d.status.key === 'in_review').length, 0),
        questionsOpen: activeSummaries.reduce((n, x) => n + x.unansweredQuestions, 0),
        defectsOpen: activeSummaries.reduce((n, x) => n + x.openDefects, 0),
        criticalDefects: s.defects.filter((d) => activeIds.has(d.projectId) && d.severity === 'Critical' && UNRESOLVED.includes(d.status)).length,
        decisionsPending: activeSummaries.reduce((n, x) => n + x.pendingDecisions, 0),
      },
      pipeline: STAGES.map((st) => ({ stage: st, label: STAGE_LABEL[st], count: activeSummaries.filter((x) => x.stage === st).length })),
      activity: s.audit
        .filter((a) => a.projectId && activeIds.has(a.projectId) && a.action !== 'Login' && a.createdAt <= t.toISOString())
        .slice(0, 12)
        .map((a) => ({ id: a.id, actorId: a.actorId, actorName: a.actorId ? nameOf(s, a.actorId) : 'AI', action: a.action, details: a.details, projectId: a.projectId, projectName: s.projects.find((x) => x.id === a.projectId)?.name, createdAt: a.createdAt })),
      activityByDay: Array.from({ length: 14 }, (_, i) => {
        const end = new Date(t.getTime() - (13 - i) * 86_400_000)
        const day = end.toISOString().slice(0, 10)
        return { day, count: s.audit.filter((a) => a.projectId && activeIds.has(a.projectId) && a.action !== 'Login' && a.createdAt.slice(0, 10) === day).length }
      }),
    }
  })
}

// ─── One project ────────────────────────────────────────────────────────

export interface ProjectView {
  summary: ProjectSummary
  members: { member: Member; name: string; title: string; role: string; away: boolean; awayUntil?: string; external?: boolean }[]
  ownerName: string
  me: {
    id: ID
    team?: Team
    isOwner: boolean
    isAdmin: boolean
    isPmTeam: boolean
    actsAsPm: boolean
    isSqa: boolean
    isDeveloper: boolean
    canManageTeam: boolean // replace and remove people (Owner)
    canAddPeople: boolean // add people, make heads and deputies (Owner or PM)
    away: boolean
  }
  /** People with more than one role (allowed, with a warning). */
  warnings: { userId: ID; name: string; roles: string[] }[]
  factSheetConfirmed: boolean
  testing: Record<TestStage, { tests: number; run: number; passed: number; defectsOpen: number; status: string }>
  openItems: { label: string; count: number; link: string }[]
}

export async function getProject(pid: ID): Promise<ProjectView> {
  return read((s, t) => {
    const user = me(s)
    const p = projectOf(s, pid)
    ensure(can.view(p, user))
    const summary = summarize(s, p, user.id, t)
    const m = memberOf(p, user.id)
    const testing = {} as ProjectView['testing']
    for (const stage of ['SQA', 'UAT'] as TestStage[]) {
      const tests = s.testCases.filter((x) => x.projectId === pid && x.stage === stage)
      const latest = tests.map((tc) => s.executions.filter((e) => e.testCaseId === tc.id && e.result !== 'not_run').sort((a, b) => (a.executedAt ?? '').localeCompare(b.executedAt ?? '')).at(-1))
      testing[stage] = {
        tests: tests.length,
        run: latest.filter(Boolean).length,
        passed: latest.filter((e) => e?.result === 'pass').length,
        defectsOpen: s.defects.filter((d) => d.projectId === pid && d.stage === stage && UNRESOLVED.includes(d.status)).length,
        status: testingStatus(s, pid, stage, summary),
      }
    }
    const pendingFactUpdates = s.factUpdates.filter((f) => f.projectId === pid && f.status === 'pending').length
    return {
      summary,
      members: p.members.map((mm) => {
        const u = s.users.find((x) => x.id === mm.userId)
        const awayP = p.away.find((a) => a.userId === mm.userId && new Date(a.from) <= t && t <= new Date(a.to))
        return { member: mm, name: u?.name ?? mm.userId, title: u?.title ?? '', role: roleLabel(p, mm.userId), away: !!awayP, awayUntil: awayP?.to, external: u?.external }
      }),
      ownerName: nameOf(s, p.ownerId),
      me: {
        id: user.id,
        team: m?.team,
        isOwner: isOwner(p, user.id),
        isAdmin: !!user.isAdmin,
        isPmTeam: inTeam(p, user.id, 'PM'),
        actsAsPm: actAsHead(p, 'PM', user.id, t).ok,
        isSqa: isSqa(p, user.id),
        isDeveloper: isDeveloper(p, user.id),
        canManageTeam: can.manageTeam(p, user.id).ok,
        canAddPeople: can.addPeople(p, user.id, t).ok,
        away: isAway(p, user.id, t),
      },
      warnings: teamWarnings(p.members).map((w) => ({ ...w, name: nameOf(s, w.userId) })),
      factSheetConfirmed: factSheetConfirmed(pipelineCtx(s, pid)),
      testing,
      openItems: [
        { label: 'Unanswered Q/A questions', count: summary.unansweredQuestions, link: `/projects/${pid}/intake?tab=questions` },
        { label: 'Open comments', count: summary.docs.reduce((n, d) => n + d.openComments, 0), link: `/projects/${pid}` },
        { label: 'Comments pending check', count: summary.docs.reduce((n, d) => n + d.pendingComments, 0), link: `/projects/${pid}` },
        { label: 'Decisions waiting for the PM', count: summary.pendingDecisions, link: `/projects/${pid}/decisions` },
        { label: 'Open change requests', count: summary.openChangeRequests, link: `/projects/${pid}/changes` },
        { label: 'Proposed Fact Sheet updates', count: pendingFactUpdates, link: `/projects/${pid}/changes` },
        { label: 'Unresolved defects', count: summary.openDefects, link: `/projects/${pid}/testing/UAT?tab=defects` },
      ],
    }
  })
}

/** SQA/UAT status for the dashboard (SPEC_SQA_UAT.md "Dashboard"). */
function testingStatus(s: DemoState, pid: ID, stage: TestStage, summary: ProjectSummary): string {
  const card = summary.docs.find((d) => d.type === (stage === 'SQA' ? 'SQA_SIGNOFF' : 'UAT_SIGNOFF'))
  if (card && card.status.key !== 'not_started' && card.status.key !== 'draft') return card.status.key === 'approved' || card.status.key === 'signed' ? 'Signed off' : card.status.label
  const tests = s.testCases.filter((x) => x.projectId === pid && x.stage === stage)
  const runs = s.testRuns.filter((r) => r.projectId === pid && r.stage === stage).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  if (runs.length) return `Testing (build ${s.builds.find((b) => b.id === runs[0].buildId)?.version})`
  return tests.length ? 'Preparing tests' : 'Not started'
}

// ─── New project wizard ─────────────────────────────────────────────────

/** Real problems with a team (see teamProblems in rules/permissions.ts). Empty teams are fine. */
export const validateTeam = teamProblems

/**
 * Starts a project. One person is enough: whoever starts it becomes the Project Owner and the
 * Project Manager (they can hand the PM role to someone else later). Anyone else is optional now;
 * the app asks for them when a step needs them (see rules/people.ts).
 */
export async function createProject(input: { name: string; description: string; members?: Member[] }): Promise<ID> {
  return act((s, t, at) => {
    const user = me(s)
    if (!input.name.trim()) fail('Give the project a name.')
    const others = (input.members ?? []).filter((m) => !(m.userId === user.id && m.team === 'PM')).map((m) => (m.team === 'PM' ? { ...m, isHead: false } : m))
    const members: Member[] = [{ userId: user.id, team: 'PM', isHead: true }, ...others]
    const problems = validateTeam(members)
    if (problems.length) fail(problems[0])
    input = { ...input, members }
    const id = newId('p')
    const p: Project = {
      id,
      slug: 'generic',
      name: input.name.trim(),
      description: input.description.trim(),
      ownerId: user.id,
      status: 'active',
      createdAt: at,
      members,
      away: [],
      templateVersions: Object.fromEntries(MAIN_DOCS.map((d) => [d, Math.max(...s.templates.filter((x) => x.docType === d).map((x) => x.version))])),
      facts: [],
      intake: { description: '', analysed: false },
    }
    s.projects.push(p)
    s.chats.push({ id: `${id}-chat`, projectId: id, kind: 'project', title: 'Project chat' })
    s.messages.push({ id: newId('msg'), chatId: `${id}-chat`, authorId: null, kind: 'system', body: `Project created by ${user.name}.`, createdAt: at })
    for (const userId of new Set(others.map((m) => m.userId)))
      notify(s, { to: [userId], type: 'invite', title: `You were added to ${p.name}`, body: `${user.name} added you as ${roleLabel(p, userId)}.`, link: `/projects/${id}`, projectId: id, at, exclude: user.id })
    audit(s, { projectId: id, actorId: user.id, action: 'Project created', details: others.length ? `${p.name} with ${new Set(members.map((m) => m.userId)).size} people` : `${p.name}, started alone (Owner and PM: ${user.name})`, at })
    void t
    return id
  })
}

export async function teamTemplates() {
  return read((s) => {
    const user = me(s)
    return s.teamTemplates.filter((x) => x.ownerId === user.id || user.isAdmin)
  })
}

export async function saveTeamTemplate(pid: ID, name: string) {
  return act((s, _t, at) => {
    const user = me(s)
    const p = projectOf(s, pid)
    ensure(can.addPeople(p, user.id, now()))
    if (!name.trim()) fail('Give the template a name.')
    s.teamTemplates.push({ id: newId('tt'), ownerId: user.id, name: name.trim(), members: structuredClone(p.members) })
    audit(s, { projectId: pid, actorId: user.id, action: 'Team template saved', details: name, at })
  })
}

// ─── Team changes ───────────────────────────────────────────────────────
// Adding people and making heads, deputies or SQA testers: the Owner or the PM.
// Replacing and removing people: the Owner. A person may hold several roles (the screens warn).

type Who = 'add' | 'owner'

function teamChange(pid: ID, who: Who, fn: (s: DemoState, p: Project, at: string, t: Date, actorName: string) => string) {
  return act((s, t, at) => {
    const user = me(s)
    const p = projectOf(s, pid)
    ensure(who === 'owner' ? can.manageTeam(p, user.id) : can.addPeople(p, user.id, t))
    const details = fn(s, p, at, t, user.name)
    const problems = validateTeam(p.members)
    if (problems.length) fail(problems[0])
    audit(s, { projectId: pid, actorId: user.id, action: 'Role change', details, at })
  })
}

function roleIn(s: DemoState, p: Project, userId: ID, team: Team) {
  const m = membershipIn(p, userId, team)
  if (!m) fail(`${nameOf(s, userId)} is not in the ${TEAM_LABEL[team]}.`)
  return m
}

export type NewRole = 'member' | 'head' | 'deputy' | 'sqa'

/** Adds someone to a team, as a member, the head, the deputy or (tech team) an SQA tester. */
export async function addMember(pid: ID, userId: ID, team: Team, role: NewRole = 'member') {
  return teamChange(pid, 'add', (s, p, at, _t, actor) => {
    const user = s.users.find((u) => u.id === userId)
    if (!user || user.deactivated) fail('Choose an active user.')
    if (membershipIn(p, userId, team)) fail(`${nameOf(s, userId)} is already in the ${TEAM_LABEL[team]}.`)
    if (role === 'sqa' && team !== 'TECH') fail('Only tech team members can be tagged SQA.')
    const m: Member = { userId, team }
    p.members.push(m)
    if (role === 'head') setHead(s, p, m, at)
    if (role === 'deputy') setDeputy(p, m)
    if (role === 'sqa') m.isSqa = true
    notify(s, { to: [userId], type: 'role', title: `You were added to ${p.name}`, body: `${actor} added you as ${memberLabel(m).toLowerCase()}.`, link: `/projects/${p.id}`, projectId: p.id, at })
    return `${nameOf(s, userId)} added as ${memberLabel(m)}`
  })
}

export async function removeMember(pid: ID, userId: ID, team: Team) {
  return teamChange(pid, 'owner', (s, p) => {
    const m = roleIn(s, p, userId, team)
    if (m.isHead) fail('Replace the head with someone else first (use “Replace”).')
    p.members = p.members.filter((x) => x !== m)
    return `${nameOf(s, userId)} removed from ${TEAM_LABEL[team]}`
  })
}

function setHead(s: DemoState, p: Project, m: Member, at: string) {
  const old = headOf(p, m.team)
  for (const x of p.members) if (x.team === m.team) x.isHead = false
  m.isHead = true
  m.isDeputy = false
  m.isSqa = false
  moveHeadWork(s, p, m.team, old?.userId, m.userId, at)
  return old
}

function setDeputy(p: Project, m: Member) {
  if (m.isHead) fail('The head cannot also be the deputy.')
  for (const x of p.members) if (x.team === m.team) x.isDeputy = false
  m.isDeputy = true
}

/** Makes someone the head of a team. A pending approval moves to them on the same version. */
export async function makeHead(pid: ID, userId: ID, team: Team) {
  return teamChange(pid, 'add', (s, p, at, _t, actor) => {
    const m = roleIn(s, p, userId, team)
    const old = setHead(s, p, m, at)
    notify(s, { to: [userId], type: 'role', title: `You are now ${HEAD_LABEL[team].toLowerCase()} of ${p.name}`, body: `${actor} made you ${HEAD_LABEL[team].toLowerCase()}. Anything waiting for the previous head now waits for you.`, link: `/projects/${p.id}`, projectId: p.id, at })
    return `${nameOf(s, userId)} is now ${HEAD_LABEL[team]}${old ? ` (replacing ${nameOf(s, old.userId)})` : ''}`
  })
}

export async function makeDeputy(pid: ID, userId: ID, team: Team) {
  return teamChange(pid, 'add', (s, p, at, _t, actor) => {
    const m = roleIn(s, p, userId, team)
    setDeputy(p, m)
    notify(s, { to: [userId], type: 'role', title: `You are now deputy ${HEAD_LABEL[team].toLowerCase()} in ${p.name}`, body: `${actor} made you deputy. You act for the head while they are Away.`, link: `/projects/${p.id}`, projectId: p.id, at })
    return `${nameOf(s, userId)} is now deputy ${HEAD_LABEL[team]}`
  })
}

export async function toggleSqa(pid: ID, userId: ID) {
  return teamChange(pid, 'add', (s, p) => {
    const m = membershipIn(p, userId, 'TECH')
    if (!m) fail('Only tech team members can be tagged SQA.')
    if (m.isHead) fail('The tech head is not tagged SQA.')
    m.isSqa = !m.isSqa
    return `${nameOf(s, userId)} ${m.isSqa ? 'tagged' : 'no longer tagged'} SQA`
  })
}

/** Replace a person with someone else in the same position (member, head or deputy). */
export async function replacePerson(pid: ID, oldId: ID, newId_: ID, team: Team) {
  return teamChange(pid, 'owner', (s, p, at, _t, owner) => {
    const m = roleIn(s, p, oldId, team)
    if (membershipIn(p, newId_, team)) fail(`${nameOf(s, newId_)} is already in the ${TEAM_LABEL[team]}.`)
    m.userId = newId_
    if (m.isHead) moveHeadWork(s, p, m.team, oldId, newId_, at)
    for (const q of s.questions.filter((q) => q.projectId === p.id && !q.answeredAt && q.team === team)) q.assigneeIds = q.assigneeIds.map((x) => (x === oldId ? newId_ : x))
    if (team === 'TECH') for (const d of s.defects.filter((d) => d.projectId === p.id && d.assigneeId === oldId)) d.assigneeId = newId_
    notify(s, { to: [newId_], type: 'role', title: `A role was reassigned to you in ${p.name}`, body: `${owner} gave you ${nameOf(s, oldId)}'s role (${memberLabel(m)}).`, link: `/projects/${p.id}`, projectId: p.id, at })
    return `${nameOf(s, oldId)} replaced by ${nameOf(s, newId_)} (${memberLabel(m)})`
  })
}

function moveHeadWork(s: DemoState, p: Project, team: Team, oldId: ID | undefined, newHeadId: ID, at: string) {
  s.chains = s.chains.map((c) => (c.projectId === p.id ? reassign(c, team, newHeadId) : c))
  const moved = s.chains.filter((c) => c.projectId === p.id && c.status === 'in_progress' && c.steps.some((st) => st.status === 'pending' && st.assigneeId === newHeadId))
  if (moved.length && oldId)
    notify(s, { to: [newHeadId], type: 'approval', title: 'An approval moved to you', body: `${moved.length} pending approval${moved.length > 1 ? 's' : ''} moved to you on the same version.`, link: `/projects/${p.id}`, projectId: p.id, at })
}

// ─── Away and archive ───────────────────────────────────────────────────

export async function setAway(pid: ID, userId: ID, fromIso: string | null, to: string) {
  return act((s, _t, at) => {
    const from = fromIso ?? at
    const user = me(s)
    const p = projectOf(s, pid)
    if (user.id !== userId) ensure(can.manageTeam(p, user.id))
    const roles = membershipsOf(p, userId).filter((x) => x.isHead || x.isDeputy)
    const m = roles[0]
    if (!m) fail('Only heads mark themselves Away (their deputy takes over).')
    const noDeputy = roles.find((r) => r.isHead && !p.members.some((x) => x.team === r.team && x.isDeputy))
    if (noDeputy) fail(`Add a deputy to the ${TEAM_LABEL[noDeputy.team]} first: while ${nameOf(s, userId)} is Away, the deputy approves and answers for them.`)
    if (new Date(to) <= new Date(from)) fail('The end date must be after the start date.')
    p.away = p.away.filter((a) => a.userId !== userId)
    p.away.push({ userId, from, to, setBy: user.id })
    const deputy = p.members.find((x) => roles.some((r) => r.isHead && r.team === x.team) && x.isDeputy)
    if (deputy) notify(s, { to: [deputy.userId], type: 'away', title: `You are covering for ${nameOf(s, userId)}`, body: `${nameOf(s, userId)} is Away until ${new Date(to).toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka' })}. Their approvals, signatures, questions and reminders come to you.`, link: `/projects/${pid}`, projectId: pid, at })
    audit(s, { projectId: pid, actorId: user.id, action: 'Away set', details: `${nameOf(s, userId)} Away until ${to.slice(0, 10)}`, at })
  })
}

export async function endAway(pid: ID, userId: ID) {
  return act((s, _t, at) => {
    const user = me(s)
    const p = projectOf(s, pid)
    if (user.id !== userId) ensure(can.manageTeam(p, user.id))
    p.away = p.away.filter((a) => a.userId !== userId)
    audit(s, { projectId: pid, actorId: user.id, action: 'Away ended', details: nameOf(s, userId), at })
  })
}

export async function archive(pid: ID) {
  return act((s, _t, at) => {
    const user = me(s)
    const p = projectOf(s, pid)
    ensure(can.archive(p, user.id))
    p.status = 'archived'
    p.archivedAt = at
    s.locks = s.locks.filter((l) => !s.docs.some((d) => d.id === l.docId && d.projectId === pid))
    audit(s, { projectId: pid, actorId: user.id, action: 'Project archived', details: p.name, at })
    notify(s, { to: p.members.map((m) => m.userId), type: 'archive', title: `${p.name} was archived`, body: 'The project is now read-only.', link: `/projects/${pid}`, projectId: pid, at, exclude: user.id })
  })
}

export async function projectAudit(pid: ID) {
  return read((s, t) => {
    const user = me(s)
    const p = projectOf(s, pid)
    const allowed = user.isAdmin || isOwner(p, user.id) || actAsHead(p, 'PM', user.id, t).ok || headOf(p, 'PM')?.userId === user.id
    if (!allowed) throw new ApiError(403, 'The audit log is shown to the Project Owner and the PM.')
    return s.audit.filter((a) => a.projectId === pid).map((a) => ({ ...a, actorName: a.actorId ? nameOf(s, a.actorId) : 'System', actingForName: a.actingFor ? nameOf(s, a.actingFor) : undefined }))
  })
}

export { STAGES }
