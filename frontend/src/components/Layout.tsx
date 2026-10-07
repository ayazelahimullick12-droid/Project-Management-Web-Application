/**
 * The app frame: top bar (prototype badge, demo clock and controls, notifications, user switcher)
 * and the left navigation (global pages, plus the current project's pages).
 */
import { clsx } from 'clsx'
import {
  Archive, Bell, BookOpen, ChevronDown, CircleHelp, ClipboardList, Clock, FastForward, FileText, FlaskConical, Gavel, House, Inbox, LayoutDashboard,
  ListChecks, LogOut, Mail, Menu, MessageCircle, MessagesSquare, RotateCcw, ScrollText, Settings, Users, Workflow, Zap,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAction, useApi, useNow, useSessionUserId } from '../api/hooks'
import { brand } from '../theme/brand'
import type { DocType } from '../types'
import { JobTray } from './ai'
import { ago, fmtDateTime } from './format'
import { Avatar, Badge } from './ui'
import { useToast } from './toast'

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onOut: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onOut()
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [ref, onOut])
}

function Dropdown({ button, children, align = 'right', width = 'w-80' }: { button: (open: boolean) => ReactNode; children: (close: () => void) => ReactNode; align?: 'left' | 'right'; width?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false))
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)} className="flex items-center">
        {button(open)}
      </button>
      {open && <div className={clsx('absolute top-11 z-40 rounded-lg bg-white shadow-xl ring-1 ring-line', width, align === 'right' ? 'right-0' : 'left-0')}>{children(() => setOpen(false))}</div>}
    </div>
  )
}

function DemoMenu() {
  const now = useNow()
  const toast = useToast()
  const { data: info } = useApi(['demo-info'], api.admin.demoInfo)
  const travel = useAction(api.admin.timeTravel, { onDone: (r) => toast.ok(`Clock moved forward. ${r.reminders} reminder${r.reminders === 1 ? '' : 's'} sent, ${r.locksReleased} lock${r.locksReleased === 1 ? '' : 's'} released.`) })
  const morning = useAction(api.admin.jumpToNextWorkingMorning, { onDone: (r) => toast.ok(`Jumped to the next working morning. ${r.reminders} reminder${r.reminders === 1 ? '' : 's'} sent.`) })
  const resetClock = useAction(api.admin.resetClock, { success: 'Clock reset.' })
  const speed = useAction(api.admin.setAiSpeed)
  const reset = useAction(api.admin.reset, { success: 'Demo data reset to the seed files.' })
  const H = 3600_000
  return (
    <Dropdown
      width="w-80"
      button={() => (
        <span className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted hover:bg-black/5" title="Demo clock and controls">
          <Clock className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">{fmtDateTime(now.toISOString())}</span>
          {!!info?.offsetMs && <Badge tone="amber">+{Math.round(info.offsetMs / H)}h</Badge>}
          <ChevronDown className="h-3 w-3" />
        </span>
      )}
    >
      {() => (
        <div className="p-3 text-sm">
          <div className="mb-1 font-semibold">Demo controls</div>
          <p className="mb-3 text-xs text-muted">The prototype has its own clock (Bangladesh time). In the real app, time travel is an Admin-only tool in development mode.</p>
          <div className="mb-1 text-xs font-medium">Time travel</div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {[['+1 hour', H], ['+4 hours', 4 * H], ['+1 day', 24 * H]].map(([l, ms]) => (
              <button key={l as string} className="rounded bg-canvas px-2 py-1 text-xs ring-1 ring-line hover:bg-white" onClick={() => travel.run(ms as number)}>
                <FastForward className="mr-1 inline h-3 w-3" />
                {l}
              </button>
            ))}
            <button className="rounded bg-canvas px-2 py-1 text-xs ring-1 ring-line hover:bg-white" onClick={() => morning.run()}>
              Next working morning
            </button>
            {!!info?.offsetMs && (
              <button className="rounded px-2 py-1 text-xs text-muted hover:bg-black/5" onClick={() => resetClock.run()}>
                Reset clock
              </button>
            )}
          </div>
          <div className="mb-1 text-xs font-medium">AI speed</div>
          <div className="mb-3 flex gap-1.5">
            {(['normal', 'fast', 'instant'] as const).map((sp) => (
              <button key={sp} onClick={() => speed.run(sp)} className={clsx('rounded px-2 py-1 text-xs ring-1', info?.aiSpeed === sp ? 'bg-ink text-white ring-ink' : 'bg-canvas ring-line hover:bg-white')}>
                <Zap className="mr-1 inline h-3 w-3" />
                {sp}
              </button>
            ))}
          </div>
          <button
            className="flex w-full items-center justify-center gap-1.5 rounded-md bg-red-50 px-3 py-2 text-xs font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-100"
            onClick={() => {
              if (confirm('Reset all demo data to the original seed files? Everything done in this browser will be lost.')) reset.run()
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset demo data
          </button>
        </div>
      )}
    </Dropdown>
  )
}

function NotificationBell() {
  const uid = useSessionUserId()
  const now = useNow()
  const navigate = useNavigate()
  const { data } = useApi(['notifications', uid], api.notifications.myNotifications, !!uid)
  const markRead = useAction(api.notifications.markRead)
  const unread = (data ?? []).filter((n) => !n.readAt).length
  return (
    <Dropdown
      width="w-96"
      button={() => (
        <span className="relative rounded-md p-2 hover:bg-black/5" title="Notifications">
          <Bell className="h-5 w-5" />
          {unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-brand px-1 text-center text-[10px] font-bold text-white">{unread > 99 ? '99+' : unread}</span>}
        </span>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between border-b border-line px-3 py-2 text-sm font-semibold">
            Notifications
            <Link to="/notifications" className="text-xs font-medium text-brand" onClick={close}>
              See all
            </Link>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {(data ?? []).slice(0, 8).map((n) => (
              <button
                key={n.id}
                className={clsx('block w-full border-b border-line px-3 py-2 text-left text-sm hover:bg-canvas', !n.readAt && 'bg-brand-soft/40')}
                onClick={() => {
                  markRead.run(n.id)
                  close()
                  navigate(n.link)
                }}
              >
                <div className="flex items-start gap-2">
                  {!n.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />}
                  <div className="min-w-0">
                    <div className="font-medium">{n.title}</div>
                    <div className="line-clamp-2 text-xs text-muted">{n.body}</div>
                    <div className="mt-0.5 text-[11px] text-muted">{ago(n.createdAt, now)}</div>
                  </div>
                </div>
              </button>
            ))}
            {!data?.length && <div className="p-4 text-center text-sm text-muted">No notifications yet.</div>}
          </div>
        </div>
      )}
    </Dropdown>
  )
}

function UserSwitcher() {
  const uid = useSessionUserId()
  const { data: me } = useApi(['whoami', uid], api.projects.whoami)
  const { data: users } = useApi(['users'], api.projects.users)
  const navigate = useNavigate()
  if (!me) return null
  return (
    <Dropdown
      width="w-80"
      button={() => (
        <span className="flex items-center gap-2 rounded-md py-1 pr-2 pl-1 hover:bg-black/5">
          <Avatar name={me.name} id={me.id} />
          <span className="hidden text-left leading-tight md:block">
            <span className="block text-sm font-medium">{me.name}</span>
            <span className="block text-[11px] text-muted">{me.title}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted" />
        </span>
      )}
    >
      {(close) => (
        <div>
          <div className="border-b border-line px-3 py-2 text-xs text-muted">Switch user (demo). Each browser tab can be a different person.</div>
          <div className="max-h-96 overflow-y-auto py-1">
            {(users ?? [])
              .filter((u) => !u.deactivated)
              .map((u) => (
                <button
                  key={u.id}
                  className={clsx('flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-canvas', u.id === me.id && 'bg-brand-soft/50')}
                  onClick={() => {
                    api.projects.switchUser(u.id)
                    close()
                  }}
                >
                  <Avatar name={u.name} id={u.id} size={24} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{u.name}</span>
                    <span className="block truncate text-[11px] text-muted">{u.title}</span>
                  </span>
                  {u.isAdmin && <Badge tone="dark">Admin</Badge>}
                  {u.external && <Badge>External</Badge>}
                </button>
              ))}
          </div>
          <button
            className="flex w-full items-center gap-2 border-t border-line px-3 py-2 text-sm text-muted hover:bg-canvas"
            onClick={() => {
              api.projects.logout()
              close()
              navigate('/login')
            }}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </Dropdown>
  )
}

function NavItem({ to, icon, children, end, badge }: { to: string; icon: ReactNode; children: ReactNode; end?: boolean; badge?: ReactNode }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => clsx('flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm', isActive ? 'bg-brand-soft font-medium text-brand' : 'text-ink/80 hover:bg-black/5')}>
      <span className="h-4 w-4 shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <span className="flex-1 truncate">{children}</span>
      {badge}
    </NavLink>
  )
}

const DOC_NAV: [DocType, string][] = [
  ['PROPOSAL', 'Proposal'],
  ['CHARTER', 'Charter'],
  ['BRD', 'BRD'],
  ['SRS', 'SRS'],
]

function ProjectNav({ pid }: { pid: string }) {
  const { data } = useApi(['project', pid], () => api.projects.getProject(pid))
  if (!data) return null
  const p = data.summary.project
  const base = `/projects/${pid}`
  return (
    <div className="mt-5">
      <div className="mb-1 px-2.5 text-[11px] font-semibold tracking-wide text-muted uppercase">This project</div>
      <div className="mb-2 px-2.5 text-sm leading-tight font-medium">{p.name}</div>
      <nav className="space-y-0.5">
        <NavItem to={base} end icon={<House />}>
          Home
        </NavItem>
        <NavItem to={`${base}/intake`} icon={<ClipboardList />} badge={data.summary.unansweredQuestions ? <Badge tone="magenta">{data.summary.unansweredQuestions}</Badge> : undefined}>
          Intake &amp; Fact Sheet
        </NavItem>
        {DOC_NAV.map(([t, l]) => {
          const card = data.summary.docs.find((d) => d.type === t)
          return (
            <NavItem key={t} to={`${base}/docs/${t}`} icon={<FileText />} badge={card?.status.key === 'out_of_sync' ? <Badge tone="red">sync</Badge> : card?.status.key === 'in_review' ? <Badge tone="blue">review</Badge> : undefined}>
              {l}
            </NavItem>
          )
        })}
        <NavItem to={`${base}/testing/SQA`} icon={<FlaskConical />}>
          SQA
        </NavItem>
        <NavItem to={`${base}/testing/UAT`} icon={<ListChecks />}>
          UAT
        </NavItem>
        <NavItem to={`${base}/changes`} icon={<Workflow />} badge={data.summary.openChangeRequests ? <Badge tone="amber">{data.summary.openChangeRequests}</Badge> : undefined}>
          Change requests
        </NavItem>
        <NavItem to={`${base}/chat`} icon={<MessagesSquare />}>
          Chats &amp; calls
        </NavItem>
        <NavItem to={`${base}/decisions`} icon={<Gavel />} badge={data.summary.pendingDecisions ? <Badge tone="amber">{data.summary.pendingDecisions}</Badge> : undefined}>
          Decisions
        </NavItem>
        <NavItem to={`${base}/team`} icon={<Users />}>
          Team
        </NavItem>
        <NavItem to={`${base}/audit`} icon={<ScrollText />}>
          Audit log
        </NavItem>
      </nav>
    </div>
  )
}

export function AppShell() {
  const [menu, setMenu] = useState(false)
  const location = useLocation()
  useEffect(() => setMenu(false), [location.pathname])
  const uid = useSessionUserId()
  const { data: me } = useApi(['whoami', uid], api.projects.whoami)
  const match = useMatch('/projects/:pid/*')
  const pid = match?.params.pid !== 'new' ? match?.params.pid : undefined
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-white px-4 no-print">
        <button className="rounded-md p-1.5 hover:bg-black/5 md:hidden" onClick={() => setMenu(!menu)} aria-label="Menu">
          <Menu className="h-5 w-5" />
        </button>
        <Link to="/" className="flex items-center gap-2">
          <img src="/favicon.svg" alt="" className="h-8 w-8" />
          <span className="leading-tight">
            <span className="block text-sm font-semibold">{brand.appName}</span>
            <span className="block text-[11px] text-muted">{brand.unitName}</span>
          </span>
        </Link>
        <Badge tone="amber" className="ml-2 hidden sm:inline-flex" title="Clickable prototype. All data is fictional and stored only in this browser.">
          Prototype · dummy data
        </Badge>
        <div className="ml-auto flex items-center gap-1">
          <DemoMenu />
          <NotificationBell />
          <UserSwitcher />
        </div>
      </header>
      <div className="flex flex-1">
        <aside className={clsx('top-14 h-[calc(100vh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-line bg-white px-2 py-4 no-print md:sticky md:block', menu ? 'fixed z-40 block shadow-xl' : 'hidden')}>
          <nav className="space-y-0.5">
            <NavItem to="/" end icon={<LayoutDashboard />}>
              Dashboard
            </NavItem>
            <NavItem to="/inbox/questions" icon={<Inbox />}>
              My questions
            </NavItem>
            <NavItem to="/inbox/tests" icon={<FlaskConical />}>
              My tests
            </NavItem>
            <NavItem to="/notifications" icon={<Bell />}>
              Notifications
            </NavItem>
            <NavItem to="/messages" icon={<MessageCircle />}>
              Direct messages
            </NavItem>
            <NavItem to="/mailbox" icon={<Mail />}>
              Mailbox (emails)
            </NavItem>
            {me?.isAdmin && (
              <NavItem to="/admin" icon={<Settings />}>
                Admin
              </NavItem>
            )}
          </nav>
          {pid && <ProjectNav pid={pid} />}
          <div className="mt-6 border-t border-line pt-3">
            <nav className="space-y-0.5">
              <NavItem to="/open-questions" icon={<CircleHelp />}>
                Open questions
              </NavItem>
              <NavItem to="/how-it-works" icon={<BookOpen />}>
                How the real app works
              </NavItem>
              <NavItem to="/archive" icon={<Archive />}>
                Archived projects
              </NavItem>
            </nav>
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
      <JobTray />
    </div>
  )
}
