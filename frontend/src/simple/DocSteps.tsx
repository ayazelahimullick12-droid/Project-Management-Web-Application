/**
 * Simple view · the steps of one document, the same for the Proposal & Charter, the BRD and the SRS
 * (supervisor's pipeline, November 2026):
 *   1. Questions (the Fact Sheet chat for the Proposal & Charter; the document's own questions for the BRD and SRS)
 *   2. The AI writes it
 *   3. Summary and slides (made with it)
 *   4. The PM chooses the approvers and sends it
 *   5. Everyone chosen approves and signs
 * Shown at the top of the document so people always see where it is.
 */
import { clsx } from 'clsx'
import { Check } from 'lucide-react'
import { Link } from 'react-router-dom'

export interface DocStepState {
  pid: string
  type: 'PROPOSAL' | 'BRD' | 'SRS'
  questionsDone: boolean
  written: boolean
  summarised: boolean
  sent: boolean
  signed: boolean
}

export function DocSteps(st: DocStepState) {
  const steps = [
    { label: 'Questions', done: st.questionsDone, to: st.type === 'PROPOSAL' ? `/projects/${st.pid}/intake` : undefined },
    { label: 'Written', done: st.written },
    { label: 'Summary & slides', done: st.summarised },
    { label: 'Approvers', done: st.sent },
    { label: 'Signed', done: st.signed },
  ]
  const now = steps.findIndex((x) => !x.done)
  return (
    <ol aria-label="Steps of this document" className="flex flex-wrap items-center gap-x-1 gap-y-2 text-sm">
      {steps.map((x, i) => {
        const inner = (
          <>
            <span
              className={clsx(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                x.done ? 'bg-leaf text-white' : i === now ? 'bg-brand text-white' : 'bg-ink/[0.07] text-muted',
              )}
              aria-hidden
            >
              {x.done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={clsx(i === now ? 'font-semibold text-ink' : x.done ? 'text-ink' : 'text-muted')}>{x.label}</span>
            <span className="sr-only">{x.done ? ' (done)' : i === now ? ' (now)' : ' (later)'}</span>
          </>
        )
        return (
          <li key={x.label} className="flex items-center gap-1" aria-current={i === now ? 'step' : undefined}>
            {i > 0 && <span className={clsx('mx-1 h-px w-4 sm:w-6', steps[i - 1].done ? 'bg-leaf' : 'bg-line')} aria-hidden />}
            {x.to ? (
              <Link to={x.to} className="flex items-center gap-1.5 rounded-lg py-1 hover:underline">
                {inner}
              </Link>
            ) : (
              <span className="flex items-center gap-1.5 py-1">{inner}</span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
