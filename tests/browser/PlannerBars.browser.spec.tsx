import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'

import { PlannerProgress } from '@/components/PlannerProgress/PlannerProgress'
import { PlannerContext } from '@/components/PlannerShell/planner-context'
import {
  BAR_STYLES,
  DEFAULT_BAR,
  defaultAppearance,
  type BarSetting,
} from '@/features/planner/appearance'
import { messagesFor } from '@/i18n/address-form'

const renderBars = (fourWeeks: Partial<BarSetting>, deadline: Partial<BarSetting> = {}) => {
  const appearance = defaultAppearance()
  appearance.bars = {
    fourWeeks: { ...DEFAULT_BAR, ...fourWeeks },
    deadline: { ...DEFAULT_BAR, ...deadline },
  }
  return render(
    <NextIntlClientProvider locale="en" messages={messagesFor('en', 'ty')}>
      <PlannerContext.Provider
        value={{ appearance, update: () => {}, openSettings: () => {}, saveFailed: false }}
      >
        <PlannerProgress
          part="blocks"
          baseDate="2026-10-12"
          activeIndex={0}
          activeCells={[
            { text: 'A', done: true, day: 0 },
            { text: 'B', done: false, day: 1 },
            { text: 'C', done: false, day: 2 },
            { text: 'D', done: false, day: 3 },
          ]}
          weekIndexes={[0]}
          otherTasks={[]}
          settings={{
            showWeekProgress: false,
            showFourWeekProgress: true,
            showDeadlineProgress: true,
            deadlineTitle: 'IELTS',
            deadlineDate: '2026-12-20',
          }}
          today="2026-10-14"
        />
      </PlannerContext.Provider>
    </NextIntlClientProvider>,
  )
}

const fills = () => [...document.querySelectorAll<HTMLElement>('[data-testid="planner-bar-fill"]')]
const running = (el: HTMLElement) => el.getAnimations({ subtree: true })

describe('Progress bars (story 027)', () => {
  test('4. the fill width equals the percent whatever the style', async () => {
    for (const style of BAR_STYLES) {
      const { unmount } = await renderBars({ style })
      expect(fills()[0]!.style.width).toBe('25%')
      await expect
        .element(page.getByRole('progressbar', { name: 'Weeks 01–01' }))
        .toHaveAttribute('aria-valuenow', '25')
      await unmount()
    }
  })

  test('2/3. every moving style runs only slow, endless, alternating or periodic animations', async () => {
    const still = new Set(['none', 'film-grain'])
    for (const style of BAR_STYLES) {
      const { unmount } = await renderBars({ style })
      const animations = running(fills()[0]!)
      if (still.has(style)) expect(animations, style).toHaveLength(0)
      else {
        expect(animations.length, style).toBeGreaterThan(0)
        for (const animation of animations) {
          const timing = animation.effect!.getComputedTiming()
          expect(timing.iterations, style).toBe(Infinity)
          expect(Number(timing.duration), style).toBeGreaterThanOrEqual(23000)
          expect(Number(timing.duration), style).toBeLessThanOrEqual(45000)
        }
      }
      await unmount()
    }
  })

  test('5. No Animation and the animate switch stop all movement', async () => {
    await renderBars({ style: 'none' }, { style: 'soft-aurora', animate: false })
    const [four, deadline] = fills()
    expect(running(four!)).toHaveLength(0)
    expect(running(deadline!)).toHaveLength(0)
  })

  test('2. the styles look different from each other', async () => {
    const seen = new Set<string>()
    for (const style of BAR_STYLES) {
      const { unmount } = await renderBars({ style })
      const el = fills()[0]!
      const before = getComputedStyle(el, '::before')
      const after = getComputedStyle(el, '::after')
      seen.add(
        [
          before.backgroundImage,
          before.opacity,
          after.backgroundImage,
          after.opacity,
          running(el)
            .map((a) => (a as CSSAnimation).animationName)
            .join(','),
        ].join('|'),
      )
      await unmount()
    }
    expect(seen.size).toBe(BAR_STYLES.length)
  })

  test('6. a reduced-motion rule switches every layer animation off', async () => {
    await renderBars({ style: 'soft-aurora' })
    const rules = [...document.styleSheets].flatMap((sheet) => {
      try {
        return [...sheet.cssRules]
      } catch {
        return []
      }
    })
    const reduced = rules.filter(
      (rule): rule is CSSMediaRule =>
        rule instanceof CSSMediaRule && rule.conditionText.includes('prefers-reduced-motion'),
    )
    expect(
      reduced.some((rule) =>
        [...rule.cssRules].some((r) => /animation:[^;]*\bnone\b/.test(r.cssText)),
      ),
    ).toBe(true)
  })

  test('7. grain 0 is perfectly smooth; grain > 0 adds a layer inside the fill', async () => {
    const { unmount } = await renderBars({ grain: 0 }, { grain: 0 })
    expect(page.getByTestId('planner-bar-grain').query()).toBeNull()
    await unmount()
    await renderBars({ grain: 40 }, { grain: 0 })
    const grain = page.getByTestId('planner-bar-grain').first().element() as HTMLElement
    expect(fills()[0]!.contains(grain)).toBe(true)
    expect(grain.style.opacity).toBe('0.4')
  })

  test('8. the percent label is outside the animated fill', async () => {
    await renderBars({ style: 'soft-aurora' })
    const label = page.getByText('25%').first().element()
    expect(fills().some((fill) => fill.contains(label))).toBe(false)
  })

  test('1. the two bars take their own colors', async () => {
    await renderBars({ fill: '#ff0000' }, { fill: '#0000ff' })
    const [four, deadline] = fills()
    expect(four!.style.getPropertyValue('--bar-fill')).toBe('rgba(255, 0, 0, 1)')
    expect(deadline!.style.getPropertyValue('--bar-fill')).toBe('rgba(0, 0, 255, 1)')
  })
})
