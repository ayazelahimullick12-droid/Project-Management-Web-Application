/**
 * Prototype-only controls, shared by both views: show prototype notes, move the demo clock,
 * the speed of the simulated steps, the AI (LM Studio) status, starting again, and switching
 * to another demo person. The real app has none of this.
 */
import { clsx } from 'clsx'
import { Bot, FastForward, RotateCcw, Zap } from 'lucide-react'
import { api } from '../api'
import { useAction, useApi, useSessionUserId } from '../api/hooks'
import { setPref, usePrefs } from './prefs'
import { Avatar, Badge } from './ui'
import { useToast } from './toast'

export function DemoControls() {
  const toast = useToast()
  const { showNotes } = usePrefs()
  const { data: info } = useApi(['demo-info'], api.admin.demoInfo)
  const travel = useAction(api.admin.timeTravel, { onDone: (r) => toast.ok(`Clock moved forward. ${r.reminders} reminder${r.reminders === 1 ? '' : 's'} sent, ${r.locksReleased} lock${r.locksReleased === 1 ? '' : 's'} released.`) })
  const morning = useAction(api.admin.jumpToNextWorkingMorning, { onDone: (r) => toast.ok(`Jumped to the next working morning. ${r.reminders} reminder${r.reminders === 1 ? '' : 's'} sent.`) })
  const resetClock = useAction(api.admin.resetClock, { success: 'Clock reset.' })
  const speed = useAction(api.admin.setAiSpeed)
  const reset = useAction(api.admin.reset, { success: 'Started again.' })
  const { data: ai, refetch: checkAi, isFetching: checkingAi } = useApi(['ai-status'], api.admin.aiStatus)
  const H = 3600_000
  return (
    <div className="p-3 text-sm">
      <div className="mb-1 font-semibold">Demo controls</div>
      <p className="mb-3 text-xs text-muted">A prototype for demos on this laptop. The data is saved in one file (frontend/data/db.json) and shared by every open tab.</p>
      <div className="mb-3 rounded-xl bg-canvas p-2.5 text-xs">
        <div className="flex items-center gap-1.5 font-medium">
          <Bot className="h-3.5 w-3.5" /> AI (LM Studio):{' '}
          {!ai ? 'checking…' : ai.ok ? <span className="text-leaf">connected</span> : <span className="text-red-700">not reachable</span>}
          <button className="ml-auto text-muted hover:text-ink" disabled={checkingAi} onClick={() => checkAi()}>{checkingAi ? '…' : 'Check'}</button>
        </div>
        {ai && (
          <div className="mt-1 text-muted">
            {ai.ok ? (
              <>
                Writes with <b>{ai.model}</b>{!ai.modelFound && <span className="text-amber-700"> (not loaded in LM Studio)</span>}. Compares with <b>{ai.embedModel}</b>{!ai.embedFound && <span className="text-amber-700"> (not loaded)</span>}.
              </>
            ) : (
              ai.error ?? 'Start LM Studio, load the model and start its server (Developer tab).'
            )}
          </div>
        )}
      </div>
      <label className="mb-3 flex cursor-pointer items-start gap-2 rounded-xl bg-canvas p-2.5">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--brand-primary)]" checked={showNotes} onChange={(e) => setPref('showNotes', e.target.checked)} />
        <span>
          <span className="block font-medium">Show prototype notes</span>
          <span className="block text-xs text-muted">“In the real app…” explanations and open-question markers. Turn on for spec reviews.</span>
        </span>
      </label>
      <div className="mb-1 text-xs font-medium">
        Time travel <span className="font-normal text-muted">(demo clock, Bangladesh time)</span>
        {!!info?.offsetMs && <Badge tone="amber" className="ml-1">+{Math.round(info.offsetMs / H)}h</Badge>}
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {[['+1 hour', H], ['+4 hours', 4 * H], ['+1 day', 24 * H]].map(([l, ms]) => (
          <button key={l as string} className="rounded-lg bg-canvas px-2 py-1 text-xs hover:bg-ink/10" onClick={() => travel.run(ms as number)}>
            <FastForward className="mr-1 inline h-3 w-3" />
            {l}
          </button>
        ))}
        <button className="rounded-lg bg-canvas px-2 py-1 text-xs hover:bg-ink/10" onClick={() => morning.run()}>
          Next working morning
        </button>
        {!!info?.offsetMs && (
          <button className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-ink/5" onClick={() => resetClock.run()}>
            Reset clock
          </button>
        )}
      </div>
      <div className="mb-1 text-xs font-medium">Speed of the simulated steps <span className="font-normal text-muted">(file reading, call transcripts)</span></div>
      <div className="mb-3 flex gap-1.5">
        {(['normal', 'fast', 'instant'] as const).map((sp) => (
          <button key={sp} onClick={() => speed.run(sp)} className={clsx('rounded-lg px-2 py-1 text-xs', info?.aiSpeed === sp ? 'bg-ink text-canvas' : 'bg-canvas hover:bg-ink/10')}>
            <Zap className="mr-1 inline h-3 w-3" />
            {sp}
          </button>
        ))}
      </div>
      <div className="mb-1 text-xs font-medium">Start again</div>
      <div className="flex gap-1.5">
        <button
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium text-red-700 hover:bg-red-50"
          onClick={() => {
            if (confirm('Start again with no projects (users, settings and templates only)? Everything done so far will be lost.')) reset.run(false)
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" /> Empty
        </button>
        <button
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium text-red-700 hover:bg-red-50"
          onClick={() => {
            if (confirm('Start again with the demo projects from the seed files? Everything done so far will be lost.')) reset.run(true)
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" /> With demo projects
        </button>
      </div>
    </div>
  )
}

/** Demo only: sign in as someone else without signing out. Each browser tab can be a different person. */
export function SwitchUserList({ onPicked }: { onPicked?: () => void }) {
  const uid = useSessionUserId()
  const { data: users } = useApi(['users'], api.projects.users)
  return (
    <>
      <div className="px-4 pt-2 text-[11px] font-medium text-muted">Switch user (demo) · each browser tab can be a different person</div>
      <div className="max-h-80 overflow-y-auto p-1">
        {(users ?? [])
          .filter((u) => !u.deactivated)
          .map((u) => (
            <button
              key={u.id}
              className={clsx('flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-left text-sm hover:bg-canvas', u.id === uid && 'bg-brand-soft')}
              onClick={() => {
                api.projects.switchUser(u.id)
                onPicked?.()
              }}
            >
              <Avatar name={u.name} id={u.id} size={24} />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{u.name}</span>
                <span className="block truncate text-[11px] text-muted">{u.title}</span>
              </span>
              {u.isAdmin && <Badge tone="dark">Admin</Badge>}
              {u.external && <Badge>External</Badge>}
            </button>
          ))}
      </div>
    </>
  )
}
