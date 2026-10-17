'use client'

import { useEffect, useRef, useState } from 'react'

import { getPlannerRevisionAction } from '@/features/planner/actions'
import { useRouter } from '@/i18n/navigation'

export const POLL_MS = 5_000
export const SLOW_POLL_MS = 30_000

export type SyncState = 'ok' | 'offline'

/**
 * Story 032: while the tab is visible, ask the server for the planner's revision every few
 * seconds (at once on focus / when the tab becomes visible) and `router.refresh()` when it changed.
 * Failures slow the poll to ~30 s and flag `offline`; the next success recovers by itself.
 */
export function usePlannerSync(plannerId: number): SyncState {
  const router = useRouter()
  const [state, setState] = useState<SyncState>('ok')
  const known = useRef<string | null>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    let stopped = false
    let running = false
    let failing = false

    const schedule = () => {
      if (timer) clearTimeout(timer)
      timer = null
      if (stopped || document.visibilityState !== 'visible') return
      timer = setTimeout(() => void check(), failing ? SLOW_POLL_MS : POLL_MS)
    }

    const check = async () => {
      if (running || stopped) return
      running = true
      try {
        const result = await getPlannerRevisionAction({ plannerId })
        if (stopped) return
        if (result.status === 'success') {
          failing = false
          setState('ok')
          if (known.current !== null && known.current !== result.signature) router.refresh()
          known.current = result.signature
        } else {
          failing = true
          setState('offline')
        }
      } catch {
        failing = true
        if (!stopped) setState('offline')
      } finally {
        running = false
        schedule()
      }
    }

    const wake = () => {
      if (document.visibilityState === 'visible') void check()
      else schedule()
    }

    document.addEventListener('visibilitychange', wake)
    window.addEventListener('focus', wake)
    wake()
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', wake)
      window.removeEventListener('focus', wake)
    }
  }, [plannerId, router])

  return state
}
