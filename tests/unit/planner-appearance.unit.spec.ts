import { describe, expect, it } from 'vitest'

import {
  BAR_STYLES,
  DEFAULT_BAR,
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
  GRAIN_DATA_URI,
  TYPE_SECTIONS,
  grainTilePx,
} from '@/features/planner/appearance'
import { FONTS } from '@/features/planner/font-list'

describe('story 025 · appearance', () => {
  it('2. the defaults are the site palette', () => {
    const a = defaultAppearance()
    expect(a.colors.header).toEqual({ color: '#1b1a17', opacity: 100 })
    expect(a.colors.done.color).toBe('#cdebd7')
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

describe('story 026 · background', () => {
  const photo = 'https://example.com/bg.jpg'

  it('9/8. keeps a valid image and drops anything else', () => {
    expect(parseAppearance({ background: { image: photo } }).background.image).toBe(photo)
    for (const bad of [
      'http://x/y.png',
      '//evil.example/y.png',
      'data:image/png;base64,iVBORw0KGgo=',
      'data:text/html;base64,AAAA',
      'data:image/svg+xml;base64,AAAA',
      42,
      null,
    ])
      expect(parseAppearance({ background: { image: bad } }).background.image).toBeNull()
    const huge = `https://example.com/${'a'.repeat(2000)}`
    expect(parseAppearance({ background: { image: huge } }).background.image).toBeNull()
  })

  it('5. clamps each effect to its range, independently', () => {
    const bg = parseAppearance({
      background: {
        blur: 99,
        brightness: 5,
        overlay: -250,
        grain: 50,
        grainSize: 12,
        mode: 'zoom',
      },
    }).background
    expect(bg).toMatchObject({
      blur: 0,
      brightness: 100,
      overlay: 0,
      grain: 50,
      grainSize: 12,
      mode: 'cover',
    })
    expect(
      parseAppearance({ background: { blur: 40, overlay: -100, brightness: 20 } }).background,
    ).toMatchObject({
      blur: 40,
      overlay: -100,
      brightness: 20,
    })
  })

  it('7. grain tile grows with the size setting', () => {
    expect(grainTilePx(1)).toBeLessThan(grainTilePx(12))
    expect(GRAIN_DATA_URI).toContain('feTurbulence')
  })

  it('defaults: transparent-capable color, no image, no grain, neutral effects', () => {
    expect(defaultAppearance().background).toEqual({
      color: '#fbfaf7',
      opacity: 100,
      image: null,
      mode: 'cover',
      blur: 0,
      brightness: 100,
      overlay: 0,
      grain: 0,
      grainSize: 3,
    })
  })
})

describe('story 027 · progress bars', () => {
  it('1/9. each bar has its own settings; an unknown style becomes No Animation', () => {
    expect(BAR_STYLES).toHaveLength(11)
    const a = parseAppearance({
      bars: {
        fourWeeks: { style: 'moonlight', grain: 0, fill: '#112233' },
        deadline: { style: 'sparkles', grain: 400 },
      },
    })
    expect(a.bars.fourWeeks).toMatchObject({ style: 'moonlight', grain: 0, fill: '#112233' })
    expect(a.bars.deadline.style).toBe('none')
    expect(a.bars.deadline.grain).toBe(DEFAULT_BAR.grain)
    expect(a.bars.fourWeeks.track).toBe(DEFAULT_BAR.track)
  })

  it('13. defaults: animated, restrained grain, fully opaque', () => {
    expect(defaultAppearance().bars.deadline).toEqual({
      style: 'ambient-flow',
      animate: true,
      fill: '#4f8a6a',
      track: '#e5e7eb',
      highlight: '#ffffff',
      opacity: 100,
      grain: 12,
      grainSize: 2,
    })
  })
})
