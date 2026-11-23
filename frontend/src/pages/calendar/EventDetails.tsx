/**
 * One meeting: when, repeat, guests and their replies, video call, location, description,
 * attachments, reminders; Yes / No / Maybe with a note and "+ guests"; Add to Google Calendar,
 * download .ics, change, duplicate and delete (one occurrence, following, or all).
 */
import { CalendarPlus, Check, CircleHelp, Copy, Download, Lock, MapPin, MessageSquare, Paperclip, Pencil, Repeat, Trash2, Users, Video, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { useAction, useApi } from '../../api/hooks'
import type { Scope, EventView } from '../../api/calendar'
import type { Rsvp } from '../../types'
import { describeRecurrence, EVENT_COLORS, googleCalendarUrl } from '../../rules/calendar'
import { Avatar, Button, Input, Modal, Select } from '../../components/ui'
import { showCall } from '../../components/chat/dock'
import type { EditorStart } from './EventEditor'

const REPLY: Record<Rsvp, string> = { accepted: 'Going', declined: 'Not going', tentative: 'Maybe', needsAction: 'No reply yet' }

export function whenText(ev: Pick<EventView, 'allDay' | 'timeZone'>, start: string, end: string) {
  if (ev.allDay) {
    const last = new Date(Date.parse(end + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10)
    const d = (x: string) => new Date(x + 'T00:00:00Z').toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })
    return last === start ? `${d(start)} · all day` : `${d(start)} – ${d(last)}`
  }
  const o = { timeZone: ev.timeZone }
  return `${new Date(start).toLocaleDateString('en-GB', { ...o, weekday: 'long', day: 'numeric', month: 'long' })} · ${new Date(start).toLocaleTimeString('en-GB', { ...o, hour: '2-digit', minute: '2-digit' })} – ${new Date(end).toLocaleTimeString('en-GB', { ...o, hour: '2-digit', minute: '2-digit' })} (${ev.timeZone})`
}

export function EventDetails({ eventId, start, end, originalStart, onClose, onEdit }: { eventId: string; start: string; end: string; originalStart: string; onClose: () => void; onEdit: (s: EditorStart) => void }) {
  const { data: ev } = useApi(['event', eventId], () => api.calendar.getEvent(eventId))
  const navigate = useNavigate()
  const [note, setNote] = useState<string | null>(null)
  const [guests, setGuests] = useState(0)
  const [deleting, setDeleting] = useState(false)
  const [scope, setScope] = useState<Scope>('this')
  const reply = useAction(api.calendar.respond, { success: 'Reply sent to the organiser.' })
  const remove = useAction(api.calendar.deleteEvent, { success: 'Meeting deleted. Guests were told.', onDone: onClose })
  if (!ev) return null
  const repeating = !!ev.recurrence
  const colour = ev.colorId ? EVENT_COLORS[ev.colorId].hex : 'var(--color-brand)'
  const asStart = (): EditorStart => ({ ...ev, id: ev.id, originalStart, repeating, start: repeating ? start : ev.start, end: repeating ? end : ev.end })
  const ics = async () => {
    const text = await api.calendar.exportIcs([ev.id])
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/calendar' }))
    a.download = `${ev.summary.replace(/[^\w -]+/g, '').trim() || 'meeting'}.ics`
    a.click()
  }
  const joinCall = async () => {
    if (!ev.chatId) return
    await api.chat.startCall(ev.chatId, 'video').catch(() => api.chat.getChat(ev.chatId!).then((c) => c.call && api.chat.joinCall(c.call.id)))
    navigate(`/messages/${ev.chatId}`)
    showCall(ev.chatId)
  }

  return (
    <Modal open onClose={onClose} title={<span className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded" style={{ background: colour }} />{ev.summary}{ev.status === 'tentative' && <span className="text-sm font-normal text-muted">(tentative)</span>}</span>}>
      <div className="space-y-4 text-[0.9375rem]">
        <div>
          <div>{whenText(ev, start, end)}</div>
          {repeating && <div className="mt-0.5 flex items-center gap-1.5 text-sm text-muted"><Repeat className="h-3.5 w-3.5" /> {describeRecurrence(ev.recurrence, ev.start, ev.timeZone)}</div>}
          {ev.eventType !== 'default' && <div className="mt-0.5 text-sm text-muted">{{ outOfOffice: 'Out of office', focusTime: 'Focus time', workingLocation: `Working from: ${ev.workingLocation?.label || { homeOffice: 'home', officeLocation: 'the office', customLocation: 'elsewhere' }[ev.workingLocation?.type ?? 'officeLocation']}`, default: '' }[ev.eventType]}{ev.autoDecline?.on ? ' · declines new invitations' : ''}</div>}
        </div>
        {ev.limited && <p className="flex items-center gap-2 text-muted"><Lock className="h-4 w-4" /> A private meeting: only its guests see the details.</p>}

        {ev.conference && ev.chatId && (
          <Button variant="primary" onClick={() => void joinCall()}><Video className="h-4 w-4" /> Join the video call</Button>
        )}
        {ev.location && <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" /> {ev.location}</div>}
        {ev.chatId && <Link to={`/messages/${ev.chatId}`} className="flex items-center gap-2 text-brand hover:underline"><MessageSquare className="h-4 w-4" /> {ev.chatTitle ?? 'Open the chat'}</Link>}

        {!ev.limited && (ev.attendees.length > 0 || ev.hiddenGuests > 0) && (
          <div>
            <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4" /> {ev.attendees.length + 1 + ev.hiddenGuests} people · {ev.attendees.filter((a) => a.responseStatus === 'accepted').length + 1} going</div>
            <ul className="space-y-1.5">
              <li className="flex items-center gap-2.5"><Avatar name={ev.organizer.name} id={ev.organizer.id} size={28} /><span className="flex-1">{ev.organizer.name} <span className="text-sm text-muted">· organiser</span></span></li>
              {ev.attendees.map((a) => (
                <li key={a.email} className="flex items-center gap-2.5">
                  <Avatar name={a.name} id={a.userId ?? a.email} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{a.name}{a.optional && <span className="text-sm text-muted"> · optional</span>}{a.additionalGuests ? <span className="text-sm text-muted"> · +{a.additionalGuests}</span> : null}</span>
                    {a.comment && <span className="block truncate text-sm text-muted">“{a.comment}”</span>}
                  </span>
                  <span className="text-sm text-muted">{REPLY[a.responseStatus]}</span>
                </li>
              ))}
              {ev.hiddenGuests > 0 && <li className="text-sm text-muted">The organiser hid the other {ev.hiddenGuests} guests.</li>}
            </ul>
          </div>
        )}
        {!ev.limited && ev.description && <p className="whitespace-pre-wrap">{ev.description}</p>}
        {!ev.limited && ev.attachments.length > 0 && <div className="flex flex-wrap gap-2">{ev.attachments.map((a, i) => <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-paper px-2 py-1 text-sm ring-1 ring-line"><Paperclip className="h-3.5 w-3.5" /> {a.title}</span>)}</div>}
        <div className="text-sm text-muted">
          {ev.calendarName} · {ev.transparency === 'transparent' ? 'shows as free' : 'shows as busy'}{ev.visibility !== 'default' ? ` · ${ev.visibility}` : ''} · reminders: {ev.reminders.useDefault ? 'pop-up 10 minutes before' : ev.reminders.overrides.map((r) => `${r.method === 'email' ? 'email' : 'pop-up'} ${r.minutes} min`).join(', ') || 'none'}
        </div>

        {/* Reply (guests) */}
        {ev.myResponse && (
          <div className="rounded-xl bg-canvas/60 p-3 ring-1 ring-line">
            <div className="mb-2 text-sm font-semibold">Going? <span className="font-normal text-muted">({REPLY[ev.myResponse]})</span></div>
            <div className="flex flex-wrap gap-2">
              {(['accepted', 'declined', 'tentative'] as Rsvp[]).map((r) => (
                <Button key={r} variant={ev.myResponse === r ? 'primary' : 'secondary'} disabled={reply.pending} onClick={() => reply.run(ev.id, r, note ?? ev.myComment, guests || ev.myGuests)}>
                  {r === 'accepted' ? <Check className="h-4 w-4" /> : r === 'declined' ? <X className="h-4 w-4" /> : <CircleHelp className="h-4 w-4" />} {r === 'accepted' ? 'Yes' : r === 'declined' ? 'No' : 'Maybe'}
                </Button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Input value={note ?? ev.myComment ?? ''} onChange={(e) => setNote(e.target.value)} placeholder="Add a note for the organiser (optional)" className="!w-auto flex-1" aria-label="Note with your reply" />
              <label className="flex items-center gap-1.5 text-sm">+<Input type="number" min={0} max={10} value={guests || ev.myGuests || 0} onChange={(e) => setGuests(Number(e.target.value))} className="!w-16" aria-label="Extra guests you bring" /> guests</label>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          {ev.canEdit && <Button onClick={() => onEdit(asStart())}><Pencil className="h-4 w-4" /> Change</Button>}
          {!ev.canEdit && ev.canInvite && <Button onClick={() => onEdit(asStart())}><Users className="h-4 w-4" /> Invite others</Button>}
          {!ev.limited && <Button onClick={() => onEdit({ ...ev, id: undefined, originalStart: undefined, repeating: false, summary: `${ev.summary} (copy)`, attendees: ev.attendees.map((a) => ({ ...a, responseStatus: 'needsAction' })) })}><Copy className="h-4 w-4" /> Duplicate</Button>}
          {!ev.limited && <a href={googleCalendarUrl({ ...ev, start: repeating ? start : ev.start, end: repeating ? end : ev.end })} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium ring-1 ring-line hover:bg-ink/5"><CalendarPlus className="h-4 w-4" /> Add to Google Calendar</a>}
          {!ev.limited && <Button onClick={() => void ics()}><Download className="h-4 w-4" /> Download .ics</Button>}
          {ev.canEdit && !ev.myResponse && <Button variant="ghost" onClick={() => setDeleting(true)}><Trash2 className="h-4 w-4" /> Delete</Button>}
        </div>
        {deleting && (
          <div className="rounded-xl bg-red-50 p-3 text-sm text-red-900 ring-1 ring-red-200">
            <p className="font-medium">Delete this meeting? Guests are told.</p>
            {repeating && (
              <Select value={scope} onChange={(e) => setScope(e.target.value as Scope)} className="mt-2 !w-auto">
                <option value="this">This event</option>
                <option value="following">This and following events</option>
                <option value="all">All events</option>
              </Select>
            )}
            <div className="mt-2 flex gap-2">
              <Button variant="primary" disabled={remove.pending} onClick={() => remove.run(ev.id, repeating ? scope : 'all', originalStart, 'all')}>Delete</Button>
              <Button onClick={() => setDeleting(false)}>Keep it</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
