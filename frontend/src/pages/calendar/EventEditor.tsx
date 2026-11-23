/**
 * Create or change a meeting, with the options of a Google Calendar event:
 * type (event, out of office, focus time, working location), title, all day, start and end with
 * time zone, repeat (presets and custom), guests (optional, permissions), free/busy with clashes and
 * "Find a time", video call in the app, location, description, attachments, calendar, colour,
 * busy/free, visibility, reminders (popup / email), and whether guests are told.
 */
import { clsx } from 'clsx'
import { AlertTriangle, Paperclip, Plus, Sparkles, Trash2, Video, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api'
import { useAction, useApi } from '../../api/hooks'
import type { EventInput, Scope } from '../../api/calendar'
import type { EventAttendee, Recurrence, Weekday } from '../../types'
import { describeRecurrence, EVENT_COLORS, utcToZoned, WEEKDAYS, WEEKDAY_NAME, zonedToUtc, DEFAULT_TZ } from '../../rules/calendar'
import { FileButton } from '../../components/FileButton'
import { Button, Checkbox, Field, Input, Modal, Segmented, Select, Textarea } from '../../components/ui'
import { now } from '../../demo/clock'

export interface EditorStart extends Partial<EventInput> {
  id?: string // editing an existing meeting
  originalStart?: string // the occurrence being edited (repeating meetings)
  repeating?: boolean
}

const TZS = ['Asia/Dhaka', 'UTC', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'America/New_York']
const MINUTES = [0, 5, 10, 15, 30, 60, 120, 1440, 10080]
const minutesLabel = (m: number) => (m === 0 ? 'At the start' : m < 60 ? `${m} minutes before` : m < 1440 ? `${m / 60} hour${m > 60 ? 's' : ''} before` : m < 10080 ? `${m / 1440} day before` : '1 week before')
const addDays = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)

/** The wall-clock form of the times, in the event's time zone. */
function toForm(start: string, end: string, allDay: boolean, tz: string) {
  if (allDay) return { sd: start, st: '09:00', ed: addDays(end, -1), et: '10:00' }
  const a = utcToZoned(start, tz)
  const b = utcToZoned(end, tz)
  return { sd: a.date, st: a.time, ed: b.date, et: b.time }
}

export function EventEditor({ open, onClose, start, onSaved }: { open: boolean; onClose: () => void; start: EditorStart; onSaved?: (id: string) => void }) {
  const { data: cals } = useApi(['calendars'], api.calendar.calendars, open)
  const projectId = start.calendarId?.startsWith('project:') ? start.calendarId.slice(8) : start.projectId
  const { data: people } = useApi(['cal-people', projectId], () => api.calendar.people(projectId), open)
  const [f, setF] = useState<EventInput>(() => ({ ...api.calendar.defaults(start.calendarId ?? ''), ...start }) as EventInput)
  const [t, setT] = useState(() => {
    const s0 = start.start || zonedToUtc(utcToZoned(now().toISOString(), DEFAULT_TZ).date, '10:00', DEFAULT_TZ)
    const e0 = start.end || new Date(Date.parse(s0) + 3600000).toISOString()
    return toForm(s0, e0, !!start.allDay, start.timeZone ?? DEFAULT_TZ)
  })
  const [repeatMode, setRepeatMode] = useState<string>(start.recurrence ? 'custom' : 'none')
  const [custom, setCustom] = useState<Recurrence>(start.recurrence ?? { freq: 'WEEKLY', interval: 1 })
  const [ends, setEnds] = useState<'never' | 'on' | 'after'>(start.recurrence?.until ? 'on' : start.recurrence?.count ? 'after' : 'never')
  const [email, setEmail] = useState('')
  const [scope, setScope] = useState<Scope>('this')
  const [send, setSend] = useState(true)
  const set = (patch: Partial<EventInput>) => setF((x) => ({ ...x, ...patch }))

  // When the window opens for another meeting, start again from it
  useEffect(() => {
    if (!open) return
    setF({ ...api.calendar.defaults(start.calendarId ?? ''), ...start } as EventInput)
    const s0 = start.start || zonedToUtc(utcToZoned(now().toISOString(), DEFAULT_TZ).date, '10:00', DEFAULT_TZ)
    setT(toForm(s0, start.end || new Date(Date.parse(s0) + 3600000).toISOString(), !!start.allDay, start.timeZone ?? DEFAULT_TZ))
    setRepeatMode(start.recurrence ? 'custom' : 'none')
    setCustom(start.recurrence ?? { freq: 'WEEKLY', interval: 1 })
    setEnds(start.recurrence?.until ? 'on' : start.recurrence?.count ? 'after' : 'never')
    setScope(start.repeating ? 'this' : 'all')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, start.id, start.originalStart, start.start])
  useEffect(() => {
    if (open && !f.calendarId && cals?.length) set({ calendarId: cals[0].id })
  }, [open, cals, f.calendarId])

  // The times in UTC (all day: dates, end exclusive)
  const times = useMemo(() => {
    if (f.allDay) return { start: t.sd, end: addDays(t.ed < t.sd ? t.sd : t.ed, 1) }
    return { start: zonedToUtc(t.sd, t.st, f.timeZone), end: zonedToUtc(t.ed, t.et, f.timeZone) }
  }, [t, f.allDay, f.timeZone])
  const weekday = WEEKDAYS[new Date(t.sd + 'T00:00:00Z').getUTCDay()]
  const nth = Math.ceil(Number(t.sd.slice(8, 10)) / 7)

  // The repeat, from the preset or the custom settings
  const recurrence: Recurrence | undefined = useMemo(() => {
    const endPart = (r: Recurrence): Recurrence => ({ ...r, count: ends === 'after' ? (r.count ?? 10) : undefined, until: ends === 'on' ? (r.until ?? addDays(t.sd, 90)) : undefined })
    switch (repeatMode) {
      case 'none': return undefined
      case 'daily': return { freq: 'DAILY', interval: 1 }
      case 'weekly': return { freq: 'WEEKLY', interval: 1, byDay: [weekday] }
      case 'workdays': return { freq: 'WEEKLY', interval: 1, byDay: ['SU', 'MO', 'TU', 'WE', 'TH'] }
      case 'monthly': return { freq: 'MONTHLY', interval: 1, monthlyBy: 'monthday' }
      case 'monthlyWeekday': return { freq: 'MONTHLY', interval: 1, monthlyBy: 'weekday' }
      case 'yearly': return { freq: 'YEARLY', interval: 1 }
      default: return endPart(custom)
    }
  }, [repeatMode, custom, ends, weekday, t.sd])

  // Free / busy of the guests (and the organiser) at the chosen time
  const guestIds = f.attendees.map((a) => a.userId).filter(Boolean) as string[]
  const { data: clash } = useApi(['cal-clash', guestIds.join(','), times.start, times.end, start.id], () => api.calendar.clashesFor(guestIds, f.allDay ? zonedToUtc(times.start, '00:00', f.timeZone) : times.start, f.allDay ? zonedToUtc(times.end, '00:00', f.timeZone) : times.end, start.id), open && guestIds.length > 0 && !f.allDay)
  const minutes = f.allDay ? 60 : Math.max(15, Math.round((Date.parse(times.end) - Date.parse(times.start)) / 60000))
  const [findTime, setFindTime] = useState(false)
  const { data: slots } = useApi(['cal-suggest', guestIds.join(','), minutes, findTime], () => api.calendar.suggest(guestIds, minutes, now().toISOString(), f.timeZone, start.id), open && findTime)

  const create = useAction(api.calendar.createEvent, { success: 'Meeting saved.', onDone: (r) => { onSaved?.(r.id); onClose() } })
  const update = useAction(api.calendar.updateEvent, { success: 'Meeting updated.', onDone: (r) => { onSaved?.(r.id); onClose() } })
  const busy = create.pending || update.pending
  const save = () => {
    const body: EventInput = { ...f, ...times, recurrence: f.eventType === 'workingLocation' || !start.repeating || scope !== 'this' ? recurrence : undefined }
    if (start.id) update.run(start.id, body, start.repeating ? scope : 'all', start.originalStart, send ? 'all' : 'none')
    else create.run(body, send ? 'all' : 'none')
  }

  const addPerson = (id: string) => {
    const p = people?.find((x) => x.id === id)
    if (!p || f.attendees.some((a) => a.userId === id)) return
    set({ attendees: [...f.attendees, { userId: p.id, email: p.email, name: p.name, responseStatus: 'needsAction' }] })
  }
  const addEmail = () => {
    const e = email.trim()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) || f.attendees.some((a) => a.email === e)) return
    set({ attendees: [...f.attendees, { email: e, name: e, responseStatus: 'needsAction' }] })
    setEmail('')
  }
  const editGuest = (i: number, patch: Partial<EventAttendee>) => set({ attendees: f.attendees.map((a, j) => (j === i ? { ...a, ...patch } : a)) })
  const isMeeting = f.eventType === 'default'
  const pickSlot = (s: { start: string; end: string }) => {
    const a = utcToZoned(s.start, f.timeZone)
    const b = utcToZoned(s.end, f.timeZone)
    setT({ sd: a.date, st: a.time, ed: b.date, et: b.time })
    setFindTime(false)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={start.id ? 'Change the meeting' : 'New meeting'}
      footer={
        <div className="flex w-full flex-wrap items-center gap-3">
          {start.repeating && (
            <Select value={scope} onChange={(e) => setScope(e.target.value as Scope)} aria-label="Which occurrences to change" className="!w-auto">
              <option value="this">This event</option>
              <option value="following">This and following events</option>
              <option value="all">All events</option>
            </Select>
          )}
          {f.attendees.length > 0 && <Checkbox label="Tell the guests" checked={send} onChange={setSend} />}
          <span className="flex-1" />
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={busy} onClick={save}>Save</Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Segmented
          value={f.eventType}
          onChange={(x) => set({ eventType: x as EventInput['eventType'], transparency: x === 'workingLocation' ? 'transparent' : 'opaque' })}
          options={[
            { id: 'default', label: 'Meeting' },
            { id: 'outOfOffice', label: 'Out of office' },
            { id: 'focusTime', label: 'Focus time' },
            { id: 'workingLocation', label: 'Working location' },
          ]}
        />
        <Input value={f.summary} onChange={(e) => set({ summary: e.target.value })} placeholder={isMeeting ? 'Add a title' : 'Title (optional)'} aria-label="Title" className="!text-lg" autoFocus />

        {/* When */}
        <div className="space-y-3 rounded-xl bg-canvas/60 p-4 ring-1 ring-line">
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Starts"><Input type="date" value={t.sd} onChange={(e) => setT({ ...t, sd: e.target.value, ed: e.target.value > t.ed ? e.target.value : t.ed })} /></Field>
            {!f.allDay && <Field label="at"><Input type="time" value={t.st} onChange={(e) => setT({ ...t, st: e.target.value })} /></Field>}
            <Field label="Ends"><Input type="date" value={t.ed} onChange={(e) => setT({ ...t, ed: e.target.value })} /></Field>
            {!f.allDay && <Field label="at"><Input type="time" value={t.et} onChange={(e) => setT({ ...t, et: e.target.value })} /></Field>}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Checkbox label="All day" checked={f.allDay} onChange={(v) => set({ allDay: v })} />
            <label className="flex items-center gap-2 text-sm">
              Time zone
              <Select value={f.timeZone} onChange={(e) => set({ timeZone: e.target.value })} className="!w-auto">
                {TZS.map((z) => <option key={z} value={z}>{z}</option>)}
              </Select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={repeatMode} onChange={(e) => setRepeatMode(e.target.value)} aria-label="Repeat" className="!w-auto">
              <option value="none">Does not repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly on {WEEKDAY_NAME[weekday]}</option>
              <option value="workdays">Every weekday (Sunday to Thursday)</option>
              <option value="monthly">Monthly on day {Number(t.sd.slice(8, 10))}</option>
              <option value="monthlyWeekday">Monthly on the {['first', 'second', 'third', 'fourth', 'fifth'][nth - 1]} {WEEKDAY_NAME[weekday]}</option>
              <option value="yearly">Yearly</option>
              <option value="custom">Custom…</option>
            </Select>
            {recurrence && <span className="text-sm text-muted">{describeRecurrence(recurrence, times.start, f.timeZone)}</span>}
          </div>
          {repeatMode === 'custom' && (
            <div className="space-y-3 rounded-lg bg-paper p-3 ring-1 ring-line">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                Every <Input type="number" min={1} value={custom.interval} onChange={(e) => setCustom({ ...custom, interval: Math.max(1, Number(e.target.value)) })} className="!w-20" />
                <Select value={custom.freq} onChange={(e) => setCustom({ ...custom, freq: e.target.value as Recurrence['freq'] })} className="!w-auto">
                  <option value="DAILY">day(s)</option>
                  <option value="WEEKLY">week(s)</option>
                  <option value="MONTHLY">month(s)</option>
                  <option value="YEARLY">year(s)</option>
                </Select>
                {custom.freq === 'MONTHLY' && (
                  <Select value={custom.monthlyBy ?? 'monthday'} onChange={(e) => setCustom({ ...custom, monthlyBy: e.target.value as 'monthday' | 'weekday' })} className="!w-auto">
                    <option value="monthday">on day {Number(t.sd.slice(8, 10))}</option>
                    <option value="weekday">on the {['first', 'second', 'third', 'fourth', 'fifth'][nth - 1]} {WEEKDAY_NAME[weekday]}</option>
                  </Select>
                )}
              </div>
              {custom.freq === 'WEEKLY' && (
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Repeat on">
                  {WEEKDAYS.map((d) => {
                    const on = (custom.byDay ?? [weekday]).includes(d)
                    return (
                      <button key={d} type="button" aria-pressed={on} onClick={() => { const cur = custom.byDay ?? [weekday]; const next = on ? cur.filter((x) => x !== d) : [...cur, d]; setCustom({ ...custom, byDay: (next.length ? next : [weekday]).sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b)) as Weekday[] }) }} className={clsx('h-9 w-9 rounded-full text-sm font-medium ring-1', on ? 'bg-brand text-white ring-brand' : 'ring-line hover:bg-ink/5')}>
                        {WEEKDAY_NAME[d][0]}
                      </button>
                    )
                  })}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3 text-sm">
                Ends
                <Select value={ends} onChange={(e) => setEnds(e.target.value as typeof ends)} className="!w-auto">
                  <option value="never">Never</option>
                  <option value="on">On a date</option>
                  <option value="after">After a number of times</option>
                </Select>
                {ends === 'on' && <Input type="date" value={custom.until ?? addDays(t.sd, 90)} onChange={(e) => setCustom({ ...custom, until: e.target.value })} className="!w-auto" />}
                {ends === 'after' && <><Input type="number" min={1} value={custom.count ?? 10} onChange={(e) => setCustom({ ...custom, count: Math.max(1, Number(e.target.value)) })} className="!w-20" /> times</>}
              </div>
            </div>
          )}
        </div>

        {/* Out of office, focus time, working location */}
        {(f.eventType === 'outOfOffice' || f.eventType === 'focusTime') && (
          <div className="space-y-2 rounded-xl p-4 ring-1 ring-line">
            <Checkbox label="Decline new and existing invitations in this time" checked={!!f.autoDecline?.on} onChange={(v) => set({ autoDecline: { on: v, message: f.autoDecline?.message } })} />
            {f.autoDecline?.on && <Input value={f.autoDecline.message ?? ''} onChange={(e) => set({ autoDecline: { on: true, message: e.target.value } })} placeholder="Message with the decline (optional)" />}
            {f.eventType === 'focusTime' && <Checkbox label="Set my chat status to “Do not disturb”" checked={f.focusChatStatus === 'doNotDisturb'} onChange={(v) => set({ focusChatStatus: v ? 'doNotDisturb' : 'available' })} />}
          </div>
        )}
        {f.eventType === 'workingLocation' && (
          <div className="flex flex-wrap gap-2 rounded-xl p-4 ring-1 ring-line">
            <Select value={f.workingLocation?.type ?? 'officeLocation'} onChange={(e) => set({ workingLocation: { type: e.target.value as 'homeOffice' | 'officeLocation' | 'customLocation', label: f.workingLocation?.label } })} className="!w-auto">
              <option value="officeLocation">Office</option>
              <option value="homeOffice">Home</option>
              <option value="customLocation">Somewhere else</option>
            </Select>
            <Input value={f.workingLocation?.label ?? ''} onChange={(e) => set({ workingLocation: { type: f.workingLocation?.type ?? 'officeLocation', label: e.target.value } })} placeholder="e.g. BRAC Centre, Mohakhali" />
          </div>
        )}

        {/* Guests */}
        {isMeeting && (
          <div className="space-y-3">
            <div className="text-sm font-semibold">Guests</div>
            <div className="flex flex-wrap gap-2">
              <Select value="" onChange={(e) => addPerson(e.target.value)} aria-label="Add a person" className="!w-auto min-w-56">
                <option value="">Add people…</option>
                {people?.filter((p) => !f.attendees.some((a) => a.userId === p.id)).map((p) => (
                  <option key={p.id} value={p.id}>{p.name} · {p.role}{p.inProject ? '' : ' (not in the project)'}</option>
                ))}
              </Select>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEmail())} placeholder="or an email address" aria-label="Guest email" className="!w-56" />
              <Button onClick={addEmail} disabled={!email.trim()}><Plus className="h-4 w-4" /> Add</Button>
            </div>
            {f.attendees.length > 0 && (
              <ul className="divide-y divide-line rounded-xl ring-1 ring-line">
                {f.attendees.map((a, i) => {
                  const theirs = clash?.filter((c) => c.userId === a.userId) ?? []
                  return (
                    <li key={a.email} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{a.name}{!a.userId && <span className="ml-1 text-muted">(email guest)</span>}</div>
                        {theirs.length > 0 && <div className="flex items-center gap-1 text-amber-700"><AlertTriangle className="h-3.5 w-3.5" /> Busy then: {theirs.map((c) => c.summary).join(', ')}</div>}
                      </div>
                      <Checkbox label="Optional" checked={!!a.optional} onChange={(v) => editGuest(i, { optional: v })} />
                      <button type="button" className="rounded p-1 text-muted hover:bg-ink/5" aria-label={`Remove ${a.name}`} onClick={() => set({ attendees: f.attendees.filter((_, j) => j !== i) })}><X className="h-4 w-4" /></button>
                    </li>
                  )
                })}
              </ul>
            )}
            {guestIds.length > 0 && (
              <div>
                <Button size="sm" onClick={() => setFindTime(!findTime)}><Sparkles className="h-4 w-4" /> Find a time when everyone is free</Button>
                {findTime && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {!slots ? <span className="text-sm text-muted">Looking…</span> : slots.length ? slots.map((s) => (
                      <button key={s.start} type="button" onClick={() => pickSlot(s)} className="rounded-full px-3 py-1.5 text-sm ring-1 ring-line hover:bg-brand-soft">
                        {new Date(s.start).toLocaleString('en-GB', { timeZone: f.timeZone, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </button>
                    )) : <span className="text-sm text-muted">No common free time in the next three weeks of working hours.</span>}
                  </div>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              <span className="text-sm text-muted">Guests can:</span>
              <Checkbox label="Change the meeting" checked={f.guestsCanModify} onChange={(v) => set({ guestsCanModify: v })} />
              <Checkbox label="Invite others" checked={f.guestsCanInviteOthers} onChange={(v) => set({ guestsCanInviteOthers: v })} />
              <Checkbox label="See the guest list" checked={f.guestsCanSeeOtherGuests} onChange={(v) => set({ guestsCanSeeOtherGuests: v })} />
            </div>
          </div>
        )}

        {/* Details */}
        {isMeeting && (
          <div className="space-y-3">
            <Checkbox label={<span className="inline-flex items-center gap-1.5"><Video className="h-4 w-4" /> Add a video call (in the app, in this meeting’s chat)</span>} checked={!!f.conference} onChange={(v) => set({ conference: v ? { kind: 'inApp', label: 'Video call in the app' } : undefined })} />
            <Input value={f.location ?? ''} onChange={(e) => set({ location: e.target.value })} placeholder="Add a location (room or address)" aria-label="Location" />
            <Textarea rows={3} value={f.description ?? ''} onChange={(e) => set({ description: e.target.value })} placeholder="Add a description or agenda" aria-label="Description" />
            <div className="flex flex-wrap items-center gap-2">
              {f.attachments.map((a, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-paper px-2 py-1 text-sm ring-1 ring-line">
                  <Paperclip className="h-3.5 w-3.5" /> {a.title}
                  <button type="button" aria-label={`Remove ${a.title}`} onClick={() => set({ attachments: f.attachments.filter((_, j) => j !== i) })}><X className="h-3.5 w-3.5" /></button>
                </span>
              ))}
              <FileButton size="sm" onPick={(file) => set({ attachments: [...f.attachments, { title: file.name, fileName: file.name }] })}><Paperclip className="h-4 w-4" /> Attach a file</FileButton>
            </div>
          </div>
        )}

        {/* Calendar and display */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Calendar">
            <Select value={f.calendarId} onChange={(e) => set({ calendarId: e.target.value })}>
              {cals?.filter((c) => c.canWrite).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Show me as">
            <Select value={f.transparency} onChange={(e) => set({ transparency: e.target.value as 'opaque' | 'transparent' })}>
              <option value="opaque">Busy</option>
              <option value="transparent">Free</option>
            </Select>
          </Field>
          <Field label="Visibility">
            <Select value={f.visibility} onChange={(e) => set({ visibility: e.target.value as EventInput['visibility'] })}>
              <option value="default">Default visibility</option>
              <option value="public">Public</option>
              <option value="private">Private (others see only “Busy”)</option>
              <option value="confidential">Confidential</option>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={f.status} onChange={(e) => set({ status: e.target.value as 'confirmed' | 'tentative' })}>
              <option value="confirmed">Confirmed</option>
              <option value="tentative">Tentative</option>
            </Select>
          </Field>
        </div>
        <div>
          <div className="mb-1.5 text-sm font-medium">Colour</div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => set({ colorId: undefined })} className={clsx('h-7 rounded-full px-2 text-xs ring-1', !f.colorId ? 'ring-2 ring-ink' : 'ring-line')}>Calendar colour</button>
            {Object.entries(EVENT_COLORS).map(([id, c]) => (
              <button key={id} type="button" title={c.name} aria-label={c.name} aria-pressed={f.colorId === id} onClick={() => set({ colorId: id })} className={clsx('h-7 w-7 rounded-full', f.colorId === id && 'ring-2 ring-ink ring-offset-2')} style={{ background: c.hex }} />
            ))}
          </div>
        </div>

        {/* Reminders */}
        <div className="space-y-2">
          <div className="text-sm font-medium">Reminders</div>
          <Checkbox label="Default (a pop-up 10 minutes before)" checked={f.reminders.useDefault} onChange={(v) => set({ reminders: { useDefault: v, overrides: v ? [] : [{ method: 'popup', minutes: 10 }] } })} />
          {!f.reminders.useDefault && (
            <>
              {f.reminders.overrides.map((r, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <Select value={r.method} onChange={(e) => set({ reminders: { useDefault: false, overrides: f.reminders.overrides.map((x, j) => (j === i ? { ...x, method: e.target.value as 'popup' | 'email' } : x)) } })} className="!w-auto">
                    <option value="popup">Pop-up</option>
                    <option value="email">Email</option>
                  </Select>
                  <Select value={r.minutes} onChange={(e) => set({ reminders: { useDefault: false, overrides: f.reminders.overrides.map((x, j) => (j === i ? { ...x, minutes: Number(e.target.value) } : x)) } })} className="!w-auto">
                    {MINUTES.map((m) => <option key={m} value={m}>{minutesLabel(m)}</option>)}
                  </Select>
                  <button type="button" aria-label="Remove the reminder" className="rounded p-1 text-muted hover:bg-ink/5" onClick={() => set({ reminders: { useDefault: false, overrides: f.reminders.overrides.filter((_, j) => j !== i) } })}><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              {f.reminders.overrides.length < 5 && <Button size="sm" variant="ghost" onClick={() => set({ reminders: { useDefault: false, overrides: [...f.reminders.overrides, { method: 'popup', minutes: 30 }] } })}><Plus className="h-4 w-4" /> Add a reminder</Button>}
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
