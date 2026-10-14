import { NextIntlClientProvider } from 'next-intl'
import { useEffect, useState } from 'react'
import { describe, expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'

import { PlannerContext } from '@/components/PlannerShell/planner-context'
import { PlannerColorSettings } from '@/components/PlannerSettings/PlannerColorSettings'
import { PlannerTypographySettings } from '@/components/PlannerSettings/PlannerTypographySettings'
import { defaultAppearance, type Appearance } from '@/features/planner/appearance'
import { messagesFor } from '@/i18n/address-form'

const seen = { current: defaultAppearance() }
function Harness({ children }: { children: React.ReactNode }) {
  const [appearance, setAppearance] = useState<Appearance>(defaultAppearance())
  useEffect(() => {
    seen.current = appearance
  })
  return (
    <PlannerContext.Provider
      value={{
        appearance,
        update: (change) => setAppearance((current) => change(current)),
        openSettings: () => {},
        saveFailed: false,
      }}
    >
      {children}
    </PlannerContext.Provider>
  )
}

const renderPanel = (panel: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale="en" messages={messagesFor('en', 'ty')}>
      <Harness>{panel}</Harness>
    </NextIntlClientProvider>,
  )

describe('Planner settings panels (story 025)', () => {
  test('1/3. color and opacity change independently; reset restores the original palette', async () => {
    await renderPanel(<PlannerColorSettings />)
    const opacity = page.getByLabelText('Opacity: Main header')
    await opacity.fill('40')
    expect(seen.current.colors.header).toEqual({ color: '#1b1a17', opacity: 40 })
    expect(seen.current.colors.strip.opacity).toBe(100)
    await userEvent.click(page.getByRole('button', { name: 'Reset colors' }))
    expect(seen.current.colors.header.opacity).toBe(100)
  })

  test('9. a low-contrast text color shows a warning but is still allowed', async () => {
    await renderPanel(<PlannerColorSettings />)
    await page.getByLabelText('Opacity: Text', { exact: true }).fill('20')
    await expect
      .element(page.getByText('Some text colors may be hard to read on this paper.'))
      .toBeVisible()
    expect(seen.current.colors.text.opacity).toBe(20)
  })

  test('5. size, bold and italic apply to one section only', async () => {
    await renderPanel(<PlannerTypographySettings />)
    await page.getByLabelText('Size: Assignments').fill('30')
    await userEvent.click(page.getByRole('button', { name: 'Italic: Assignments' }))
    expect(seen.current.type.tasks).toMatchObject({ size: 30, italic: true })
    expect(seen.current.type.dates.size).toBe(12)
    await page.getByLabelText('Size: Assignments').fill('5')
    expect(seen.current.type.tasks.size).toBe(30) // out of the 9–90 range: ignored
  })

  test('6/7. apply to all keeps sizes; restore only fonts; reset everything', async () => {
    await renderPanel(<PlannerTypographySettings />)
    await page.getByLabelText('Size: Assignments').fill('30')
    await page.getByLabelText('Font for all sections').selectOptions('lora')
    await userEvent.click(page.getByRole('button', { name: 'Apply font to all sections' }))
    expect(seen.current.type.tasks).toMatchObject({ font: 'lora', size: 30 })
    expect(seen.current.type.goalText.font).toBe('lora')
    await page.getByLabelText('Font: Goal', { exact: true }).selectOptions('caveat')
    expect(seen.current.type.goalText.font).toBe('caveat')
    await userEvent.click(page.getByRole('button', { name: 'Restore original font everywhere' }))
    expect(seen.current.type.tasks).toMatchObject({ font: 'default', size: 30 })
    await userEvent.click(page.getByRole('button', { name: 'Reset all typography' }))
    expect(seen.current.type.tasks.size).toBe(14)
  })

  test('4. the font list has 30+ families in three groups', async () => {
    await renderPanel(<PlannerTypographySettings />)
    const options = page
      .getByLabelText('Font for all sections')
      .element()
      .querySelectorAll('option')
    expect(options.length).toBeGreaterThanOrEqual(31)
    expect(
      page.getByLabelText('Font for all sections').element().querySelectorAll('optgroup'),
    ).toHaveLength(3)
  })
})
