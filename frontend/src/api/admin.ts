/**
 * Admin: templates, users, settings, legacy project import, AI activity log, audit log,
 * and the demo controls (time travel, AI speed, reset).
 *
 * Spec: SPEC.md roles (Admin maintains templates), "Templates and export", RAG legacy import,
 * BUILD_PROMPT.md 3.1 (ai_calls log) and 3.6 (time travel for demos).
 */
import type { DocType, ID, Settings, TemplateSection, User } from '../types'
import { MAIN_DOCS } from '../types'
import { nowIso } from '../demo/clock'
import { newId } from '../demo/ids'
import { runJob } from '../demo/jobs'
import { getState, mutate, resetDemo } from '../demo/store'
import { aiStatus as aiStatusCheck } from '../ai/client'
import { tick } from '../demo/worker'
import { nextWorkingStart } from '../rules/workingHours'
import { DOC_LABEL } from '../rules/pipeline'
import { act, ApiError, fail, me, nameOf, read } from './core'
import { audit } from './effects'
import { now } from '../demo/clock'

function adminOnly(user: User) {
  if (!user.isAdmin) throw new ApiError(403, 'Only the Admin can do this.')
}

export async function getAdmin() {
  return read((s) => {
    const user = me(s)
    adminOnly(user)
    return {
      templates: s.templates,
      catalog: s.factCatalog,
      users: s.users,
      settings: s.settings,
      aiCalls: s.aiCalls.map((c) => ({ ...c, projectName: s.projects.find((p) => p.id === c.projectId)?.name })),
      audit: s.audit.slice(0, 300).map((a) => ({ ...a, actorName: a.actorId ? nameOf(s, a.actorId) : 'System', projectName: s.projects.find((p) => p.id === a.projectId)?.name })),
      legacy: s.projects.filter((p) => p.legacy),
    }
  })
}

export async function saveTemplate(docType: DocType, sections: TemplateSection[], note: string) {
  return act((s, _t, at) => {
    const user = me(s)
    adminOnly(user)
    if (!sections.length) fail('A template needs at least one section.')
    for (const sec of sections) if (!sec.key.match(/^[a-z_]+$/) || !sec.title.trim()) fail('Every section needs a title and a key made of lowercase letters and underscores.')
    const latest = Math.max(...s.templates.filter((t) => t.docType === docType).map((t) => t.version))
    s.templates.push({ docType, version: latest + 1, sections, createdAt: at, createdBy: user.id, placeholder: false, note: note.trim() || undefined })
    audit(s, { actorId: user.id, action: 'Template saved', details: `${DOC_LABEL[docType]} v${latest + 1} (projects keep their version until the PM switches)`, at })
  })
}

export async function saveSettings(patch: Partial<Settings>) {
  return act((s, _t, at) => {
    const user = me(s)
    adminOnly(user)
    s.settings = { ...s.settings, ...patch }
    audit(s, { actorId: user.id, action: 'Settings changed', details: Object.keys(patch).join(', '), at })
  })
}

export async function addUser(input: { name: string; email: string; title: string; department: string; external: boolean }) {
  return act((s, _t, at) => {
    const user = me(s)
    adminOnly(user)
    if (!input.name.trim() || !input.email.includes('@')) fail('Give a name and a valid email.')
    if (s.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) fail('This email already has an account.')
    s.users.push({ id: newId('u'), name: input.name.trim(), email: input.email.trim(), title: input.title.trim(), department: input.department.trim(), external: input.external })
    audit(s, { actorId: user.id, action: 'User added', details: `${input.name}${input.external ? ' (outside BRAC)' : ''}`, at })
  })
}

export async function toggleDeactivated(userId: ID) {
  return act((s, _t, at) => {
    const user = me(s)
    adminOnly(user)
    const u = s.users.find((x) => x.id === userId)!
    if (u.id === user.id) fail('You cannot deactivate yourself.')
    u.deactivated = !u.deactivated
    audit(s, { actorId: user.id, action: u.deactivated ? 'User deactivated' : 'User reactivated', details: u.name, at })
  })
}

/** Imports a pre-app project so the RAG agent can suggest from it. */
export async function importLegacy(input: { name: string; year: number; department: string; summary: string; memberNames: string[]; files: string[] }) {
  const user = await read((s) => me(s))
  adminOnly(user)
  if (!input.name.trim()) fail('Give the project a name.')
  if (!input.files.length) fail('Add at least one document (Word or PDF).')
  return runJob({
    agent: 'rag',
    title: `Importing ${input.name}`,
    byUserId: user.id,
    link: '/admin?tab=import',
    promptTokens: 0,
    steps: ['Reading the documents (text layer and OCR)', 'Splitting them into sections', 'Creating embeddings for each section', 'Adding them to the search index'],
    apply: (s) => {
      const at = nowIso()
      const pid = newId('p')
      const linked = input.memberNames.map((n) => s.users.find((u) => u.name.toLowerCase() === n.trim().toLowerCase()))
      s.projects.push({
        id: pid, slug: 'legacy', name: input.name.trim(), description: input.summary.trim(), summary: input.summary.trim(), ownerId: user.id, status: 'active', createdAt: at,
        members: linked.filter(Boolean).map((u, i) => ({ userId: u!.id, team: i === 0 ? 'PM' : 'TECH', isHead: i === 0 })), away: [], templateVersions: {}, facts: [],
        intake: { description: input.summary, analysed: true }, finished: true, finishedYear: input.year, department: input.department,
        legacy: { year: input.year, department: input.department, importedBy: user.id, files: input.files, memberNames: input.memberNames },
      })
      input.files.forEach((f, i) => {
        const guess = (MAIN_DOCS.find((d) => f.toLowerCase().includes(d.toLowerCase())) ?? MAIN_DOCS[Math.min(i, MAIN_DOCS.length - 1)]) as DocType
        const docId = `${pid}-${guess}-${i}`
        s.docs.push({ id: docId, projectId: pid, type: guess, title: `${DOC_LABEL[guess]} (imported: ${f})`, currentVersionId: `${docId}-v1` })
        s.versions.push({ id: `${docId}-v1`, docId, projectId: pid, number: 1, authorId: user.id, message: `Imported from ${f}`, kind: 'manual', sections: [{ id: `${docId}:imported`, key: 'imported', title: 'Imported text', content: `Text extracted from ${f} (simulated). In the real app the document is read with python-docx or PyMuPDF and Tesseract, split by section and indexed for the RAG agent.\n\n${input.summary}`, factKeys: [] }], regeneratedSectionIds: [], factSheetVersion: 0, templateVersion: 0, frozen: true, createdAt: at })
      })
      audit(s, { actorId: user.id, action: 'Legacy project imported', details: `${input.name} (${input.year}, ${input.department}), ${input.files.length} files`, at })
      const unmatched = input.memberNames.filter((_, i) => !linked[i])
      return `Imported and indexed.${unmatched.length ? ` Not linked to an account: ${unmatched.join(', ')}.` : ''}`
    },
  })
}

// ─── Demo controls ──────────────────────────────────────────────────────

export async function timeTravel(ms: number) {
  mutate((s) => {
    s.meta.timeOffsetMs += ms
  })
  return tick()
}

export async function jumpToNextWorkingMorning() {
  const s = getState()
  const t = now()
  const tomorrow = new Date(t.getTime() + 60 * 1000)
  let target = nextWorkingStart(tomorrow, s.settings)
  if (target.getTime() - t.getTime() < 60 * 60 * 1000) target = nextWorkingStart(new Date(t.getTime() + 18 * 3600 * 1000), s.settings)
  return timeTravel(target.getTime() - t.getTime())
}

export async function resetClock() {
  mutate((s) => {
    s.meta.timeOffsetMs = 0
  })
}

export async function setAiSpeed(speed: Settings['aiSpeed']) {
  mutate((s) => {
    s.settings.aiSpeed = speed
  })
}

/** Starts again: empty (users, settings and templates only), or with the demo projects loaded. */
export async function reset(withProjects = false) {
  await resetDemo(withProjects)
}

/** Is LM Studio running, which models does it offer, and are the chosen ones among them? */
export async function aiStatus() {
  const r = await aiStatusCheck()
  const { model, embedModel } = getState().settings.ai
  return { ...r, model, embedModel, modelFound: r.models.includes(model), embedFound: r.models.includes(embedModel) }
}

export async function demoInfo() {
  return read((s, t) => ({ now: t.toISOString(), offsetMs: s.meta.timeOffsetMs, aiSpeed: s.settings.aiSpeed, seedVersion: s.meta.seedVersion }))
}
