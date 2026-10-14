import { describe, expect, it } from 'vitest'

import { defaultAppearance } from '@/features/planner/appearance'
import {
  BACKUP_VERSION,
  buildBackup,
  parseBackup,
  type PlannerData,
} from '@/features/planner/backup'

const sample = (): PlannerData => {
  const appearance = defaultAppearance()
  appearance.colors.header = { color: '#112233', opacity: 70 }
  appearance.type.tasks = { font: 'lora', size: 18, bold: true, italic: true }
  appearance.background = {
    ...appearance.background,
    image: 'https://example.com/bg.jpg',
    blur: 9,
    overlay: -20,
  }
  appearance.bars.deadline = { ...appearance.bars.deadline, style: 'moonlight', grain: 0 }
  return {
    baseDate: '2026-10-12',
    studentName: 'Анна',
    goal: 'IELTS 7.5',
    subtitle: 'ACADEMIC',
    labels: { exercises: 'HOMEWORK', days: ['Пн', '', '', '', '', '', ''] },
    settings: {
      showWeekProgress: false,
      showFourWeekProgress: true,
      showDeadlineProgress: true,
      deadlineTitle: 'IELTS EXAM',
      deadlineDate: '2026-12-20',
    },
    appearance,
    weeks: [
      {
        index: 0,
        rowCount: 3,
        cells: [
          { row: 0, day: 0, text: 'ANKI', done: true },
          { row: 2, day: 6, text: 'Читать 20 страниц', done: false },
        ],
        notes: [{ kind: 'exercises', day: 1, text: 'Unit 4\nex. 3' }],
      },
      { index: 3, rowCount: 1, cells: [], notes: [] },
    ],
  }
}

// The state shape of the standalone mock, as saved in localStorage ('sergei-week-planner-v2').
const legacyState = () => ({
  baseDate: '2026-10-12',
  active: 1,
  colors: {
    hero: '#383838',
    strip: '#666666',
    priority: '#709ee8',
    done: '#00ee25',
    accent: '#598ff0',
    paper: '#ffffff',
    ink: '#292929',
    muted: '#797979',
  },
  colorOpacity: {
    hero: 80,
    strip: 100,
    priority: 100,
    done: 75,
    accent: 100,
    paper: 85,
    ink: 100,
    muted: 100,
  },
  background: {
    mode: 'image',
    image: 'data:image/jpeg;base64,/9j/4AAQ',
    imageName: 'a.jpg',
    blur: 12,
    grain: 30,
    grainSize: 4,
    darken: 20,
    lighten: 0,
  },
  progress: {
    weekly: true,
    fourWeek: true,
    deadline: true,
    fourWeekStyle: {
      fill: '#598ff0',
      track: '#e4e7ed',
      highlight: '#ffffff',
      animation: 'aurora',
      grain: 10,
    },
    deadlineStyle: {
      fill: '#6087b9',
      track: '#e4e7ed',
      highlight: '#ffffff',
      animation: 'bubbles',
      grain: 0,
    },
    deadlineName: 'B2 FIRST',
    deadlineDate: '2026-12-20',
  },
  typography: {
    tasks: { font: 'Lora', size: 20, bold: true, italic: false },
    goal: { font: 'Comic Sans', size: 70 },
  },
  global: {
    ownerLabel: 'NAME:',
    student: 'Анна',
    goalLabel: 'GOAL:',
    goal: 'B2 EXAM',
    subtitle: 'CAMBRIDGE FIRST FOR SCHOOLS',
    exerciseTitle: 'EXERCISES',
    questionTitle: 'ВОПРОСЫ',
    dayHeaders: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
    noteDayLabels: [
      'MONDAY:',
      'TUESDAY:',
      'WEDNESDAY:',
      'THURSDAY:',
      'FRIDAY:',
      'SATURDAY:',
      'SUNDAY:',
    ],
  },
  weeks: [
    {
      priorities: ['I', 'II'],
      cells: [
        [
          { text: 'ANKI', done: true },
          { text: '', done: true },
          { text: '-', done: true },
          { text: '', done: false },
          { text: '', done: false },
          { text: '', done: false },
          { text: '', done: false },
        ],
        [
          { text: '', done: false },
          { text: 'TV SHOW', done: false },
          { text: '', done: false },
          { text: '', done: false },
          { text: '', done: false },
          { text: '', done: false },
          { text: 'Podcast', done: true },
        ],
      ],
      notes: {
        exercises: ['Unit 1', '', '', '', '', '', ''],
        questions: ['', '', 'Why?', '', '', '', ''],
      },
    },
    {
      priorities: ['I'],
      cells: [Array.from({ length: 7 }, () => ({ text: '', done: false }))],
      notes: { exercises: Array(7).fill(''), questions: Array(7).fill('') },
    },
  ],
})

describe('story 028 · backup', () => {
  it('1/2. a backup round-trips the whole planner', () => {
    const json = JSON.stringify(buildBackup(sample(), new Date('2026-10-14T10:00:00Z')))
    const parsed = parseBackup(json)
    expect(parsed).toEqual({ ok: true, data: sample() })
    const file = JSON.parse(json)
    expect(file).toMatchObject({
      app: 'murad-portal-planner',
      schemaVersion: BACKUP_VERSION,
      exportedAt: '2026-10-14T10:00:00.000Z',
    })
  })

  it('3. migrates the mock state: tasks, ticks, notes, header, colors, background, bars, deadline', () => {
    const parsed = parseBackup(JSON.stringify(legacyState()))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const d = parsed.data
    expect(d).toMatchObject({
      baseDate: '2026-10-12',
      studentName: 'Анна',
      goal: 'B2 EXAM',
      subtitle: 'CAMBRIDGE FIRST FOR SCHOOLS',
    })
    expect(d.labels).toEqual({ questions: 'ВОПРОСЫ' }) // untouched defaults are not copied
    expect(d.settings).toEqual({
      showWeekProgress: true,
      showFourWeekProgress: true,
      showDeadlineProgress: true,
      deadlineTitle: 'B2 FIRST',
      deadlineDate: '2026-12-20',
    })
    expect(d.weeks.map((w) => [w.index, w.rowCount])).toEqual([
      [0, 2],
      [1, 1],
    ])
    expect(d.weeks[0]!.cells).toEqual([
      { row: 0, day: 0, text: 'ANKI', done: true },
      { row: 1, day: 1, text: 'TV SHOW', done: false },
      { row: 1, day: 6, text: 'Podcast', done: true },
    ]) // blank and "-" cells are dropped, their ticks with them
    expect(d.weeks[0]!.notes).toEqual([
      { kind: 'exercises', day: 0, text: 'Unit 1' },
      { kind: 'questions', day: 2, text: 'Why?' },
    ])
    expect(d.appearance.colors.header).toEqual({ color: '#383838', opacity: 80 })
    expect(d.appearance.colors.text.color).toBe('#292929')
    expect(d.appearance.colors.paper.opacity).toBe(85)
    expect(d.appearance.type.tasks).toMatchObject({ font: 'lora', size: 20, bold: true })
    expect(d.appearance.type.goalText).toMatchObject({ font: 'default', size: 70 }) // unknown font → original
    expect(d.appearance.background).toMatchObject({
      image: null, // the mock's picture is a data URL: not imported, there is no upload yet
      blur: 12,
      grain: 30,
      grainSize: 4,
      overlay: -20,
    })
    expect(d.appearance.bars.fourWeeks).toMatchObject({ style: 'soft-aurora', grain: 10 })
    expect(d.appearance.bars.deadline.style).toBe('cloud-bloom')
  })

  it('4. malformed input is refused with a code and never throws', () => {
    expect(parseBackup('not json')).toEqual({ ok: false, error: 'invalid_json' })
    expect(parseBackup('[]')).toEqual({ ok: false, error: 'invalid_format' })
    expect(parseBackup('{}')).toEqual({ ok: false, error: 'invalid_format' })
    expect(parseBackup(JSON.stringify({ baseDate: '2026-02-30', weeks: [] }))).toEqual({
      ok: false,
      error: 'invalid_format',
    })
    expect(parseBackup('x'.repeat(3_600_000))).toEqual({ ok: false, error: 'too_big' })
    expect(
      parseBackup(
        JSON.stringify({ app: 'murad-portal-planner', schemaVersion: 'one', planner: {} }),
      ),
    ).toEqual({ ok: false, error: 'invalid_format' })
  })

  it('4. clamps and drops bad values instead of failing', () => {
    const file = {
      app: 'murad-portal-planner',
      schemaVersion: 1,
      planner: {
        baseDate: '2026-10-14', // a Wednesday → its Monday
        studentName: 'x'.repeat(500),
        weeks: [
          {
            index: 2,
            rowCount: 999,
            cells: [
              { row: 0, day: 0, text: 'ok', done: true },
              { row: 0, day: 0, text: 'duplicate', done: false },
              { row: 99, day: 0, text: 'bad row' },
              { row: 0, day: 9, text: 'bad day' },
              { row: 1, day: 1, text: '   ', done: true },
              { row: 1, day: 2, text: 'x'.repeat(900), done: true },
            ],
            notes: [
              { kind: 'weird', day: 0, text: 'x' },
              { kind: 'questions', day: 3, text: 'fine' },
            ],
          },
          { index: 2, rowCount: 5 },
        ],
        appearance: { colors: 'nope', type: { tasks: { size: 1 } } },
        settings: { deadlineDate: 'tomorrow', deadlineTitle: 5 },
      },
    }
    const parsed = parseBackup(JSON.stringify(file))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.data.baseDate).toBe('2026-10-12')
    expect(parsed.data.studentName).toHaveLength(80)
    expect(parsed.data.weeks).toHaveLength(1) // the duplicate index is dropped
    const week = parsed.data.weeks[0]!
    expect(week.rowCount).toBe(40)
    expect(week.cells.map((c) => [c.row, c.day, c.text.length, c.done])).toEqual([
      [0, 0, 2, true],
      [1, 2, 500, true],
    ])
    expect(week.notes).toEqual([{ kind: 'questions', day: 3, text: 'fine' }])
    expect(parsed.data.appearance).toEqual(defaultAppearance())
    expect(parsed.data.settings.deadlineDate).toBe('')
  })

  it('8. a backup from a newer version is refused', () => {
    const file = {
      app: 'murad-portal-planner',
      schemaVersion: BACKUP_VERSION + 1,
      planner: sample(),
    }
    expect(parseBackup(JSON.stringify(file))).toEqual({ ok: false, error: 'unsupported_version' })
  })

  it('a backup with no weeks still gets one blank week', () => {
    const file = {
      app: 'murad-portal-planner',
      schemaVersion: 1,
      planner: { baseDate: '2026-10-12', weeks: [] },
    }
    const parsed = parseBackup(JSON.stringify(file))
    expect(parsed.ok && parsed.data.weeks).toEqual([
      { index: 0, rowCount: 1, cells: [], notes: [] },
    ])
  })
})
