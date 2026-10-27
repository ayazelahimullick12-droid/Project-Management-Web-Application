/**
 * Building blocks for the Simple view. Every Simple page has the same shape:
 *
 *   ← Back link
 *   Title  (and one line saying what the page is for)
 *   Status sentence
 *   "Your next step" box (only when there is something for you to do)
 *   At most three sections
 *   ▸ More (everything else, closed)
 *   Action bar at the bottom: one main button
 *
 * Text is at least 16px for reading and 14px for small print; rows and buttons are large.
 */
import { clsx } from 'clsx'
import { ArrowLeft, ArrowRight, ChevronDown, ChevronRight, Circle, CircleCheck, Clock, TriangleAlert } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Tone } from './words'

export function SimplePage({ back, title, subtitle, children, wide }: { back?: { to: string; label: string }; title: ReactNode; subtitle?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <div className={clsx('mx-auto', wide ? 'max-w-5xl' : 'max-w-3xl')}>
      {back && (
        <Link to={back.to} className="mb-5 inline-flex items-center gap-2 rounded-lg py-1 text-base text-muted hover:text-brand">
          <ArrowLeft className="h-5 w-5" /> {back.label}
        </Link>
      )}
      <h1 className="page-title text-3xl leading-tight">{title}</h1>
      {subtitle && <p className="mt-2 text-lg text-muted">{subtitle}</p>}
      <div className="mt-7 space-y-8">{children}</div>
    </div>
  )
}

const TONE_ICON: Record<Tone, ReactNode> = {
  done: <CircleCheck className="h-6 w-6 text-leaf" />,
  waiting: <Clock className="h-6 w-6 text-sky-600" />,
  action: <ArrowRight className="h-6 w-6 text-brand" />,
  problem: <TriangleAlert className="h-6 w-6 text-amber-600" />,
  todo: <Circle className="h-6 w-6 text-gray-400" />,
}

export function ToneIcon({ tone }: { tone: Tone }) {
  return <span className="shrink-0">{TONE_ICON[tone]}</span>
}

/** Where things stand, in one sentence. */
export function StatusLine({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-surface px-5 py-4 text-lg ring-1 ring-line">
      <ToneIcon tone={tone} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

/** The one thing this person should do here. Shown only when there is something to do. */
export function NextStep({ title = 'Your next step', children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-2xl border-2 border-brand/30 bg-brand-soft/40 p-5 md:p-6">
      <div className="text-base font-semibold text-brand">{title}</div>
      <div className="mt-1 text-lg">{children}</div>
      {actions && <div className="mt-4 flex flex-wrap items-center gap-3">{actions}</div>}
    </section>
  )
}

export function Section({ title, children, hint }: { title: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold">{title}</h2>
      {hint && <p className="mt-1 text-base text-muted">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

/** A large, easy-to-click row: icon, title, one line under it, and an optional label on the right. */
export function Row({ to, onClick, icon, title, subtitle, right, muted }: { to?: string; onClick?: () => void; icon?: ReactNode; title: ReactNode; subtitle?: ReactNode; right?: ReactNode; muted?: boolean }) {
  const inner = (
    <>
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className={clsx('block text-lg font-medium', muted && 'text-muted')}>{title}</span>
        {subtitle && <span className="mt-0.5 block text-base text-muted">{subtitle}</span>}
      </span>
      {right && <span className="shrink-0 text-base font-medium text-brand">{right}</span>}
      {(to || onClick) && <ChevronRight className="h-5 w-5 shrink-0 text-muted" />}
    </>
  )
  const cls = 'flex w-full items-center gap-4 rounded-2xl bg-surface px-5 py-4 text-left ring-1 ring-line transition'
  if (to)
    return (
      <Link to={to} className={clsx(cls, 'hover:bg-brand-soft/30 hover:ring-brand/40')}>
        {inner}
      </Link>
    )
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={clsx(cls, 'hover:bg-brand-soft/30 hover:ring-brand/40')}>
        {inner}
      </button>
    )
  return <div className={cls}>{inner}</div>
}

export function Rows({ children }: { children: ReactNode }) {
  return <div className="space-y-3">{children}</div>
}

/** Everything that is not needed right now, closed until asked for. */
export function More({ label = 'More', children, defaultOpen = false }: { label?: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex items-center gap-2 rounded-lg py-1 text-lg font-medium text-muted hover:text-ink">
        <ChevronDown className={clsx('h-5 w-5 transition', !open && '-rotate-90')} />
        {label}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </section>
  )
}

/** The page's main button(s), always at the bottom of the screen. */
export function ActionBar({ children, more }: { children?: ReactNode; more?: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 border-t border-line bg-surface/95 px-4 py-4 backdrop-blur md:-mx-8 md:px-8">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
        {children}
        {more && <div className="ml-auto">{more}</div>}
      </div>
    </div>
  )
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-surface px-6 py-12 text-center ring-1 ring-line">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-leaf-soft text-leaf [&>svg]:h-7 [&>svg]:w-7">{icon}</span>
      <div className="text-xl font-semibold">{title}</div>
      {children && <div className="mt-2 max-w-md text-base text-muted">{children}</div>}
    </div>
  )
}

export function Count({ n, className }: { n?: number; className?: string }) {
  return n ? <span className={clsx('min-w-6 rounded-full bg-brand px-2 text-center text-sm leading-6 font-semibold text-white', className)}>{n}</span> : null
}
