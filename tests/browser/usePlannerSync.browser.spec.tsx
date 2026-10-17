import { renderHook } from 'vitest-browser-react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { usePlannerSync } from '@/components/PlannerShell/usePlannerSync'

const refresh = vi.fn()
const revision = vi.fn()

vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('@/features/planner/actions', () => ({
  getPlannerRevisionAction: (input: unknown) => revision(input),
}))

const ok = (signature: string) => ({ status: 'success', signature })
const setVisibility = (value: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { value, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}
const tick = (ms: number) => vi.advanceTimersByTimeAsync(ms)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  refresh.mockReset()
  revision.mockReset()
  setVisibility('visible')
})
afterEach(() => vi.useRealTimers())

describe('usePlannerSync (story 032 · polling)', () => {
  test('7/8. polls every 5 s, refreshes only when the signature changes', async () => {
    revision.mockResolvedValue(ok('a'))
    const { result } = await renderHook(() => usePlannerSync(7))
    await tick(0)
    expect(revision).toHaveBeenCalledWith({ plannerId: 7 })
    await tick(5_000)
    expect(revision).toHaveBeenCalledTimes(2)
    expect(refresh).not.toHaveBeenCalled()
    revision.mockResolvedValue(ok('b'))
    await tick(5_000)
    expect(refresh).toHaveBeenCalledTimes(1)
    await expect.poll(() => result.current).toBe('ok')
  })

  test('7. a hidden tab is not polled; becoming visible checks at once', async () => {
    revision.mockResolvedValue(ok('a'))
    await renderHook(() => usePlannerSync(7))
    await tick(0)
    setVisibility('hidden')
    revision.mockClear()
    await tick(60_000)
    expect(revision).not.toHaveBeenCalled()
    revision.mockResolvedValue(ok('b'))
    setVisibility('visible')
    await tick(0)
    expect(revision).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  test('8. errors slow the poll to 30 s, flag offline, and recover by themselves', async () => {
    revision.mockResolvedValue({ status: 'error', error: 'server' })
    const { result } = await renderHook(() => usePlannerSync(7))
    await tick(0)
    await expect.poll(() => result.current).toBe('offline')
    revision.mockClear()
    await tick(29_000)
    expect(revision).not.toHaveBeenCalled()
    revision.mockResolvedValue(ok('a'))
    await tick(1_000)
    expect(revision).toHaveBeenCalledTimes(1)
    await expect.poll(() => result.current).toBe('ok')
    expect(refresh).not.toHaveBeenCalled()
  })
})
