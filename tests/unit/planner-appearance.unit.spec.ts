import { describe, expect, it } from 'vitest'

import {
  appearanceVars,
  applyFontToAll,
  contrastRatio,
  contrastWarnings,
  defaultAppearance,
  parseAppearance,
  resetColors,
  resetTypography,
  restoreOriginalFonts,
  rgba,
  DEFAULT_COLORS,
  TYPE_SECTIONS,
} from '@/features/planner/appearance'
import { FONTS } from '@/features/planner/font-list'

describe('story 025 · appearance', () => {
  it('2. the defaults are the original spreadsheet look', () => {
    const a = defaultAppearance()
    expect(a.colors.header).toEqual({ color: '#2b2d31', opacity: 100 })
    expect(a.colors.done.color).toBe('#7ed48f')
    expect(a.type.tasks.font).toBe('default')
  })

  it('1. applies real alpha, not a blend with white', () => {
    expect(rgba('#ff0000', 75)).toBe('rgba(255, 0, 0, 0.75)')
    const a = defaultAppearance()
    a.colors.paper = { color: '#ffffff', opacity: 85 }
    const vars = appearanceVars(a, () => 'x')
    expect(vars['--pl-paper']).toBe('rgba(255, 255, 255, 0.85)')
    expect(vars['--pl-t-tasks-font']).toBe('inherit')
  })

  it('3. resets colors only', () => {
    const a = defaultAppearance()
    a.colors.header = { color: '#112233', opacity: 40 }
    a.type.tasks.size = 30
    const reset = resetColors(a)
    expect(reset.colors).toEqual(defaultAppearance().colors)
    expect(reset.type.tasks.size).toBe(30)
  })

  it('4. offers 30+ fonts in three groups, each with a distinct id', () => {
    expect(FONTS.length).toBeGreaterThanOrEqual(30)
    expect(new Set(FONTS.map((f) => f.id)).size).toBe(FONTS.length)
    expect(new Set(FONTS.map((f) => f.category))).toEqual(new Set(['sans', 'serif', 'expressive']))
  })

  it('5. has the 14 sections with 9–90 px sizes', () => {
    expect(TYPE_SECTIONS).toHaveLength(14)
    expect(parseAppearance({ type: { tasks: { size: 5 } } }).type.tasks.size).toBe(14)
    expect(parseAppearance({ type: { tasks: { size: 90 } } }).type).toBeDefined()
  })

  it('6/7. global font keeps sizes, bold, italic; restore and reset are distinct (scenario H)', () => {
    let a = defaultAppearance()
    a.type.tasks = { font: 'default', size: 31, bold: true, italic: true }
    a.type.goalText.size = 64
    a = applyFontToAll(a, 'lora')
    expect(a.type.tasks).toEqual({ font: 'lora', size: 31, bold: true, italic: true })
    expect(a.type.goalText).toMatchObject({ font: 'lora', size: 64, bold: true })
    a.type.priority.font = 'caveat'
    const restored = restoreOriginalFonts(a)
    expect(restored.type.tasks).toEqual({ font: 'default', size: 31, bold: true, italic: true })
    expect(restored.type.priority.font).toBe('default')
    expect(resetTypography(a).type).toEqual(defaultAppearance().type)
    expect(applyFontToAll(a, 'lobster').type.tasks.size).toBe(31) // still editable afterwards
  })

  it('10. damaged storage falls back field by field', () => {
    expect(parseAppearance(null)).toEqual(defaultAppearance())
    expect(parseAppearance('nope')).toEqual(defaultAppearance())
    const parsed = parseAppearance({
      colors: { header: { color: 'red', opacity: 500 }, done: { color: '#00ff00', opacity: 50 } },
      type: { tasks: { font: 'comic-sans', size: 'big', bold: 1, italic: true } },
      unknown: true,
    })
    expect(parsed.colors.header).toEqual({ color: DEFAULT_COLORS.header, opacity: 100 })
    expect(parsed.colors.done).toEqual({ color: '#00ff00', opacity: 50 })
    expect(parsed.type.tasks).toEqual({ font: 'default', size: 14, bold: false, italic: true })
  })

  it('9. warns on unreadable text, never blocks', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21)
    expect(contrastWarnings(defaultAppearance().colors)).toEqual([])
    const a = defaultAppearance()
    a.colors.text = { color: '#eeeeee', opacity: 100 }
    a.colors.textMuted = { color: '#6b7280', opacity: 20 }
    expect(contrastWarnings(a.colors)).toEqual(['text', 'textMuted'])
  })
})
