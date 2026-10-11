/** A small marker showing an open question from the spec and what the prototype assumes. */
import { CircleHelp } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { openQuestion } from '../demo/openQuestions'
import { usePrefs } from './prefs'

/** Shown only when prototype notes are on (Demo menu → Show prototype notes). */
export function OpenQuestion({ id }: { id: string }) {
  const q = openQuestion(id)
  const [open, setOpen] = useState(false)
  const { showNotes } = usePrefs()
  if (!q || !showNotes) return null
  return (
    <span className="relative inline-block align-middle no-print">
      <button type="button" onClick={() => setOpen(!open)} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100">
        <CircleHelp className="h-3 w-3" /> Open question
      </button>
      {open && (
        <span className="absolute left-0 top-6 z-30 block w-72 rounded-md bg-surface p-3 text-xs leading-relaxed shadow-xl ring-1 ring-amber-200">
          <span className="block font-medium text-ink">{q.question}</span>
          <span className="mt-1 block text-muted">Prototype assumes: {q.assumption}</span>
          <span className="mt-1 block text-muted">Source: {q.source}</span>
          <Link to="/open-questions" className="mt-1.5 inline-block font-medium text-brand hover:underline" onClick={() => setOpen(false)}>
            All open questions
          </Link>
        </span>
      )}
    </span>
  )
}
