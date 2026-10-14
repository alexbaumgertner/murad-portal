import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, test, vi } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'

import { PlannerWeekNav } from '@/components/PlannerWeekNav/PlannerWeekNav'
import { messagesFor } from '@/i18n/address-form'

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: { pathname: string; query: Record<string, number> }
    children: React.ReactNode
  }) => (
    <a href={`${href.pathname}?${new URLSearchParams(href.query as never).toString()}`} {...rest}>
      {children}
    </a>
  ),
}))

const weeks = [
  { id: 1, index: 0, label: 'WEEK 01', from: '2026-10-12', to: '2026-10-18' },
  { id: 2, index: 1, label: 'WEEK 02', from: '2026-10-19', to: '2026-10-25' },
  { id: 3, index: 2, label: 'WEEK 03', from: '2026-10-26', to: '2026-11-01' },
]

const show = (activeId: number) =>
  render(
    <NextIntlClientProvider locale="en" messages={messagesFor('en', 'ty')}>
      <PlannerWeekNav weeks={weeks} activeId={activeId} />
    </NextIntlClientProvider>,
  )

describe('PlannerWeekNav (week switching)', () => {
  test('shows every week with its dates and marks the current one', async () => {
    await show(2)
    await expect.element(page.getByText('Oct 19 — Oct 25')).toBeVisible()
    const current = page.getByRole('link', { name: /WEEK 02/ }).element()
    expect(current.getAttribute('aria-current')).toBe('page')
    expect(
      page
        .getByRole('link', { name: /WEEK 03/ })
        .element()
        .getAttribute('href'),
    ).toContain('week=2')
  })

  test('arrows lead to the neighbours and are off at the ends', async () => {
    await show(1)
    expect(page.getByRole('link', { name: 'Previous week' }).query()).toBeNull()
    await expect.element(page.getByRole('link', { name: 'Next week' })).toBeVisible()
  })
})
