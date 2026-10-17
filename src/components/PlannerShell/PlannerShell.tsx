'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'

import { PlannerBackground } from '@/components/PlannerBackground/PlannerBackground'
import { PlannerContext } from '@/components/PlannerShell/planner-context'
import { PlannerSyncStatus } from '@/components/PlannerSyncStatus/PlannerSyncStatus'
import { usePlannerSync } from '@/components/PlannerShell/usePlannerSync'
import { PlannerSettings } from '@/components/PlannerSettings/PlannerSettings'
import { saveAppearanceAction } from '@/features/planner/actions'
import { appearanceVars, type Appearance } from '@/features/planner/appearance'
import { FONT_FAMILIES } from '@/features/planner/fonts'

const SAVE_DELAY_MS = 600

/**
 * Holds how the planner looks (story 025): the CSS variables on the wrapper change at once, the
 * save to the server is debounced. Also owns the settings drawer, opened by the gear in the header.
 */
export function PlannerShell({
  plannerId,
  revision,
  initial,
  isOwner,
  ownerPanels,
  children,
}: {
  plannerId: number
  /** Signature of the planner read before the page was rendered (see `usePlannerSync`). */
  revision: string
  isOwner: boolean
  initial: Appearance
  /** Owner-only settings sections rendered inside the drawer. */
  ownerPanels?: ReactNode
  children: ReactNode
}) {
  const sync = usePlannerSync(plannerId, revision)
  const [appearance, setAppearance] = useState(initial)
  const [open, setOpen] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(appearance)

  const flush = useCallback(async () => {
    timer.current = null
    const result = await saveAppearanceAction({ plannerId, appearance: latest.current })
    setSaveFailed(result.status === 'error')
  }, [plannerId])

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current)
        void flush()
      }
    },
    [flush],
  )

  const update = useCallback(
    (change: (current: Appearance) => Appearance) => {
      setAppearance((current) => {
        latest.current = change(current)
        return latest.current
      })
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS)
    },
    [flush],
  )

  const value = useMemo(
    () => ({ appearance, update, openSettings: () => setOpen(true), saveFailed }),
    [appearance, update, saveFailed],
  )
  const style = useMemo(
    () => appearanceVars(appearance, (font) => FONT_FAMILIES[font]) as CSSProperties,
    [appearance],
  )

  return (
    <PlannerContext.Provider value={value}>
      <PlannerBackground background={appearance.background} />
      <div style={style}>
        <PlannerSyncStatus state={sync} />
        {children}
      </div>
      <PlannerSettings
        open={open}
        onClose={() => setOpen(false)}
        plannerId={plannerId}
        isOwner={isOwner}
      >
        {ownerPanels}
      </PlannerSettings>
    </PlannerContext.Provider>
  )
}
