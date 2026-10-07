/** Intake → Proposal → Charter → BRD → SRS → SQA → UAT → Complete */
import { Check } from 'lucide-react'
import { clsx } from 'clsx'
import { STAGES, STAGE_LABEL, type Stage } from '../rules/pipeline'

export function StageTracker({ stage, compact }: { stage: Stage; compact?: boolean }) {
  const current = STAGES.indexOf(stage)
  return (
    <ol className="flex flex-wrap items-center gap-1">
      {STAGES.map((s, i) => {
        const done = i < current || stage === 'COMPLETE'
        const now = i === current && stage !== 'COMPLETE'
        return (
          <li key={s} className="flex items-center gap-1">
            <span
              className={clsx(
                'inline-flex items-center gap-1 rounded-full font-medium',
                compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
                done && 'bg-leaf-soft text-leaf',
                now && 'bg-brand text-white',
                !done && !now && 'bg-white text-muted ring-1 ring-line',
              )}
            >
              {done && <Check className="h-3 w-3" />}
              {STAGE_LABEL[s]}
            </span>
            {i < STAGES.length - 1 && <span className={clsx('h-px w-3', done ? 'bg-leaf' : 'bg-line')} />}
          </li>
        )
      })}
    </ol>
  )
}
