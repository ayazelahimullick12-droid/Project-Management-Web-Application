/**
 * The PM chooses who approves and signs a document, in order (November 2026).
 * Everyone chosen approves one after another, and everyone signs. The list starts with the
 * people chosen last time for this document, or the project's heads.
 */
import { ArrowDown, ArrowUp, Send, UserPlus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../api'
import { useApi } from '../api/hooks'
import { Avatar, Button, Loading, Modal, Select } from './ui'

export function ChooseApprovers({ docId, label, open, onClose, onSend, busy }: { docId: string; label: string; open: boolean; onClose: () => void; onSend: (ids: string[]) => void; busy?: boolean }) {
  const { data } = useApi(['approver-choices', docId], () => api.documents.approverChoicesFor(docId), open)
  const [ids, setIds] = useState<string[] | null>(null)
  // Start from the suggestion each time the window opens
  useEffect(() => {
    if (open && data) setIds(data.suggested)
    if (!open) setIds(null)
  }, [open, data])

  const person = (id: string) => data?.people.find((p) => p.userId === id)
  const others = data?.people.filter((p) => !ids?.includes(p.userId)) ?? []
  const move = (i: number, by: number) => {
    if (!ids) return
    const next = [...ids]
    ;[next[i], next[i + by]] = [next[i + by], next[i]]
    setIds(next)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Who approves and signs the ${label}?`}
      footer={
        <Button variant="primary" disabled={!ids?.length || busy} onClick={() => ids && onSend(ids)}>
          <Send className="h-4 w-4" /> Send to {ids?.length ?? 0} {ids?.length === 1 ? 'person' : 'people'}
        </Button>
      }
    >
      {!data || !ids ? (
        <Loading />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted">They get it one after another, in this order. Each person approves and signs. You (the PM) and the Project Owner can act in anyone’s place.</p>
          {ids.length === 0 && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Add at least one person.</p>}
          <ol className="space-y-2">
            {ids.map((id, i) => {
              const p = person(id)
              return (
                <li key={id} className="flex items-center gap-3 rounded-xl bg-paper px-3 py-2 ring-1 ring-line">
                  <span className="w-5 text-center text-sm font-semibold text-muted">{i + 1}</span>
                  <Avatar name={p?.name ?? id} id={id} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{p?.name ?? id}</div>
                    <div className="truncate text-sm text-muted">{p?.role}</div>
                  </div>
                  <Button variant="ghost" aria-label={`Move ${p?.name} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" aria-label={`Move ${p?.name} down`} disabled={i === ids.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" aria-label={`Remove ${p?.name}`} onClick={() => setIds(ids.filter((x) => x !== id))}>
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              )
            })}
          </ol>
          {others.length > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <UserPlus className="h-4 w-4 shrink-0 text-muted" />
              <Select
                value=""
                aria-label="Add a person"
                onChange={(e) => e.target.value && setIds([...ids, e.target.value])}
              >
                <option value="">Add a person…</option>
                {others.map((p) => (
                  <option key={p.userId} value={p.userId}>
                    {p.name} · {p.role}
                  </option>
                ))}
              </Select>
            </label>
          )}
        </div>
      )}
    </Modal>
  )
}
