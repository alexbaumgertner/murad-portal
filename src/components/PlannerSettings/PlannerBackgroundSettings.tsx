'use client'

import { useTranslations } from 'next-intl'

import { usePlanner } from '@/components/PlannerShell/planner-context'
import {
  BACKGROUND_MODES,
  DEFAULT_BACKGROUND,
  type Background,
} from '@/features/planner/appearance'

import styles from './PlannerSettings.module.css'

type SliderKey = 'blur' | 'brightness' | 'overlay' | 'grain' | 'grainSize' | 'opacity'
const SLIDERS: { key: SliderKey; min: number; max: number; imageOnly?: boolean }[] = [
  { key: 'opacity', min: 0, max: 100 },
  { key: 'blur', min: 0, max: 40, imageOnly: true },
  { key: 'brightness', min: 20, max: 150, imageOnly: true },
  { key: 'overlay', min: -100, max: 100 },
  { key: 'grain', min: 0, max: 100 },
  { key: 'grainSize', min: 1, max: 12 },
]

/** Color, photo and its effects: blur, brightness, one dark↔light overlay, grain intensity and size. */
export function PlannerBackgroundSettings() {
  const t = useTranslations('Planner.settings.background')
  const { appearance, update } = usePlanner()
  const { background } = appearance

  const set = (patch: Partial<Background>) =>
    update((current) => ({ ...current, background: { ...current.background, ...patch } }))

  return (
    <div className={styles.group}>
      <label className={styles.colorLabel}>
        {t('color')}
        <input
          type="color"
          value={background.color}
          aria-label={t('color')}
          onChange={(event) => set({ color: event.target.value })}
        />
      </label>
      {background.image ? (
        <label className={styles.colorLabel}>
          {t('mode')}
          <select
            className={styles.select}
            value={background.mode}
            aria-label={t('mode')}
            onChange={(event) => set({ mode: event.target.value as Background['mode'] })}
          >
            {BACKGROUND_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {t(`modes.${mode}`)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {SLIDERS.filter(({ imageOnly }) => !imageOnly || background.image).map(
        ({ key, min, max }) => (
          <label key={key} className={styles.opacity}>
            <span>{t(`sliders.${key}`)}</span>
            <input
              type="range"
              min={min}
              max={max}
              value={background[key]}
              aria-label={t(`sliders.${key}`)}
              onChange={(event) => set({ [key]: Number(event.target.value) })}
            />
            <output>{background[key]}</output>
          </label>
        ),
      )}
      <div className={styles.globalFont}>
        <button
          type="button"
          className={styles.button}
          onClick={() =>
            update((current) => ({ ...current, background: { ...DEFAULT_BACKGROUND } }))
          }
        >
          {t('reset')}
        </button>
      </div>
    </div>
  )
}
