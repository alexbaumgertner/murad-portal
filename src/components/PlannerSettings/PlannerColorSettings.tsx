'use client'

import { useTranslations } from 'next-intl'

import { usePlanner } from '@/components/PlannerShell/planner-context'
import {
  COLOR_KEYS,
  contrastWarnings,
  resetColors,
  type ColorKey,
} from '@/features/planner/appearance'

import styles from './PlannerSettings.module.css'

/** One color + its own opacity per colored part of the sheet; a warning for unreadable text. */
export function PlannerColorSettings() {
  const t = useTranslations('Planner.settings')
  const { appearance, update } = usePlanner()
  const warnings = contrastWarnings(appearance.colors)

  const set = (key: ColorKey, patch: Partial<{ color: string; opacity: number }>) =>
    update((current) => ({
      ...current,
      colors: { ...current.colors, [key]: { ...current.colors[key], ...patch } },
    }))

  return (
    <div className={styles.group}>
      {COLOR_KEYS.map((key) => {
        const { color, opacity } = appearance.colors[key]
        return (
          <div key={key} className={styles.colorRow}>
            <label className={styles.colorLabel}>
              {t(`color.${key}`)}
              <input
                type="color"
                value={color}
                aria-label={t('colorOf', { name: t(`color.${key}`) })}
                onChange={(event) => set(key, { color: event.target.value })}
              />
            </label>
            <label className={styles.opacity}>
              <span>{t('opacity')}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={opacity}
                aria-label={t('opacityOf', { name: t(`color.${key}`) })}
                onChange={(event) => set(key, { opacity: Number(event.target.value) })}
              />
              <output>{opacity}%</output>
            </label>
          </div>
        )
      })}
      {warnings.length > 0 ? (
        <p role="status" className={styles.warning}>
          {t('lowContrast')}
        </p>
      ) : null}
      <button
        type="button"
        className={styles.button}
        onClick={() => update((current) => resetColors(current))}
      >
        {t('resetColors')}
      </button>
    </div>
  )
}
