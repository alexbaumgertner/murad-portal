'use client'

import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'

import { ManualMark } from '@/components/ManualMark/ManualMark'
import { startTimerAction, stopTimerAction, syncTimerAction } from '@/features/slot-timer/actions'
import type { TimerActionState, TimerError } from '@/features/slot-timer/schema'
import { MAX_TIMER_MINUTES, type TimerState } from '@/features/slot-timer/shape'
import { playChime, primeChime, vibrate } from '@/lib/chime'

import styles from './SlotTimers.module.css'

export type TimerSlot = { index: number; name: string; description: string | null; minutes: number }

type Props = {
  slots: TimerSlot[]
  initial: TimerState
  /** Program day of today: «Отметить вручную» names it (story 015). */
  programDay: number
}

const MINUTE = 60_000

/** Seconds on the slot's counter: saved minutes + the running time, which never counts past the cap. */
function liveSeconds(saved: number, startedAt: string | null, now: number): number {
  const running = startedAt
    ? Math.min(Math.max(now - Date.parse(startedAt), 0), MAX_TIMER_MINUTES * MINUTE)
    : 0
  return saved * 60 + Math.floor(running / 1000)
}

const pad = (n: number) => String(n).padStart(2, '0')
const clock = (seconds: number) => `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`

// The signal plays once per run: remembered across reloads, so reopening the tab after the minimum
// was passed (AC 5) sounds once, and a plain reload does not sound again.
const playedKey = (slot: number, startedAt: string) => `slot-timer:played:${slot}:${startedAt}`
function wasPlayed(slot: number, startedAt: string): boolean {
  try {
    return localStorage.getItem(playedKey(slot, startedAt)) !== null
  } catch {
    return false
  }
}
function markPlayed(slot: number, startedAt: string): void {
  try {
    localStorage.setItem(playedKey(slot, startedAt), '1')
  } catch {
    // Private mode: the in-memory guard still keeps it to once per page.
  }
}

/**
 * Today's slots with a «Старт» / «Стоп» timer each (story 014). The server owns the clock (D-SP-4):
 * the browser counts from the server time of the last answer and replaces its state with every
 * answer. A tap is ignored while the previous one is in flight (AC 10), the server is idempotent
 * anyway. At the minimum the browser plays a signal once; when the browser blocks audio (AC 9) a
 * visible banner stands in and «Проверить звук» is there to allow it.
 */
export function SlotTimers({ slots, initial, programDay }: Props) {
  const t = useTranslations('StudyTimer')
  const [state, setState] = useState<TimerState>(initial)
  const [now, setNow] = useState(() => Date.parse(initial.serverNow))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<TimerError | null>(null)
  const [blocked, setBlocked] = useState(false)
  const [soundOk, setSoundOk] = useState(false)
  const busy = useRef(false)
  const offset = useRef(0)
  const announced = useRef(new Set<string>())
  const syncing = useRef(new Set<string>())

  const apply = useCallback((answer: TimerActionState) => {
    if (answer.status === 'error') {
      setError(answer.error)
      return
    }
    setError(null)
    offset.current = Date.parse(answer.state.serverNow) - Date.now()
    setNow(Date.parse(answer.state.serverNow))
    setState(answer.state)
  }, [])

  const run = useCallback(
    async (action: () => Promise<TimerActionState>) => {
      if (busy.current) return
      busy.current = true
      setPending(true)
      setError(null)
      try {
        apply(await action())
      } catch {
        setError('server')
      } finally {
        busy.current = false
        setPending(false)
      }
    },
    [apply],
  )

  const running = state.slots.some((slot) => slot.startedAt) || state.carried != null

  // The server's clock at render time, against the browser's now.
  useEffect(() => {
    offset.current = Date.parse(initial.serverNow) - Date.now()
  }, [initial.serverNow])

  // The browser clock only drives the display, offset to the server's.
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(Date.now() + offset.current), 1000)
    return () => clearInterval(id)
  }, [running])

  const announce = useCallback(async (index: number, startedAt: string) => {
    const key = playedKey(index, startedAt)
    if (announced.current.has(key) || wasPlayed(index, startedAt)) return
    announced.current.add(key)
    markPlayed(index, startedAt)
    vibrate()
    setBlocked(!(await playChime()))
  }, [])

  // Reached while the tab is open → signal once and let the server save «done» (AC 2). Reached while
  // it was closed → the server already saved it; the signal plays on return (AC 5).
  useEffect(() => {
    for (const log of state.slots) {
      const slot = slots.find((s) => s.index === log.index)
      if (!slot || !log.startedAt) continue
      const reached = liveSeconds(log.minutes, log.startedAt, now) >= slot.minutes * 60
      if (!reached) continue
      // A slot already done before this run started was not just reached: no signal.
      if (log.minutes < slot.minutes) void announce(log.index, log.startedAt)
      const key = `${log.index}:${log.startedAt}`
      if (!log.completed && !syncing.current.has(key)) {
        syncing.current.add(key)
        void syncTimerAction({})
          .then(apply, () => {})
          .finally(() => {
            // Ask again later if the server's clock was a moment behind.
            setTimeout(() => syncing.current.delete(key), 3000)
          })
      }
    }
  }, [now, state.slots, slots, announce, apply])

  const onStart = (index: number) => {
    void primeChime() // a tap unlocks audio for the signal later
    void run(() => startTimerAction({ slotIndex: index }))
  }

  const checkSound = async () => {
    vibrate()
    const played = await playChime()
    setBlocked(!played)
    setSoundOk(played)
  }

  return (
    <div className={styles.timers}>
      {state.carried ? (
        <div className={styles.carried}>
          <span>
            {state.carried.name ? t('carried', { name: state.carried.name }) : t('carriedUnnamed')}
          </span>
          <span className={styles.clock} role="timer">
            {clock(liveSeconds(0, state.carried.startedAt, now))}
          </span>
          <button
            type="button"
            className={styles.stop}
            onClick={() => void run(() => stopTimerAction({}))}
            disabled={pending}
          >
            {pending ? t('working') : t('stop')}
          </button>
        </div>
      ) : null}

      <ul className={styles.slots} aria-label={t('listLabel')}>
        {slots.map((slot) => {
          const log = state.slots.find((s) => s.index === slot.index)
          const startedAt = log?.startedAt ?? null
          const saved = log?.minutes ?? 0
          const seconds = liveSeconds(saved, startedAt, now)
          const completed = (log?.completed ?? false) || seconds >= slot.minutes * 60
          return (
            <li key={slot.index} className={styles.slot}>
              <span className={styles.name}>{slot.name}</span>
              <span className={styles.status}>
                {completed
                  ? t('done')
                  : saved > 0 || startedAt
                    ? t('progress', { minutes: Math.floor(seconds / 60), min: slot.minutes })
                    : t('minimum', { minutes: slot.minutes })}
              </span>
              {slot.description ? <span className={styles.text}>{slot.description}</span> : null}
              <div className={styles.controls}>
                {startedAt ? (
                  <>
                    <span
                      className={styles.clock}
                      role="timer"
                      aria-label={t('timerOf', { name: slot.name })}
                    >
                      {clock(seconds)}
                    </span>
                    <button
                      type="button"
                      className={styles.stop}
                      onClick={() => void run(() => stopTimerAction({}))}
                      disabled={pending}
                    >
                      {pending ? t('working') : t('stop')}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className={styles.start}
                    onClick={() => onStart(slot.index)}
                    disabled={pending}
                  >
                    {pending ? t('working') : t('start')}
                  </button>
                )}
              </div>
              <ManualMark
                programDay={programDay}
                slotIndex={slot.index}
                slotName={slot.name}
                minutes={saved}
                onSaved={(next) => apply({ status: 'success', state: next })}
              />
            </li>
          )
        })}
      </ul>

      <div className={styles.footer}>
        <button type="button" className={styles.link} onClick={() => void checkSound()}>
          {t('checkSound')}
        </button>
        <span role="status" className={styles.note}>
          {blocked ? t('soundBlocked') : soundOk ? t('soundOk') : null}
        </span>
      </div>
      {blocked ? (
        <p className={styles.banner} role="status">
          {t('banner')}
        </p>
      ) : null}
      <p className={styles.error} role="alert">
        {error ? t(`errors.${error}`) : null}
      </p>
    </div>
  )
}
