/** A button that opens a small panel below (or above) it, closed by clicking anywhere else. */
import { clsx } from 'clsx'
import { useEffect, useRef, useState, type ReactNode } from 'react'

export function useClickOutside(ref: React.RefObject<HTMLElement | null>, onOut: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onOut()
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [ref, onOut])
}

export function Dropdown({ button, children, align = 'right', width = 'w-80', up, full, label }: { button: (open: boolean) => ReactNode; children: (close: () => void) => ReactNode; align?: 'left' | 'right'; width?: string; up?: boolean; full?: boolean; label?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false))
  return (
    <div className={clsx('relative', full && 'w-full')} ref={ref}>
      <button type="button" aria-label={label} aria-expanded={open} onClick={() => setOpen(!open)} className={clsx('flex items-center', full && 'w-full')}>
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
