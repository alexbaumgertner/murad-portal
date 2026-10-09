'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useId, useState, useSyncExternalStore } from 'react'

import { startProgramAction } from '@/features/enrollments/actions'
import { initialStartState } from '@/features/enrollments/schema'
import { DEFAULT_TIMEZONE, timeZoneOrDefault } from '@/features/enrollments/shape'

import styles from './StartProgram.module.css'

function detectTimeZone(): string {
  try {
    return timeZoneOrDefault(Intl.DateTimeFormat().resolvedOptions().timeZone)
  } catch {
    return DEFAULT_TIMEZONE
  }
}

// The zone does not change while the page is open.
const subscribeNever = () => () => {}

function allTimeZones(current: string): string[] {
  let zones: string[] = []
  try {
    zones = Intl.supportedValuesOf('timeZone')
  } catch {
    zones = []
  }
  return zones.includes(current) ? zones : [current, ...zones]
}

/**
 * «Начать» on the program card (story 012). The browser only tells its time zone (Almaty when it
 * cannot, AC 5); the server decides the date. A confirmation step guards against a stray tap and
 * the button is disabled while the request runs; the server also starts only once (AC 7).
 */
export function StartProgram({ program }: { program: string }) {
  const t = useTranslations('StudyProgram')
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(startProgramAction, initialStartState)
  const [confirming, setConfirming] = useState(false)
  const [editingZone, setEditingZone] = useState(false)
  // The browser's zone; null while rendering on the server, which cannot know it.
  const detected = useSyncExternalStore(subscribeNever, detectTimeZone, () => null)
  const [chosen, setChosen] = useState<string | null>(null)
  const timeZone = chosen ?? detected
  const zoneId = useId()
  const confirmId = useId()

  useEffect(() => {
    // The page re-renders as «Сегодня», day 1.
    if (state.status === 'success') router.refresh()
  }, [state, router])

  const zone = timeZone ?? DEFAULT_TIMEZONE
  const zoneName =
    zone === DEFAULT_TIMEZONE ? t('almaty') : (zone.split('/').pop() ?? zone).replace(/_/g, ' ')
  const busy = isPending || state.status === 'success'

  return (
    <div className={styles.start}>
      {timeZone ? (
        editingZone ? (
          <label className={styles.zoneField} htmlFor={zoneId}>
            <span>{t('timezoneLabel')}</span>
            <select
              id={zoneId}
              className={styles.select}
              value={zone}
              onChange={(event) => setChosen(event.target.value)}
              disabled={busy}
            >
              {allTimeZones(zone).map((value) => (
                <option key={value} value={value}>
                  {value.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className={styles.zone}>
            {t('timezone', { zone: zoneName })} (
            <button type="button" className={styles.link} onClick={() => setEditingZone(true)}>
              {t('timezoneChange')}
            </button>
            )
          </p>
        )
      ) : null}

      {confirming ? (
        <form action={formAction} className={styles.confirm} aria-labelledby={confirmId}>
          <p id={confirmId} className={styles.question}>
            {t('confirm', { program })}
          </p>
          <input type="hidden" name="timezone" value={zone} />
          <div className={styles.buttons}>
            <button type="submit" className={styles.primary} disabled={busy}>
              {isPending ? t('pending') : t('confirmYes')}
            </button>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => setConfirming(false)}
              disabled={busy}
            >
              {t('cancel')}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className={styles.primary} onClick={() => setConfirming(true)}>
          {t('start')}
        </button>
      )}

      <p className={styles.error} role="alert">
        {state.status === 'error' ? t(`errors.${state.error}`) : null}
      </p>
    </div>
  )
}
