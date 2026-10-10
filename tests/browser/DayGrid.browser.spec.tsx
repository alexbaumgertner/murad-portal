import type { AnchorHTMLAttributes } from 'react'
import { describe, expect, test, vi } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'

import { DayGrid } from '@/components/DayGrid/DayGrid'
import type { GridCell } from '@/features/study-today/shape'

// The locale-aware Link needs Next's router; a plain anchor is enough to see what is a link.
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: unknown }) => (
    <a href={typeof href === 'string' ? href : '/study'} {...rest} />
  ),
}))

const cells: GridCell[] = [
  { programDay: 8, date: '2026-10-08', state: 'done' },
  { programDay: 9, date: '2026-10-09', state: 'missed' },
  { programDay: null, date: '2026-10-10', state: 'paused' },
  { programDay: 10, date: '2026-10-11', state: 'today' },
]

describe('DayGrid read-only (story 019)', () => {
  test('3. the owner’s grid has the markers of the student’s grid and nothing to click', async () => {
    const screen = await render(
      <DayGrid cells={cells} week={2} selected={0} locale="ru" addressForm="ty" readOnly />,
    )
    // Every day keeps its name and marker, never colour alone.
    await expect.element(page.getByRole('img', { name: /День 8, .*: Выполнено/ })).toBeVisible()
    await expect.element(page.getByRole('img', { name: /День 9, .*: Пропущено/ })).toBeVisible()
    await expect.element(page.getByRole('img', { name: /: пауза/ })).toBeVisible()
    await expect.element(page.getByRole('img', { name: /День 10, .*: Сегодня/ })).toBeVisible()
    expect(screen.container.textContent).toContain('✓')
    expect(screen.container.textContent).toContain('✕')
    // No link and no button: reading it cannot open, mark or change a day.
    expect(screen.container.querySelectorAll('a, button')).toHaveLength(0)
  })

  test('the student’s own grid still links every program day', async () => {
    const screen = await render(
      <DayGrid cells={cells} week={2} selected={10} locale="ru" addressForm="ty" />,
    )
    // Three program days are links; the paused calendar day is not.
    expect(screen.container.querySelectorAll('a')).toHaveLength(3)
  })
})
