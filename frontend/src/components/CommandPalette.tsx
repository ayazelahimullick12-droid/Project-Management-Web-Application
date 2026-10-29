/**
 * Quick switcher (Ctrl+K / ⌘K), like Linear or GitHub: type to jump to any page, project or document.
 */
import { CornerDownLeft, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { api } from '../api'
import { useApi, useSessionUserId } from '../api/hooks'
import { setPref, useIsDark, usePrefs } from './prefs'

interface Item {
  label: string
  hint: string
  to?: string // a page to open…
  run?: () => void // …or an action (light / dark mode)
}

const PAGES: Item[] = [
  { label: 'Home (To do)', hint: 'What is waiting on you', to: '/' },
  { label: 'Projects', hint: 'All your projects', to: '/projects' },
  { label: 'Questions for you', hint: 'Answer the Q/A questions one at a time', to: '/questions' },
  { label: 'Reports', hint: 'All projects at a glance (Owner and Admin)', to: '/reports' },
  { label: 'Help', hint: 'How do I…', to: '/help' },
  { label: 'My work', hint: 'Approvals, questions and tests waiting on you', to: '/my-work' },
  { label: 'Inbox', hint: 'Notifications', to: '/notifications' },
  { label: 'Messages', hint: 'Project channels and direct messages', to: '/messages' },
  { label: 'New project', hint: 'Page', to: '/projects/new' },
  { label: 'Mailbox', hint: 'Emails the app would send', to: '/mailbox' },
  { label: 'Admin', hint: 'Templates, users, settings', to: '/admin' },
  { label: 'Open questions', hint: 'What the spec leaves open', to: '/open-questions' },
  { label: 'How the real app works', hint: 'Prototype notes', to: '/how-it-works' },
  { label: 'Archived projects', hint: 'Page', to: '/archive' },
]

const PROJECT_PAGES: [string, string][] = [
  ['Overview', ''],
  ['Intake & facts', '/intake'],
  ['Proposal & Charter', '/docs/PROPOSAL'],
  ['BRD', '/docs/BRD'],
  ['SRS', '/docs/SRS'],
  ['SQA', '/testing/SQA'],
  ['UAT', '/testing/UAT'],
  ['Changes & decisions', '/changes'],
  ['Project chat', '/chat'],
  ['Team', '/team'],
]

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const uid = useSessionUserId()
  const navigate = useNavigate()
  const { data: projects } = useApi(['my-projects', uid], api.projects.myProjects, !!uid)
  const dark = useIsDark()
  const { view } = usePrefs()
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const input = useRef<HTMLInputElement>(null)

  const items = useMemo(() => {
    const all: Item[] = [
      ...PAGES,
      { label: dark ? 'Switch to light mode' : 'Switch to dark mode', hint: 'Appearance (theme, dark, light)', run: () => setPref('theme', dark ? 'light' : 'dark') },
      { label: 'Use the computer’s light or dark setting', hint: 'Appearance (theme, system)', run: () => setPref('theme', 'system') },
      { label: view === 'simple' ? 'Switch to the Full view' : 'Switch to the Simple view', hint: 'Simple: one job per page · Full: every tool on screen', run: () => setPref('view', view === 'simple' ? 'full' : 'simple') },
    ]
    for (const p of (projects ?? []).filter((x) => x.status === 'active'))
      for (const [label, path] of PROJECT_PAGES) all.push({ label: path ? `${p.name} › ${label}` : p.name, hint: path ? 'Project page' : `Project · ${p.role}`, to: `/projects/${p.id}${path}` })
    const words = q.toLowerCase().split(/\s+/).filter(Boolean)
    return all.filter((it) => words.every((w) => `${it.label} ${it.hint}`.toLowerCase().includes(w))).slice(0, 9)
  }, [projects, q, dark, view])

  useEffect(() => {
    if (open) {
      setQ('')
      setI(0)
      setTimeout(() => input.current?.focus(), 0)
    }
  }, [open])
  useEffect(() => setI(0), [q])

  if (!open) return null
  const go = (it?: Item) => {
    if (!it) return
    if (it.run) it.run()
    else if (it.to) navigate(it.to)
    onClose()
  }
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/30 p-4 pt-[12vh] no-print" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-xl overflow-hidden rounded-xl bg-surface shadow-2xl ring-1 ring-line">
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Search className="h-4 w-4 text-muted" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
              if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(items.length - 1, x + 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(0, x - 1)) }
              if (e.key === 'Enter') go(items[i])
            }}
            placeholder="Jump to a project, document or page…"
            className="w-full bg-transparent py-3.5 text-sm outline-none"
          />
          <kbd className="rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">Esc</kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto py-1">
          {items.map((it, n) => (
            <li key={it.to ?? it.label}>
              <button onMouseEnter={() => setI(n)} onClick={() => go(it)} className={clsx('flex w-full items-center gap-3 px-4 py-2 text-left', n === i && 'bg-brand-soft/60')}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{it.label}</span>
                  <span className="block truncate text-xs text-muted">{it.hint}</span>
                </span>
                {n === i && <CornerDownLeft className="h-3.5 w-3.5 text-muted" />}
              </button>
            </li>
          ))}
          {!items.length && <li className="px-4 py-6 text-center text-sm text-muted">Nothing found.</li>}
        </ul>
      </div>
    </div>,
    document.body,
  )
}
