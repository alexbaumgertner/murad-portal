import { page } from 'vitest/browser'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'

import { CopyWeekForm } from '@/components/admin/PlanGrid/CopyWeekForm'

const copyWeekAction = vi.hoisted(() => vi.fn())
vi.mock('@/features/program-plan/actions', () => ({ copyWeekAction }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

describe('CopyWeekForm (story 010)', () => {
  it('shows the summary after copying', async () => {
    copyWeekAction.mockResolvedValue({ status: 'success', copied: 6, skipped: 2 })
    await render(<CopyWeekForm programId={7} durationWeeks={52} />)
    await page.getByRole('button', { name: 'Копировать', exact: true }).click()
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('Скопировано: 6, пропущено (занято): 2')
  })

  it('shows an error without throwing', async () => {
    copyWeekAction.mockResolvedValue({ status: 'error', error: 'invalid_range' })
    await render(<CopyWeekForm programId={7} durationWeeks={52} />)
    await page.getByRole('button', { name: 'Копировать', exact: true }).click()
    await expect.element(page.getByRole('alert')).toBeVisible()
  })
})
