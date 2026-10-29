/**
 * React hooks for the api layer.
 *
 * useApi    reads data (TanStack Query caches it and refetches when the data changes).
 * useAction runs a change and shows any refusal as a message.
 */
import { useMutation, useQuery } from '@tanstack/react-query'
import { useSyncExternalStore, useEffect, useState } from 'react'
import { getSessionUserId, subscribeSession } from '../demo/session'
import { now } from '../demo/clock'
import { useToast } from '../components/toast'

export function useApi<T>(key: unknown[], fn: () => Promise<T>, enabled = true) {
  return useQuery({ queryKey: key, queryFn: fn, enabled })
}

export function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>, opts: { success?: string | ((r: R) => string); onDone?: (r: R) => void } = {}) {
  const toast = useToast()
  const m = useMutation({
    mutationFn: (args: A) => fn(...args),
    onError: (err: Error) => toast.error(err.message),
    onSuccess: (r: R) => {
      const msg = typeof opts.success === 'function' ? opts.success(r) : opts.success
      if (msg) toast.ok(msg)
      opts.onDone?.(r)
    },
  })
  return {
    run: (...args: A) => m.mutateAsync(args).catch(() => undefined),
    pending: m.isPending,
  }
}

/** The signed-in user's id for this tab. */
export function useSessionUserId(): string | null {
  return useSyncExternalStore(subscribeSession, getSessionUserId)
}

/** The demo clock, refreshed every 20 seconds (and whenever data changes). */
export function useNow(): Date {
  const [t, setT] = useState(() => now())
  useEffect(() => {
    const id = setInterval(() => setT(now()), 20_000)
    return () => clearInterval(id)
  }, [])
  return t
}

/** The value once it has stopped changing for `ms` (e.g. text the user has finished typing). */
export function useSettled<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return settled
}
