/** Notification centre, and the Mailbox (stands in for Mailpit, which catches every email in development). */
import { BellRing, Mail } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { api } from '../api'
import { useAction, useApi, useNow, useSessionUserId } from '../api/hooks'
import { ago, fmtDateTime } from '../components/format'
import { OpenQuestion } from '../components/OpenQuestion'
import { Badge, Button, Card, Checkbox, EmptyState, Loading, PageHeader } from '../components/ui'

export function NotificationsPage() {
  const uid = useSessionUserId()
  const now = useNow()
  const navigate = useNavigate()
  const { data, isLoading } = useApi(['notifications', uid], api.notifications.myNotifications)
  const markAll = useAction(api.notifications.markAllRead)
  const markRead = useAction(api.notifications.markRead)
  const [unreadOnly, setUnreadOnly] = useState(false)
  if (isLoading) return <Loading />
  const list = (data ?? []).filter((n) => !unreadOnly || !n.readAt)
  return (
    <div>
      <PageHeader title="Notifications" subtitle="Every event is sent in-app and by email. Anything waiting on you is reminded every 4 working hours (Sunday–Thursday, 9:00–17:00)." actions={<><OpenQuestion id="working-hours" /><Button onClick={() => markAll.run()}>Mark all read</Button></>} />
      <div className="mb-3"><Checkbox label="Unread only" checked={unreadOnly} onChange={setUnreadOnly} /></div>
      <Card padded={false}>
        <ul className="divide-y divide-line">
          {list.map((n) => (
            <li key={n.id}>
              <button className={clsx('flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-canvas', !n.readAt && 'bg-brand-soft/30')} onClick={() => { markRead.run(n.id); navigate(n.link) }}>
                {n.reminder ? <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /> : <span className={clsx('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.readAt ? 'bg-line' : 'bg-brand')} />}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{n.title}</div>
                  <div className="text-sm text-muted">{n.body}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                    {fmtDateTime(n.createdAt)} ({ago(n.createdAt, now)})
                    {n.reminder && <Badge tone="amber">reminder</Badge>}
                    {n.forUserName && <Badge tone="blue">covering for {n.forUserName}</Badge>}
                    {n.emailId && <Badge><Mail className="h-3 w-3" /> also emailed</Badge>}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
        {!list.length && <div className="p-6"><EmptyState title="No notifications" /></div>}
      </Card>
    </div>
  )
}

export function MailboxPage() {
  const { data, isLoading } = useApi(['mailbox'], api.notifications.mailbox)
  const uid = useSessionUserId()
  const [mine, setMine] = useState(true)
  const [open, setOpen] = useState<string | null>(null)
  if (isLoading) return <Loading />
  const list = (data ?? []).filter((e) => !mine || e.to === uid)
  const current = list.find((e) => e.id === open) ?? list[0]
  return (
    <div>
      <PageHeader title="Mailbox" subtitle="Simulated email (the real app sends through Mailpit in development). Nothing leaves this browser." actions={<Checkbox label="Only emails to me" checked={mine} onChange={setMine} />} />
      {list.length ? (
        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <Card padded={false}>
            <ul className="max-h-[70vh] divide-y divide-line overflow-y-auto">
              {list.map((e) => (
                <li key={e.id}>
                  <button onClick={() => setOpen(e.id)} className={clsx('block w-full px-3 py-2 text-left hover:bg-canvas', current?.id === e.id && 'bg-brand-soft/50')}>
                    <div className="truncate text-sm font-medium">{e.subject}</div>
                    <div className="text-xs text-muted">To {e.toName} · {fmtDateTime(e.createdAt)}</div>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          {current && (
            <Card title={current.subject} subtitle={`To: ${current.toName} <${current.toEmail}> · From: BRAC Project Management <no-reply@brac.example> · ${fmtDateTime(current.createdAt)}`}>
              <pre className="font-sans text-sm whitespace-pre-wrap">{current.body}</pre>
            </Card>
          )}
        </div>
      ) : (
        <EmptyState title="No emails" icon={<Mail className="h-6 w-6" />} />
      )}
    </div>
  )
}
