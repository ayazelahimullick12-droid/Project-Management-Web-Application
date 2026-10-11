/**
 * The app frame, kept deliberately quiet (ideas from Linear and Asana):
 * - Top bar: logo, a search box that opens the quick switcher (Ctrl+K), demo clock, inbox, user.
 * - Sidebar: Home, My work, Inbox, Messages; then your projects, with only the open project expanded;
 *   help and prototype pages are grouped at the bottom.
 */
import { clsx } from 'clsx'
import {
  Archive, Bell, BookOpen, ChevronDown, ChevronRight, CircleHelp, Clock, FastForward, House, Inbox, LogOut, Mail, Menu, MessageCircle,
  Plus, RotateCcw, Search, Settings, SquareCheckBig, Zap,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAction, useApi, useNow, useSessionUserId } from '../api/hooks'
import type { StatusKey } from '../rules/pipeline'
import { brand } from '../theme/brand'
import { JobTray } from './ai'
import { CommandPalette } from './CommandPalette'
import { groupTasks } from '../pages/DashboardPage'
import { ago, fmtDateTime } from './format'
import { setPref, usePrefs } from './prefs'
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
      {open && <div className={clsx('absolute top-11 z-40 rounded-xl bg-white shadow-xl ring-1 ring-line', width, align === 'right' ? 'right-0' : 'left-0')}>{children(() => setOpen(false))}</div>}
    </div>
  )
}

function DemoMenu() {
  const now = useNow()
  const toast = useToast()
  const { showNotes } = usePrefs()
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
          <div className="mb-3 font-semibold">Demo controls</div>
          <label className="mb-3 flex cursor-pointer items-start gap-2 rounded-lg bg-canvas p-2.5">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--brand-primary)]" checked={showNotes} onChange={(e) => setPref('showNotes', e.target.checked)} />
            <span>
              <span className="block font-medium">Show prototype notes</span>
              <span className="block text-xs text-muted">“In the real app…” explanations and open-question markers. Turn on for spec reviews.</span>
            </span>
          </label>
          <div className="mb-1 text-xs font-medium">Time travel <span className="font-normal text-muted">(demo clock, Bangladesh time)</span></div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {[['+1 hour', H], ['+4 hours', 4 * H], ['+1 day', 24 * H]].map(([l, ms]) => (
              <button key={l as string} className="rounded-md bg-canvas px-2 py-1 text-xs hover:bg-black/10" onClick={() => travel.run(ms as number)}>
                <FastForward className="mr-1 inline h-3 w-3" />
                {l}
              </button>
            ))}
            <button className="rounded-md bg-canvas px-2 py-1 text-xs hover:bg-black/10" onClick={() => morning.run()}>
              Next working morning
            </button>
            {!!info?.offsetMs && (
              <button className="rounded-md px-2 py-1 text-xs text-muted hover:bg-black/5" onClick={() => resetClock.run()}>
                Reset clock
              </button>
            )}
          </div>
          <div className="mb-1 text-xs font-medium">AI speed</div>
          <div className="mb-3 flex gap-1.5">
            {(['normal', 'fast', 'instant'] as const).map((sp) => (
              <button key={sp} onClick={() => speed.run(sp)} className={clsx('rounded-md px-2 py-1 text-xs', info?.aiSpeed === sp ? 'bg-ink text-white' : 'bg-canvas hover:bg-black/10')}>
                <Zap className="mr-1 inline h-3 w-3" />
                {sp}
              </button>
            ))}
          </div>
          <button
            className="flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50"
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
        <span className="relative rounded-md p-2 hover:bg-black/5" title="Inbox">
          <Bell className="h-5 w-5" />
          {unread > 0 && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-brand" />}
        </span>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between px-3 py-2.5 text-sm font-semibold">
            Inbox {unread > 0 && <span className="text-xs font-normal text-muted">{unread} unread</span>}
            <Link to="/notifications" className="text-xs font-medium text-brand" onClick={close}>
              Open inbox
            </Link>
          </div>
          <div className="max-h-96 overflow-y-auto border-t border-line">
            {(data ?? []).slice(0, 7).map((n) => (
              <button
                key={n.id}
                className="block w-full px-3 py-2.5 text-left text-sm hover:bg-canvas"
                onClick={() => {
                  markRead.run(n.id)
                  close()
                  navigate(n.link)
                }}
              >
                <div className="flex items-start gap-2">
                  <span className={clsx('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-brand')} />
                  <div className="min-w-0">
                    <div className={clsx('truncate', !n.readAt && 'font-medium')}>{n.title}</div>
                    <div className="line-clamp-1 text-xs text-muted">{n.body}</div>
                    <div className="mt-0.5 text-[11px] text-muted">{ago(n.createdAt, now)}</div>
                  </div>
                </div>
              </button>
            ))}
            {!data?.length && <div className="p-4 text-center text-sm text-muted">You are all caught up.</div>}
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
          <div className="px-3 py-2.5 text-xs text-muted">Switch user (demo). Each browser tab can be a different person.</div>
          <div className="max-h-96 overflow-y-auto border-t border-line py-1">
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

// ─── Sidebar ────────────────────────────────────────────────────────────

function NavItem({ to, icon, children, end, count, indent, dot }: { to: string; icon?: ReactNode; children: ReactNode; end?: boolean; count?: number; indent?: boolean; dot?: string }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => clsx('flex items-center gap-2.5 rounded-md py-1.5 text-[13px]', indent ? 'pr-2 pl-9' : 'px-2.5', isActive ? 'bg-black/[0.06] font-medium text-ink' : 'text-ink/75 hover:bg-black/[0.04] hover:text-ink')}
    >
      {icon && <span className="h-4 w-4 shrink-0 text-ink/60 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
      <span className="flex-1 truncate">{children}</span>
      {dot && <span className={clsx('h-1.5 w-1.5 rounded-full', dot)} />}
      {!!count && <span className="min-w-5 rounded-full bg-brand px-1.5 text-center text-[10px] leading-4 font-semibold text-white">{count}</span>}
    </NavLink>
  )
}

const DOT: Partial<Record<StatusKey, string>> = { in_review: 'bg-sky-500', changes_requested: 'bg-amber-500', approved: 'bg-leaf', signed: 'bg-leaf', out_of_sync: 'bg-red-500', draft: 'bg-gray-400' }

function ProjectTree({ pid }: { pid: string }) {
  const { data } = useApi(['project', pid], () => api.projects.getProject(pid))
  if (!data) return null
  const base = `/projects/${pid}`
  const doc = (t: string) => data.summary.docs.find((d) => d.type === t)?.status.key
  const group = (label: string) => <div className="mt-2 mb-0.5 pl-9 text-[11px] font-medium text-muted">{label}</div>
  return (
    <div className="mb-1">
      <NavItem to={base} end indent>
        Overview
      </NavItem>
      <NavItem to={`${base}/intake`} indent count={data.summary.unansweredQuestions}>
        Intake &amp; facts
      </NavItem>
      {group('Documents')}
      {(['PROPOSAL', 'CHARTER', 'BRD', 'SRS'] as const).map((t) => (
        <NavItem key={t} to={`${base}/docs/${t}`} indent dot={DOT[doc(t) ?? 'not_started']}>
          {t === 'PROPOSAL' ? 'Proposal' : t === 'CHARTER' ? 'Charter' : t}
        </NavItem>
      ))}
      {group('Testing')}
      <NavItem to={`${base}/testing/SQA`} indent>
        SQA
      </NavItem>
      <NavItem to={`${base}/testing/UAT`} indent>
        UAT
      </NavItem>
      <div className="mt-2" />
      <NavItem to={`${base}/changes`} indent count={data.summary.pendingDecisions + data.summary.openChangeRequests}>
        Changes &amp; decisions
      </NavItem>
      <NavItem to={`${base}/chat`} indent>
        Chat
      </NavItem>
      <NavItem to={`${base}/team`} indent>
        Team
      </NavItem>
    </div>
  )
}

function Sidebar({ pid }: { pid?: string }) {
  const uid = useSessionUserId()
  const { data: me } = useApi(['whoami', uid], api.projects.whoami)
  const { data: projects } = useApi(['my-projects', uid], api.projects.myProjects, !!uid)
  const { data: dash } = useApi(['dashboard'], api.projects.dashboard, !!uid)
  const { data: notes } = useApi(['notifications', uid], api.notifications.myNotifications, !!uid)
  const [help, setHelp] = useState(false)
  const active = (projects ?? []).filter((p) => p.status === 'active' && !p.finished)
  const current = (projects ?? []).find((p) => p.id === pid)
  const list = current && !active.some((p) => p.id === current.id) ? [...active, current] : active
  return (
    <div className="flex h-full flex-col">
      <nav className="space-y-0.5">
        <NavItem to="/" end icon={<House />}>
          Home
        </NavItem>
        <NavItem to="/my-work" icon={<SquareCheckBig />} count={dash ? groupTasks(dash.myTasks).length : 0}>
          My work
        </NavItem>
        <NavItem to="/notifications" icon={<Inbox />} count={(notes ?? []).filter((n) => !n.readAt).length}>
          Inbox
        </NavItem>
        <NavItem to="/messages" icon={<MessageCircle />}>
          Messages
        </NavItem>
      </nav>

      <div className="mt-6 mb-1 flex items-center justify-between px-2.5">
        <span className="text-[11px] font-semibold tracking-wide text-muted uppercase">Projects</span>
        <Link to="/projects/new" className="rounded p-0.5 text-muted hover:bg-black/5 hover:text-ink" title="New project">
          <Plus className="h-3.5 w-3.5" />
        </Link>
      </div>
      <nav className="space-y-0.5">
        {list.map((p) => (
          <div key={p.id}>
            <NavLink
              to={`/projects/${p.id}`}
              className={clsx('flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px]', p.id === pid ? 'font-medium text-ink' : 'text-ink/75 hover:bg-black/[0.04] hover:text-ink')}
            >
              {p.id === pid ? <ChevronDown className="h-3.5 w-3.5 text-muted" /> : <ChevronRight className="h-3.5 w-3.5 text-muted" />}
              <span className="truncate">{p.name}</span>
            </NavLink>
            {p.id === pid && <ProjectTree pid={p.id} />}
          </div>
        ))}
        {!list.length && <div className="px-2.5 py-1 text-xs text-muted">No projects yet.</div>}
      </nav>

      <div className="mt-auto space-y-0.5 pt-6">
        {me?.isAdmin && (
          <NavItem to="/admin" icon={<Settings />}>
            Admin
          </NavItem>
        )}
        <button onClick={() => setHelp(!help)} className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] text-ink/75 hover:bg-black/[0.04]">
          <CircleHelp className="h-4 w-4 text-ink/60" />
          <span className="flex-1 text-left">Help &amp; prototype</span>
          <ChevronDown className={clsx('h-3.5 w-3.5 text-muted transition', help && 'rotate-180')} />
        </button>
        {help && (
          <>
            <NavItem to="/how-it-works" icon={<BookOpen />}>
              How the real app works
            </NavItem>
            <NavItem to="/open-questions" icon={<CircleHelp />}>
              Open questions
            </NavItem>
            <NavItem to="/mailbox" icon={<Mail />}>
              Mailbox (emails)
            </NavItem>
            <NavItem to="/archive" icon={<Archive />}>
              Archived &amp; finished
            </NavItem>
          </>
        )}
      </div>
    </div>
  )
}

export function AppShell() {
  const [menu, setMenu] = useState(false)
  const [palette, setPalette] = useState(false)
  const location = useLocation()
  useEffect(() => setMenu(false), [location.pathname])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const match = useMatch('/projects/:pid/*')
  const pid = match?.params.pid !== 'new' ? match?.params.pid : undefined
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line/80 bg-white/95 px-4 backdrop-blur no-print">
        <button className="rounded-md p-1.5 hover:bg-black/5 md:hidden" onClick={() => setMenu(!menu)} aria-label="Menu">
          <Menu className="h-5 w-5" />
        </button>
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <img src="/favicon.svg" alt="" className="h-7 w-7" />
          <span className="hidden text-sm font-semibold sm:inline">{brand.appName}</span>
        </Link>
        <button onClick={() => setPalette(true)} className="mx-auto flex w-full max-w-md items-center gap-2 rounded-lg bg-black/[0.04] px-3 py-1.5 text-sm text-muted hover:bg-black/[0.07]">
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Search or jump to…</span>
          <kbd className="hidden rounded bg-white px-1.5 text-[10px] ring-1 ring-line sm:inline">Ctrl K</kbd>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <span className="hidden rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 lg:inline" title="Clickable prototype. All data is fictional and stored only in this browser.">
            Prototype
          </span>
          <DemoMenu />
          <NotificationBell />
          <UserSwitcher />
        </div>
      </header>
      <div className="flex flex-1">
        <aside className={clsx('top-14 h-[calc(100vh-3.5rem)] w-64 shrink-0 overflow-y-auto border-r border-line/80 bg-[#fbfbfa] px-2 py-4 no-print md:sticky md:block', menu ? 'fixed z-40 block shadow-xl' : 'hidden')}>
          <Sidebar pid={pid} />
        </aside>
        <main className="min-w-0 flex-1 px-4 py-7 md:px-10">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
      <JobTray />
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  )
}
