/**
 * Basic building blocks used on every screen: buttons, badges, cards, tabs, modals, form fields.
 * Styling uses Tailwind classes; colours come from the BRAC tokens in src/theme/brand.ts.
 */
import { clsx } from 'clsx'
import { X } from 'lucide-react'
import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import { initials } from './format'

// ─── Buttons ────────────────────────────────────────────────────────────

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:brightness-110 disabled:bg-brand/40',
  secondary: 'bg-white text-ink ring-1 ring-line hover:bg-canvas disabled:text-muted',
  ghost: 'text-ink hover:bg-black/5 disabled:text-muted',
  danger: 'bg-white text-red-700 ring-1 ring-red-200 hover:bg-red-50 disabled:text-red-300',
  success: 'bg-leaf text-white hover:brightness-110 disabled:bg-leaf/40',
}

export function Button({ variant = 'secondary', size = 'md', className, why, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; why?: string }) {
  return (
    <button
      type="button"
      title={rest.disabled && why ? why : rest.title}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition disabled:cursor-not-allowed',
        size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm',
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

export function LinkButton({ to, children, variant = 'secondary', size = 'md', className }: { to: string; children: ReactNode; variant?: Variant; size?: 'sm' | 'md'; className?: string }) {
  return (
    <Link to={to} className={clsx('inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition', size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm', VARIANT[variant], className)}>
      {children}
    </Link>
  )
}

// ─── Badges ─────────────────────────────────────────────────────────────

export type Tone = 'gray' | 'magenta' | 'green' | 'amber' | 'red' | 'blue' | 'violet' | 'dark'

const TONE: Record<Tone, string> = {
  gray: 'bg-gray-100 text-gray-700 ring-gray-200',
  magenta: 'bg-brand-soft text-brand ring-pink-200',
  green: 'bg-leaf-soft text-leaf ring-green-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  blue: 'bg-sky-50 text-sky-800 ring-sky-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
  dark: 'bg-ink text-white ring-ink',
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
    <section className={clsx('rounded-lg bg-white ring-1 ring-line', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={padded ? 'p-4' : undefined}>{children}</div>
    </section>
  )
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <div className="mb-1 text-xs font-medium text-brand">{eyebrow}</div>}
        <h1 className="page-title text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function EmptyState({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line bg-white/60 px-6 py-10 text-center">
      {icon && <div className="mb-2 text-muted">{icon}</div>}
      <div className="text-sm font-medium">{title}</div>
      {children && <div className="mt-1 max-w-md text-sm text-muted">{children}</div>}
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <span className={clsx('inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent', className)} />
}

export function Loading() {
  return (
    <div className="flex items-center gap-2 p-6 text-sm text-muted">
      <Spinner /> Loading…
    </div>
  )
}

export function ErrorBox({ error }: { error: unknown }) {
  return <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800 ring-1 ring-red-200">{error instanceof Error ? error.message : 'Something went wrong.'}</div>
}

export function Note({ tone = 'gray', children, icon, className }: { tone?: Tone; children: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <div className={clsx('flex items-start gap-2 rounded-md px-3 py-2 text-sm ring-1 ring-inset', TONE[tone], className)}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

const AVATAR_COLORS = ['#D10074', '#008945', '#27281C', '#B45309', '#0369A1', '#6D28D9', '#BE185D', '#047857']

export function Avatar({ name, id, size = 28 }: { name: string; id?: string; size?: number }) {
  const key = id ?? name
  let h = 0
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) | 0
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white" style={{ width: size, height: size, fontSize: size * 0.38, background: AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length] }} title={name}>
      {initials(name)}
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[6vh] no-print" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={clsx('w-full rounded-xl bg-white shadow-2xl', wide ? 'max-w-4xl' : 'max-w-lg')} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button className="rounded p-1 text-muted hover:bg-black/5" onClick={onClose} aria-label="Close">
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

const inputCls = 'w-full rounded-md border-0 bg-white px-3 py-2 text-sm ring-1 ring-line placeholder:text-muted/70 focus:ring-2 focus:ring-brand focus:outline-none disabled:bg-canvas'

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
