import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'

import { CloseDayCell } from '@/components/CloseDayCell/CloseDayCell'
import type { CloseDayError, CloseDayState } from '@/features/challenge/schema'
import type { Locale } from '@/i18n/routing'

import en from '../../messages/en.json'
import ru from '../../messages/ru.json'

const { closeDayAction } = vi.hoisted(() => ({
  closeDayAction: vi.fn<(prev: CloseDayState, formData: FormData) => Promise<CloseDayState>>(),
}))
vi.mock('@/features/challenge/actions', () => ({ closeDayAction }))

const messages = { en, ru }

function renderCell(props: { minutes?: number; notes?: string } = {}, locale: Locale = 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <CloseDayCell
        slug="90-90-1"
        dayNumber={4}
        defaultMinutes={90}
        label="Day 4"
        summary={<span>4</span>}
        {...props}
      />
    </NextIntlClientProvider>,
  )
}

const open = () => page.getByText('4', { exact: true }).click()

describe('CloseDayCell', () => {
  beforeEach(() => {
    closeDayAction.mockReset()
  })

  test('opens a form with the daily target as the default minutes (criterion 1)', async () => {
    await renderCell()
    await open()

    await expect.element(page.getByLabelText(en.Challenge.closeDay.minutesLabel)).toHaveValue(90)
    await expect.element(page.getByLabelText(en.Challenge.closeDay.notesLabel)).toHaveValue('')
    await expect
      .element(page.getByRole('button', { name: en.Challenge.closeDay.submit }))
      .toBeEnabled()
  })

  test('prefills a closed day and offers to save changes (criterion 4)', async () => {
    await renderCell({ minutes: 120, notes: 'Earlier note' })
    await open()

    await expect.element(page.getByLabelText(en.Challenge.closeDay.minutesLabel)).toHaveValue(120)
    await expect
      .element(page.getByLabelText(en.Challenge.closeDay.notesLabel))
      .toHaveValue('Earlier note')
    await expect
      .element(page.getByRole('button', { name: en.Challenge.closeDay.update }))
      .toBeVisible()
  })

  test('submits the slug, day, minutes and notes, then closes the form (criterion 2)', async () => {
    closeDayAction.mockResolvedValue({ status: 'success', dayNumber: 4, updated: false })
    await renderCell()
    await open()

    await page.getByLabelText(en.Challenge.closeDay.notesLabel).fill('Listened to a podcast')
    await page.getByRole('button', { name: en.Challenge.closeDay.submit }).click()

    await vi.waitFor(() => expect(closeDayAction).toHaveBeenCalledTimes(1))
    const data = closeDayAction.mock.calls[0]?.[1]
    expect(Object.fromEntries(data ?? [])).toEqual({
      slug: '90-90-1',
      dayNumber: '4',
      minutes: '90',
      notes: 'Listened to a podcast',
    })
    await expect.element(page.getByLabelText(en.Challenge.closeDay.minutesLabel)).not.toBeVisible()
  })

  test('disables the form while saving, so a double tap sends one request (criterion 8)', async () => {
    let resolve!: (state: CloseDayState) => void
    closeDayAction.mockReturnValue(new Promise((r) => (resolve = r)))
    await renderCell()
    await open()

    await page.getByRole('button', { name: en.Challenge.closeDay.submit }).dblClick()

    await expect
      .element(page.getByRole('button', { name: en.Challenge.closeDay.pending }))
      .toBeDisabled()
    expect(closeDayAction).toHaveBeenCalledTimes(1)
    resolve({ status: 'success', dayNumber: 4, updated: false })
  })

  const codes: CloseDayError[] = [
    'unauthorized',
    'invalid_request',
    'invalid_day',
    'invalid_minutes',
    'invalid_notes',
    'future_day',
    'not_found',
    'server',
  ]

  test.each(codes)(
    'shows a translated message for the code %s in both locales (criterion 6)',
    async (code) => {
      for (const locale of ['en', 'ru'] as const) {
        closeDayAction.mockResolvedValue({ status: 'error', error: code })
        const view = await renderCell({}, locale)
        await open()
        await page.getByRole('button', { name: messages[locale].Challenge.closeDay.submit }).click()

        await expect
          .element(page.getByRole('alert'))
          .toHaveTextContent(messages[locale].Challenge.closeDay.errors[code])
        await view.unmount()
      }
    },
  )

  test('keeps what was typed after an error so nothing is lost', async () => {
    closeDayAction.mockResolvedValue({ status: 'error', error: 'invalid_minutes' })
    await renderCell()
    await open()

    await page.getByLabelText(en.Challenge.closeDay.minutesLabel).fill('0')
    await page.getByLabelText(en.Challenge.closeDay.notesLabel).fill('keep me')
    await page.getByRole('button', { name: en.Challenge.closeDay.submit }).click()

    await expect.element(page.getByRole('alert')).toBeVisible()
    await expect
      .element(page.getByLabelText(en.Challenge.closeDay.notesLabel))
      .toHaveValue('keep me')
    await userEvent.keyboard('{Tab}')
  })
})
