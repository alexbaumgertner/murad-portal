'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { usePlanner } from '@/components/PlannerShell/planner-context'
import {
  MAX_SIZE,
  MIN_SIZE,
  TYPE_SECTIONS,
  applyFontToAll,
  resetTypography,
  restoreOriginalFonts,
  type TypeSection,
  type TypeSetting,
} from '@/features/planner/appearance'
import { FONTS, FONT_CATEGORIES, isFontChoice, type FontChoice } from '@/features/planner/font-list'

import styles from './PlannerSettings.module.css'

function FontSelect({
  value,
  label,
  onChange,
}: {
  value: FontChoice
  label: string
  onChange: (font: FontChoice) => void
}) {
  const t = useTranslations('Planner.settings')
  return (
    <select
      className={styles.select}
      value={value}
      aria-label={label}
      onChange={(event) => isFontChoice(event.target.value) && onChange(event.target.value)}
    >
      <option value="default">{t('originalFont')}</option>
      {FONT_CATEGORIES.map((category) => (
        <optgroup key={category} label={t(`fontGroup.${category}`)}>
          {FONTS.filter((font) => font.category === category).map((font) => (
            <option key={font.id} value={font.id}>
              {font.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}

/** Global font actions first, then family / size / bold / italic for each of the 14 sections. */
export function PlannerTypographySettings() {
  const t = useTranslations('Planner.settings')
  const { update } = usePlanner()
  const { appearance } = usePlanner()
  const [globalFont, setGlobalFont] = useState<FontChoice>('default')

  const set = (section: TypeSection, patch: Partial<TypeSetting>) =>
    update((current) => ({
      ...current,
      type: { ...current.type, [section]: { ...current.type[section], ...patch } },
    }))

  return (
    <div className={styles.group}>
      <div className={styles.globalFont}>
        <FontSelect value={globalFont} label={t('globalFont')} onChange={setGlobalFont} />
        <button
          type="button"
          className={styles.button}
          onClick={() => update((current) => applyFontToAll(current, globalFont))}
        >
          {t('applyToAll')}
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={() => update((current) => restoreOriginalFonts(current))}
        >
          {t('restoreFonts')}
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={() => update((current) => resetTypography(current))}
        >
          {t('resetTypography')}
        </button>
      </div>
      {TYPE_SECTIONS.map((section) => {
        const value = appearance.type[section]
        const name = t(`section.${section}`)
        return (
          <div key={section} className={styles.typeRow}>
            <span className={styles.typeName}>{name}</span>
            <FontSelect
              value={value.font}
              label={t('fontOf', { name })}
              onChange={(font) => set(section, { font })}
            />
            <input
              type="number"
              className={styles.size}
              min={MIN_SIZE}
              max={MAX_SIZE}
              value={value.size}
              aria-label={t('sizeOf', { name })}
              onChange={(event) => {
                const size = Number(event.target.value)
                if (size >= MIN_SIZE && size <= MAX_SIZE) set(section, { size })
              }}
            />
            <button
              type="button"
              className={styles.toggle}
              aria-pressed={value.bold}
              aria-label={t('boldOf', { name })}
              onClick={() => set(section, { bold: !value.bold })}
            >
              <b>B</b>
            </button>
            <button
              type="button"
              className={styles.toggle}
              aria-pressed={value.italic}
              aria-label={t('italicOf', { name })}
              onClick={() => set(section, { italic: !value.italic })}
            >
              <i>I</i>
            </button>
          </div>
        )
      })}
    </div>
  )
}
