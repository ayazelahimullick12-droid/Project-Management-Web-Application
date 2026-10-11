/** Small pop-up messages ("Version saved", or why an action was refused). */
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CircleCheck, TriangleAlert, X } from 'lucide-react'

interface Toast {
  id: number
  kind: 'ok' | 'error'
  text: string
}

const Ctx = createContext<{ ok: (t: string) => void; error: (t: string) => void }>({ ok: () => {}, error: () => {} })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random()
    setItems((x) => [...x.slice(-3), { id, kind, text }])
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), kind === 'error' ? 7000 : 3500)
  }, [])
  return (
    <Ctx.Provider value={{ ok: (t) => push('ok', t), error: (t) => push('error', t) }}>
      {children}
      <div className="fixed top-4 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2 no-print">
        {items.map((t) => (
          <div key={t.id} className={`flex max-w-xl items-start gap-2.5 rounded-xl bg-surface px-4 py-3 text-sm shadow-xl ring-1 ${t.kind === 'ok' ? 'ring-line' : 'ring-red-200'}`} role="status">
            {t.kind === 'ok' ? <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-leaf" /> : <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />}
            <span>{t.text}</span>
            <button className="ml-2 opacity-60 hover:opacity-100" onClick={() => setItems((x) => x.filter((y) => y.id !== t.id))} aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
