import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'

import { PlannerBoard } from '@/components/PlannerBoard/PlannerBoard'
import type { ProgressSettings } from '@/features/planner/queries'
import { messagesFor } from '@/i18n/address-form'

const actions = vi.hoisted(() => ({
  addRowAction: vi.fn(),
  removeRowAction: vi.fn(),
  setCellTextAction: vi.fn(),
  setOwnTaskAction: vi.fn(),
  setDoneAction: vi.fn(),
  saveHeaderAction: vi.fn(),
  saveNoteAction: vi.fn(),
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
const base: ProgressSettings = {
  showWeekProgress: true,
  showFourWeekProgress: false,
  showDeadlineProgress: false,
  deadlineTitle: '',
  deadlineDate: '',
}

const renderBoard = (
  cells: Record<string, { text: string; done: boolean }>,
  settings: Partial<ProgressSettings> = {},
  otherTasks: { week: number; day: number; done: boolean }[] = [],
  weekIndexes = [0],
) =>
  render(
    <NextIntlClientProvider locale="en" messages={messagesFor('en', 'ty')}>
      <PlannerBoard
        plannerId={7}
        header={{ studentName: '', goal: '', subtitle: '', labels: {} }}
        notes={{}}
        weekId={1}
        weekIndex={0}
        rowCount={2}
        dates={dates}
        cells={cells}
        canEdit
        baseDate="2026-10-12"
        weekIndexes={weekIndexes}
        otherTasks={otherTasks}
        settings={{ ...base, ...settings }}
        today="2026-10-14"
      />
    </NextIntlClientProvider>,
  )

describe('PlannerProgress (story 024)', () => {
  beforeEach(() => {
    for (const action of Object.values(actions))
      action.mockReset().mockResolvedValue({ status: 'success' })
  })

  test('2. an empty week says "No tasks", never 100%', async () => {
    await renderBoard({})
    await expect.element(page.getByText('No tasks')).toBeVisible()
  })

  test('3. the week percent follows ticks, new tasks and deleted tasks at once', async () => {
    await renderBoard({ '0-0': { text: 'A', done: false } })
    const strip = page.getByRole('status').filter({ hasText: 'This week' })
    await expect.element(strip).toHaveTextContent('This week 0%')
    await userEvent.click(page.getByRole('button', { name: /Mark as done: A/ }))
    await expect.element(strip).toHaveTextContent('This week 100%')
    await userEvent.fill(page.getByRole('textbox', { name: /priority I, Oct 13/ }), 'B')
    await userEvent.tab()
    await expect.element(strip).toHaveTextContent('This week 50%')
    await userEvent.fill(page.getByRole('textbox', { name: /priority I, Oct 13/ }), '')
    await userEvent.tab()
    await expect.element(strip).toHaveTextContent('This week 100%')
  })

  test('10. the week strip can be hidden; four-week and deadline blocks are off by default', async () => {
    await renderBoard({ '0-0': { text: 'A', done: true } }, { showWeekProgress: false })
    expect(page.getByText('This week').query()).toBeNull()
    expect(page.getByRole('progressbar').query()).toBeNull()
  })

  test('4/5. the four-week bar is weighted by tasks and shows its dates', async () => {
    const other = Array.from({ length: 9 }, (_, day) => ({ week: 1, day: day % 7, done: false }))
    await renderBoard(
      { '0-0': { text: 'A', done: true } },
      { showFourWeekProgress: true },
      other,
      [0, 1],
    )
    const bar = page.getByRole('progressbar', { name: 'Weeks 01–02' })
    await expect.element(bar).toHaveAttribute('aria-valuenow', '10')
    await expect.element(page.getByText(/Oct 12 – Oct 25, 2026/)).toBeVisible()
  })

  test('7/8. the deadline counts tasks up to its date and shows days left', async () => {
    const other = [
      { week: 1, day: 0, done: true }, // Oct 19
      { week: 1, day: 6, done: false }, // Oct 25
    ]
    await renderBoard(
      { '0-0': { text: 'A', done: true }, '0-3': { text: 'B', done: false } },
      { showDeadlineProgress: true, deadlineTitle: 'IELTS EXAM', deadlineDate: '2026-10-19' },
      other,
      [0, 1],
    )
    const bar = page.getByRole('progressbar', { name: 'IELTS EXAM' })
    await expect.element(bar).toHaveAttribute('aria-valuenow', '67')
    await expect.element(page.getByText('5 days left')).toBeVisible()
  })

  test('8. a deadline in the past is overdue; no eligible tasks has no percent', async () => {
    await renderBoard(
      { '0-0': { text: 'A', done: true } },
      { showDeadlineProgress: true, deadlineTitle: 'OLD', deadlineDate: '2026-10-01' },
    )
    await expect.element(page.getByText('Overdue')).toBeVisible()
    await expect
      .element(page.getByRole('progressbar', { name: 'OLD' }))
      .not.toHaveAttribute('aria-valuenow')
  })
})
