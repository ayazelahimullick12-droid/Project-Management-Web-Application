/**
 * Calendar endpoints (Messages → Calendar): the Google Calendar API v3 operations, inside the app.
 *   calendarList → calendars        events.list → listEvents      events.get → getEvent
 *   events.insert → createEvent     events.patch → updateEvent    events.delete → deleteEvent
 *   events.quickAdd → quickAddEvent attendee reply → respond       freebusy.query → freeBusyFor
 *   "Find a time" → suggest         events.import / export → exportIcs
 * sendUpdates ('all' | 'none') decides whether guests are notified, as in the API.
 * Changes to a repeating meeting apply to this occurrence, this and following, or all of them.
 *
 * Saved data: `events` is optional, so older saved data needs no change; the list is created
 * with the first meeting.
 */
import type { CalendarEvent, DemoState, EventAttendee, ID, Rsvp, User } from '../types'
import { newId } from '../demo/ids'
import { memberOf, isOwner, roleLabel } from '../rules/permissions'
import { clashes, expand, freeBusy, quickAdd, suggestTimes, toIcs, takesPart, DEFAULT_TZ } from '../rules/calendar'
import { act, ensure, fail, me, nameOf, projectOf, read } from './core'
import { audit, notify } from './effects'
import { can } from '../rules/permissions'

export type EventInput = Omit<CalendarEvent, 'id' | 'organizerId' | 'sequence' | 'createdAt' | 'updatedAt' | 'createdBy' | 'exdates' | 'recurringEventId' | 'originalStart'>
export type Scope = 'this' | 'following' | 'all'

const eventsOf = (s: DemoState) => s.events ?? []

/** Projects whose calendar this person sees: members, the Owner and admins. */
function myProjects(s: DemoState, user: User) {
  return s.projects.filter((p) => p.status === 'active' && (user.isAdmin || isOwner(p, user.id) || !!memberOf(p, user.id)))
}

/** Can this person see the event at all, and its details? Private events show only as "busy" to others. */
function access(s: DemoState, ev: CalendarEvent, user: User): 'none' | 'busy' | 'full' {
  const part = ev.organizerId === user.id || ev.attendees.some((a) => a.userId === user.id)
  if (part) return 'full'
  if (ev.calendarId === `user:${user.id}`) return 'full'
  const pid = ev.calendarId.startsWith('project:') ? ev.calendarId.slice(8) : undefined
  if (!pid || !myProjects(s, user).some((p) => p.id === pid)) return 'none'
  return ev.visibility === 'private' || ev.visibility === 'confidential' ? 'busy' : 'full'
}

const canEdit = (ev: CalendarEvent, user: User) => ev.organizerId === user.id || (ev.guestsCanModify && ev.attendees.some((a) => a.userId === user.id))

/** What a viewer may see of the event: guests are hidden when guests may not see each other. */
function view(s: DemoState, ev: CalendarEvent, user: User) {
  const level = access(s, ev, user)
  const organizer = { id: ev.organizerId, name: nameOf(s, ev.organizerId) }
  const me_ = ev.attendees.find((a) => a.userId === user.id)
  const seesGuests = ev.organizerId === user.id || ev.guestsCanSeeOtherGuests || ev.guestsCanModify
  const base = {
    ...ev,
    organizer,
    myResponse: me_?.responseStatus,
    myComment: me_?.comment,
    myGuests: me_?.additionalGuests,
    canEdit: canEdit(ev, user),
    canInvite: canEdit(ev, user) || (ev.guestsCanInviteOthers && !!me_),
    attendees: seesGuests ? ev.attendees : ev.attendees.filter((a) => a.userId === user.id),
    hiddenGuests: seesGuests ? 0 : ev.attendees.length - (me_ ? 1 : 0),
    calendarName: ev.calendarId.startsWith('project:') ? (s.projects.find((p) => p.id === ev.calendarId.slice(8))?.name ?? 'Project') : `${nameOf(s, ev.calendarId.slice(5))} (personal)`,
    chatTitle: ev.chatId ? s.chats.find((c) => c.id === ev.chatId)?.title : undefined,
  }
  if (level === 'busy') return { ...base, summary: 'Busy', description: undefined, location: undefined, attendees: [], attachments: [], conference: undefined, hiddenGuests: 0, limited: true as const }
  return { ...base, limited: false as const }
}

export type EventView = ReturnType<typeof view>

// ─── Reading ────────────────────────────────────────────────────────────

/** The calendars this person can show: their own, and one per project they are in. */
export async function calendars() {
  return read((s) => {
    const user = me(s)
    return [
      { id: `user:${user.id}`, name: 'My calendar', projectId: undefined as ID | undefined, canWrite: true },
      ...myProjects(s, user).map((p) => ({ id: `project:${p.id}`, name: p.name, projectId: p.id as ID | undefined, canWrite: can.change(p).ok })),
    ]
  })
}

/** Every occurrence between two times, in the chosen calendars (each occurrence carries its event). */
export async function listEvents(from: string, to: string, calendarIds?: string[]) {
  return read((s) => {
    const user = me(s)
    const out: { key: string; start: string; end: string; originalStart: string; event: EventView }[] = []
    for (const ev of eventsOf(s)) {
      if (ev.status === 'cancelled') continue
      const shown = calendarIds ? calendarIds.includes(ev.calendarId) || (ev.attendees.some((a) => a.userId === user.id) && calendarIds.includes(`user:${user.id}`)) : true
      if (!shown || access(s, ev, user) === 'none') continue
      const v = view(s, ev, user)
      for (const i of expand(ev, from, to)) out.push({ key: `${ev.id}:${i.originalStart}`, start: i.start, end: i.end, originalStart: ev.originalStart ?? i.originalStart, event: v })
    }
    return out.sort((a, b) => a.start.localeCompare(b.start))
  })
}

export async function getEvent(id: ID) {
  return read((s) => {
    const user = me(s)
    const ev = eventsOf(s).find((e) => e.id === id)
    if (!ev || access(s, ev, user) === 'none') fail('This meeting is not available.')
    return view(s, ev, user)
  })
}

/** People who can be invited: everyone with an active account, the project's members first. */
export async function people(projectId?: ID) {
  return read((s) => {
    const p = projectId ? s.projects.find((x) => x.id === projectId) : undefined
    const inProject = new Set(p ? [p.ownerId, ...p.members.map((m) => m.userId)] : [])
    return s.users
      .filter((u) => !u.deactivated)
      .map((u) => ({ id: u.id, name: u.name, email: u.email, title: u.title, role: p && inProject.has(u.id) ? roleLabel(p, u.id) : u.title, inProject: inProject.has(u.id) }))
      .sort((a, b) => Number(b.inProject) - Number(a.inProject) || a.name.localeCompare(b.name))
  })
}

/** freebusy.query: busy times of people (titles only for meetings the viewer may see). */
export async function freeBusyFor(userIds: ID[], from: string, to: string, ignoreEventId?: ID) {
  return read((s) => {
    const user = me(s)
    return freeBusy(eventsOf(s).filter((e) => e.id !== ignoreEventId), userIds, from, to).map((b) => {
      const ev = eventsOf(s).find((e) => e.id === b.eventId)!
      return { ...b, summary: access(s, ev, user) === 'full' ? b.summary : 'Busy', name: nameOf(s, b.userId) }
    })
  })
}

/** "Find a time": the next free slots for everyone, in working hours. */
export async function suggest(userIds: ID[], minutes: number, fromIso: string, tz = DEFAULT_TZ, ignoreEventId?: ID) {
  return read((s) => {
    const to = new Date(Date.parse(fromIso) + 21 * 86400000).toISOString()
    return suggestTimes(freeBusy(eventsOf(s).filter((e) => e.id !== ignoreEventId), userIds, fromIso, to), fromIso, minutes, tz)
  })
}

/** An .ics file of one meeting (or several). */
export async function exportIcs(ids: ID[]) {
  return read((s) => {
    const user = me(s)
    const evs = eventsOf(s).filter((e) => ids.includes(e.id) && access(s, e, user) === 'full')
    return toIcs(evs.map((e) => ({ ...e, organizerEmail: s.users.find((u) => u.id === e.organizerId)?.email })))
  })
}

// ─── Changing ───────────────────────────────────────────────────────────

function check(s: DemoState, user: User, input: Partial<EventInput>) {
  if (input.summary !== undefined && !input.summary.trim() && input.eventType === 'default') fail('Give the meeting a title.')
  if (input.start && input.end) {
    const bad = input.allDay ? input.end <= input.start : Date.parse(input.end) <= Date.parse(input.start)
    if (bad) fail('The end must be after the start.')
  }
  if (input.calendarId?.startsWith('project:')) {
    const p = projectOf(s, input.calendarId.slice(8))
    ensure(can.change(p))
    if (!(user.isAdmin || isOwner(p, user.id) || memberOf(p, user.id))) fail('Only people in the project can add to its calendar.')
  } else if (input.calendarId && input.calendarId !== `user:${user.id}`) fail('You can only add to your own calendar or a project calendar.')
  if (input.recurrence?.count !== undefined && input.recurrence.count < 1) fail('A repeat needs at least 1 time.')
}

/** Guests in the app get a notification; email guests "get an email" (kept in the Mailbox). */
function tell(s: DemoState, ev: CalendarEvent, by: User, at: string, what: 'invite' | 'update' | 'cancel', send: 'all' | 'none', to?: EventAttendee[]) {
  if (send === 'none') return
  const people = (to ?? ev.attendees).filter((a) => a.userId && a.userId !== by.id)
  const when = new Date(ev.start).toLocaleString('en-GB', { timeZone: ev.timeZone, weekday: 'short', day: 'numeric', month: 'short', hour: ev.allDay ? undefined : '2-digit', minute: ev.allDay ? undefined : '2-digit' })
  const title = what === 'invite' ? `Invitation: ${ev.summary}` : what === 'update' ? `Updated: ${ev.summary}` : `Cancelled: ${ev.summary}`
  if (people.length) notify(s, { to: people.map((a) => a.userId!), type: 'meeting', title, body: `${by.name} · ${when}${ev.location ? ` · ${ev.location}` : ''}`, link: `/messages/calendar?event=${ev.id}`, projectId: ev.projectId, at })
  for (const a of (to ?? ev.attendees).filter((x) => !x.userId && x.email))
    s.emails.unshift({ id: newId('mail'), to: a.email, subject: title, body: `${by.name} ${what === 'cancel' ? 'cancelled' : what === 'update' ? 'updated' : 'invited you to'} "${ev.summary}" on ${when}.\n\n— BRAC Project Management (prototype)`, createdAt: at })
}

/** A meeting card in the chat it was scheduled from. */
function postCard(s: DemoState, ev: CalendarEvent, by: User, at: string, text: string) {
  if (!ev.chatId || !s.chats.some((c) => c.id === ev.chatId)) return
  s.messages.push({ id: newId('msg'), chatId: ev.chatId, authorId: null, body: `${by.name} ${text}: ${ev.summary}`, createdAt: at, kind: 'system', eventId: ev.id })
}

export async function createEvent(input: EventInput, sendUpdates: 'all' | 'none' = 'all') {
  return act((s, _t, at) => {
    const user = me(s)
    check(s, user, input)
    const ev: CalendarEvent = {
      ...input,
      summary: input.summary.trim() || (input.eventType === 'outOfOffice' ? 'Out of office' : input.eventType === 'focusTime' ? 'Focus time' : input.eventType === 'workingLocation' ? 'Working location' : 'Meeting'),
      projectId: input.calendarId.startsWith('project:') ? input.calendarId.slice(8) : input.projectId,
      attendees: input.attendees.filter((a) => a.userId !== user.id).map((a) => ({ ...a, responseStatus: 'needsAction' as Rsvp })),
      id: newId('evt'), organizerId: user.id, sequence: 0, createdAt: at, updatedAt: at, createdBy: user.id,
    }
    // Out of office / focus time with auto-decline: decline the meetings already in that time
    if (ev.autoDecline?.on && (ev.eventType === 'outOfOffice' || ev.eventType === 'focusTime')) {
      for (const other of eventsOf(s)) {
        const mine = other.attendees.find((a) => a.userId === user.id && a.responseStatus !== 'declined')
        if (mine && expand(other, ev.start, ev.end).length) Object.assign(mine, { responseStatus: 'declined', comment: ev.autoDecline.message || 'Declined automatically.' })
      }
    }
    s.events = [...eventsOf(s), ev]
    tell(s, ev, user, at, 'invite', sendUpdates)
    postCard(s, ev, user, at, 'scheduled a meeting')
    if (ev.projectId) audit(s, { projectId: ev.projectId, actorId: user.id, action: 'Meeting scheduled', details: ev.summary, at })
    return { id: ev.id }
  })
}

/**
 * events.patch. For a repeating meeting: 'this' changes one occurrence (an exception),
 * 'following' ends the series and starts a new one from this occurrence, 'all' changes the series.
 */
export async function updateEvent(id: ID, patch: Partial<EventInput>, scope: Scope = 'all', originalStart?: string, sendUpdates: 'all' | 'none' = 'all') {
  return act((s, _t, at) => {
    const user = me(s)
    const ev = eventsOf(s).find((e) => e.id === id)
    if (!ev) fail('This meeting no longer exists.')
    const guestInviting = !canEdit(ev, user) && ev.guestsCanInviteOthers && ev.attendees.some((a) => a.userId === user.id)
    if (!canEdit(ev, user)) {
      // A guest who may invite others can only add guests
      if (!guestInviting || Object.keys(patch).some((k) => k !== 'attendees')) fail('Only the organiser can change this meeting.')
      const added = (patch.attendees ?? []).filter((a) => !ev.attendees.some((b) => b.email === a.email))
      ev.attendees.push(...added.map((a) => ({ ...a, responseStatus: 'needsAction' as Rsvp })))
      ev.updatedAt = at
      tell(s, ev, user, at, 'invite', sendUpdates, added)
      return { id: ev.id }
    }
    check(s, user, { ...ev, ...patch })
    const before = new Set(ev.attendees.map((a) => a.email))
    const keep = (list?: EventAttendee[]) => list?.map((a) => ({ ...a, responseStatus: ev.attendees.find((b) => b.email === a.email)?.responseStatus ?? ('needsAction' as Rsvp), comment: ev.attendees.find((b) => b.email === a.email)?.comment }))
    let target = ev
    if (ev.recurrence && scope !== 'all' && originalStart) {
      if (scope === 'this') {
        // One occurrence: remove its slot from the series, add a stand-alone copy
        ev.exdates = [...(ev.exdates ?? []), originalStart]
        const len = ev.allDay ? 0 : Date.parse(ev.end) - Date.parse(ev.start)
        target = { ...structuredClone(ev), id: newId('evt'), recurrence: undefined, exdates: undefined, recurringEventId: ev.id, originalStart, start: originalStart, end: ev.allDay ? originalStart : new Date(Date.parse(originalStart) + len).toISOString() }
        s.events = [...eventsOf(s), target]
      } else {
        // This and following: the series ends the day before; a new series starts here
        const day = new Date(Date.parse(originalStart) - 86400000).toISOString().slice(0, 10)
        const rest: CalendarEvent = { ...structuredClone(ev), id: newId('evt'), start: originalStart, end: ev.allDay ? originalStart : new Date(Date.parse(originalStart) + Date.parse(ev.end) - Date.parse(ev.start)).toISOString(), exdates: (ev.exdates ?? []).filter((x) => x >= originalStart) }
        if (rest.recurrence?.count) rest.recurrence = { ...rest.recurrence, count: Math.max(1, rest.recurrence.count - expand(ev, ev.start, originalStart).length) }
        ev.recurrence = { ...ev.recurrence, until: day, count: undefined }
        s.events = [...eventsOf(s), rest]
        target = rest
      }
    }
    Object.assign(target, { ...patch, attendees: keep(patch.attendees) ?? target.attendees, updatedAt: at, sequence: target.sequence + 1 })
    // Moving the time asks guests to reply again (as Google does)
    if (patch.start && patch.start !== ev.start) for (const a of target.attendees) a.responseStatus = 'needsAction'
    const added = target.attendees.filter((a) => !before.has(a.email))
    tell(s, target, user, at, 'update', sendUpdates, target.attendees.filter((a) => before.has(a.email)))
    tell(s, target, user, at, 'invite', sendUpdates, added)
    postCard(s, target, user, at, 'updated the meeting')
    return { id: target.id }
  })
}

/** events.delete: this occurrence, this and following, or all. Guests are told when sendUpdates is 'all'. */
export async function deleteEvent(id: ID, scope: Scope = 'all', originalStart?: string, sendUpdates: 'all' | 'none' = 'all') {
  return act((s, _t, at) => {
    const user = me(s)
    const ev = eventsOf(s).find((e) => e.id === id)
    if (!ev) fail('This meeting no longer exists.')
    if (ev.organizerId !== user.id) fail('Only the organiser can delete the meeting. You can decline it.')
    if (ev.recurrence && originalStart && scope === 'this') ev.exdates = [...(ev.exdates ?? []), originalStart]
    else if (ev.recurrence && originalStart && scope === 'following') ev.recurrence = { ...ev.recurrence, until: new Date(Date.parse(originalStart) - 86400000).toISOString().slice(0, 10), count: undefined }
    else ev.status = 'cancelled'
    ev.updatedAt = at
    tell(s, ev, user, at, 'cancel', sendUpdates)
    postCard(s, ev, user, at, scope === 'all' ? 'cancelled the meeting' : 'cancelled an occurrence of the meeting')
    if (ev.projectId) audit(s, { projectId: ev.projectId, actorId: user.id, action: 'Meeting cancelled', details: ev.summary, at })
  })
}

/** A guest replies: Yes, No or Maybe, with a note and "+N guests" (for the whole series). */
export async function respond(id: ID, status: Rsvp, comment?: string, additionalGuests?: number) {
  return act((s, _t, at) => {
    const user = me(s)
    const ev = eventsOf(s).find((e) => e.id === id)
    const a = ev?.attendees.find((x) => x.userId === user.id)
    if (!ev || !a) fail('You are not invited to this meeting.')
    Object.assign(a, { responseStatus: status, comment: comment?.trim() || undefined, additionalGuests: additionalGuests || undefined })
    ev.updatedAt = at
    const word = { accepted: 'accepted', declined: 'declined', tentative: 'said maybe to', needsAction: 'has not replied to' }[status]
    notify(s, { to: [ev.organizerId], type: 'meeting', title: `${user.name} ${word} ${ev.summary}`, body: comment?.trim() || 'No note.', link: `/messages/calendar?event=${ev.id}`, projectId: ev.projectId, at, email: false, exclude: user.id })
  })
}

/** events.quickAdd: "Sprint review Wednesday 3pm for 90 minutes" → a meeting (in a chat: with its people). */
export async function quickAddEvent(text: string, opts: { calendarId?: string; chatId?: ID; nowIso: string }) {
  if (!text.trim()) fail('Type what and when, e.g. “Review tomorrow at 3pm”.')
  const s0 = await read((s) => s)
  const user = me(s0)
  const q = quickAdd(text, opts.nowIso, DEFAULT_TZ)
  const chat = opts.chatId ? s0.chats.find((c) => c.id === opts.chatId) : undefined
  const calendarId = opts.calendarId ?? (chat?.projectId && chat.kind !== 'direct' ? `project:${chat.projectId}` : `user:${user.id}`)
  const ids = chat ? (chat.memberIds ?? (chat.projectId ? [...new Set(projectOf(s0, chat.projectId).members.map((m) => m.userId))] : [])) : []
  const attendees = s0.users.filter((u) => ids.includes(u.id) && u.id !== user.id && !u.deactivated).map((u) => ({ userId: u.id, email: u.email, name: u.name, responseStatus: 'needsAction' as Rsvp }))
  return createEvent({ ...defaults(calendarId), summary: q.summary, start: q.start, end: q.end, recurrence: q.recurrence, attendees, chatId: opts.chatId })
}

/** A new event's settings (Google's defaults: busy, default visibility, a popup 10 minutes before). */
export function defaults(calendarId: string): EventInput {
  return {
    calendarId, eventType: 'default', summary: '', allDay: false, start: '', end: '', timeZone: DEFAULT_TZ, attendees: [],
    guestsCanModify: false, guestsCanInviteOthers: true, guestsCanSeeOtherGuests: true,
    reminders: { useDefault: true, overrides: [] }, transparency: 'opaque', visibility: 'default', status: 'confirmed', attachments: [],
  }
}

/** Popup reminders due now for this person (shown once each), checked every minute by the app. */
export async function dueReminders(nowIso: string) {
  // Look first without saving; save only when something is due (so the check every minute writes nothing)
  const found = await read((s) => findDue(s, me(s), nowIso))
  if (!found.length) return found
  return act((s) => {
    const due = findDue(s, me(s), nowIso)
    if (due.length) s.remindersShown = [...(s.remindersShown ?? []), ...due.map((d) => d.key)].slice(-500)
    return due
  })
}

function findDue(s: DemoState, user: User, nowIso: string) {
  {
    const shown = new Set(s.remindersShown ?? [])
    const due: { key: string; eventId: ID; summary: string; start: string; minutes: number }[] = []
    const from = new Date(Date.parse(nowIso) - 60 * 60000).toISOString()
    const to = new Date(Date.parse(nowIso) + 7 * 86400000).toISOString()
    for (const ev of eventsOf(s)) {
      if (ev.status === 'cancelled' || !takesPart(ev, user.id) || ev.allDay) continue
      const list = ev.reminders.useDefault ? [{ method: 'popup' as const, minutes: 10 }] : ev.reminders.overrides.filter((r) => r.method === 'popup')
      for (const i of expand(ev, from, to))
        for (const r of list) {
          const at = Date.parse(i.start) - r.minutes * 60000
          const key = `${user.id}:${ev.id}:${i.start}:${r.minutes}`
          if (at <= Date.parse(nowIso) && Date.parse(i.start) > Date.parse(nowIso) - 5 * 60000 && !shown.has(key)) due.push({ key, eventId: ev.id, summary: ev.summary, start: i.start, minutes: r.minutes })
        }
    }
    return due
  }
}

/** Is someone free for [start, end)? (used to warn about clashes while editing) */
export async function clashesFor(userIds: ID[], start: string, end: string, ignoreEventId?: ID) {
  return read((s) => clashes(freeBusy(eventsOf(s), userIds, start, end), start, end, ignoreEventId).map((b) => ({ ...b, name: nameOf(s, b.userId) })))
}
