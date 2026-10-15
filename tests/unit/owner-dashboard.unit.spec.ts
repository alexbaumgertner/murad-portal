import { describe, expect, it } from 'vitest'

import {
  IDLE_DAYS,
  applyFilter,
  parseFilter,
  sortRows,
  summarizePlanner,
  type DashboardRow,
  type PlannerFacts,
} from '@/features/owner-progress/dashboard-shape'

// 2026-10-14 is a Wednesday; week 0 starts Monday 2026-10-12, week 1 on 2026-10-19.
const BASE = '2026-10-12'
const TODAY = '2026-10-14'
const cell = (day: number, text: string, done = false) => ({ day, text, done })

const planner = (over: Partial<PlannerFacts> = {}): PlannerFacts => ({
  baseDate: BASE,
  weeks: [{ index: 0, cells: [], questionNotes: 0 }],
  lastTickAt: null,
  ...over,
})

const week0 = (cells: ReturnType<typeof cell>[], questionNotes = 0) => ({
  index: 0,
  cells,
  questionNotes,
})

const summary = (facts: PlannerFacts | null, today = TODAY) =>
  summarizePlanner(facts, today, IDLE_DAYS)

describe('story 030 · owner dashboard shape', () => {
  it('2. a student without a planner has only the noPlanner signal', () => {
    const row = summary(null)
    expect(row.hasPlanner).toBe(false)
    expect(row.signals).toEqual(['noPlanner'])
    expect(row.needsHelp).toBe(false)
    expect(row.stats).toBeNull()
    expect(row.percent).toBeNull()
  })

  it('3. progress counts written tasks only and is null for an empty week', () => {
    const row = summary(
      planner({
        weeks: [
          week0([
            cell(0, 'A', true),
            cell(1, 'B', true),
            cell(2, 'C', true),
            cell(2, 'D'),
            cell(3, 'E'),
            cell(4, 'F'),
            cell(5, 'G'),
            cell(6, 'H'),
            cell(0, '-'),
            cell(1, '  '),
            cell(1, '—', true),
          ]),
        ],
        lastTickAt: '2026-10-14T08:00:00.000Z',
      }),
    )
    expect(row.currentWeek).toBe(1)
    expect(row.stats).toEqual({ total: 8, done: 3 })
    expect(row.percent).toBe(38)
    expect(summary(planner()).percent).toBeNull()
  })

  it('4. noTasks fires for an empty current week, a missing week and a future planner', () => {
    expect(summary(planner()).signals).toContain('noTasks')
    expect(
      summary(planner({ weeks: [{ index: 3, cells: [], questionNotes: 0 }] })).signals,
    ).toEqual(['noTasks'])
    // today is before the first Monday: no current week at all
    const future = summary(planner({ baseDate: '2026-11-02' }))
    expect(future.currentWeek).toBeNull()
    expect(future.signals).toEqual(['noTasks'])
    expect(summary(planner({ weeks: [week0([cell(5, 'A')])] })).signals).not.toContain('noTasks')
  })

  it('4. idle: a tick exactly 3 days ago is idle, 2 days ago is not', () => {
    const tasks = [week0([cell(0, 'A', true), cell(1, 'B')])]
    expect(
      summary(planner({ weeks: tasks, lastTickAt: '2026-10-11T23:00:00.000Z' })).signals,
    ).toContain('idle')
    expect(
      summary(planner({ weeks: tasks, lastTickAt: '2026-10-12T01:00:00.000Z' })).signals,
    ).not.toContain('idle')
    // never ticked, but tasks are already due
    expect(summary(planner({ weeks: tasks })).signals).toContain('idle')
  })

  it('4. idle does not fire when every task is dated after today', () => {
    const row = summary(planner({ weeks: [week0([cell(4, 'A'), cell(6, 'B')])] }))
    expect(row.signals).toEqual([])
    expect(row.needsHelp).toBe(false)
  })

  it('4. questions fire only for notes of the current week', () => {
    const current = summary(
      planner({ weeks: [week0([cell(5, 'A')], 1)], lastTickAt: '2026-10-14T00:00:00.000Z' }),
    )
    expect(current.signals).toEqual(['questions'])
    expect(current.needsHelp).toBe(true)
    const other = summary(
      planner({
        weeks: [week0([cell(5, 'A')]), { index: 1, cells: [], questionNotes: 4 }],
      }),
    )
    expect(other.signals).not.toContain('questions')
  })

  it('5. parseFilter falls back to all; applyFilter keeps the matching rows', () => {
    expect(parseFilter('help')).toBe('help')
    expect(parseFilter('noPlanner')).toBe('noPlanner')
    expect(parseFilter('active')).toBe('active')
    expect(parseFilter('nonsense')).toBe('all')
    expect(parseFilter(undefined)).toBe('all')
    expect(parseFilter(['help'])).toBe('all')

    const rows = [
      row({ name: 'Help', needsHelp: true, hasPlanner: true }),
      row({ name: 'Fine', hasPlanner: true }),
      row({ name: 'None', hasPlanner: false, signals: ['noPlanner'] }),
      row({ name: 'Program', hasPlanner: false, programActive: true, signals: ['noPlanner'] }),
    ]
    const names = (filter: Parameters<typeof applyFilter>[1]) =>
      applyFilter(rows, filter).map((r) => r.name)
    expect(names('all')).toEqual(['Help', 'Fine', 'None', 'Program'])
    expect(names('help')).toEqual(['Help'])
    expect(names('noPlanner')).toEqual(['None', 'Program'])
    expect(names('active')).toEqual(['Help', 'Fine', 'Program'])
  })

  it('6. orders: needs help, then planner, then none; oldest tick first; then name', () => {
    const rows = [
      row({ name: 'Zoya', hasPlanner: false, signals: ['noPlanner'] }),
      row({ name: 'Boris', hasPlanner: true, lastTick: '2026-10-13' }),
      row({ name: 'Anna', hasPlanner: true, lastTick: '2026-10-10' }),
      row({ name: 'Dan', hasPlanner: true, needsHelp: true, lastTick: '2026-10-13' }),
      row({ name: 'Eva', hasPlanner: true, needsHelp: true, lastTick: null }),
      row({ name: 'Clara', hasPlanner: true, needsHelp: true, lastTick: '2026-10-13' }),
      row({ name: 'Adam', hasPlanner: false, signals: ['noPlanner'] }),
    ]
    expect(sortRows(rows, 'ru').map((r) => r.name)).toEqual([
      'Eva',
      'Clara',
      'Dan',
      'Anna',
      'Boris',
      'Adam',
      'Zoya',
    ])
  })
})

function row(
  over: Partial<DashboardRow> & { name: string; programActive?: boolean },
): DashboardRow {
  const { programActive, ...rest } = over
  return {
    studentId: 1,
    plannerId: rest.hasPlanner ? 1 : null,
    hasPlanner: false,
    currentWeek: null,
    weekStart: null,
    stats: null,
    percent: null,
    lastTick: null,
    signals: [],
    needsHelp: false,
    active: Boolean(rest.hasPlanner) || Boolean(programActive),
    program: null,
    ...rest,
  }
}
