/**
 * The frame of the Simple view: one flush top bar with the logo, four places (To do, Projects,
 * Messages, Help), a small Demo button (prototype only) and your avatar. The Simple / Full switch,
 * text size and colours are in the avatar's menu.
 * Nothing floats over the page: AI progress shows as a strip under the top bar.
 * While it is on screen, <html> has the "simple-view" class: the calmer look in index.css.
 */
import { clsx } from 'clsx'
import { BarChart3, ChevronDown, CircleCheck, CircleHelp, FolderKanban, ListTodo, LogOut, MessageCircle, Settings, SlidersHorizontal, Sparkles, TriangleAlert, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useApi, useNow, useSessionUserId } from '../api/hooks'
import { usePrefs } from '../components/prefs'
import { brand } from '../theme/brand'
import { AppearanceSettings } from '../components/Appearance'
import { CallLayer } from '../components/chat/ChatThread'
import { CommandPalette } from '../components/CommandPalette'
import { DemoControls, SwitchUserList } from '../components/DemoControls'
import { Dropdown } from '../components/Dropdown'
import { fmtDateTime } from '../components/format'
import { Avatar } from '../components/ui'
import { ViewSwitch } from '../components/ViewSwitch'
import { Count } from './parts'
import { useTodo } from './todo'
import { ProjectCrumb, ProjectTabs, projectIdFrom } from './ProjectNav'

function NavTab({ to, icon, label, count, end, mobile }: { to: string; icon: ReactNode; label: string; count?: number; end?: boolean; mobile?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        clsx(
          'relative flex items-center font-medium whitespace-nowrap transition [&_svg]:h-5 [&_svg]:w-5',
          // Underline tabs (as in GitHub and Atlassian): the current place is marked by a magenta line.
          mobile ? 'flex-col justify-center gap-0.5 py-2.5 text-sm' : 'gap-2 px-3 text-[0.9375rem]',
          'after:absolute after:bottom-0 after:h-0.5 after:rounded-full',
          mobile ? 'after:inset-x-6' : 'after:inset-x-3',
          isActive ? 'text-ink after:bg-brand [&_svg]:text-brand' : 'text-muted hover:text-ink after:bg-transparent',
        )
      }
    >
      {icon}
      <span>{label}</span>
      {!!count && <Count n={count} className={mobile ? 'absolute top-1 right-[calc(50%-1.75rem)] min-w-5 px-1 text-xs leading-5' : undefined} />}
    </NavLink>
  )
}

/** AI progress, as a strip under the top bar instead of a box floating over the page. */
function JobStrip() {
  const uid = useSessionUserId()
  const { data: jobs } = useApi(['jobs', uid], api.notifications.myJobs, !!uid)
  const [hidden, setHidden] = useState<string[]>([])
  const visible = (jobs ?? []).filter((j) => !hidden.includes(j.id) && (j.status === 'running' || Date.now() - (j.startedReal ?? 0) < 45_000)).slice(0, 2)
  if (!visible.length) return null
  return (
    <div className="glass-strong mx-auto mt-2 w-[calc(100%-1rem)] max-w-6xl rounded-2xl bg-violet-50 no-print sm:w-[calc(100%-1.5rem)]">
      {visible.map((j) => (
        <div key={j.id} className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 text-base md:px-8">
          {j.status === 'running' ? <Sparkles className="h-5 w-5 shrink-0 animate-pulse text-violet-700" /> : j.status === 'done' ? <CircleCheck className="h-5 w-5 shrink-0 text-leaf" /> : <TriangleAlert className="h-5 w-5 shrink-0 text-red-600" />}
          <div className="min-w-0 flex-1">
            <div className="truncate text-violet-950">
              {j.status === 'running' ? (
                <>
                  <b>The AI is working:</b> {j.title.charAt(0).toLowerCase() + j.title.slice(1)} — {j.steps[j.step]} (step {j.step + 1} of {j.steps.length})
                </>
              ) : (
                <>
                  <b>{j.status === 'done' ? 'Done:' : 'It did not work:'}</b> {j.resultNote ?? j.title}
                </>
              )}
            </div>
            {j.status === 'running' && (
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-violet-200">
                <div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${((j.step + 1) / j.steps.length) * 100}%` }} />
              </div>
            )}
          </div>
          {j.status === 'done' && j.link && (
            <Link to={j.link} className="shrink-0 font-medium text-brand hover:underline">
              Open
            </Link>
          )}
          <button className="shrink-0 rounded-lg p-1 text-violet-900/60 hover:text-violet-950" onClick={() => setHidden((h) => [...h, j.id])} aria-label="Hide">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

function DemoButton() {
  const now = useNow()
  return (
    <Dropdown
      width="w-80"
      label="Demo controls"
      button={() => (
        <span className="relative flex h-11 items-center gap-1.5 rounded-full px-3 text-[0.9375rem] font-medium text-muted hover:bg-ink/[0.05] hover:text-ink dark:hover:bg-white/10" title={`Demo controls (prototype only) · demo clock ${fmtDateTime(now.toISOString())}`}>
          <SlidersHorizontal className="h-5 w-5" />
          <span className="hidden sm:inline">Demo</span>
          <span className="absolute top-2 left-7 h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
        </span>
      )}
    >
      {(close) => (
        <div className="max-h-[80vh] overflow-y-auto">
          <div className="px-3 pt-3 text-xs text-muted">Demo clock: {fmtDateTime(now.toISOString())}</div>
          <DemoControls />
          <div className="border-t border-line">
            <SwitchUserList onPicked={close} />
          </div>
        </div>
      )}
    </Dropdown>
  )
}

function ProfileMenu({ portfolio }: { portfolio: boolean }) {
  const uid = useSessionUserId()
  const navigate = useNavigate()
  const { data: me } = useApi(['whoami', uid], api.projects.whoami)
  if (!me) return null
  const item = 'flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-base hover:bg-canvas'
  return (
    <Dropdown
      width="w-80"
      label="Your profile and settings"
      button={(open) => (
        <span className={clsx('flex h-11 items-center gap-1 rounded-full p-0.5 pr-1.5 ring-2 transition', open ? 'ring-brand/40' : 'ring-transparent hover:ring-line')}>
          <Avatar name={me.name} id={me.id} size={38} />
          <ChevronDown className={clsx('h-4 w-4 text-muted transition', open && 'rotate-180')} />
        </span>
      )}
    >
      {(close) => (
        <div>
          <div className="border-b border-line px-4 py-3">
            <div className="text-base font-semibold">{me.name}</div>
            <div className="text-sm text-muted">{me.title}</div>
          </div>
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <span className="text-sm font-medium">View</span>
            <ViewSwitch />
          </div>
          <AppearanceSettings />
          <div className="border-t border-line p-1.5">
            {portfolio && (
              <button className={item} onClick={() => { close(); navigate('/reports') }}>
                <BarChart3 className="h-5 w-5 text-muted" /> Reports
              </button>
            )}
            {me.isAdmin && (
              <button className={item} onClick={() => { close(); navigate('/admin') }}>
                <Settings className="h-5 w-5 text-muted" /> Admin settings
              </button>
            )}
            <button
              className={item}
              onClick={() => {
                api.projects.logout()
                close()
                navigate('/login')
              }}
            >
              <LogOut className="h-5 w-5 text-muted" /> Sign out
            </button>
          </div>
        </div>
      )}
    </Dropdown>
  )
}

/**
 * Screen-width rules do not grow with the text size, so with larger text the four places move to
 * their own row under the top bar on wider screens too (the class names must be written in full).
 */
const NAV_LAYOUT = {
  normal: { top: 'lg:flex', row: 'lg:hidden', height: 'lg:h-[calc(100dvh-5.5rem)]' },
  large: { top: 'xl:flex', row: 'xl:hidden', height: 'xl:h-[calc(100dvh-5.5rem)]' },
  larger: { top: '2xl:flex', row: '2xl:hidden', height: '2xl:h-[calc(100dvh-5.5rem)]' },
} as const

export function SimpleShell() {
  const uid = useSessionUserId()
  const nav = NAV_LAYOUT[usePrefs().textSize]
  const location = useLocation()
  const [palette, setPalette] = useState(false)
  useEffect(() => {
    document.documentElement.classList.add('simple-view')
    return () => document.documentElement.classList.remove('simple-view')
  }, [])
  const { items, dash } = useTodo()
  const { data: chats } = useApi(['conversations', uid], api.chat.conversations, !!uid)
  useEffect(() => {
    window.scrollTo({ top: 0 }) // newer browsers return a Promise here, so don't return it
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
  const pid = projectIdFrom(location.pathname) // inside a project: the project bar is shown
  const full = location.pathname.startsWith('/messages') // the Messages page fills the screen
  const tabs = [
    { to: '/', icon: <ListTodo />, label: 'To do', count: items.length, end: true },
    { to: '/projects', icon: <FolderKanban />, label: 'Projects' },
    { to: '/messages', icon: <MessageCircle />, label: 'Messages', count: chats?.unread },
    { to: '/help', icon: <CircleHelp />, label: 'Help' },
  ]

  return (
    <div className="flex min-h-full flex-col">
      {/* App-wide header (logo, the four places, view, demo, profile): flush and full width, its
          content lined up with the page. Project navigation is a separate band below it. */}
      <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur-xl no-print">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 md:px-8">
          <Link to="/" className={clsx('shrink-0 items-center gap-2.5 rounded-lg py-1 pr-2', pid ? 'hidden sm:flex' : 'flex')}>
            <img src="/favicon.svg" alt="" className="h-8 w-8 rounded-lg" />
            {/* Inside a project the project takes the name's place */}
            {!pid && <span className="hidden text-base font-semibold md:block">{brand.appName}</span>}
          </Link>
          {pid ? (
            <>
              <span className="mx-1 hidden h-6 w-px bg-line sm:block" aria-hidden />
              <ProjectCrumb pid={pid} />
            </>
          ) : (
            <span className={clsx('mx-3 hidden h-6 w-px bg-line', nav.top)} aria-hidden />
          )}
          <nav className={clsx('hidden h-16 items-stretch gap-1', nav.top, pid && 'ml-auto')} aria-label="Main">
            {tabs.map((t) => (
              <NavTab key={t.to} {...t} />
            ))}
          </nav>
          <div className={clsx('flex shrink-0 items-center gap-1.5', !pid && 'ml-auto')}>
            <DemoButton />
            <ProfileMenu portfolio={!!dash?.portfolio} />
          </div>
        </div>
        <nav className={clsx('grid grid-cols-4 border-t border-line', nav.row)} aria-label="Main">
          {tabs.map((t) => (
            <NavTab key={t.to} {...t} mobile />
          ))}
        </nav>
        {/* The project's tabs: the second line of the same bar */}
        {pid && !full && (
          <div className="border-t border-line">
            <ProjectTabs pid={pid} />
          </div>
        )}
      </header>
      <JobStrip />
      {full ? (
        <main className={clsx('shadow-soft mx-auto mt-3 flex h-[calc(100dvh-9.5rem)] w-[calc(100%-1rem)] max-w-6xl flex-col overflow-hidden rounded-2xl sm:w-[calc(100%-1.5rem)]', nav.height)}>
          <Outlet />
        </main>
      ) : (
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-10 md:px-8">
          <Outlet />
        </main>
      )}
      <CallLayer />
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  )
}
