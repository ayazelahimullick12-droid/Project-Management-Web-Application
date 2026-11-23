/**
 * Messages → Calendar: meetings for everyone's projects, like Google Calendar.
 * Views: Month, Week, Day and Schedule. Left: Create, quick add ("Review tomorrow at 3pm"), and
 * which calendars to show (My calendar and each project). Click an empty time to plan a meeting
 * there; click a meeting for its details. ?event=<id> opens one meeting (links in notifications).
 */
import { clsx } from 'clsx'
import { ChevronLeft, ChevronRight, Lock, Plus, Repeat, Sparkles, Video } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../api'
import { useAction, useApi, useSessionUserId } from '../../api/hooks'
import type { EventView } from '../../api/calendar'
import { DEFAULT_TZ, EVENT_COLORS, utcToZoned, zonedToUtc } from '../../rules/calendar'
import { Button, Input, Segmented } from '../../components/ui'
import { now } from '../../demo/clock'
import { EventEditor, type EditorStart } from './EventEditor'
import { EventDetails } from './EventDetails'

type Occ = { key: string; start: string; end: string; originalStart: string; event: EventView }
type ViewKind = 'month' | 'week' | 'day' | 'schedule'

const TZ = DEFAULT_TZ
const HOUR = 48 // px per hour in the week and day views
const addDays = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)
const dow = (d: string) => new Date(d + 'T00:00:00Z').getUTCDay()
const PALETTE = ['7', '2', '3', '6', '9', '10', '4', '1', '5', '11']
const calColour = (id: string) => EVENT_COLORS[PALETTE[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length]].hex
const colourOf = (o: Occ) => (o.event.colorId ? EVENT_COLORS[o.event.colorId].hex : calColour(o.event.calendarId))
const timeOf = (iso: string) => utcToZoned(iso, TZ).time
const dateLabel = (d: string, o: Intl.DateTimeFormatOptions) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { timeZone: 'UTC', ...o })

/** The local dates an occurrence covers (all-day events: their dates; timed: start to end). */
function datesOf(o: Occ): string[] {
  if (o.event.allDay) {
    const out: string[] = []
    for (let d = o.start; d < o.end; d = addDays(d, 1)) out.push(d)
    return out
  }
  const a = utcToZoned(o.start, TZ).date
  const b = utcToZoned(new Date(Date.parse(o.end) - 1).toISOString(), TZ).date
  const out: string[] = []
  for (let d = a; d <= b; d = addDays(d, 1)) out.push(d)
  return out
}

export function CalendarPage() {
  const uid = useSessionUserId()
  const [params, setParams] = useSearchParams()
  const today = utcToZoned(now().toISOString(), TZ).date
  const [view, setView] = useState<ViewKind>('week')
  const [anchor, setAnchor] = useState(today)
  const { data: cals } = useApi(['calendars', uid], api.calendar.calendars, !!uid)
  const [hidden, setHidden] = useState<string[]>([])
  const shownIds = cals?.map((c) => c.id).filter((id) => !hidden.includes(id))

  // The range on screen
  const range = useMemo(() => {
    if (view === 'day') return { from: anchor, days: 1 }
    if (view === 'week') return { from: addDays(anchor, -dow(anchor)), days: 7 }
    if (view === 'schedule') return { from: anchor, days: 30 }
    const first = anchor.slice(0, 8) + '01'
    return { from: addDays(first, -dow(first)), days: 42 }
  }, [view, anchor])
  const fromIso = zonedToUtc(range.from, '00:00', TZ)
  const toIso = zonedToUtc(addDays(range.from, range.days), '00:00', TZ)
  const { data: occ } = useApi(['events', uid, fromIso, toIso, shownIds?.join(',')], () => api.calendar.listEvents(fromIso, toIso, shownIds), !!shownIds)

  const [editing, setEditing] = useState<EditorStart | null>(null)
  const [open, setOpen] = useState<Occ | null>(null)
  const [quick, setQuick] = useState('')
  const quickAdd = useAction((text: string) => api.calendar.quickAddEvent(text, { nowIso: now().toISOString() }), { success: 'Meeting added. Open it to add guests or change it.', onDone: () => setQuick('') })

  // ?event=<id>: open that meeting (from a notification or a chat card)
  const wanted = params.get('event')
  const { data: wantedEv } = useApi(['event', wanted], () => api.calendar.getEvent(wanted!), !!wanted)
  useEffect(() => {
    if (!wantedEv) return
    setOpen({ key: wantedEv.id, start: wantedEv.start, end: wantedEv.end, originalStart: wantedEv.start, event: wantedEv })
    setAnchor(wantedEv.allDay ? wantedEv.start : utcToZoned(wantedEv.start, TZ).date)
    params.delete('event')
    setParams(params, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantedEv])

  const step = (n: number) => setAnchor(view === 'day' ? addDays(anchor, n) : view === 'week' ? addDays(anchor, 7 * n) : view === 'schedule' ? addDays(anchor, 30 * n) : new Date(Date.UTC(+anchor.slice(0, 4), +anchor.slice(5, 7) - 1 + n, 1)).toISOString().slice(0, 10))
  const title = view === 'month' ? dateLabel(anchor, { month: 'long', year: 'numeric' }) : view === 'day' ? dateLabel(anchor, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : `${dateLabel(range.from, { day: 'numeric', month: 'short' })} – ${dateLabel(addDays(range.from, range.days - 1), { day: 'numeric', month: 'short', year: 'numeric' })}`
  const newAt = (date: string, hour?: number) => {
    const start = hour === undefined ? zonedToUtc(date, '10:00', TZ) : zonedToUtc(date, `${String(hour).padStart(2, '0')}:00`, TZ)
    setEditing({ start, end: new Date(Date.parse(start) + 3600000).toISOString(), calendarId: `user:${uid}` })
  }
  const byDate = (d: string) => (occ ?? []).filter((o) => datesOf(o).includes(d))

  return (
    <div className="flex min-h-0 flex-1">
      {/* Left: create, quick add, calendars */}
      <aside className="hidden w-64 shrink-0 space-y-5 overflow-y-auto border-r border-line p-4 lg:block">
        <Button variant="primary" onClick={() => setEditing({ calendarId: `user:${uid}` })}><Plus className="h-4 w-4" /> New meeting</Button>
        <form onSubmit={(e) => { e.preventDefault(); if (quick.trim()) quickAdd.run(quick) }} className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-muted"><Sparkles className="h-3.5 w-3.5" /> Quick add</label>
          <Input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="Review Wednesday 3pm for 1 hour" aria-label="Quick add a meeting" />
          <p className="text-[11px] text-muted">Day, time, “for 45 minutes”, “every week”. Enter to add.</p>
        </form>
        <div>
          <div className="mb-2 text-[11px] font-semibold tracking-wide text-muted uppercase">Calendars</div>
          <ul className="space-y-1">
            {cals?.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-sm hover:bg-ink/[0.04]">
                  <input type="checkbox" checked={!hidden.includes(c.id)} onChange={(e) => setHidden(e.target.checked ? hidden.filter((x) => x !== c.id) : [...hidden, c.id])} style={{ accentColor: calColour(c.id) }} className="h-4 w-4" />
                  <span className="truncate">{c.name}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[11px] leading-relaxed text-muted">Times are shown in {TZ}. Meetings live in this app; use “Add to Google Calendar” or “Download .ics” on a meeting to put it in another calendar.</p>
      </aside>

      {/* Main */}
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <Button size="sm" onClick={() => setAnchor(today)}>Today</Button>
          <button className="rounded-lg p-1.5 hover:bg-ink/5" aria-label="Earlier" onClick={() => step(-1)}><ChevronLeft className="h-5 w-5" /></button>
          <button className="rounded-lg p-1.5 hover:bg-ink/5" aria-label="Later" onClick={() => step(1)}><ChevronRight className="h-5 w-5" /></button>
          <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h2>
          <Button size="sm" variant="primary" className="lg:hidden" onClick={() => setEditing({ calendarId: `user:${uid}` })}><Plus className="h-4 w-4" /> New</Button>
          <Segmented value={view} onChange={(x) => setView(x as ViewKind)} options={[{ id: 'day', label: 'Day' }, { id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }, { id: 'schedule', label: 'Schedule' }]} />
        </div>

        {view === 'month' && <MonthGrid from={range.from} month={anchor.slice(0, 7)} today={today} byDate={byDate} onOpen={setOpen} onNew={(d) => newAt(d)} />}
        {(view === 'week' || view === 'day') && <TimeGrid from={range.from} days={range.days} today={today} byDate={byDate} onOpen={setOpen} onNew={newAt} />}
        {view === 'schedule' && <Schedule from={range.from} days={range.days} byDate={byDate} onOpen={setOpen} />}
      </section>

      {open && <EventDetails eventId={open.event.id} start={open.start} end={open.end} originalStart={open.originalStart} onClose={() => setOpen(null)} onEdit={(s) => { setOpen(null); setEditing(s) }} />}
      <EventEditor open={!!editing} onClose={() => setEditing(null)} start={editing ?? {}} />
    </div>
  )
}

function Chip({ o, onOpen, showTime = true }: { o: Occ; onOpen: (o: Occ) => void; showTime?: boolean }) {
  const declined = o.event.myResponse === 'declined'
  const pending = o.event.myResponse === 'needsAction'
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onOpen(o) }}
      className={clsx('flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-xs', o.event.allDay ? 'text-white' : 'hover:bg-ink/5', declined && 'line-through opacity-60')}
      style={o.event.allDay ? { background: colourOf(o) } : pending ? { boxShadow: `inset 0 0 0 1px ${colourOf(o)}` } : undefined}
      title={o.event.summary}
    >
      {!o.event.allDay && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colourOf(o) }} />}
      {showTime && !o.event.allDay && <span className="shrink-0 text-muted">{timeOf(o.start)}</span>}
      <span className="truncate">{o.event.summary}</span>
    </button>
  )
}

function MonthGrid({ from, month, today, byDate, onOpen, onNew }: { from: string; month: string; today: string; byDate: (d: string) => Occ[]; onOpen: (o: Occ) => void; onNew: (d: string) => void }) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-[auto_repeat(6,minmax(0,1fr))] overflow-y-auto">
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="border-b border-line py-1.5 text-center text-xs font-semibold text-muted">{d}</div>)}
      {Array.from({ length: 42 }, (_, i) => addDays(from, i)).map((d) => {
        const items = byDate(d)
        return (
          <div key={d} onClick={() => onNew(d)} className={clsx('min-h-24 cursor-pointer border-r border-b border-line p-1 hover:bg-ink/[0.02]', d.slice(0, 7) !== month && 'bg-ink/[0.02] text-muted')}>
            <div className={clsx('mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs', d === today && 'bg-brand font-semibold text-white')}>{Number(d.slice(8))}</div>
            <div className="space-y-0.5">
              {items.slice(0, 3).map((o) => <Chip key={o.key} o={o} onOpen={onOpen} />)}
              {items.length > 3 && <div className="px-1.5 text-xs text-muted">+{items.length - 3} more</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TimeGrid({ from, days, today, byDate, onOpen, onNew }: { from: string; days: number; today: string; byDate: (d: string) => Occ[]; onOpen: (o: Occ) => void; onNew: (d: string, hour: number) => void }) {
  const dates = Array.from({ length: days }, (_, i) => addDays(from, i))
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null)
  useEffect(() => { if (scroller) scroller.scrollTop = 8 * HOUR }, [scroller])
  const cols = `3.5rem repeat(${days}, minmax(0, 1fr))`
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid border-b border-line" style={{ gridTemplateColumns: cols }}>
        <div />
        {dates.map((d) => (
          <div key={d} className="border-l border-line px-1 py-1.5 text-center">
            <div className="text-xs text-muted">{dateLabel(d, { weekday: 'short' })}</div>
            <div className={clsx('mx-auto flex h-8 w-8 items-center justify-center rounded-full text-base', d === today && 'bg-brand font-semibold text-white')}>{Number(d.slice(8))}</div>
            <div className="mt-1 space-y-0.5">{byDate(d).filter((o) => o.event.allDay).map((o) => <Chip key={o.key} o={o} onOpen={onOpen} />)}</div>
          </div>
        ))}
      </div>
      <div ref={setScroller} className="min-h-0 flex-1 overflow-y-auto">
        <div className="relative grid" style={{ gridTemplateColumns: cols, height: 24 * HOUR }}>
          <div>{Array.from({ length: 24 }, (_, h) => <div key={h} className="pr-2 text-right text-[11px] text-muted" style={{ height: HOUR }}>{h ? `${String(h).padStart(2, '0')}:00` : ''}</div>)}</div>
          {dates.map((d) => {
            const timed = byDate(d).filter((o) => !o.event.allDay)
            // Side by side when meetings overlap
            const lanes: Occ[][] = []
            for (const o of timed) {
              const lane = lanes.find((l) => Date.parse(l.at(-1)!.end) <= Date.parse(o.start))
              if (lane) lane.push(o)
              else lanes.push([o])
            }
            return (
              <div key={d} className="relative border-l border-line">
                {Array.from({ length: 24 }, (_, h) => <div key={h} onClick={() => onNew(d, h)} className="cursor-pointer border-b border-line/60 hover:bg-brand-soft/40" style={{ height: HOUR }} />)}
                {lanes.map((lane, li) =>
                  lane.map((o) => {
                    const dayStart = Date.parse(zonedToUtc(d, '00:00', TZ))
                    const top = Math.max(0, (Date.parse(o.start) - dayStart) / 3600000) * HOUR
                    const bottom = Math.min(24, (Date.parse(o.end) - dayStart) / 3600000) * HOUR
                    const c = colourOf(o)
                    const pending = o.event.myResponse === 'needsAction'
                    return (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => onOpen(o)}
                        className={clsx('absolute overflow-hidden rounded-md px-1.5 py-0.5 text-left text-xs leading-tight shadow-sm', o.event.myResponse === 'declined' && 'line-through opacity-60')}
                        style={{ top, height: Math.max(20, bottom - top - 2), left: `calc(${(li / lanes.length) * 100}% + 2px)`, width: `calc(${100 / lanes.length}% - 4px)`, background: pending ? 'var(--color-paper)' : c, color: pending ? c : 'white', border: `1px solid ${c}` }}
                      >
                        <span className="flex items-center gap-1 font-semibold">
                          {o.event.limited && <Lock className="h-3 w-3" />}{o.event.recurrence && <Repeat className="h-3 w-3" />}{o.event.conference && <Video className="h-3 w-3" />}
                          <span className="truncate">{o.event.summary}</span>
                        </span>
                        <span className="block opacity-90">{timeOf(o.start)} – {timeOf(o.end)}{o.event.location ? ` · ${o.event.location}` : ''}</span>
                      </button>
                    )
                  }),
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Schedule({ from, days, byDate, onOpen }: { from: string; days: number; byDate: (d: string) => Occ[]; onOpen: (o: Occ) => void }) {
  const dates = Array.from({ length: days }, (_, i) => addDays(from, i)).filter((d) => byDate(d).length)
  if (!dates.length) return <p className="p-6 text-sm text-muted">No meetings in the next 30 days.</p>
  return (
    <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
      {dates.map((d) => (
        <li key={d} className="flex gap-4 px-4 py-3">
          <div className="w-28 shrink-0 text-sm"><div className="font-semibold">{dateLabel(d, { day: 'numeric', month: 'short' })}</div><div className="text-muted">{dateLabel(d, { weekday: 'long' })}</div></div>
          <ul className="min-w-0 flex-1 space-y-1">
            {byDate(d).map((o) => (
              <li key={o.key}>
                <button type="button" onClick={() => onOpen(o)} className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-ink/[0.04]">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colourOf(o) }} />
                  <span className="w-28 shrink-0 text-muted">{o.event.allDay ? 'All day' : `${timeOf(o.start)} – ${timeOf(o.end)}`}</span>
                  <span className={clsx('min-w-0 flex-1 truncate font-medium', o.event.myResponse === 'declined' && 'line-through opacity-60')}>{o.event.summary}</span>
                  {o.event.myResponse === 'needsAction' && <span className="text-xs text-brand">Reply needed</span>}
                </button>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}
