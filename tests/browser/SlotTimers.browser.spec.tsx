import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'

import { SlotTimers, type TimerSlot } from '@/components/SlotTimers/SlotTimers'
import type { TimerActionState } from '@/features/slot-timer/schema'
import type { TimerState } from '@/features/slot-timer/shape'
import { messagesFor } from '@/i18n/address-form'

const {
  startTimerAction,
  stopTimerAction,
  syncTimerAction,
  markSlotAction,
  playChime,
  primeChime,
  vibrate,
} = vi.hoisted(() => ({
  startTimerAction: vi.fn<(input: unknown) => Promise<TimerActionState>>(),
  stopTimerAction: vi.fn<(input: unknown) => Promise<TimerActionState>>(),
  syncTimerAction: vi.fn<(input: unknown) => Promise<TimerActionState>>(),
  markSlotAction: vi.fn<(input: unknown) => Promise<TimerActionState>>(),
  playChime: vi.fn<() => Promise<boolean>>(),
  primeChime: vi.fn<() => Promise<void>>(),
  vibrate: vi.fn(),
}))
vi.mock('@/features/slot-timer/actions', () => ({
  startTimerAction,
  stopTimerAction,
  syncTimerAction,
  markSlotAction,
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/chime', () => ({ playChime, primeChime, vibrate }))

const slots: TimerSlot[] = [
  { index: 0, name: 'Anki', description: null, minutes: 20 },
  { index: 1, name: 'Сериал', description: 'Серия без субтитров', minutes: 40 },
]

const minutesAgo = (minutes: number, now = Date.now()) => new Date(now - minutes * 60_000)
const stateOf = (
  rows: { minutes?: number; completed?: boolean; startedAt?: Date | null }[],
  now = new Date(),
): TimerState => ({
  serverNow: now.toISOString(),
  slots: rows.map((row, index) => ({
    index,
    minutes: row.minutes ?? 0,
    completed: row.completed ?? false,
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
  })),
  carried: null,
})

const renderTimers = (initial: TimerState, locale: 'ru' | 'en' = 'ru', form: 'ty' | 'vy' = 'ty') =>
  render(
    <NextIntlClientProvider locale={locale} messages={messagesFor(locale, form)}>
      <SlotTimers slots={slots} initial={initial} programDay={10} />
    </NextIntlClientProvider>,
  )

describe('SlotTimers (story 014)', () => {
  beforeEach(() => {
    for (const mock of [
      startTimerAction,
      stopTimerAction,
      syncTimerAction,
      markSlotAction,
      playChime,
      primeChime,
      vibrate,
    ]) {
      mock.mockReset()
    }
    playChime.mockResolvedValue(true)
    primeChime.mockResolvedValue()
    syncTimerAction.mockResolvedValue({ status: 'error', error: 'server' })
    localStorage.clear()
  })
  afterEach(() => {
    localStorage.clear()
  })

  test('1. «Старт» sends only the slot and shows a running mm:ss counter', async () => {
    startTimerAction.mockImplementation(async () => ({
      status: 'success',
      state: stateOf([{}, { startedAt: new Date() }]),
    }))
    await renderTimers(stateOf([{}, {}]))

    await expect.element(page.getByText('минимум 40 мин')).toBeVisible()
    await page.getByRole('button', { name: 'Старт' }).nth(1).click()

    expect(startTimerAction).toHaveBeenCalledExactlyOnceWith({ slotIndex: 1 })
    expect(primeChime).toHaveBeenCalled()
    await vi.waitFor(() =>
      expect(page.getByRole('timer', { name: 'Таймер: Сериал' }).element().textContent).toMatch(
        /^00:\d\d$/,
      ),
    )
    await expect.element(page.getByRole('button', { name: 'Стоп' })).toBeVisible()
  })

  test('2. reaching the minimum plays the signal once, vibrates, and shows «Минимум выполнен ✓»', async () => {
    // 2 seconds short of the 20-minute minimum: the browser passes it by itself.
    const started = new Date(Date.now() - 20 * 60_000 + 2000)
    syncTimerAction.mockImplementation(async () => ({
      status: 'success',
      state: stateOf([{ startedAt: started, completed: true }, {}]),
    }))
    await renderTimers(stateOf([{ startedAt: started }, {}]))

    await expect.element(page.getByText('Минимум выполнен ✓'), { timeout: 6000 }).toBeVisible()
    expect(playChime).toHaveBeenCalledTimes(1)
    expect(vibrate).toHaveBeenCalledTimes(1)
    expect(syncTimerAction).toHaveBeenCalled()
    // Still running: the timer is not stopped by reaching the minimum.
    await expect.element(page.getByRole('button', { name: 'Стоп' })).toBeVisible()
  })

  test('4. a stop at 25 of 40 minutes shows «25 из 40 мин»', async () => {
    stopTimerAction.mockResolvedValue({
      status: 'success',
      state: stateOf([{}, { minutes: 25 }]),
    })
    await renderTimers(stateOf([{}, { startedAt: minutesAgo(25) }]))
    await page.getByRole('button', { name: 'Стоп' }).click()

    expect(stopTimerAction).toHaveBeenCalledExactlyOnceWith({})
    await expect.element(page.getByText('25 из 40 мин')).toBeVisible()
    await expect.element(page.getByText('Минимум выполнен ✓')).not.toBeInTheDocument()
  })

  test('5. reopened after the minimum passed while closed: counter is correct and sounds once', async () => {
    const started = minutesAgo(30)
    const view = stateOf([{ startedAt: started, completed: true }, {}])
    const first = await renderTimers(view)
    await expect.element(page.getByText('Минимум выполнен ✓')).toBeVisible()
    await vi.waitFor(() =>
      expect(page.getByRole('timer', { name: 'Таймер: Anki' }).element().textContent).toMatch(
        /^30:\d\d$/,
      ),
    )
    await vi.waitFor(() => expect(playChime).toHaveBeenCalledTimes(1))
    await first.unmount()

    // A reload of the same run does not sound again.
    await renderTimers(view)
    await expect.element(page.getByText('Минимум выполнен ✓')).toBeVisible()
    expect(playChime).toHaveBeenCalledTimes(1)
  })

  test('a slot that was already done does not sound again when it is restarted', async () => {
    await renderTimers(stateOf([{ minutes: 25, completed: true, startedAt: minutesAgo(1) }, {}]))
    await expect.element(page.getByText('Минимум выполнен ✓')).toBeVisible()
    expect(playChime).not.toHaveBeenCalled()
  })

  test('9. blocked audio falls back to a visible banner; «Проверить звук» retries', async () => {
    playChime.mockResolvedValue(false)
    await renderTimers(stateOf([{ startedAt: minutesAgo(25), completed: true }, {}]))

    await expect.element(page.getByText('Минимум выполнен', { exact: true })).toBeVisible()
    await expect.element(page.getByText(/Браузер не дал включить звук/)).toBeVisible()

    playChime.mockResolvedValue(true)
    await page.getByRole('button', { name: 'Проверить звук' }).click()
    await expect.element(page.getByText('Звук работает')).toBeVisible()
    await expect.element(page.getByText(/Браузер не дал включить звук/)).not.toBeInTheDocument()
  })

  test('10. a double tap on «Старт» sends one request', async () => {
    startTimerAction.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200))
      return { status: 'success', state: stateOf([{ startedAt: new Date() }, {}]) }
    })
    await renderTimers(stateOf([{}, {}]))
    await page.getByRole('button', { name: 'Старт' }).first().dblClick()

    await expect.element(page.getByRole('button', { name: 'Стоп' })).toBeVisible()
    expect(startTimerAction).toHaveBeenCalledTimes(1)
  })

  test('shows an error code as a sentence and keeps the state, then recovers', async () => {
    startTimerAction.mockResolvedValueOnce({ status: 'error', error: 'server' })
    await renderTimers(stateOf([{}, {}]), 'ru', 'vy')
    await page.getByRole('button', { name: 'Старт' }).first().click()
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('Не получилось. Попробуйте ещё раз')
    await expect.element(page.getByRole('button', { name: 'Старт' }).first()).toBeEnabled()
  })

  test('a timer carried over from yesterday can be stopped', async () => {
    stopTimerAction.mockResolvedValue({ status: 'success', state: stateOf([{}, {}]) })
    const view = {
      ...stateOf([{}, {}]),
      carried: { name: 'Anki', startedAt: minutesAgo(10).toISOString() },
    }
    await renderTimers(view, 'en')
    await expect.element(page.getByText('Timer from the previous day: Anki')).toBeVisible()
    await page.getByRole('button', { name: 'Stop' }).click()
    await expect
      .element(page.getByText('Timer from the previous day: Anki'))
      .not.toBeInTheDocument()
  })

  test('015. «Отметить вручную» sends the day, slot and minutes, and takes the answer', async () => {
    markSlotAction.mockResolvedValue({
      status: 'success',
      state: stateOf([{ minutes: 30, completed: true }, {}]),
    })
    await renderTimers(stateOf([{}, {}]))

    await page.getByRole('button', { name: 'Отметить вручную: Anki' }).click()
    await page.getByLabelText('Минут: Anki').fill('30')
    await page.getByRole('button', { name: 'Сохранить' }).click()

    expect(markSlotAction).toHaveBeenCalledExactlyOnceWith({
      programDay: 10,
      slotIndex: 0,
      minutes: 30,
    })
    await expect.element(page.getByText('Минимум выполнен ✓')).toBeVisible()
  })

  test('015. 601 is refused in the form with «Не больше 600 минут», nothing is sent', async () => {
    await renderTimers(stateOf([{}, {}]))
    await page.getByRole('button', { name: 'Отметить вручную: Anki' }).click()
    await page.getByLabelText('Минут: Anki').fill('601')
    await page.getByRole('button', { name: 'Сохранить' }).click()

    await expect.element(page.getByRole('alert')).toHaveTextContent('Не больше 600 минут')
    expect(markSlotAction).not.toHaveBeenCalled()
  })

  test('015. a server error is shown and the form stays open', async () => {
    markSlotAction.mockResolvedValue({ status: 'error', error: 'forbidden' })
    await renderTimers(stateOf([{}, {}]), 'en')
    await page.getByRole('button', { name: 'Mark manually: Anki' }).click()
    await page.getByLabelText('Minutes: Anki').fill('10')
    await page.getByRole('button', { name: 'Save' }).click()

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('This day cannot be marked: it has not started yet')
    await expect.element(page.getByLabelText('Minutes: Anki')).toBeVisible()
  })
})
