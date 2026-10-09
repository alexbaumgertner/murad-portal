'use client'

import { useFormFields } from '@payloadcms/ui'
import { useEffect, useState } from 'react'

import { messages, placementAboveProgram } from '@/features/enrollments/shape'

import styles from './PlacementLevelWarning.module.css'

type Rel = number | string | { id: number | string } | null | undefined
const idOf = (value: Rel) => (typeof value === 'object' && value ? value.id : value)

/**
 * AC 11 (story 012): a placement level above the program's start is a warning, not an error —
 * Murad may have reasons. Reads the program's start level through the admin's own REST session.
 */
export function PlacementLevelWarning() {
  const { cefr, program } = useFormFields(([fields]) => ({
    cefr: fields['placement.cefr']?.value,
    program: idOf(fields.program?.value as Rel),
  }))
  const [levelFrom, setLevelFrom] = useState<{ id: Rel; level: string | null }>({
    id: null,
    level: null,
  })

  useEffect(() => {
    if (program == null || program === '') return
    const controller = new AbortController()
    fetch(`/api/programs/${encodeURIComponent(String(program))}?depth=0`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((doc: { levelFrom?: string } | null) =>
        setLevelFrom({ id: program, level: doc?.levelFrom ?? null }),
      )
      .catch(() => {})
    return () => controller.abort()
  }, [program])

  const level = levelFrom.id === program ? levelFrom.level : null
  if (!placementAboveProgram(cefr, level)) return null
  return (
    <p className={styles.warning} role="status">
      {messages.levelAbove(String(cefr))}
    </p>
  )
}
