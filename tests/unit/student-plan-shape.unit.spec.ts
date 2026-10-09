import { describe, expect, it } from 'vitest'

import {
  editKind,
  groupWeek,
  taskText,
  weekOfDay,
  type PlanItemView,
} from '@/features/student-plan/shape'

describe('personal plan rules (story 018)', () => {
  it('3. a new pool task wins, a changed text makes the task «своё», nothing else keeps it', () => {
    const original = { sourceTask: 5, text: { ru: 'Отзыв', en: null } }
    expect(editKind(original, { sourceTask: 7 })).toBe('pool')
    expect(editKind(original, { sourceTask: 7, text: { ru: 'Отзыв' } })).toBe('pool')
    expect(editKind(original, { text: { ru: 'Своё задание' } })).toBe('custom')
    expect(editKind(original, { sourceTask: 5, text: { ru: 'Отзыв', en: 'Review' } })).toBe(
      'custom',
    )
    expect(editKind(original, { sourceTask: { id: 5 }, text: { ru: 'Отзыв', en: null } })).toBe(
      'same',
    )
    expect(editKind(original, { week: 4 })).toBe('same')
    expect(editKind(original, { sourceTask: null })).toBe('custom')
  })

  it('4. finds the program week of a program day', () => {
    expect(weekOfDay(1)).toBe(1)
    expect(weekOfDay(7)).toBe(1)
    expect(weekOfDay(8)).toBe(2)
    expect(weekOfDay(10)).toBe(2)
    expect(weekOfDay(364)).toBe(52)
  })

  it('shows Murad’s English text in English, the Russian one otherwise', () => {
    expect(taskText({ ru: 'Отзыв', en: 'Review' }, 'en')).toBe('Review')
    expect(taskText({ ru: 'Отзыв', en: '  ' }, 'en')).toBe('Отзыв')
    expect(taskText({ ru: 'Отзыв', en: 'Review' }, 'ru')).toBe('Отзыв')
  })

  it('7. lays one week out as 7 days, empty days included, tasks in order', () => {
    const items: PlanItemView[] = [
      { id: 2, day: 2, order: 2, text: 'b' },
      { id: 1, day: 2, order: 1, text: 'a' },
      { id: 3, day: 7, order: 1, text: 'c' },
    ]
    const days = groupWeek(items, 3)
    expect(days).toHaveLength(7)
    expect(days[0]).toEqual({ day: 1, programDay: 15, tasks: [] })
    expect(days[1]?.tasks.map((task) => task.text)).toEqual(['a', 'b'])
    expect(days[6]).toMatchObject({ day: 7, programDay: 21 })
    expect(groupWeek([], 1).every((day) => day.tasks.length === 0)).toBe(true)
  })
})
