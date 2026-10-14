'use client'

import { useTranslations } from 'next-intl'

import { usePlanner } from '@/components/PlannerShell/planner-context'
import {
  BAR_KEYS,
  BAR_STYLES,
  DEFAULT_BAR,
  type BarKey,
  type BarSetting,
} from '@/features/planner/appearance'

import styles from './PlannerSettings.module.css'

/** Four-week and deadline bars are styled independently: animation, colors, opacity and grain. */
export function PlannerBarSettings() {
  const t = useTranslations('Planner.settings.bars')
  const { appearance, update } = usePlanner()

  const set = (key: BarKey, patch: Partial<BarSetting>) =>
    update((current) => ({
      ...current,
      bars: { ...current.bars, [key]: { ...current.bars[key], ...patch } },
    }))

  return (
    <div className={styles.group}>
      {BAR_KEYS.map((key) => {
        const bar = appearance.bars[key]
        const name = t(`names.${key}`)
        return (
          <fieldset key={key} className={styles.fieldset}>
            <legend>{name}</legend>
            <label className={styles.colorLabel}>
              {t('style')}
              <select
                className={styles.select}
                value={bar.style}
                aria-label={t('styleOf', { name })}
                onChange={(event) => set(key, { style: event.target.value as BarSetting['style'] })}
              >
                {BAR_STYLES.map((style) => (
                  <option key={style} value={style}>
                    {t(`styles.${style}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.colorLabel}>
              {t('animate')}
              <input
                type="checkbox"
                checked={bar.animate}
                aria-label={t('animateOf', { name })}
                onChange={(event) => set(key, { animate: event.target.checked })}
              />
            </label>
            {(['fill', 'track', 'highlight'] as const).map((part) => (
              <label key={part} className={styles.colorLabel}>
                {t(part)}
                <input
                  type="color"
                  value={bar[part]}
                  aria-label={t(`${part}Of`, { name })}
                  onChange={(event) => set(key, { [part]: event.target.value })}
                />
              </label>
            ))}
            {(
              [
                ['opacity', 0, 100],
                ['grain', 0, 100],
                ['grainSize', 1, 12],
              ] as const
            ).map(([field, min, max]) => (
              <label key={field} className={styles.opacity}>
                <span>{t(field)}</span>
                <input
                  type="range"
                  min={min}
                  max={max}
                  value={bar[field]}
                  aria-label={t(`${field}Of`, { name })}
                  onChange={(event) => set(key, { [field]: Number(event.target.value) })}
                />
                <output>{bar[field]}</output>
              </label>
            ))}
            <button
              type="button"
              className={styles.button}
              onClick={() => set(key, { ...DEFAULT_BAR })}
            >
              {t('reset')}
            </button>
          </fieldset>
        )
      })}
    </div>
  )
}
