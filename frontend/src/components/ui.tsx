/**
 * Basic building blocks used on every screen: buttons, badges, cards, tabs, modals, form fields.
 * Styling uses Tailwind classes; colours come from the BRAC tokens in src/theme/brand.ts.
 */
import { clsx } from 'clsx'
import { X } from 'lucide-react'
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import { initials } from './format'

// ─── Buttons ────────────────────────────────────────────────────────────

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand text-white shadow-sm shadow-brand/25 hover:brightness-110 disabled:bg-brand/40 disabled:shadow-none',
  secondary: 'bg-surface text-ink shadow-xs ring-1 ring-line hover:bg-canvas disabled:text-muted',
  ghost: 'text-ink hover:bg-ink/5 disabled:text-muted',
  danger: 'bg-surface text-red-700 ring-1 ring-red-200 hover:bg-red-50 disabled:text-red-300',
  success: 'bg-leaf text-white shadow-sm shadow-leaf/25 hover:brightness-110 disabled:bg-leaf/40 disabled:shadow-none',
}

const SIZE = { sm: 'h-7 px-2.5 text-xs', md: 'h-9 px-3.5 text-sm', lg: 'h-12 px-6 text-base' } as const

export function Button({ variant = 'secondary', size = 'md', className, why, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: keyof typeof SIZE; why?: string }) {
  return (
    <button
      type="button"
      title={rest.disabled && why ? why : rest.title}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100',
        SIZE[size],
        VARIANT[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

/** A button whose rule check is shown as a reason when it is not allowed. */
export function Guarded({ check, children, ...rest }: Omit<Parameters<typeof Button>[0], 'disabled'> & { check: { ok: boolean; reason?: string }; disabled?: boolean }) {
  const disabled = !check.ok || rest.disabled
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button {...rest} disabled={disabled} why={check.reason}>
        {children}
      </Button>
      {!check.ok && check.reason && <span className="max-w-xs text-[11px] leading-tight text-muted">{check.reason}</span>}
    </span>
  )
}

export function LinkButton({ to, children, variant = 'secondary', size = 'md', className }: { to: string; children: ReactNode; variant?: Variant; size?: keyof typeof SIZE; className?: string }) {
  return (
    <Link to={to} className={clsx('inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition active:scale-[0.98]', SIZE[size], VARIANT[variant], className)}>
      {children}
    </Link>
  )
}

// ─── Badges ─────────────────────────────────────────────────────────────

export type Tone = 'gray' | 'magenta' | 'green' | 'amber' | 'red' | 'blue' | 'violet' | 'dark'

const TONE: Record<Tone, string> = {
  gray: 'bg-ink/[0.05] text-ink/70 ring-transparent',
  magenta: 'bg-brand-soft text-brand ring-transparent',
  green: 'bg-leaf-soft text-leaf ring-transparent',
  amber: 'bg-amber-50 text-amber-800 ring-transparent',
  red: 'bg-red-50 text-red-700 ring-transparent',
  blue: 'bg-sky-50 text-sky-800 ring-transparent',
  violet: 'bg-violet-50 text-violet-700 ring-transparent',
  dark: 'bg-ink text-canvas ring-ink',
}

const DOT: Record<Tone, string> = {
  gray: 'bg-gray-400',
  magenta: 'bg-brand',
  green: 'bg-leaf',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  blue: 'bg-sky-500',
  violet: 'bg-violet-500',
  dark: 'bg-ink',
}

/** A status shown as a coloured dot and a label (quieter than a filled pill). */
export function Dot({ tone = 'gray', children, className, title }: { tone?: Tone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={clsx('inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-ink/80', className)}>
      <span className={clsx('h-2 w-2 shrink-0 rounded-full', DOT[tone])} />
      {children}
    </span>
  )
}

export function Badge({ tone = 'gray', children, className, title }: { tone?: Tone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={clsx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset', TONE[tone], className)}>
      {children}
    </span>
  )
}

// ─── Layout pieces ──────────────────────────────────────────────────────

export function Card({ title, actions, children, className, padded = true, subtitle }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children?: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={clsx('shadow-soft rounded-2xl border border-line/70 bg-surface', className)}>
      {(title || actions) && (
        <header className={clsx('flex flex-wrap items-start justify-between gap-2 px-5 pt-4', padded ? 'pb-0' : 'border-b border-line/70 pb-3')}>
          <div>
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={padded ? 'px-5 pt-3 pb-5' : undefined}>{children}</div>
    </section>
  )
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs text-muted [&_a]:hover:text-brand">{eyebrow}</div>}
        <h1 className="page-title text-2xl leading-tight">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function EmptyState({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface/60 px-6 py-10 text-center">
      {icon && <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-ink/5 text-muted">{icon}</div>}
      <div className="text-sm font-medium">{title}</div>
      {children && <div className="mt-1 max-w-md text-sm text-muted">{children}</div>}
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <span className={clsx('inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent', className)} />
}

/** Grey placeholder blocks shown while a screen loads (a "skeleton", like most current apps). */
export function Loading() {
  return (
    <div className="animate-pulse space-y-4 py-2" aria-label="Loading">
      <div className="h-7 w-64 rounded-lg bg-ink/[0.06]" />
      <div className="h-4 w-96 max-w-full rounded bg-ink/[0.05]" />
      <div className="grid gap-4 pt-2 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-ink/[0.05]" />
        ))}
      </div>
      <div className="h-48 rounded-2xl bg-ink/[0.04]" />
    </div>
  )
}

export function ErrorBox({ error }: { error: unknown }) {
  return <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800 ring-1 ring-red-200">{error instanceof Error ? error.message : 'Something went wrong.'}</div>
}

export function Note({ tone = 'gray', children, icon, className }: { tone?: Tone; children: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <div className={clsx('flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm ring-1 ring-inset', TONE[tone], className)}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

const AVATAR_COLORS = ['#D10074', '#008945', '#52534A', '#B45309', '#0369A1', '#6D28D9', '#BE185D', '#047857']

/** Picks a steady colour for a person or project from its id. */
export function colorFor(key: string) {
  let h = 0
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) | 0
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

export function Avatar({ name, id, size = 28, status, className }: { name: string; id?: string; size?: number; status?: 'online' | 'away' | 'off'; className?: string }) {
  const c = colorFor(id ?? name)
  return (
    <span className={clsx('relative inline-flex shrink-0', className)} title={name}>
      <span className="inline-flex items-center justify-center rounded-full font-semibold text-white" style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(135deg, ${c}, ${c}cc)` }}>
        {initials(name)}
      </span>
      {status && <span className={clsx('absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-surface', status === 'online' ? 'bg-leaf' : status === 'away' ? 'bg-amber-500' : 'bg-gray-400')} />}
    </span>
  )
}

/** Overlapping avatars, like the "people on this" row in Asana or Figma. */
export function AvatarStack({ people, size = 24, max = 4 }: { people: { id: string; name: string }[]; size?: number; max?: number }) {
  return (
    <span className="flex items-center">
      {people.slice(0, max).map((p, i) => (
        <span key={p.id} className={clsx('rounded-full ring-2 ring-surface', i > 0 && '-ml-1.5')}>
          <Avatar name={p.name} id={p.id} size={size} />
        </span>
      ))}
      {people.length > max && (
        <span className="-ml-1.5 inline-flex items-center justify-center rounded-full bg-canvas text-[10px] font-medium text-muted ring-2 ring-surface" style={{ width: size, height: size }}>
          +{people.length - max}
        </span>
      )}
    </span>
  )
}

/** A project's coloured square with its first letter (like workspace icons in Linear or Slack). */
export function ProjectIcon({ id, name, size = 28 }: { id: string; name: string; size?: number }) {
  const c = colorFor(id)
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-lg font-semibold" style={{ width: size, height: size, fontSize: size * 0.42, background: `${c}22`, color: c }}>
      {name.trim()[0]?.toUpperCase()}
    </span>
  )
}

/** A circular progress indicator (0–100). */
export function ProgressRing({ value, size = 36, stroke = 3.5 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.min(100, Math.max(0, value))
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-ink/[0.08]" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * v) / 100} className={v >= 100 ? 'stroke-leaf' : 'stroke-brand'} />
      </svg>
      <span className="absolute text-[10px] font-semibold tabular-nums">{v}%</span>
    </span>
  )
}

// ─── Tabs (kept in the URL as ?tab=… so links can open a tab) ───────────

export function useTab(defaultTab: string): [string, (t: string) => void] {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? defaultTab
  return [tab, (t: string) => setParams((p) => {
    const n = new URLSearchParams(p)
    n.set('tab', t)
    return n
  }, { replace: true })]
}

export function Tabs({ tabs, value, onChange }: { tabs: { id: string; label: ReactNode; hidden?: boolean }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="mb-4 flex flex-wrap gap-1 border-b border-line">
      {tabs
        .filter((t) => !t.hidden)
        .map((t) => (
          <button key={t.id} type="button" onClick={() => onChange(t.id)} className={clsx('-mb-px border-b-2 px-3 py-2 text-sm', value === t.id ? 'border-brand font-medium text-ink' : 'border-transparent text-muted hover:text-ink')}>
            {t.label}
          </button>
        ))}
    </div>
  )
}

// ─── Modal ──────────────────────────────────────────────────────────────

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[6vh] backdrop-blur-[2px] no-print" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={clsx('w-full rounded-2xl bg-surface shadow-2xl ring-1 ring-line', wide ? 'max-w-4xl' : 'max-w-lg')} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button className="rounded p-1 text-muted hover:bg-ink/5" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

// ─── Form fields ────────────────────────────────────────────────────────

export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
    </label>
  )
}

const inputCls = 'w-full rounded-lg border-0 bg-surface px-3 py-2 text-sm shadow-xs ring-1 ring-line placeholder:text-muted/70 focus:ring-2 focus:ring-brand/70 focus:outline-none disabled:bg-canvas'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx(inputCls, props.className)} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={clsx(inputCls, 'leading-relaxed', props.className)} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={clsx(inputCls, 'pr-8', props.className)} />
}

export function Checkbox({ label, checked, onChange, disabled }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={clsx('inline-flex cursor-pointer items-center gap-2 text-sm', disabled && 'cursor-not-allowed opacity-60')}>
      <input type="checkbox" className="h-4 w-4 accent-[var(--brand-primary)]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

export function KV({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(110px,max-content)_1fr] gap-x-4 gap-y-1.5 text-sm">
      {items.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="min-w-0">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Table({ head, children, className }: { head: ReactNode[]; children: ReactNode; className?: string }) {
  return (
    <div className={clsx('overflow-x-auto', className)}>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs text-muted">
            {head.map((h, i) => (
              <th key={i} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  )
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={clsx('px-3 py-2 align-top', className)}>{children}</td>
}

/** A compact switch between views (like a segmented control). */
export function Segmented({ options, value, onChange }: { options: { id: string; label: ReactNode; hidden?: boolean }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="inline-flex rounded-lg bg-ink/[0.05] p-0.5">
      {options
        .filter((o) => !o.hidden)
        .map((o) => (
          <button key={o.id} type="button" onClick={() => onChange(o.id)} className={clsx('rounded-md px-3 py-1 text-sm transition', value === o.id ? 'bg-surface font-medium shadow-sm dark:bg-ink/15' : 'text-muted hover:text-ink')}>
            {o.label}
          </button>
        ))}
    </div>
  )
}

/** A small menu that opens from a button (for secondary actions, behind "…"). */
export function MenuButton({ label, items, align = 'right' }: { label: ReactNode; items: ({ label: ReactNode; onClick?: () => void; href?: string; danger?: boolean; hidden?: boolean } | 'divider')[]; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-surface px-2.5 text-sm shadow-xs ring-1 ring-line hover:bg-canvas">
        {label}
      </button>
      {open && (
        <div className={clsx('absolute top-11 z-30 min-w-52 rounded-xl bg-surface p-1 shadow-xl ring-1 ring-line', align === 'right' ? 'right-0' : 'left-0')}>
          {items.map((it, i) =>
            it === 'divider' ? (
              <div key={i} className="my-1 border-t border-line" />
            ) : it.hidden ? null : it.href ? (
              <a key={i} href={it.href} target="_blank" rel="noreferrer" className="block rounded-lg px-3 py-1.5 text-sm hover:bg-canvas" onClick={() => setOpen(false)}>
                {it.label}
              </a>
            ) : (
              <button key={i} type="button" className={clsx('block w-full rounded-lg px-3 py-1.5 text-left text-sm hover:bg-canvas', it.danger && 'text-red-700')} onClick={() => { setOpen(false); it.onClick?.() }}>
                {it.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  )
}
