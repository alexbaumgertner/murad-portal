import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'

import { PlannerBoard } from '@/components/PlannerBoard/PlannerBoard'
import { messagesFor } from '@/i18n/address-form'
import type { PlannerActionState } from '@/features/planner/schema'

const actions = vi.hoisted(() => ({
  addRowAction: vi.fn(),
  removeRowAction: vi.fn(),
  setCellTextAction: vi.fn(),
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

const boardFor = (canEdit: boolean, notes: Record<string, string> = {}) => (
  <NextIntlClientProvider locale="en" messages={messagesFor('en', 'ty')}>
    <PlannerBoard
      plannerId={7}
      header={{ studentName: '', goal: '', subtitle: '', labels: {} }}
      notes={notes}
      weekId={1}
      weekIndex={0}
      rowCount={1}
      dates={dates}
      cells={{}}
      canEdit={canEdit}
      baseDate="2026-10-12"
      weekIndexes={[0]}
      otherTasks={[]}
      settings={{
        showWeekProgress: true,
        showFourWeekProgress: false,
        showDeadlineProgress: false,
        deadlineTitle: '',
        deadlineDate: '',
      }}
      today="2026-10-14"
    />
  </NextIntlClientProvider>
)

const renderBoard = (canEdit: boolean, notes: Record<string, string> = {}) =>
  render(boardFor(canEdit, notes))

describe('PlannerHeader and PlannerDiary (story 023)', () => {
  beforeEach(() => {
    for (const action of Object.values(actions))
      action.mockReset().mockResolvedValue({ status: 'success' })
  })

  test('1/3. a new planner shows placeholders, no example data, and the week line from the date', async () => {
    await renderBoard(true)
    await expect.element(page.getByLabelText('Student name')).toHaveValue('')
    await expect.element(page.getByLabelText('Student name')).toHaveAttribute('placeholder', 'NAME')
    await expect.element(page.getByLabelText('Goal', { exact: true })).toHaveValue('')
    await expect.element(page.getByText('WEEK 01 · October 12, 2026')).toBeVisible()
  })

  test('2. Enter saves a single-line field, Escape cancels', async () => {
    await renderBoard(true)
    const name = page.getByLabelText('Student name')
    await userEvent.fill(name, 'Anna')
    await userEvent.keyboard('{Enter}')
    await vi.waitFor(() =>
      expect(actions.saveHeaderAction).toHaveBeenCalledWith({ plannerId: 7, studentName: 'Anna' }),
    )
    actions.saveHeaderAction.mockClear()
    await userEvent.fill(name, 'Boris')
    await userEvent.keyboard('{Escape}')
    await expect.element(name).toHaveValue('Anna')
    expect(actions.saveHeaderAction).not.toHaveBeenCalled()
  })

  test('2. renaming a heading saves only that label', async () => {
    await renderBoard(true)
    await userEvent.fill(page.getByLabelText('Exercises heading'), 'HOMEWORK')
    await userEvent.tab()
    await vi.waitFor(() =>
      expect(actions.saveHeaderAction).toHaveBeenCalledWith({
        plannerId: 7,
        labels: { exercises: 'HOMEWORK' },
      }),
    )
  })

  test('4. the diary has seven entries per heading; multi-line text saves on blur', async () => {
    await renderBoard(true, { 'exercises-1': 'Unit 4' })
    expect(page.getByRole('textbox', { name: /^EXERCISES, Tuesday$/ }).elements()).toHaveLength(1)
    const entry = page.getByRole('textbox', { name: 'EXERCISES, Monday' })
    await userEvent.fill(entry, 'line 1\nline 2')
    await userEvent.tab()
    await vi.waitFor(() =>
      expect(actions.saveNoteAction).toHaveBeenCalledWith({
        weekId: 1,
        kind: 'exercises',
        day: 0,
        text: 'line 1\nline 2',
      }),
    )
    await expect
      .element(page.getByRole('textbox', { name: 'EXERCISES, Tuesday' }))
      .toHaveValue('Unit 4')
  })

  test('5. a student writes diary entries but cannot edit header, headings or tasks', async () => {
    await renderBoard(false)
    expect(page.getByLabelText('Student name').query()).toBeNull()
    expect(page.getByLabelText('Exercises heading').query()).toBeNull()
    await userEvent.fill(page.getByRole('textbox', { name: 'QUESTIONS, Friday' }), 'Why?')
    await userEvent.tab()
    await vi.waitFor(() =>
      expect(actions.saveNoteAction).toHaveBeenCalledWith({
        weekId: 1,
        kind: 'questions',
        day: 4,
        text: 'Why?',
      }),
    )
  })

  test('failed save puts the old text back', async () => {
    actions.saveNoteAction.mockResolvedValue({ status: 'error', error: 'server' })
    await renderBoard(false, { 'exercises-0': 'old' })
    const entry = page.getByRole('textbox', { name: 'EXERCISES, Monday' })
    await userEvent.fill(entry, 'new')
    await userEvent.tab()
    await expect.element(entry).toHaveValue('old')
  })

  test('032. a remote diary entry shows up unless the field is in focus', async () => {
    const { rerender } = await renderBoard(false, { 'exercises-0': 'old' })
    const entry = page.getByRole('textbox', { name: 'EXERCISES, Monday' })
    await userEvent.click(entry)
    await userEvent.keyboard(' mine')
    await rerender(boardFor(false, { 'exercises-0': 'remote' }))
    await expect.element(entry).toHaveValue('old mine')
    await userEvent.tab()
    await expect.element(entry).toHaveValue('old mine')
    await rerender(boardFor(false, { 'exercises-0': 'old mine' }))
    await rerender(boardFor(false, { 'exercises-2': 'wednesday', 'exercises-0': 'newer' }))
    await expect.element(entry).toHaveValue('newer')
    await expect
      .element(page.getByRole('textbox', { name: 'EXERCISES, Wednesday' }))
      .toHaveValue('wednesday')
  })

  test('032. saving into a deleted week shows a translated message', async () => {
    actions.saveNoteAction.mockResolvedValue({ status: 'error', error: 'not_found' })
    await renderBoard(false)
    await userEvent.fill(page.getByRole('textbox', { name: 'EXERCISES, Monday' }), 'text')
    await userEvent.tab()
    await expect.element(page.getByText('Not found')).toBeVisible()
  })

  test('an older failed save does not erase text typed after refocusing', async () => {
    let fail: (state: PlannerActionState) => void = () => {}
    actions.saveHeaderAction.mockImplementationOnce(
      () => new Promise<PlannerActionState>((resolve) => (fail = resolve)),
    )
    await renderBoard(true)
    const name = page.getByLabelText('Student name')
    await userEvent.fill(name, 'Anna')
    await userEvent.tab()
    await userEvent.click(name)
    await userEvent.fill(name, 'Boris')
    fail({ status: 'error', error: 'server' })
    await expect.element(name).toHaveValue('Boris')
    await userEvent.tab()
    await vi.waitFor(() =>
      expect(actions.saveHeaderAction).toHaveBeenLastCalledWith({
        plannerId: 7,
        studentName: 'Boris',
      }),
    )
  })
})
