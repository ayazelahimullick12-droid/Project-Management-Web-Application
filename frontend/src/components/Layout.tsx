/**
 * The app frame, in the current "inset panel" style (Linear, Vercel, Notion):
 * - Sidebar on the page background: app name and inbox bell, search (Ctrl+K), Home / My work /
 *   Inbox / Messages, your projects (only the open one expanded), and at the bottom the demo
 *   clock and your profile menu (theme: light, dark or system; switch user; sign out).
 * - The page itself sits in a rounded panel next to it.
 * - The chat dock (bottom right) and the call screen are always available.
 */
import { clsx } from 'clsx'
import {
  Archive, Bell, BookOpen, ChevronDown, ChevronsUpDown, CircleHelp, Clock, FastForward, House, Inbox, LogOut, Mail, Menu, MessageCircle,
  Monitor, Moon, Plus, RotateCcw, Search, Settings, SquareCheckBig, Sun, X, Zap,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAction, useApi, useNow, useSessionUserId } from '../api/hooks'
import type { StatusKey } from '../rules/pipeline'
import { brand } from '../theme/brand'
import { JobTray } from './ai'
import { CallLayer } from './chat/ChatThread'
import { ChatDock } from './chat/ChatDock'
import { openChat } from './chat/dock'
import { CommandPalette } from './CommandPalette'
import { groupTasks } from '../pages/DashboardPage'
import { ago, fmtDateTime } from './format'
import { setPref, usePrefs, type Theme } from './prefs'
import { Avatar, Badge, ProjectIcon } from './ui'
import { useToast } from './toast'
import { ThemeToggle } from './ThemeToggle'

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onOut: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onOut()
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [ref, onOut])
}

function Dropdown({ button, children, align = 'right', width = 'w-80', up, full }: { button: (open: boolean) => ReactNode; children: (close: () => void) => ReactNode; align?: 'left' | 'right'; width?: string; up?: boolean; full?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false))
  return (
    <div className={clsx('relative', full && 'w-full')} ref={ref}>
      <button type="button" onClick={() => setOpen(!open)} className={clsx('flex items-center', full && 'w-full')}>
        {button(open)}
      </button>
      {open && (
        <div className={clsx('absolute z-50 rounded-2xl bg-surface shadow-2xl ring-1 ring-line', width, up ? 'bottom-full mb-2' : 'top-full mt-2', align === 'right' ? 'right-0' : 'left-0')}>
          {children(() => setOpen(false))}
        </div>
      )}
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
      align="left"
      up
      full
      button={() => (
        <span className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-muted hover:bg-ink/5" title="Clickable prototype: demo clock and controls">
          <Clock className="h-3.5 w-3.5" />
          <span className="flex-1 truncate text-left">{fmtDateTime(now.toISOString())}</span>
          {!!info?.offsetMs && <Badge tone="amber">+{Math.round(info.offsetMs / H)}h</Badge>}
          <span className="rounded-full bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-800">Demo</span>
        </span>
      )}
    >
      {() => (
        <div className="p-3 text-sm">
          <div className="mb-1 font-semibold">Demo controls</div>
          <p className="mb-3 text-xs text-muted">This is a clickable prototype. All data is fictional and kept only in this browser.</p>
          <label className="mb-3 flex cursor-pointer items-start gap-2 rounded-xl bg-canvas p-2.5">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--brand-primary)]" checked={showNotes} onChange={(e) => setPref('showNotes', e.target.checked)} />
            <span>
              <span className="block font-medium">Show prototype notes</span>
              <span className="block text-xs text-muted">“In the real app…” explanations and open-question markers. Turn on for spec reviews.</span>
            </span>
          </label>
          <div className="mb-1 text-xs font-medium">Time travel <span className="font-normal text-muted">(demo clock, Bangladesh time)</span></div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {[['+1 hour', H], ['+4 hours', 4 * H], ['+1 day', 24 * H]].map(([l, ms]) => (
              <button key={l as string} className="rounded-lg bg-canvas px-2 py-1 text-xs hover:bg-ink/10" onClick={() => travel.run(ms as number)}>
                <FastForward className="mr-1 inline h-3 w-3" />
                {l}
              </button>
            ))}
            <button className="rounded-lg bg-canvas px-2 py-1 text-xs hover:bg-ink/10" onClick={() => morning.run()}>
              Next working morning
            </button>
            {!!info?.offsetMs && (
              <button className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-ink/5" onClick={() => resetClock.run()}>
                Reset clock
              </button>
            )}
          </div>
          <div className="mb-1 text-xs font-medium">AI speed</div>
          <div className="mb-3 flex gap-1.5">
            {(['normal', 'fast', 'instant'] as const).map((sp) => (
              <button key={sp} onClick={() => speed.run(sp)} className={clsx('rounded-lg px-2 py-1 text-xs', info?.aiSpeed === sp ? 'bg-ink text-canvas' : 'bg-canvas hover:bg-ink/10')}>
                <Zap className="mr-1 inline h-3 w-3" />
                {sp}
              </button>
            ))}
          </div>
          <button
            className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50"
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

function NotificationBell({ align = 'left' }: { align?: 'left' | 'right' }) {
  const uid = useSessionUserId()
  const now = useNow()
  const navigate = useNavigate()
  const { data } = useApi(['notifications', uid], api.notifications.myNotifications, !!uid)
  const markRead = useAction(api.notifications.markRead)
  const unread = (data ?? []).filter((n) => !n.readAt).length
  return (
    <Dropdown
      width="w-96"
      align={align}
      button={() => (
        <span className="relative rounded-lg p-1.5 text-ink/70 hover:bg-ink/5 hover:text-ink" title="Notifications">
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-brand ring-2 ring-canvas" />}
        </span>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between px-4 py-3 text-sm font-semibold">
            <span>
              Notifications {unread > 0 && <span className="ml-1 text-xs font-normal text-muted">{unread} unread</span>}
            </span>
            <Link to="/notifications" className="text-xs font-medium text-brand" onClick={close}>
              Open inbox
            </Link>
          </div>
          <div className="max-h-96 overflow-y-auto border-t border-line p-1">
            {(data ?? []).slice(0, 7).map((n) => (
              <button
                key={n.id}
                className="block w-full rounded-xl px-3 py-2.5 text-left text-sm hover:bg-canvas"
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

const THEMES: { id: Theme; label: string; icon: ReactNode }[] = [
  { id: 'light', label: 'Light', icon: <Sun className="h-3.5 w-3.5" /> },
  { id: 'dark', label: 'Dark', icon: <Moon className="h-3.5 w-3.5" /> },
  { id: 'system', label: 'System', icon: <Monitor className="h-3.5 w-3.5" /> },
]

/** Profile menu at the bottom of the sidebar: theme, switch user (demo), sign out. */
function UserMenu() {
  const uid = useSessionUserId()
  const { theme } = usePrefs()
  const { data: me } = useApi(['whoami', uid], api.projects.whoami)
  const { data: users } = useApi(['users'], api.projects.users)
  const navigate = useNavigate()
  if (!me) return null
  return (
    <Dropdown
      width="w-80"
      align="left"
      up
      full
      button={() => (
        <span className="flex w-full items-center gap-2.5 rounded-xl p-1.5 hover:bg-ink/5">
          <Avatar name={me.name} id={me.id} size={32} status="online" />
          <span className="min-w-0 flex-1 text-left leading-tight">
            <span className="block truncate text-[13px] font-medium">{me.name}</span>
            <span className="block truncate text-[11px] text-muted">{me.title}</span>
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted" />
        </span>
      )}
    >
      {(close) => (
        <div>
          <div className="px-4 pt-3 pb-2">
            <div className="mb-1.5 text-[11px] font-medium text-muted">Appearance</div>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-ink/[0.05] p-1">
              {THEMES.map((t) => (
                <button key={t.id} onClick={() => setPref('theme', t.id)} className={clsx('flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs', theme === t.id ? 'bg-surface font-medium shadow-sm dark:bg-ink/15' : 'text-muted hover:text-ink')}>
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="px-4 pt-2 text-[11px] font-medium text-muted">Switch user (demo) · each browser tab can be a different person</div>
          <div className="max-h-80 overflow-y-auto p-1">
            {(users ?? [])
              .filter((u) => !u.deactivated)
              .map((u) => (
                <button
                  key={u.id}
                  className={clsx('flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-left text-sm hover:bg-canvas', u.id === me.id && 'bg-brand-soft')}
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
          <div className="border-t border-line p-1">
            <button
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted hover:bg-canvas hover:text-ink"
              onClick={() => {
                api.projects.logout()
                close()
                navigate('/login')
              }}
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      )}
    </Dropdown>
  )
}

// ─── Sidebar ────────────────────────────────────────────────────────────

const itemCls = (active: boolean, indent?: boolean) =>
  clsx('flex w-full items-center gap-2.5 rounded-lg py-1.5 text-[13px] transition', indent ? 'pr-2 pl-9' : 'px-2.5', active ? 'bg-surface font-medium text-ink shadow-xs ring-1 ring-line/80 dark:bg-ink/10 dark:ring-transparent' : 'text-ink/75 hover:bg-ink/[0.045] hover:text-ink')

function Count({ n }: { n?: number }) {
  return n ? <span className="min-w-5 rounded-full bg-brand px-1.5 text-center text-[10px] leading-4 font-semibold text-white">{n}</span> : null
}

function NavItem({ to, icon, children, end, count, indent, dot }: { to: string; icon?: ReactNode; children: ReactNode; end?: boolean; count?: number; indent?: boolean; dot?: string }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => itemCls(isActive, indent)}>
      {icon && <span className="h-4 w-4 shrink-0 text-ink/60 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
      <span className="flex-1 truncate">{children}</span>
      {dot && <span className={clsx('h-1.5 w-1.5 rounded-full', dot)} />}
      <Count n={count} />
    </NavLink>
  )
}

const DOT: Partial<Record<StatusKey, string>> = { in_review: 'bg-sky-500', changes_requested: 'bg-amber-500', approved: 'bg-leaf', signed: 'bg-leaf', out_of_sync: 'bg-red-500', draft: 'bg-gray-400' }

function ProjectTree({ pid, chatUnread }: { pid: string; chatUnread: number }) {
  const navigate = useNavigate()
  const { data } = useApi(['project', pid], () => api.projects.getProject(pid))
  if (!data) return null
  const base = `/projects/${pid}`
  const doc = (t: string) => data.summary.docs.find((d) => d.type === t)?.status.key
  const group = (label: string) => <div className="mt-2 mb-0.5 pl-9 text-[11px] font-medium text-muted">{label}</div>
  return (
    <div className="mt-0.5 mb-1 space-y-px">
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
      <button className={itemCls(false, true)} onClick={() => openChat(`${pid}-chat`, navigate)} title="Opens the project chat at the bottom right">
        <span className="flex-1 truncate text-left">Project chat</span>
        <Count n={chatUnread} />
      </button>
      <NavItem to={`${base}/team`} indent>
        Team
      </NavItem>
    </div>
  )
}

function Sidebar({ pid, onSearch }: { pid?: string; onSearch: () => void }) {
  const uid = useSessionUserId()
  const { data: me } = useApi(['whoami', uid], api.projects.whoami)
  const { data: projects } = useApi(['my-projects', uid], api.projects.myProjects, !!uid)
  const { data: dash } = useApi(['dashboard'], api.projects.dashboard, !!uid)
  const { data: notes } = useApi(['notifications', uid], api.notifications.myNotifications, !!uid)
  const { data: chats } = useApi(['conversations', uid], api.chat.conversations, !!uid)
  const [help, setHelp] = useState(false)
  const active = (projects ?? []).filter((p) => p.status === 'active' && !p.finished)
  const current = (projects ?? []).find((p) => p.id === pid)
  const list = current && !active.some((p) => p.id === current.id) ? [...active, current] : active
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-1.5 pb-3">
        <Link to="/" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1 hover:bg-ink/5">
          <img src="/favicon.svg" alt="" className="h-7 w-7 rounded-lg shadow-sm" />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[13px] font-semibold">{brand.appName}</span>
            <span className="block truncate text-[11px] text-muted">{brand.orgName} · Microfinance Tech</span>
          </span>
        </Link>
      </div>
      <div className="mb-3 flex items-center gap-1">
        <button onClick={onSearch} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-surface px-2.5 py-1.5 text-[13px] text-muted shadow-xs ring-1 ring-line hover:text-ink dark:bg-ink/5 dark:ring-transparent">
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Search</span>
          <kbd className="rounded-md bg-canvas px-1.5 text-[10px] ring-1 ring-line">Ctrl K</kbd>
        </button>
        <ThemeToggle />
        <NotificationBell />
      </div>

      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        <nav className="space-y-px">
          <NavItem to="/" end icon={<House />}>
            Home
          </NavItem>
          <NavItem to="/my-work" icon={<SquareCheckBig />} count={dash ? groupTasks(dash.myTasks).length : 0}>
            My work
          </NavItem>
          <NavItem to="/notifications" icon={<Inbox />} count={(notes ?? []).filter((n) => !n.readAt).length}>
            Inbox
          </NavItem>
          <NavItem to="/messages" icon={<MessageCircle />} count={chats?.unread}>
            Messages
          </NavItem>
        </nav>

        <div className="mt-6 mb-1 flex items-center justify-between px-2.5">
          <span className="text-[11px] font-semibold tracking-wide text-muted uppercase">Projects</span>
          <Link to="/projects/new" className="rounded-md p-0.5 text-muted hover:bg-ink/5 hover:text-ink" title="New project">
            <Plus className="h-3.5 w-3.5" />
          </Link>
        </div>
        <nav className="space-y-px">
          {list.map((p) => (
            <div key={p.id}>
              <NavLink to={`/projects/${p.id}`} className={clsx('flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] transition', p.id === pid ? 'font-medium text-ink' : 'text-ink/75 hover:bg-ink/[0.045] hover:text-ink')}>
                <ProjectIcon id={p.id} name={p.name} size={20} />
                <span className="flex-1 truncate">{p.name}</span>
                {p.id === pid && <ChevronDown className="h-3.5 w-3.5 text-muted" />}
              </NavLink>
              {p.id === pid && <ProjectTree pid={p.id} chatUnread={chats?.channels.find((c) => c.id === `${p.id}-chat`)?.unread ?? 0} />}
            </div>
          ))}
          {!list.length && <div className="px-2.5 py-1 text-xs text-muted">No projects yet.</div>}
        </nav>

        <div className="mt-6 space-y-px">
          {me?.isAdmin && (
            <NavItem to="/admin" icon={<Settings />}>
              Admin
            </NavItem>
          )}
          <button onClick={() => setHelp(!help)} className={itemCls(false)}>
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

      <div className="mt-2 space-y-1 border-t border-line/70 pt-2">
        <DemoMenu />
        <UserMenu />
      </div>
    </div>
  )
}

export function AppShell() {
  const [menu, setMenu] = useState(false)
  const [palette, setPalette] = useState(false)
  const location = useLocation()
  const main = useRef<HTMLElement>(null)
  useEffect(() => {
    setMenu(false)
    main.current?.scrollTo({ top: 0 })
  }, [location.pathname])
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
  const full = location.pathname.startsWith('/messages') // the Messages page fills the panel
  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <aside className="hidden w-64 shrink-0 px-3 py-3 md:block no-print">
        <Sidebar pid={pid} onSearch={() => setPalette(true)} />
      </aside>
      {menu && (
        <div className="fixed inset-0 z-50 bg-black/30 md:hidden" onClick={() => setMenu(false)}>
          <aside className="h-full w-72 bg-canvas px-3 py-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <Sidebar pid={pid} onSearch={() => setPalette(true)} />
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col md:py-2 md:pr-2">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface md:rounded-2xl md:border md:border-line/70 md:shadow-soft">
          <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-3 md:hidden no-print">
            <button className="rounded-lg p-1.5 hover:bg-ink/5" onClick={() => setMenu(true)} aria-label="Menu">
              {menu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link to="/" className="flex flex-1 items-center gap-2">
              <img src="/favicon.svg" alt="" className="h-6 w-6" />
              <span className="text-sm font-semibold">{brand.appName}</span>
            </Link>
            <button className="rounded-lg p-1.5 hover:bg-ink/5" onClick={() => setPalette(true)} aria-label="Search">
              <Search className="h-5 w-5" />
            </button>
            <ThemeToggle />
            <NotificationBell align="right" />
          </header>
          <main ref={main} className={clsx('min-h-0 flex-1', full ? 'flex flex-col' : 'overflow-y-auto')}>
            {full ? (
              <Outlet />
            ) : (
              <div className="mx-auto max-w-6xl px-4 pt-8 pb-28 md:px-10">
                <Outlet />
              </div>
            )}
          </main>
        </div>
      </div>
      <JobTray />
      <ChatDock />
      <CallLayer />
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  )
}
