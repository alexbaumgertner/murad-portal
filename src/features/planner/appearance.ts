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

/** The site's own palette (globals.css tokens), so a fresh planner looks like the rest of the portal. */
export const DEFAULT_COLORS: Record<ColorKey, string> = {
  header: '#1b1a17',
  strip: '#6b675e',
  priority: '#f3f1ec',
  done: '#cdebd7',
  accent: '#e8590c',
  paper: '#ffffff',
  text: '#1b1a17',
  textMuted: '#6b675e',
  grid: '#e6e2d9',
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

// ---- background (story 026) ----

export const BACKGROUND_MODES = ['cover', 'contain', 'center', 'fit'] as const
export type BackgroundMode = (typeof BACKGROUND_MODES)[number]

export type Background = {
  color: string
  opacity: number
  /** `https://…` or `/…` URL of a hosted picture, or null. There is no upload yet: `data:` URLs are dropped. */
  image: string | null
  mode: BackgroundMode
  /** px, 0–40 */
  blur: number
  /** percent, 20–150 (100 = unchanged) */
  brightness: number
  /** −100 (darkest) … +100 (lightest): ONE control, so darkening and lightening never contradict. */
  overlay: number
  /** 0–100; 0 renders no grain layer at all. */
  grain: number
  /** 1–12 */
  grainSize: number
}

export const DEFAULT_BACKGROUND: Background = {
  color: '#fbfaf7',
  opacity: 100,
  image: null,
  mode: 'cover',
  blur: 0,
  brightness: 100,
  overlay: 0,
  grain: 0,
  grainSize: 3,
}

/** A URL, never the picture itself: the appearance JSON is sent on every save. */
const MAX_IMAGE_URL = 2000
const IMAGE_PATTERN = /^(?:https:\/\/|\/(?!\/))\S+$/

export const isStoredImage = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= MAX_IMAGE_URL && IMAGE_PATTERN.test(value)

const num = (min: number, max: number, fallback: number) =>
  z.number().min(min).max(max).catch(fallback)

const backgroundSchema = z
  .object({
    color: hex.catch(DEFAULT_BACKGROUND.color),
    opacity: num(0, 100, DEFAULT_BACKGROUND.opacity),
    image: z
      .unknown()
      .transform((value) => (isStoredImage(value) ? value : null))
      .catch(null),
    mode: z.enum(BACKGROUND_MODES).catch(DEFAULT_BACKGROUND.mode),
    blur: num(0, 40, DEFAULT_BACKGROUND.blur),
    brightness: num(20, 150, DEFAULT_BACKGROUND.brightness),
    overlay: num(-100, 100, DEFAULT_BACKGROUND.overlay),
    grain: num(0, 100, DEFAULT_BACKGROUND.grain),
    grainSize: num(1, 12, DEFAULT_BACKGROUND.grainSize),
  })
  .catch(() => ({ ...DEFAULT_BACKGROUND }))

/**
 * A tileable film-grain texture (SVG turbulence, gray, fully opaque). Meant for `mix-blend-mode:
 * overlay`, where mid-gray changes nothing and the noise adds fine light and dark speckle.
 */
export const GRAIN_DATA_URI =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n' x='0' y='0' width='100%25' height='100%25'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 0 0 0 0 1'/></filter><rect width='200' height='200' filter='url(%23n)'/></svg>\")"

/** Grain tile size in px: size 1 is the native 200 px tile, 12 stretches it to 2400 px (coarse). */
export const grainTilePx = (size: number) => Math.round(200 * size)

// ---- progress bars (story 027) ----

export const BAR_STYLES = [
  'none',
  'ambient-flow',
  'soft-aurora',
  'morning-mist',
  'silk-light',
  'cloud-bloom',
  'slow-tide',
  'velvet-breathing',
  'film-grain',
  'grainy-haze',
  'moonlight',
] as const
export type BarStyle = (typeof BAR_STYLES)[number]
export const BAR_KEYS = ['fourWeeks', 'deadline'] as const
export type BarKey = (typeof BAR_KEYS)[number]

export type BarSetting = {
  style: BarStyle
  /** Master switch: off keeps the style chosen but stops all movement. */
  animate: boolean
  fill: string
  track: string
  highlight: string
  /** Opacity of the fill and its highlight, 0–100. */
  opacity: number
  /** 0–100; 0 is perfectly smooth (no grain layer). */
  grain: number
  /** 1–12 */
  grainSize: number
}

export const DEFAULT_BAR: BarSetting = {
  style: 'ambient-flow',
  animate: true,
  fill: '#4f8a6a',
  track: '#e5e7eb',
  highlight: '#ffffff',
  opacity: 100,
  grain: 12,
  grainSize: 2,
}

const barSchema = z
  .object({
    style: z.enum(BAR_STYLES).catch('none'),
    animate: z.boolean().catch(DEFAULT_BAR.animate),
    fill: hex.catch(DEFAULT_BAR.fill),
    track: hex.catch(DEFAULT_BAR.track),
    highlight: hex.catch(DEFAULT_BAR.highlight),
    opacity: num(0, 100, DEFAULT_BAR.opacity),
    grain: num(0, 100, DEFAULT_BAR.grain),
    grainSize: num(1, 12, DEFAULT_BAR.grainSize),
  })
  .catch(() => ({ ...DEFAULT_BAR }))

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
  background: backgroundSchema,
  bars: z
    .object({ fourWeeks: barSchema, deadline: barSchema })
    .catch(() => ({ fourWeeks: { ...DEFAULT_BAR }, deadline: { ...DEFAULT_BAR } })),
})
export type ColorSetting = { color: string; opacity: number }
export type Appearance = {
  v: typeof APPEARANCE_VERSION
  colors: Record<ColorKey, ColorSetting>
  type: Record<TypeSection, TypeSetting>
  background: Background
  bars: Record<BarKey, BarSetting>
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
  background: { ...DEFAULT_BACKGROUND },
  bars: { fourWeeks: { ...DEFAULT_BAR }, deadline: { ...DEFAULT_BAR } },
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
