/**
 * Simple view · the project header, a band under the top bar on every page of a project.
 * Modelled on common work-app patterns (GitHub's repository header, Jira's project tabs):
 *
 *   Projects / [icon] Branch Cash Reconciliation ▾                Step 3 of 7 · Business requirements ▬▬▬▭▭▭▭
 *   Overview   Questions & facts   Proposal & Charter ✓   BRD (1)   SRS   SQA   UAT   More ▾
 *   ───────    (the current tab is underlined in magenta)
 *
 * - The project name is a switcher: your projects with their step and how many things wait for
 *   you. Picking one keeps you in the same place (the BRD of project A → the BRD of project B).
 * - "Hide" folds the bar into one slim line (project, where you are, "Show menu"); the choice is
 *   remembered in this browser.
 * - Each tab has an icon; a finished document shows a green check; a magenta count means
 *   something there is waiting for you. More holds team chat, team, changes and the activity log.
 */
import { clsx } from 'clsx'
import { Check, ChevronDown, ChevronUp, CircleCheck, ClipboardList, FileCheck2, FileText, FlaskConical, FolderKanban, LayoutDashboard, MoreHorizontal, Plus, UserCheck } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import type { DocType } from '../types'
import type { ProjectSummary } from '../api/projects'
import { api } from '../api'
import { useApi, useSessionUserId } from '../api/hooks'
import { Dropdown } from '../components/Dropdown'
import { ProjectIcon } from '../components/ui'
import { STAGES } from '../rules/pipeline'
import { stepText } from './ProjectsPage'
import { useTodo, type TodoItem } from './todo'
import { DOC_NAME } from './words'

const OPEN_KEY = 'brac-pm-prototype:project-bar'

/** Whether the project bar is open. Remembered in this browser; open unless the person hid it. */
function useBarOpen(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(OPEN_KEY) !== 'hidden'
    } catch {
      return true
    }
  })
  const set = (o: boolean) => {
    setOpen(o)
    try {
      localStorage.setItem(OPEN_KEY, o ? 'open' : 'hidden')
    } catch {
      /* storage blocked: remembered until the page is reloaded */
    }
  }
  return [open, set]
}

/** The name of the place in the project you are on, for the hidden bar. */
function placeName(path: string, base: string): string {
  const rest = path.slice(base.length)
  if (!rest) return 'Overview'
  if (rest.startsWith('/intake')) return 'Questions & facts'
  if (rest.startsWith('/docs/PROPOSAL')) return 'Proposal & Charter'
  if (rest.startsWith('/docs/BRD')) return 'BRD'
  if (rest.startsWith('/docs/SRS')) return 'SRS'
  if (rest.startsWith('/testing/SQA')) return 'SQA'
  if (rest.startsWith('/testing/UAT')) return 'UAT'
  if (rest.startsWith('/team')) return 'Team'
  if (rest.startsWith('/changes') || rest.startsWith('/decisions')) return 'Changes and decisions'
  if (rest.startsWith('/audit')) return 'Activity log'
  return ''
}

/** The project id in the address, if this is a project page. */
export function projectIdFrom(path: string): string | undefined {
  const m = /^\/projects\/([^/]+)/.exec(path)
  return m && m[1] !== 'new' ? m[1] : undefined
}

/** Where the same place is in another project (documents, questions, testing, team, changes). */
function samePlace(path: string, from: string, to: string): string {
  const rest = path.slice(`/projects/${from}`.length).replace(/\/tools$/, '')
  return /^\/(docs\/[A-Z_]+|intake|testing\/(SQA|UAT)|team|changes|decisions|audit)$/.test(rest) ? `/projects/${to}${rest}` : `/projects/${to}`
}

const tabClass = (active: boolean) =>
  clsx(
    'relative inline-flex shrink-0 items-center gap-2 px-3 pt-2 pb-3 text-[15px] font-medium whitespace-nowrap transition [&_svg]:h-[18px] [&_svg]:w-[18px]',
    'after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full',
    active ? 'text-ink after:bg-brand' : 'text-muted after:bg-transparent hover:text-ink hover:after:bg-line',
  )

/** A neutral counter; magenta when the items are waiting for you. */
function Counter({ n, mine }: { n?: number; mine?: boolean }) {
  if (!n) return null
  return <span className={clsx('min-w-5 rounded-full px-1.5 text-center text-xs leading-5 font-semibold tabular-nums', mine ? 'bg-brand text-white' : 'bg-ink/[0.07] text-muted dark:bg-white/10')}>{n}</span>
}

function Tab({ to, end, icon, label, title, count, active }: { to: string; end?: boolean; icon: ReactNode; label: string; title?: string; count?: number; active?: boolean }) {
  return (
    <NavLink to={to} end={end} title={title} className={({ isActive }) => tabClass(isActive || !!active)}>
      {icon}
      {label}
      <Counter n={count} mine />
    </NavLink>
  )
}

function Switcher({ current, all, items }: { current: ProjectSummary; all: ProjectSummary[]; items: TodoItem[] }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const mine = (pid: string) => items.filter((i) => i.projectId === pid).length
  return (
    <Dropdown
      align="left"
      width="w-[min(26rem,calc(100vw-2rem))]"
      label={`Switch project (now: ${current.project.name})`}
      button={(open) => (
        <span className="flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-ink/[0.04] dark:hover:bg-white/5">
          <ProjectIcon id={current.project.id} name={current.project.name} size={26} />
          <span className="truncate text-lg font-semibold">{current.project.name}</span>
          <ChevronDown className={clsx('h-4 w-4 shrink-0 text-muted transition', open && 'rotate-180')} />
        </span>
      )}
    >
      {(close) => (
        <div className="p-1.5">
          <div className="px-3 pt-2 pb-1 text-xs font-semibold tracking-[0.06em] text-muted uppercase">Switch project</div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {all.map((s) => {
              const n = mine(s.project.id)
              const here = s.project.id === current.project.id
              return (
                <li key={s.project.id}>
                  <button
                    type="button"
                    onClick={() => {
                      close()
                      if (!here) navigate(samePlace(pathname, current.project.id, s.project.id))
                    }}
                    className={clsx('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-ink/[0.04] dark:hover:bg-white/5', here && 'bg-ink/[0.04] dark:bg-white/5')}
                  >
                    <ProjectIcon id={s.project.id} name={s.project.name} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-medium">{s.project.name}</span>
                      <span className="block truncate text-sm text-muted">{s.project.status === 'archived' ? 'Archived' : stepText(s.stage)}</span>
                    </span>
                    {n > 0 && (
                      <span className="shrink-0 rounded-full bg-brand px-2 text-xs leading-5 font-semibold text-white" title={`${n} waiting for you`}>
                        {n}
                      </span>
                    )}
                    {here && <Check className="h-4 w-4 shrink-0 text-brand" aria-label="Current project" />}
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="mt-1 flex gap-1 border-t border-line pt-1.5">
            <Link to="/projects" onClick={close} className="flex flex-1 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium hover:bg-ink/[0.04] dark:hover:bg-white/5">
              <FolderKanban className="h-4 w-4 text-muted" /> All projects
            </Link>
            <Link to="/projects/new" onClick={close} className="flex flex-1 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium hover:bg-ink/[0.04] dark:hover:bg-white/5">
              <Plus className="h-4 w-4 text-muted" /> New project
            </Link>
          </div>
        </div>
      )}
    </Dropdown>
  )
}

function MoreTab({ pid, active, unread }: { pid: string; active: boolean; unread: number }) {
  const navigate = useNavigate()
  const links: [string, string, number?][] = [
    ['Team chat', `/messages/${pid}-chat`, unread],
    ['Team', `/projects/${pid}/team`],
    ['Changes and decisions', `/projects/${pid}/changes`],
    ['Activity log', `/projects/${pid}/audit`],
  ]
  return (
    <Dropdown
      width="w-64"
      label="More project pages"
      button={(open) => (
        <span className={tabClass(active)}>
          <MoreHorizontal />
          More
          <Counter n={unread} />
          <ChevronDown className={clsx('!h-3.5 !w-3.5 transition', open && 'rotate-180')} />
        </span>
      )}
    >
      {(close) => (
        <div className="p-1.5">
          {links.map(([label, to, n]) => (
            <button
              key={to}
              type="button"
              className="flex w-full items-center justify-between gap-2 rounded-xl px-4 py-2.5 text-left text-base hover:bg-ink/[0.04] dark:hover:bg-white/5"
              onClick={() => {
                close()
                navigate(to)
              }}
            >
              {label}
              <Counter n={n} />
            </button>
          ))}
        </div>
      )}
    </Dropdown>
  )
}

/** "Step 3 of 7 · Business requirements" with a thin segmented bar. */
function StepProgress({ stage }: { stage: ProjectSummary['stage'] }) {
  const done = stage === 'COMPLETE' ? STAGES.length : STAGES.indexOf(stage) + 1
  return (
    <div className="hidden shrink-0 items-center gap-3 md:flex">
      <span className="text-sm text-muted">{stepText(stage)}</span>
      <span className="flex w-28 gap-0.5" aria-hidden>
        {STAGES.map((st, i) => (
          <span key={st} className={clsx('h-1.5 flex-1 rounded-full', i < done ? 'bg-brand' : 'bg-ink/10 dark:bg-white/12')} />
        ))}
      </span>
    </div>
  )
}

export function ProjectNav({ pid }: { pid: string }): ReactNode {
  const uid = useSessionUserId()
  const { pathname } = useLocation()
  const { items, dash } = useTodo()
  const { data: chats } = useApi(['conversations', uid], api.chat.conversations, !!uid)
  const strip = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useBarOpen()

  // Keep the current tab in view on narrow screens, where the tabs scroll sideways.
  useEffect(() => {
    strip.current?.querySelector<HTMLElement>('a[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [pathname, !!dash, open]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!dash) return null
  const all = [...dash.active, ...dash.finished, ...dash.archived]
  const current = all.find((s) => s.project.id === pid)
  if (!current) return null

  const base = `/projects/${pid}`
  const mine = items.filter((i) => i.projectId === pid)
  const count = (test: (to: string) => boolean) => mine.filter((i) => test(i.to)).length
  const unread = chats?.channels.find((c) => c.id === `${pid}-chat`)?.unread ?? 0
  const moreActive = /\/(team|changes|decisions|audit)$/.test(pathname)

  const docTab = (t: DocType, label: string) => {
    const d = current.docs.find((x) => x.type === t)
    const finished = d?.status.key === 'signed' || d?.status.key === 'approved'
    return (
      <Tab
        key={t}
        to={`${base}/docs/${t}`}
        icon={finished ? <FileCheck2 className="text-leaf" /> : <FileText />}
        label={label}
        title={`${DOC_NAME[t]}: ${d && d.status.key !== 'not_started' ? d.status.label : 'not written yet'}`}
        count={count((to) => to.startsWith(`${base}/docs/${t}`))}
      />
    )
  }

  /** SQA (technical testing) and UAT (user testing), each with its own tab; a check once signed off. */
  const testTab = (stage: 'SQA' | 'UAT') => {
    const d = current.docs.find((x) => x.type === (stage === 'SQA' ? 'SQA_SIGNOFF' : 'UAT_SIGNOFF'))
    const finished = d?.status.key === 'signed' || d?.status.key === 'approved'
    const to = `${base}/testing/${stage}`
    return (
      <Tab
        key={stage}
        to={to}
        icon={finished ? <CircleCheck className="text-leaf" /> : stage === 'SQA' ? <FlaskConical /> : <UserCheck />}
        label={stage}
        title={`${stage === 'SQA' ? 'Technical testing (SQA)' : 'User testing (UAT)'}: ${finished ? 'signed off' : d && d.status.key !== 'not_started' ? d.status.label : 'not signed off yet'}`}
        count={count((x) => x.startsWith(to))}
        active={pathname.startsWith(to)}
      />
    )
  }

  const toggle = (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      aria-expanded={open}
      title={open ? 'Hide the project menu' : 'Show the project menu'}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted ring-1 ring-line transition hover:bg-ink/[0.04] hover:text-ink dark:hover:bg-white/5"
    >
      {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      <span className="hidden sm:inline">{open ? 'Hide' : 'Show menu'}</span>
    </button>
  )

  // Hidden: one slim line with the project (still a switcher), where you are, and "Show menu".
  if (!open) {
    const place = placeName(pathname, base)
    return (
      <div className="border-b border-line bg-paper/60 no-print">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-1.5 md:px-8">
          <span className="min-w-0">
            <Switcher current={current} all={all} items={items} />
          </span>
          {place && <span className="truncate text-[15px] text-muted">/ {place}</span>}
          {mine.length > 0 && (
            <span className="shrink-0 rounded-full bg-brand px-2 text-xs leading-5 font-semibold text-white" title={`${mine.length} waiting for you in this project`}>
              {mine.length} for you
            </span>
          )}
          <span className="ml-auto" />
          {toggle}
        </div>
      </div>
    )
  }

  return (
    <div className="border-b border-line bg-paper/60 no-print">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="flex items-center gap-3 pt-4 pb-2">
          <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1.5">
            <Link to="/projects" className="hidden shrink-0 text-[15px] text-muted hover:text-ink hover:underline sm:inline">
              Projects
            </Link>
            <span className="hidden text-muted/60 sm:inline" aria-hidden>
              /
            </span>
            <span className="min-w-0">
              <Switcher current={current} all={all} items={items} />
            </span>
          </nav>
          <StepProgress stage={current.stage} />
          {toggle}
        </div>
        <div className="flex items-end gap-1">
          <div ref={strip} className="-ml-2 flex min-w-0 flex-1 overflow-x-auto max-md:[mask-image:linear-gradient(to_right,#000_82%,transparent)]" role="navigation" aria-label="Project" style={{ scrollbarWidth: 'none' }}>
            {/* In the order of the steps: questions and facts come before the documents */}
            <Tab to={base} end icon={<LayoutDashboard />} label="Overview" />
            <Tab to={`${base}/intake`} icon={<ClipboardList />} label="Questions & facts" count={count((to) => to.startsWith(`${base}/intake`) || to === '/questions')} />
            {docTab('PROPOSAL', 'Proposal & Charter')}
            {docTab('BRD', 'BRD')}
            {docTab('SRS', 'SRS')}
            {testTab('SQA')}
            {testTab('UAT')}
          </div>
          {/* Outside the scrolling strip, so its menu is not cut off */}
          <MoreTab pid={pid} active={moreActive} unread={unread} />
        </div>
      </div>
    </div>
  )
}
