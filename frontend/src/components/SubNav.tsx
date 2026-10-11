/** Links between closely related project pages, shown as one segmented control (fewer sidebar items). */
import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'

export function SubNav({ items }: { items: { to: string; label: string }[] }) {
  return (
    <div className="mb-6 inline-flex rounded-lg bg-ink/[0.05] p-0.5">
      {items.map((it) => (
        <NavLink key={it.to} to={it.to} end className={({ isActive }) => clsx('rounded-md px-3 py-1 text-sm', isActive ? 'bg-surface font-medium shadow-sm' : 'text-muted hover:text-ink')}>
          {it.label}
        </NavLink>
      ))}
    </div>
  )
}

export const changesNav = (pid: string) => [
  { to: `/projects/${pid}/changes`, label: 'Change requests' },
  { to: `/projects/${pid}/decisions`, label: 'Decisions' },
]

export const teamNav = (pid: string) => [
  { to: `/projects/${pid}/team`, label: 'Team' },
  { to: `/projects/${pid}/audit`, label: 'Audit log' },
]
