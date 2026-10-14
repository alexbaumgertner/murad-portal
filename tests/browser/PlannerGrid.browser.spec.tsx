import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'

import { PlannerGrid } from '@/components/PlannerGrid/PlannerGrid'
import type { PlannerActionState } from '@/features/planner/schema'
import { messagesFor } from '@/i18n/address-form'

const actions = vi.hoisted(() => ({
  addRowAction: vi.fn<(input: unknown) => Promise<PlannerActionState>>(),
  removeRowAction: vi.fn<(input: unknown) => Promise<PlannerActionState>>(),
  setCellTextAction: vi.fn<(input: unknown) => Promise<PlannerActionState>>(),
  setDoneAction: vi.fn<(input: unknown) => Promise<PlannerActionState>>(),
}))
vi.mock('@/features/planner/actions', () => actions)
vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const dates = [
  '2026-10-12',
  '2026-10-13',
  '2026-10-14',
  '2026-10-15',
  '2026-10-16',
  '2026-10-17',
  '2026-10-18',
]

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const renderGrid = (props: Partial<Parameters<typeof PlannerGrid>[0]> = {}) =>
  render(
    <NextIntlClientProvider locale="en" messages={messagesFor('en', 'ty')}>
      <PlannerGrid
        weekId={1}
        rowCount={2}
        dates={dates}
        cells={{ '0-0': { text: 'ANKI', done: false } }}
        canEdit
        dayNames={DAY_NAMES}
        {...props}
      />
    </NextIntlClientProvider>,
  )

describe('PlannerGrid (story 022)', () => {
  beforeEach(() => {
    for (const action of Object.values(actions))
      action.mockReset().mockResolvedValue({ status: 'success' })
  })

  test('3/5. shows Monday…Sunday dates and Roman priority labels', async () => {
    await renderGrid({ canEdit: false })
    await expect.element(page.getByRole('columnheader', { name: /Oct 12.*Monday/i })).toBeVisible()
    await expect.element(page.getByRole('columnheader', { name: /Oct 18.*Sunday/i })).toBeVisible()
    await expect.element(page.getByRole('rowheader', { name: 'II' })).toBeVisible()
  })

  test('9/11. saving text on blur never toggles the tick; the tick button does', async () => {
    await renderGrid()
    const cell = page.getByRole('textbox', { name: /priority I, Oct 12/ })
    await userEvent.fill(cell, 'ANKI 20 min')
    await userEvent.tab()
    expect(actions.setCellTextAction).toHaveBeenCalledWith({
      weekId: 1,
      row: 0,
      day: 0,
      text: 'ANKI 20 min',
    })
    expect(actions.setDoneAction).not.toHaveBeenCalled()
    const tick = page.getByRole('button', { name: /Mark as done: ANKI 20 min/ })
    await expect.element(tick).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(tick)
    expect(actions.setDoneAction).toHaveBeenCalledWith({ weekId: 1, row: 0, day: 0, done: true })
    await expect.element(tick).toHaveAttribute('aria-pressed', 'true')
  })

  test('10. an empty or dash-only cell has no tick, and clearing a task removes it', async () => {
    await renderGrid({ cells: { '0-0': { text: 'ANKI', done: true } } })
    await expect.element(page.getByRole('button', { name: /Mark as done/ })).toBeVisible()
    await userEvent.fill(page.getByRole('textbox', { name: /priority I, Oct 12/ }), ' — ')
    await userEvent.tab()
    expect(page.getByRole('button', { name: /Mark as done/ }).query()).toBeNull()
  })

  test('3 (student). a student sees text and ticks, has no text editor, and can add or remove priorities', async () => {
    await renderGrid({ canEdit: false })
    expect(page.getByRole('textbox').query()).toBeNull()
    expect(page.getByRole('button', { name: /Add priority/ }).query()).not.toBeNull()
    await userEvent.click(page.getByRole('button', { name: /Mark as done: ANKI/ }))
    expect(actions.setDoneAction).toHaveBeenCalled()
  })

  test('029. a student picks a task type from a list instead of typing', async () => {
    await renderGrid({ canEdit: false, taskTypes: ['ANKI', 'PODCAST'] })
    expect(page.getByRole('textbox').query()).toBeNull()
    await userEvent.selectOptions(
      page.getByRole('combobox', { name: /priority I, Oct 13/ }),
      'PODCAST',
    )
    await vi.waitFor(() =>
      expect(actions.setCellTextAction).toHaveBeenCalledWith({
        weekId: 1,
        row: 0,
        day: 1,
        text: 'PODCAST',
      }),
    )
  })

  test('6. removing a priority asks first; cancel changes nothing', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await renderGrid()
    await userEvent.click(page.getByRole('button', { name: /Remove priority/ }))
    expect(confirm).toHaveBeenCalled()
    expect(actions.removeRowAction).not.toHaveBeenCalled()
    confirm.mockReturnValue(true)
    await userEvent.click(page.getByRole('button', { name: /Remove priority/ }))
    await vi.waitFor(() => expect(actions.removeRowAction).toHaveBeenCalledWith({ weekId: 1 }))
  })

  test('7. the last priority row cannot be removed', async () => {
    await renderGrid({ rowCount: 1 })
    await expect.element(page.getByRole('button', { name: /Remove priority/ })).toBeDisabled()
  })

  test('failed save puts the old value back and shows the error', async () => {
    actions.setDoneAction.mockResolvedValue({ status: 'error', error: 'server' })
    await renderGrid()
    const tick = page.getByRole('button', { name: /Mark as done: ANKI/ })
    await userEvent.click(tick)
    await expect.element(tick).toHaveAttribute('aria-pressed', 'false')
    await expect.element(page.getByText('Something went wrong. Try again')).toBeVisible()
  })
})
