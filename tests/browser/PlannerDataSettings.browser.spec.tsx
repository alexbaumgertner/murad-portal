import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'

import { PlannerDataSettings } from '@/components/PlannerSettings/PlannerDataSettings'
import { messagesFor } from '@/i18n/address-form'

const actions = vi.hoisted(() => ({
  exportPlannerAction: vi.fn(),
  importPlannerAction: vi.fn(),
  resetPlannerAction: vi.fn(),
}))
vi.mock('@/features/planner/actions', () => actions)

const renderPanel = (isOwner: boolean) =>
  render(
    <NextIntlClientProvider locale="en" messages={messagesFor('en', 'ty')}>
      <PlannerDataSettings plannerId={7} isOwner={isOwner} />
    </NextIntlClientProvider>,
  )

const file = new File(['{"app":"x"}'], 'backup.json', { type: 'application/json' })

describe('PlannerDataSettings (story 028)', () => {
  beforeEach(() => {
    for (const action of Object.values(actions)) action.mockReset()
    actions.exportPlannerAction.mockResolvedValue({
      status: 'success',
      json: '{}',
      filename: 'plan.json',
    })
    actions.importPlannerAction.mockResolvedValue({ status: 'error', error: 'invalid_format' })
    actions.resetPlannerAction.mockResolvedValue({ status: 'error', error: 'server' })
  })

  test('1/7. a student can export but sees no import or reset', async () => {
    await renderPanel(false)
    expect(page.getByLabelText('Import backup').query()).toBeNull()
    expect(page.getByRole('button', { name: 'Reset entire planner' }).query()).toBeNull()
    await userEvent.click(page.getByRole('button', { name: 'Export backup' }))
    await expect.element(page.getByText('Backup downloaded')).toBeVisible()
    expect(actions.exportPlannerAction).toHaveBeenCalledWith({ plannerId: 7 })
  })

  test('5. importing asks first; cancel keeps everything', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await renderPanel(true)
    await page.getByLabelText('Import backup').upload(file)
    await vi.waitFor(() => expect(confirm).toHaveBeenCalled())
    expect(actions.importPlannerAction).not.toHaveBeenCalled()
  })

  test('4. a refused file shows its error and nothing reloads', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await renderPanel(true)
    await page.getByLabelText('Import backup').upload(file)
    await expect.element(page.getByText('This file is not a planner backup')).toBeVisible()
    expect(actions.importPlannerAction).toHaveBeenCalledWith({ plannerId: 7, json: '{"app":"x"}' })
  })

  test('6. reset asks with a serious warning; cancel does nothing', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await renderPanel(true)
    await userEvent.click(page.getByRole('button', { name: 'Reset entire planner' }))
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('cannot be undone'))
    expect(actions.resetPlannerAction).not.toHaveBeenCalled()
  })
})
