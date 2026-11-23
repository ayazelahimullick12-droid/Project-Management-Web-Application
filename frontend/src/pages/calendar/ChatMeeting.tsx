/**
 * Calendar pieces inside a conversation:
 *   ScheduleButton  "Schedule a meeting" from the chat: its people are invited, the project's
 *                   calendar is used, a video call in the chat is added, and the card is posted here.
 *   MeetingCard     the card in the chat: when, who is going, Yes / No / Maybe, open the meeting.
 */
import { CalendarClock, CalendarPlus, Check, CircleHelp, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useAction, useApi, useSessionUserId } from '../../api/hooks'
import type { Rsvp } from '../../types'
import { DEFAULT_TZ, describeRecurrence } from '../../rules/calendar'
import { useToast } from '../../components/toast'
import { now } from '../../demo/clock'
import { EventEditor } from './EventEditor'
import { whenText } from './EventDetails'

export function ScheduleButton({ chatId, projectId, kind, memberIds, compact }: { chatId: string; projectId?: string; kind: string; memberIds: string[]; compact?: boolean }) {
  const uid = useSessionUserId()
  const [open, setOpen] = useState(false)
  const { data: people } = useApi(['cal-people', projectId], () => api.calendar.people(projectId), open)
  const attendees = (people ?? []).filter((p) => memberIds.includes(p.id) && p.id !== uid).map((p) => ({ userId: p.id, email: p.email, name: p.name, responseStatus: 'needsAction' as Rsvp }))
  const calendarId = projectId && kind !== 'direct' && kind !== 'rag_dm' ? `project:${projectId}` : `user:${uid}`
  return (
    <>
      <button className={compact ? 'rounded-md p-1.5 text-muted hover:bg-ink/5 hover:text-ink' : 'rounded-lg p-2 text-muted hover:bg-ink/5 hover:text-ink'} title="Schedule a meeting" aria-label="Schedule a meeting" onClick={() => setOpen(true)}>
        <CalendarPlus className="h-4 w-4" />
      </button>
      {open && people && <EventEditor open onClose={() => setOpen(false)} start={{ calendarId, chatId, projectId, attendees, conference: { kind: 'inApp', label: 'Video call in the app' } }} />}
    </>
  )
}

export function MeetingCard({ eventId, text }: { eventId: string; text: string }) {
  const { data: ev, error } = useApi(['event', eventId], () => api.calendar.getEvent(eventId))
  const reply = useAction(api.calendar.respond, { success: 'Reply sent.' })
  if (error) return <div className="my-3 text-center text-[11px] text-muted">{text} (no longer available)</div>
  if (!ev) return null
  const going = ev.attendees.filter((a) => a.responseStatus === 'accepted').length
  return (
    <div className="my-3 flex justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-paper p-4 ring-1 ring-line">
        <div className="text-[11px] text-muted">{text}</div>
        <div className="mt-1 flex items-start gap-2.5">
          <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
          <div className="min-w-0 flex-1">
            <div className={ev.status === 'cancelled' ? 'font-semibold line-through' : 'font-semibold'}>{ev.summary}</div>
            <div className="text-sm text-muted">{whenText(ev, ev.start, ev.end)}</div>
            {ev.recurrence && <div className="text-sm text-muted">{describeRecurrence(ev.recurrence, ev.start, ev.timeZone)}</div>}
            <div className="text-sm text-muted">{ev.organizer.name} · {going + 1} going of {ev.attendees.length + 1 + ev.hiddenGuests}</div>
          </div>
        </div>
        {ev.status !== 'cancelled' && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {ev.myResponse && (['accepted', 'declined', 'tentative'] as Rsvp[]).map((r) => (
              <button key={r} type="button" disabled={reply.pending} onClick={() => reply.run(ev.id, r, ev.myComment, ev.myGuests)} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm ring-1 ${ev.myResponse === r ? 'bg-brand text-white ring-brand' : 'ring-line hover:bg-ink/5'}`}>
                {r === 'accepted' ? <Check className="h-3.5 w-3.5" /> : r === 'declined' ? <X className="h-3.5 w-3.5" /> : <CircleHelp className="h-3.5 w-3.5" />} {r === 'accepted' ? 'Yes' : r === 'declined' ? 'No' : 'Maybe'}
              </button>
            ))}
            <Link to={`/messages/calendar?event=${ev.id}`} className="ml-auto text-sm font-medium text-brand hover:underline">Open in the calendar</Link>
          </div>
        )}
      </div>
    </div>
  )
}

/** Pop-up reminders: checked every minute while the app is open (Google's "popup" reminder). */
export function CalendarReminders() {
  const uid = useSessionUserId()
  const toast = useToast()
  const toastRef = useRef(toast)
  toastRef.current = toast
  useEffect(() => {
    if (!uid) return
    const check = () =>
      api.calendar
        .dueReminders(now().toISOString())
        .then((due) => due.forEach((d) => toastRef.current.ok(`Reminder: “${d.summary}” ${d.minutes ? `starts in ${d.minutes} minutes` : 'starts now'} (${new Date(d.start).toLocaleTimeString('en-GB', { timeZone: DEFAULT_TZ, hour: '2-digit', minute: '2-digit' })}).`)))
        .catch(() => {})
    check()
    const t = setInterval(check, 60_000)
    return () => clearInterval(t)
  }, [uid])
  return null
}
