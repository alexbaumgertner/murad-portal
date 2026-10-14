import { describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'

import { PlannerBackground } from '@/components/PlannerBackground/PlannerBackground'
import { DEFAULT_BACKGROUND, type Background } from '@/features/planner/appearance'

const png = 'data:image/png;base64,iVBORw0KGgo='
const show = (patch: Partial<Background>) =>
  render(<PlannerBackground background={{ ...DEFAULT_BACKGROUND, ...patch }} />)

describe('PlannerBackground (story 026)', () => {
  test('1/10. color keeps its own alpha, so the image can show through', async () => {
    const { container } = await show({ color: '#ff0000', opacity: 40 })
    expect((container.firstElementChild as HTMLElement).style.backgroundColor).toBe(
      'rgba(255, 0, 0, 0.4)',
    )
  })

  test('7. grain 0 renders no grain layer; no effects means no extra layers', async () => {
    await show({ image: png })
    expect(page.getByTestId('planner-bg-grain').query()).toBeNull()
    expect(page.getByTestId('planner-bg-overlay').query()).toBeNull()
    expect(page.getByTestId('planner-bg-image').query()).not.toBeNull()
  })

  test('5. blur and brightness are on the image layer only', async () => {
    await show({ image: png, blur: 12, brightness: 80 })
    const image = page.getByTestId('planner-bg-image').element() as HTMLElement
    expect(image.style.filter).toBe('blur(12px) brightness(80%)')
    expect(image.style.inset).toBe('-24px')
  })

  test('5. one overlay slider: negative darkens, positive lightens', async () => {
    const { rerender } = await show({ overlay: -40 })
    expect(
      (page.getByTestId('planner-bg-overlay').element() as HTMLElement).style.backgroundColor,
    ).toBe('rgba(0, 0, 0, 0.4)')
    await rerender(<PlannerBackground background={{ ...DEFAULT_BACKGROUND, overlay: 25 }} />)
    expect(
      (page.getByTestId('planner-bg-overlay').element() as HTMLElement).style.backgroundColor,
    ).toBe('rgba(255, 255, 255, 0.25)')
  })

  test('6. every layer is decoration: hidden from assistive tech and out of the way of clicks', async () => {
    const { container } = await show({ image: png, grain: 50, overlay: 10 })
    const stack = container.firstElementChild as HTMLElement
    expect(stack.getAttribute('aria-hidden')).toBe('true')
    expect(getComputedStyle(stack).pointerEvents).toBe('none')
    expect(getComputedStyle(page.getByTestId('planner-bg-grain').element()).mixBlendMode).toBe(
      'overlay',
    )
  })
})
