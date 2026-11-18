/** Small pop-up messages ("Version saved", or why an action was refused). */
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CircleCheck, TriangleAlert, X } from 'lucide-react'
import { readPrefs, usePrefs } from './prefs'

interface Toast {
  id: number
  kind: 'ok' | 'error'
  text: string
}

const Ctx = createContext<{ ok: (t: string) => void; error: (t: string) => void }>({ ok: () => {}, error: () => {} })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const simple = usePrefs().view === 'simple'
  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random()
    setItems((x) => [...x.slice(-3), { id, kind, text }])
    // Simple view: older readers need time, so a success message stays 10 seconds and an error stays
    // until it is closed. Full view: 3.5 and 7 seconds.
    const simple = readPrefs().view === 'simple'
    const ms = simple ? (kind === 'error' ? 0 : 10_000) : kind === 'error' ? 7000 : 3500
    if (ms) setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), ms)
  }, [])
  return (
    <Ctx.Provider value={{ ok: (t) => push('ok', t), error: (t) => push('error', t) }}>
      {children}
      <div className="fixed top-4 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2 no-print">
        {items.map((t) => (
          <div key={t.id} className={`glass-strong flex max-w-xl items-start gap-2.5 rounded-[24px] px-5 py-3 ${simple ? 'text-base' : 'text-sm'} ${t.kind === 'ok' ? '' : 'text-red-800 dark:text-red-200'}`} role="status">
            {t.kind === 'ok' ? <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-leaf" /> : <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />}
            <span>{t.text}</span>
            {simple ? (
              <button className="-my-1.5 ml-2 inline-flex h-10 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-medium ring-1 ring-line hover:bg-ink/[0.05]" onClick={() => setItems((x) => x.filter((y) => y.id !== t.id))}>
                <X className="h-4 w-4" /> Close
              </button>
            ) : (
              <button className="ml-2 opacity-60 hover:opacity-100" onClick={() => setItems((x) => x.filter((y) => y.id !== t.id))} aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
