/**
 * Simple view · the project bar, shown under the top bar on every page of a project.
 *
 * - Left: the project switcher. It lists your projects with their step and how many things wait
 *   for you; picking one keeps you in the same place (the BRD of project A → the BRD of project B).
 * - Then one tab per place in the project: Overview, the three documents, Questions & facts,
 *   Testing, and More (team chat, team, changes and decisions, activity log). Each tab shows its
 *   status as a coloured dot, and a magenta count when something there is waiting for you.
 */
import { clsx } from 'clsx'
import { Check, ChevronDown, FolderKanban, MoreHorizontal, Plus } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import type { DocType } from '../types'
import type { ProjectSummary } from '../api/projects'
import { api } from '../api'
import { useApi, useSessionUserId } from '../api/hooks'
import { Dropdown } from '../components/Dropdown'
import { ProjectIcon } from '../components/ui'
import { stepText } from './ProjectsPage'
import { useTodo, type TodoItem } from './todo'
import { DOC_NAME, docTone, type Tone } from './words'

/** The project id in the address, if this is a project page. */
export function projectIdFrom(path: string): string | undefined {
  const m = /^\/projects\/([^/]+)/.exec(path)
  return m && m[1] !== 'new' ? m[1] : undefined
}

const DOT: Record<Tone, string> = {
  done: 'bg-leaf',
  waiting: 'bg-sky-500',
  action: 'bg-brand',
  problem: 'bg-amber-500',
  todo: 'bg-ink/20 dark:bg-white/25',
}

const DOT_LABEL: Record<Tone, string> = { done: 'done', waiting: 'in review', action: 'in progress', problem: 'needs attention', todo: 'not started' }

/** Where the same place is in another project (documents, questions, testing, team, changes). */
function samePlace(path: string, from: string, to: string): string {
  const rest = path.slice(`/projects/${from}`.length).replace(/\/tools$/, '')
  return /^\/(docs\/[A-Z_]+|intake|testing\/(SQA|UAT)|team|changes|decisions|audit)$/.test(rest) ? `/projects/${to}${rest}` : `/projects/${to}`
}

function Tab({ to, end, label, title, tone, count, active }: { to: string; end?: boolean; label: string; title?: string; tone?: Tone; count?: number; active?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      title={title ?? (tone ? `${label}: ${DOT_LABEL[tone]}` : label)}
      data-tab
      className={({ isActive }) =>
        clsx(
          'relative inline-flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-2 text-[15px] font-medium whitespace-nowrap transition',
          isActive || active ? 'bg-ink/[0.06] text-ink dark:bg-white/10' : 'text-ink/70 hover:bg-ink/[0.04] hover:text-ink dark:hover:bg-white/5',
        )
      }
    >
      {tone && <span className={clsx('h-2 w-2 shrink-0 rounded-full', DOT[tone])} aria-hidden />}
      {label}
      {!!count && <span className="min-w-5 rounded-full bg-brand px-1.5 text-center text-xs leading-5 font-semibold text-white">{count}</span>}
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
      full
      width="w-[min(26rem,calc(100vw-1.5rem))]"
      label="Switch project"
      button={(open) => (
        <span className="flex min-w-0 items-center gap-2.5 md:max-w-[18rem] rounded-lg py-1.5 pr-2 pl-1.5 text-left hover:bg-ink/[0.04] dark:hover:bg-white/5">
          <ProjectIcon id={current.project.id} name={current.project.name} size={30} />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[15px] font-semibold">{current.project.name}</span>
            <span className="block truncate text-xs text-muted">{stepText(current.stage)}</span>
          </span>
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
                      <span className="block truncate text-sm text-muted">
                        {s.project.status === 'archived' ? 'Archived' : stepText(s.stage)}
                      </span>
                    </span>
                    {n > 0 && <span className="shrink-0 rounded-full bg-brand px-2 text-xs leading-5 font-semibold text-white" title={`${n} waiting for you`}>{n}</span>}
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
  const links: [string, string][] = [
    [unread ? `Team chat (${unread} new)` : 'Team chat', `/messages/${pid}-chat`],
    ['Team', `/projects/${pid}/team`],
    ['Changes and decisions', `/projects/${pid}/changes`],
    ['Activity log', `/projects/${pid}/audit`],
  ]
  return (
    <Dropdown
      width="w-64"
      label="More project pages"
      button={(open) => (
        <span className={clsx('inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[15px] font-medium whitespace-nowrap transition', active ? 'bg-ink/[0.06] text-ink dark:bg-white/10' : 'text-ink/70 hover:bg-ink/[0.04] hover:text-ink dark:hover:bg-white/5')}>
          <MoreHorizontal className="h-4 w-4" /> More {!!unread && <span className="h-2 w-2 rounded-full bg-brand" aria-label="new chat messages" />} <ChevronDown className={clsx('h-3.5 w-3.5 transition', open && 'rotate-180')} />
        </span>
      )}
    >
      {(close) => (
        <div className="p-1.5">
          {links.map(([label, to]) => (
            <button
              key={to}
              type="button"
              className="block w-full rounded-xl px-4 py-2.5 text-left text-base hover:bg-ink/[0.04] dark:hover:bg-white/5"
              onClick={() => {
                close()
                navigate(to)
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </Dropdown>
  )
}

export function ProjectNav({ pid }: { pid: string }): ReactNode {
  const uid = useSessionUserId()
  const { pathname } = useLocation()
  const { items, dash } = useTodo()
  const { data: chats } = useApi(['conversations', uid], api.chat.conversations, !!uid)
  const strip = useRef<HTMLDivElement>(null)

  // Keep the current tab in view on narrow screens, where the tabs scroll sideways.
  useEffect(() => {
    strip.current?.querySelector<HTMLElement>('a[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [pathname, !!dash])

  if (!dash) return null
  const all = [...dash.active, ...dash.finished, ...dash.archived]
  const current = all.find((s) => s.project.id === pid)
  if (!current) return null

  const base = `/projects/${pid}`
  const mine = items.filter((i) => i.projectId === pid)
  const count = (test: (to: string) => boolean) => mine.filter((i) => test(i.to)).length
  const doc = (t: DocType) => current.docs.find((d) => d.type === t)
  const testingStage = current.stage === 'UAT' || current.stage === 'COMPLETE' ? 'UAT' : 'SQA'
  const signoff = doc(testingStage === 'UAT' ? 'UAT_SIGNOFF' : 'SQA_SIGNOFF')
  const testingTone: Tone = current.stage === 'COMPLETE' ? 'done' : current.stage === 'SQA' || current.stage === 'UAT' ? (signoff && signoff.status.key !== 'not_started' ? docTone(signoff.status) : 'action') : 'todo'
  const intakeTone: Tone = current.stage === 'INTAKE' ? 'action' : 'done'
  const unread = chats?.channels.find((c) => c.id === `${pid}-chat`)?.unread ?? 0
  const moreActive = /\/(team|changes|decisions|audit)$/.test(pathname)

  const docTab = (t: DocType, label: string) => {
    const d = doc(t)
    return <Tab key={t} to={`${base}/docs/${t}`} label={label} title={`${DOC_NAME[t]}: ${d ? DOT_LABEL[docTone(d.status)] : 'not started'}`} tone={d ? docTone(d.status) : 'todo'} count={count((to) => to.startsWith(`${base}/docs/${t}`))} />
  }

  return (
    // Phones: switcher and More on the first row, the tabs (scrolling sideways) under them.
    // Wider screens: switcher | tabs | More on one row.
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line px-2 py-1.5 sm:px-4 md:flex-nowrap md:px-5">
      <div className="order-1 flex min-w-0 flex-1 items-center md:flex-none">
        <Switcher current={current} all={all} items={items} />
        <span className="ml-3 hidden h-7 w-px bg-line md:block" aria-hidden />
      </div>
      <div className="order-2 ml-auto md:order-3">
        <MoreTab pid={pid} active={moreActive} unread={unread} />
      </div>
      <div ref={strip} className="order-3 -mx-1 flex w-full min-w-0 items-center gap-0.5 overflow-x-auto px-1 md:order-2 md:w-auto md:flex-1 [&::-webkit-scrollbar]:hidden" role="navigation" aria-label="Project" style={{ scrollbarWidth: 'none' }}>
        <Tab to={base} end label="Overview" />
        {docTab('PROPOSAL', 'Proposal & Charter')}
        {docTab('BRD', 'BRD')}
        {docTab('SRS', 'SRS')}
        <Tab to={`${base}/intake`} label="Questions & facts" tone={intakeTone} count={count((to) => to.startsWith(`${base}/intake`) || to === '/questions')} />
        <Tab to={`${base}/testing/${testingStage}`} label="Testing" tone={testingTone} count={count((to) => to.startsWith(`${base}/testing`))} active={pathname.startsWith(`${base}/testing`)} />
      </div>
    </div>
  )
}
