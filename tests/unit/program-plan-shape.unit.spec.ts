import { describe, expect, it } from 'vitest'

import {
  copySummary,
  levelWithinProgram,
  messages,
  planWeekCopy,
} from '@/features/program-plan/shape'

describe('program plan rules (story 010)', () => {
  it('keeps a task level inside the program range, ends included', () => {
    expect(levelWithinProgram('B1', 'B1', 'B2')).toBe(true)
    expect(levelWithinProgram('B2', 'B1', 'B2')).toBe(true)
    expect(levelWithinProgram('A1', 'B1', 'B2')).toBe(false)
    expect(levelWithinProgram('C1', 'B1', 'B2')).toBe(false)
  })

  it('words the level mismatch like the story', () => {
    expect(messages.levelOutside('A1', 'B1', 'B2')).toBe(
      'Уровень задания (A1) вне программы B1 → B2',
    )
    expect(messages.dayFull).toBe('В дне не больше 3 заданий')
    expect(messages.weeksAfter(40)).toBe('Есть задания после недели 40: удали их сначала')
  })

  it('3. copies into free places only and counts what it skipped', () => {
    const source = [
      { week: 1, day: 1, order: 1, task: 10 },
      { week: 1, day: 1, order: 2, task: 11 },
      { week: 1, day: 5, order: 1, task: 12 },
    ]
    const occupied = new Set(['2:1:1', '3:5:1'])
    const { create, skipped } = planWeekCopy(source, [2, 3], occupied)
    expect(skipped).toBe(2)
    expect(create).toEqual([
      { week: 2, day: 1, order: 2, task: 11 },
      { week: 2, day: 5, order: 1, task: 12 },
      { week: 3, day: 1, order: 1, task: 10 },
      { week: 3, day: 1, order: 2, task: 11 },
    ])
    expect(copySummary(6, 2)).toBe('Скопировано: 6, пропущено (занято): 2')
  })
})
