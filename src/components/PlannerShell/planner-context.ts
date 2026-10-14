'use client'

import { createContext, useContext } from 'react'

import type { Appearance } from '@/features/planner/appearance'

export type PlannerContextValue = {
  appearance: Appearance
  /** Applies at once and saves a moment later. */
  update: (change: (current: Appearance) => Appearance) => void
  openSettings: () => void
  saveFailed: boolean
}

export const PlannerContext = createContext<PlannerContextValue | null>(null)

/** The shell's state, or null when the board is rendered alone (tests, previews). */
export const useOptionalPlanner = () => useContext(PlannerContext)

export function usePlanner(): PlannerContextValue {
  const value = useContext(PlannerContext)
  if (!value) throw new Error('usePlanner needs a PlannerShell')
  return value
}
