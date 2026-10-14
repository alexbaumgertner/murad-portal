// How a planner looks (stories 025–027): colors with real alpha, typography per section.
// Pure and framework-free: validated on the server, applied in the browser, tested in unit.
// Every field falls back to its default, so an old or damaged value can never break the page.

import { z } from 'zod'

import { FONT_IDS, isFontChoice, type FontChoice, type FontId } from './font-list'

export const APPEARANCE_VERSION = 1

// ---- colors ----

export const COLOR_KEYS = [
  'header',
  'strip',
  'priority',
  'done',
  'accent',
  'paper',
  'text',
  'textMuted',
  'grid',
] as const
export type ColorKey = (typeof COLOR_KEYS)[number]

/** The look of the original spreadsheet. */
export const DEFAULT_COLORS: Record<ColorKey, string> = {
  header: '#2b2d31',
  strip: '#6b6e75',
  priority: '#cfe0f3',
  done: '#7ed48f',
  accent: '#2563eb',
  paper: '#ffffff',
  text: '#1f2328',
  textMuted: '#6b7280',
  grid: '#d9dce1',
}

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/)
const colorSchema = (key: ColorKey) =>
  z
    .object({
      color: hex.catch(DEFAULT_COLORS[key]),
      opacity: z.number().min(0).max(100).catch(100),
    })
    .catch({ color: DEFAULT_COLORS[key], opacity: 100 })

// ---- typography ----

export const TYPE_SECTIONS = [
  'scheduleLabel',
  'studentName',
  'goalLabel',
  'goalText',
  'subtitle',
  'weekInfo',
  'dates',
  'weekdays',
  'priority',
  'tasks',
  'diaryHeading',
  'diaryDay',
  'diaryText',
  'progress',
] as const
export type TypeSection = (typeof TYPE_SECTIONS)[number]

export const MIN_SIZE = 9
export const MAX_SIZE = 90

export type TypeSetting = { font: FontChoice; size: number; bold: boolean; italic: boolean }

/** Sizes and weights match the stylesheet, so the defaults change nothing visible. */
export const DEFAULT_TYPE: Record<TypeSection, TypeSetting> = {
  scheduleLabel: { font: 'default', size: 22, bold: true, italic: false },
  studentName: { font: 'default', size: 22, bold: true, italic: false },
  goalLabel: { font: 'default', size: 16, bold: false, italic: false },
  goalText: { font: 'default', size: 40, bold: true, italic: false },
  subtitle: { font: 'default', size: 13, bold: false, italic: false },
  weekInfo: { font: 'default', size: 13, bold: false, italic: false },
  dates: { font: 'default', size: 12, bold: false, italic: false },
  weekdays: { font: 'default', size: 13, bold: true, italic: false },
  priority: { font: 'default', size: 16, bold: true, italic: false },
  tasks: { font: 'default', size: 14, bold: false, italic: false },
  diaryHeading: { font: 'default', size: 14, bold: true, italic: false },
  diaryDay: { font: 'default', size: 12, bold: false, italic: false },
  diaryText: { font: 'default', size: 15, bold: false, italic: false },
  progress: { font: 'default', size: 14, bold: false, italic: false },
}

const typeSchema = (section: TypeSection) => {
  const base = DEFAULT_TYPE[section]
  return z
    .object({
      font: z
        .string()
        .refine(isFontChoice)
        .transform((value) => value as FontChoice)
        .catch(base.font),
      size: z.number().min(MIN_SIZE).max(MAX_SIZE).catch(base.size),
      bold: z.boolean().catch(base.bold),
      italic: z.boolean().catch(base.italic),
    })
    .catch({ ...base })
}

// ---- whole appearance ----

const colorsShape = Object.fromEntries(COLOR_KEYS.map((key) => [key, colorSchema(key)])) as {
  [K in ColorKey]: ReturnType<typeof colorSchema>
}
const typeShape = Object.fromEntries(TYPE_SECTIONS.map((key) => [key, typeSchema(key)])) as {
  [K in TypeSection]: ReturnType<typeof typeSchema>
}

export const appearanceSchema = z.object({
  v: z.literal(APPEARANCE_VERSION).catch(APPEARANCE_VERSION),
  colors: z.object(colorsShape).catch(() => defaultColors()),
  type: z.object(typeShape).catch(() => defaultType()),
})
export type ColorSetting = { color: string; opacity: number }
export type Appearance = {
  v: typeof APPEARANCE_VERSION
  colors: Record<ColorKey, ColorSetting>
  type: Record<TypeSection, TypeSetting>
}

function defaultColors(): Record<ColorKey, ColorSetting> {
  return Object.fromEntries(
    COLOR_KEYS.map((key) => [key, { color: DEFAULT_COLORS[key], opacity: 100 }]),
  ) as Record<ColorKey, ColorSetting>
}
function defaultType(): Record<TypeSection, TypeSetting> {
  return Object.fromEntries(TYPE_SECTIONS.map((key) => [key, { ...DEFAULT_TYPE[key] }])) as Record<
    TypeSection,
    TypeSetting
  >
}

export const defaultAppearance = (): Appearance => ({
  v: APPEARANCE_VERSION,
  colors: defaultColors(),
  type: defaultType(),
})

/** Reads whatever is stored: anything unknown or damaged becomes the default for that field. */
export const parseAppearance = (raw: unknown): Appearance => {
  const input = typeof raw === 'object' && raw !== null ? { ...(raw as object) } : {}
  const parsed = appearanceSchema.safeParse(input)
  return parsed.success ? (parsed.data as Appearance) : defaultAppearance()
}

// ---- actions on typography and colors (scenario H) ----

/** Changes the font family of every section; sizes, bold and italic stay as they are. */
export const applyFontToAll = (appearance: Appearance, font: FontChoice): Appearance => ({
  ...appearance,
  type: Object.fromEntries(
    TYPE_SECTIONS.map((key) => [key, { ...appearance.type[key], font }]),
  ) as Appearance['type'],
})

/** Puts the original font back everywhere, again leaving sizes, bold and italic alone. */
export const restoreOriginalFonts = (appearance: Appearance): Appearance =>
  applyFontToAll(appearance, 'default')

export const resetTypography = (appearance: Appearance): Appearance => ({
  ...appearance,
  type: defaultType(),
})

export const resetColors = (appearance: Appearance): Appearance => ({
  ...appearance,
  colors: defaultColors(),
})

// ---- rendering ----

export const rgba = (color: string, opacity: number): string => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16))
  return `rgba(${r}, ${g}, ${b}, ${Math.round(opacity) / 100})`
}

const luminance = (color: string): number => {
  const channel = (i: number) => {
    const value = parseInt(color.slice(i, i + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

export const contrastRatio = (a: string, b: string): number => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (light + 0.05) / (dark + 0.05)
}

/** Readability warnings; the user may keep a bad pair, we only say so. */
export function contrastWarnings(colors: Appearance['colors']): ColorKey[] {
  const warn: ColorKey[] = []
  for (const key of ['text', 'textMuted'] as const) {
    const { color, opacity } = colors[key]
    if (opacity < 40 || contrastRatio(color, colors.paper.color) < 3) warn.push(key)
  }
  return warn
}

export type FontResolver = (font: FontId) => string

/**
 * CSS custom properties for the sheet. `resolve` maps a font id to its CSS family (the loaders in
 * `fonts.ts`); the portal's own font is `inherit`.
 */
export function appearanceVars(
  appearance: Appearance,
  resolve: FontResolver,
): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const key of COLOR_KEYS) {
    const { color, opacity } = appearance.colors[key]
    vars[`--pl-${key}`] = rgba(color, opacity)
  }
  for (const key of TYPE_SECTIONS) {
    const { font, size, bold, italic } = appearance.type[key]
    vars[`--pl-t-${key}-font`] = font === 'default' ? 'inherit' : resolve(font)
    vars[`--pl-t-${key}-size`] = `${size}px`
    vars[`--pl-t-${key}-weight`] = bold ? '700' : '400'
    vars[`--pl-t-${key}-style`] = italic ? 'italic' : 'normal'
  }
  return vars
}

export { FONT_IDS }
