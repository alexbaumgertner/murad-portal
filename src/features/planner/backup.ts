// Planner backup and import (story 028). Pure: no framework, no database, tested in unit.
// Reads our own format (schemaVersion 1) and the standalone HTML mock's `localStorage` state.
// Everything is validated and clamped; a damaged field falls back to its default, never throws.

import { z } from 'zod'

import {
  BAR_STYLES,
  DEFAULT_BAR,
  defaultAppearance,
  parseAppearance,
  type Appearance,
  type BarSetting,
  type BarStyle,
  type TypeSection,
} from './appearance'
import { isFontChoice, type FontChoice } from './font-list'
import { labelsSchema, type Labels } from './schema'
import {
  DAYS,
  MAX_DEADLINE_TITLE,
  MAX_HEADER_TEXT,
  MAX_LABEL,
  MAX_NOTE,
  MAX_ROWS,
  MAX_SUBTITLE,
  MAX_TASK_TEXT,
  NOTE_KINDS,
  isAssignedTask,
  isIsoDate,
  mondayOf,
} from './shape'

export const BACKUP_APP = 'murad-portal-planner'
export const BACKUP_VERSION = 1
export const MAX_WEEKS = 520
/** A backup file is refused above this many characters (an image is up to 1.2 M of it). */
export const MAX_BACKUP_CHARS = 3_500_000

export type BackupCell = { row: number; day: number; text: string; done: boolean }
export type BackupNote = { kind: (typeof NOTE_KINDS)[number]; day: number; text: string }
export type BackupWeek = {
  index: number
  rowCount: number
  cells: BackupCell[]
  notes: BackupNote[]
}
export type BackupSettings = {
  showWeekProgress: boolean
  showFourWeekProgress: boolean
  showDeadlineProgress: boolean
  deadlineTitle: string
  deadlineDate: string
}
export type PlannerData = {
  baseDate: string
  studentName: string
  goal: string
  subtitle: string
  labels: Labels
  settings: BackupSettings
  appearance: Appearance
  weeks: BackupWeek[]
}

export type Backup = {
  app: typeof BACKUP_APP
  schemaVersion: typeof BACKUP_VERSION
  exportedAt: string
  planner: PlannerData
}

export type BackupError = 'too_big' | 'invalid_json' | 'invalid_format' | 'unsupported_version'
export type ParseResult = { ok: true; data: PlannerData } | { ok: false; error: BackupError }

export const blankWeek = (index: number): BackupWeek => ({
  index,
  rowCount: 1,
  cells: [],
  notes: [],
})

export const blankSettings = (): BackupSettings => ({
  showWeekProgress: true,
  showFourWeekProgress: false,
  showDeadlineProgress: false,
  deadlineTitle: '',
  deadlineDate: '',
})

export const buildBackup = (planner: PlannerData, now = new Date()): Backup => ({
  app: BACKUP_APP,
  schemaVersion: BACKUP_VERSION,
  exportedAt: now.toISOString(),
  planner,
})

// ---- small coercions ----

const text = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.slice(0, max) : ''
const int = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback
}
const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

function cleanLabels(raw: unknown): Labels {
  const parsed = labelsSchema.partial().safeParse(record(raw))
  if (parsed.success) return parsed.data
  // Keep every label that is valid on its own.
  const out: Labels = {}
  for (const key of ['schedule', 'goal', 'exercises', 'questions'] as const) {
    const value = record(raw)[key]
    if (typeof value === 'string' && value.trim() !== '')
      out[key] = value.trim().slice(0, MAX_LABEL)
  }
  for (const key of ['days', 'diaryDays'] as const) {
    const value = record(raw)[key]
    if (Array.isArray(value) && value.length === DAYS)
      out[key] = value.map((item) => text(item, MAX_LABEL).trim())
  }
  return out
}

function cleanSettings(raw: unknown): BackupSettings {
  const r = record(raw)
  const date = typeof r.deadlineDate === 'string' && isIsoDate(r.deadlineDate) ? r.deadlineDate : ''
  return {
    showWeekProgress: r.showWeekProgress !== false,
    showFourWeekProgress: r.showFourWeekProgress === true,
    showDeadlineProgress: r.showDeadlineProgress === true,
    deadlineTitle: text(r.deadlineTitle, MAX_DEADLINE_TITLE).trim(),
    deadlineDate: date,
  }
}

function cleanWeek(raw: unknown, fallbackIndex: number): BackupWeek {
  const r = record(raw)
  const rowCount = int(r.rowCount, 1, MAX_ROWS, 1)
  const cells: BackupCell[] = []
  const seen = new Set<string>()
  for (const item of list(r.cells)) {
    const c = record(item)
    const inRange = (value: unknown, max: number) =>
      Number.isInteger(value) && (value as number) >= 0 && (value as number) <= max
    const row = inRange(c.row, rowCount - 1) ? (c.row as number) : -1
    const day = inRange(c.day, DAYS - 1) ? (c.day as number) : -1
    const body = text(c.text, MAX_TASK_TEXT)
    if (row < 0 || day < 0 || seen.has(`${row}-${day}`) || !isAssignedTask(body)) continue
    seen.add(`${row}-${day}`)
    cells.push({ row, day, text: body, done: isAssignedTask(body) && c.done === true })
  }
  const notes: BackupNote[] = []
  const seenNotes = new Set<string>()
  for (const item of list(r.notes)) {
    const n = record(item)
    const kind = NOTE_KINDS.find((k) => k === n.kind)
    const day =
      Number.isInteger(n.day) && (n.day as number) >= 0 && (n.day as number) <= DAYS - 1
        ? (n.day as number)
        : -1
    const body = text(n.text, MAX_NOTE)
    if (!kind || day < 0 || body.trim() === '' || seenNotes.has(`${kind}-${day}`)) continue
    seenNotes.add(`${kind}-${day}`)
    notes.push({ kind, day, text: body })
  }
  return { index: int(r.index, 0, MAX_WEEKS - 1, fallbackIndex), rowCount, cells, notes }
}

function cleanPlanner(raw: unknown): PlannerData | null {
  const r = record(raw)
  if (typeof r.baseDate !== 'string' || !isIsoDate(r.baseDate)) return null
  const weeks: BackupWeek[] = []
  const used = new Set<number>()
  list(r.weeks)
    .slice(0, MAX_WEEKS)
    .forEach((item, i) => {
      const week = cleanWeek(item, i)
      if (used.has(week.index)) return
      used.add(week.index)
      weeks.push(week)
    })
  if (weeks.length === 0) weeks.push(blankWeek(0))
  weeks.sort((a, b) => a.index - b.index)
  return {
    baseDate: mondayOf(r.baseDate),
    studentName: text(r.studentName, MAX_HEADER_TEXT).trim(),
    goal: text(r.goal, MAX_HEADER_TEXT).trim(),
    subtitle: text(r.subtitle, MAX_SUBTITLE).trim(),
    labels: cleanLabels(r.labels),
    settings: cleanSettings(r.settings),
    appearance: parseAppearance(r.appearance),
    weeks,
  }
}

// ---- the standalone HTML mock (docs/references/14102026) ----

const LEGACY_BAR_STYLE: Record<string, BarStyle> = {
  none: 'none',
  flow: 'ambient-flow',
  aurora: 'soft-aurora',
  mist: 'morning-mist',
  silk: 'silk-light',
  cloud: 'cloud-bloom',
  tide: 'slow-tide',
  velvet: 'velvet-breathing',
  film: 'film-grain',
  haze: 'grainy-haze',
  moonlight: 'moonlight',
  // Older, flashier presets the mock itself mapped to a calmer effect.
  liquid: 'ambient-flow',
  shimmer: 'silk-light',
  wave: 'slow-tide',
  stripes: 'soft-aurora',
  pulse: 'velvet-breathing',
  glow: 'velvet-breathing',
  gradient: 'soft-aurora',
  bubbles: 'cloud-bloom',
  scanline: 'moonlight',
  sparkle: 'film-grain',
}

const LEGACY_COLOR_KEY: Record<string, keyof Appearance['colors']> = {
  hero: 'header',
  strip: 'strip',
  priority: 'priority',
  done: 'done',
  accent: 'accent',
  paper: 'paper',
  ink: 'text',
  muted: 'textMuted',
}

const LEGACY_TYPE_SECTION: Record<string, TypeSection> = {
  ownerLabel: 'scheduleLabel',
  student: 'studentName',
  goal: 'goalText',
  weekMeta: 'weekInfo',
  subtitle: 'subtitle',
  dates: 'dates',
  days: 'weekdays',
  priorities: 'priority',
  tasks: 'tasks',
  notesTitles: 'diaryHeading',
  notesDays: 'diaryDay',
  notesText: 'diaryText',
  progressWeekly: 'progress',
}

const slugFont = (name: string): FontChoice | null => {
  const id = name.toLowerCase().replace(/\s+/g, '-')
  return isFontChoice(id) ? id : null
}

const DEFAULT_DAY_NAMES = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
]

function legacyBar(raw: unknown, fallback: BarSetting): BarSetting {
  const r = record(raw)
  const hexOr = (value: unknown, def: string) =>
    typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : def
  const style = typeof r.animation === 'string' ? LEGACY_BAR_STYLE[r.animation] : undefined
  return {
    ...fallback,
    style: style && BAR_STYLES.includes(style) ? style : fallback.style,
    fill: hexOr(r.fill, fallback.fill),
    track: hexOr(r.track, fallback.track),
    highlight: hexOr(r.highlight, fallback.highlight),
    grain: int(r.grain, 0, 100, fallback.grain),
  }
}

/** Migrates the mock's saved state (`sergei-week-planner-v2`, schema 5–8) into our model. */
export function fromLegacy(raw: Record<string, unknown>): PlannerData | null {
  if (typeof raw.baseDate !== 'string' || !isIsoDate(raw.baseDate) || !Array.isArray(raw.weeks))
    return null
  const global = record(raw.global)
  const appearance = defaultAppearance()

  const colors = record(raw.colors)
  const opacity = record(raw.colorOpacity)
  for (const [legacy, key] of Object.entries(LEGACY_COLOR_KEY)) {
    const color = colors[legacy]
    if (typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color))
      appearance.colors[key] = { color, opacity: int(opacity[legacy], 0, 100, 100) }
    else
      appearance.colors[key] = {
        ...appearance.colors[key],
        opacity: int(opacity[legacy], 0, 100, 100),
      }
  }

  const typography = record(raw.typography)
  for (const [legacy, section] of Object.entries(LEGACY_TYPE_SECTION)) {
    const t = record(typography[legacy])
    const base = appearance.type[section]
    appearance.type[section] = {
      font: typeof t.font === 'string' ? (slugFont(t.font) ?? 'default') : base.font,
      size: int(t.size, 9, 90, base.size),
      bold: typeof t.bold === 'boolean' ? t.bold : base.bold,
      italic: typeof t.italic === 'boolean' ? t.italic : base.italic,
    }
  }

  const bg = record(raw.background)
  const lighten = int(bg.lighten, 0, 100, 0)
  const darken = int(bg.darken, 0, 75, 0)
  appearance.background = {
    ...appearance.background,
    image: bg.mode === 'image' && typeof bg.image === 'string' ? bg.image : null,
    blur: int(bg.blur, 0, 40, 0),
    grain: int(bg.grain, 0, 100, 0),
    grainSize: int(bg.grainSize, 1, 12, 3),
    overlay: Math.max(-100, Math.min(100, lighten - darken)),
  }

  const progress = record(raw.progress)
  appearance.bars = {
    fourWeeks: legacyBar(progress.fourWeekStyle, DEFAULT_BAR),
    deadline: legacyBar(progress.deadlineStyle, DEFAULT_BAR),
  }

  const labels: Labels = {}
  const named = (value: unknown, fallback: string, max = MAX_LABEL) => {
    const v = text(value, max).trim()
    return v && v !== fallback ? v : null
  }
  const exercises = named(global.exerciseTitle, 'EXERCISES')
  const questions = named(global.questionTitle, 'QUESTIONS')
  const goalLabel = named(global.goalLabel, 'GOAL:')
  if (exercises) labels.exercises = exercises
  if (questions) labels.questions = questions
  if (goalLabel) labels.goal = goalLabel
  const dayNames = Array.from({ length: DAYS }, (_, i) =>
    text(list(global.dayHeaders)[i], MAX_LABEL).trim(),
  )
  if (dayNames.some((name, i) => name && name.toUpperCase() !== DEFAULT_DAY_NAMES[i]))
    labels.days = dayNames.map((name, i) =>
      name.toUpperCase() === DEFAULT_DAY_NAMES[i] ? '' : name,
    )
  const diaryNames = Array.from({ length: DAYS }, (_, i) =>
    text(list(global.noteDayLabels)[i], MAX_LABEL).trim(),
  )
  if (diaryNames.some((name, i) => name && name !== `${DEFAULT_DAY_NAMES[i]}:`))
    labels.diaryDays = diaryNames.map((name, i) =>
      name === `${DEFAULT_DAY_NAMES[i]}:` ? '' : name,
    )

  const weeks: BackupWeek[] = list(raw.weeks)
    .slice(0, MAX_WEEKS)
    .map((item, index) => {
      const week = record(item)
      const rows = Math.min(
        MAX_ROWS,
        Math.max(1, list(week.priorities).length || list(week.cells).length || 1),
      )
      const cells: BackupCell[] = []
      for (let row = 0; row < rows; row++)
        for (let day = 0; day < DAYS; day++) {
          const cell = record(list(list(week.cells)[row])[day])
          cells.push({ row, day, text: text(cell.text, MAX_TASK_TEXT), done: cell.done === true })
        }
      const notes: BackupNote[] = []
      const source = record(week.notes)
      for (const kind of NOTE_KINDS)
        for (let day = 0; day < DAYS; day++)
          notes.push({ kind, day, text: text(list(source[kind])[day], MAX_NOTE) })
      return { index, rowCount: rows, cells, notes }
    })

  const planner = cleanPlanner({
    baseDate: raw.baseDate,
    studentName: global.student,
    goal: global.goal,
    subtitle: global.subtitle,
    labels,
    settings: {
      showWeekProgress: progress.weekly,
      showFourWeekProgress: progress.fourWeek,
      showDeadlineProgress: progress.deadline,
      deadlineTitle: progress.deadlineName,
      deadlineDate: progress.deadlineDate,
    },
    appearance,
    weeks,
  })
  return planner
}

// ---- entry point ----

/** Reads a backup file's text: our format, or the mock's saved state. Nothing is trusted. */
export function parseBackup(source: string): ParseResult {
  if (source.length > MAX_BACKUP_CHARS) return { ok: false, error: 'too_big' }
  let raw: unknown
  try {
    raw = JSON.parse(source)
  } catch {
    return { ok: false, error: 'invalid_json' }
  }
  const root = record(raw)
  if (root.app === BACKUP_APP) {
    const version = z.number().int().safeParse(root.schemaVersion)
    if (!version.success) return { ok: false, error: 'invalid_format' }
    if (version.data > BACKUP_VERSION) return { ok: false, error: 'unsupported_version' }
    const planner = cleanPlanner(root.planner)
    return planner ? { ok: true, data: planner } : { ok: false, error: 'invalid_format' }
  }
  const legacy = fromLegacy(root)
  return legacy ? { ok: true, data: legacy } : { ok: false, error: 'invalid_format' }
}
