import config from '@payload-config'
import { getPayload, type Payload, type TypedUser } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { getStudentWeek } from '@/features/student-plan/queries'
import type { Enrollment, Program, StudentAssignment, TaskPool } from '@/payload-types'

let payload: Payload
let owner: TypedUser
let anna: TypedUser
let boris: TypedUser
let b1b2: Program
let a2b1: Program
let review: TaskPool
let essay: TaskPool
let a1Task: TaskPool

const context = { disableRevalidate: true }
const emails = {
  owner: 'splan-owner@example.com',
  anna: 'splan-anna@example.com',
  boris: 'splan-boris@example.com',
  gone: 'splan-gone@example.com',
}
const slugs = { b1b2: 'splan-b1-b2', a2b1: 'splan-a2-b1', big: 'splan-big', empty: 'splan-empty' }

const asUser = (doc: { id: number | string }): TypedUser =>
  ({ ...doc, collection: 'users' }) as unknown as TypedUser

async function rejection(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (e: unknown) =>
      e as { status?: number; message?: string; data?: { errors?: { message: string }[] } },
  )
  if (!error) throw new Error('expected the call to be rejected')
  return error
}
async function expectInvalid(promise: Promise<unknown>, message: string) {
  const error = await rejection(promise)
  expect(error.data?.errors?.map((e) => e.message)).toContain(message)
}

/** Without RESEND_API_KEY every email is printed by the dev sender: keep the output quiet. */
async function quietly<T>(work: () => Promise<T>): Promise<T> {
  const info = vi.spyOn(console, 'info').mockImplementation(() => {})
  try {
    return await work()
  } finally {
    info.mockRestore()
  }
}

const emptyWeek = () => Array.from({ length: 7 }, () => ({ slots: [] }))

const createProgram = (slug: string, levelFrom: string, levelTo: string, durationWeeks = 52) =>
  payload.create({
    collection: 'programs',
    context,
    data: {
      slug,
      title: `Plan ${levelFrom} → ${levelTo}`,
      levelFrom,
      levelTo,
      durationWeeks,
      weekTemplate: emptyWeek(),
      status: 'published',
    } as never,
  }) as Promise<Program>

const createTask = (title: string, level: TaskPool['level'], text: { ru: string; en?: string }) =>
  payload.create({
    collection: 'task-pool',
    context,
    data: { title: `splan ${title}`, level, text },
  }) as Promise<TaskPool>

const addPlanItem = (
  program: Program,
  position: { week: number; day: number; order: number },
  task: TaskPool,
) =>
  payload.create({
    collection: 'program-plan-items',
    context,
    data: { program: program.id, task: task.id, ...position },
  })

const placement = { test: 'murad', cefr: 'B1', takenAt: '2026-10-01T12:00:00.000Z' } as const

const assign = (student: TypedUser, program: Program) =>
  quietly(
    () =>
      payload.create({
        collection: 'enrollments',
        overrideAccess: false,
        user: owner,
        data: { student: student.id as number, program: program.id, placement } as never,
      }) as Promise<Enrollment>,
  )

const planOf = async (enrollment: Enrollment) =>
  (
    await payload.find({
      collection: 'student-assignments',
      where: { enrollment: { equals: enrollment.id } },
      sort: ['week', 'day', 'order'],
      pagination: false,
      depth: 0,
    })
  ).docs

const at = (plan: StudentAssignment[], week: number, day: number, order = 1) =>
  plan.find((item) => item.week === week && item.day === day && item.order === order)

const ownerUpdate = (id: number, data: Record<string, unknown>) =>
  payload.update({
    collection: 'student-assignments',
    id,
    data,
    depth: 0,
    overrideAccess: false,
    user: owner,
  })

const ownerCreate = (data: Record<string, unknown>) =>
  payload.create({
    collection: 'student-assignments',
    data: data as never,
    depth: 0,
    overrideAccess: false,
    user: owner,
  })

async function cleanEnrollments() {
  await payload.delete({
    collection: 'enrollments',
    where: { 'program.slug': { in: Object.values(slugs) } },
  })
}

async function cleanup() {
  await cleanEnrollments()
  await payload.delete({
    collection: 'program-plan-items',
    where: { 'program.slug': { in: Object.values(slugs) } },
  })
  await payload.delete({
    collection: 'programs',
    where: { slug: { in: Object.values(slugs) } },
    context,
  })
  await payload.delete({ collection: 'task-pool', where: { title: { like: 'splan ' } }, context })
  await payload.delete({
    collection: 'users',
    where: { email: { in: Object.values(emails) } },
    context,
  })
}

const createStudent = async (email: string) =>
  asUser(
    await quietly(() => payload.create({ collection: 'users', data: { email, role: 'student' } })),
  )

/** Starts the enrollment `daysAgo` days ago, as if she had pressed «Начать» back then. */
async function startedDaysAgo(enrollment: Enrollment, daysAgo: number) {
  const start = new Date(Date.now() - daysAgo * 86_400_000)
  await payload.db.updateOne({
    collection: 'enrollments',
    id: enrollment.id,
    data: {
      status: 'active',
      timezone: 'Asia/Almaty',
      startDate: `${start.toISOString().slice(0, 10)}T00:00:00.000Z`,
    },
  })
}

describe('personal plan per student (story 018)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    await cleanup()
    owner = asUser(
      await payload.create({ collection: 'users', data: { email: emails.owner, role: 'owner' } }),
    )
    anna = await createStudent(emails.anna)
    boris = await createStudent(emails.boris)
    b1b2 = await createProgram(slugs.b1b2, 'B1', 'B2')
    a2b1 = await createProgram(slugs.a2b1, 'A2', 'B1')
    review = await createTask('review', 'B1', {
      ru: 'Напиши отзыв на любую серию (200 слов)',
      en: 'Write a review of any episode (200 words)',
    })
    essay = await createTask('essay', 'B2', { ru: 'Эссе о своём городе' })
    a1Task = await createTask('a1', 'A1', { ru: 'Назови цвета' })
    await addPlanItem(b1b2, { week: 1, day: 5, order: 1 }, review)
    await addPlanItem(b1b2, { week: 3, day: 2, order: 1 }, review)
    await addPlanItem(b1b2, { week: 3, day: 2, order: 2 }, essay)
    await addPlanItem(a2b1, { week: 2, day: 1, order: 1 }, review)
  })

  beforeEach(cleanEnrollments)

  afterAll(async () => {
    await cleanup()
    await payload.destroy()
  })

  describe('1. assigning copies the default plan', () => {
    it('copies every plan item with the pool text at that moment', async () => {
      const enrollment = await assign(anna, b1b2)
      const plan = await planOf(enrollment)
      expect(plan).toHaveLength(3)
      expect(at(plan, 1, 5)).toMatchObject({
        text: {
          ru: 'Напиши отзыв на любую серию (200 слов)',
          en: 'Write a review of any episode (200 words)',
        },
        sourceTask: review.id,
        editedByOwner: false,
      })
      expect(at(plan, 3, 2, 2)).toMatchObject({ text: { ru: 'Эссе о своём городе' } })
    })

    it('rolls the assignment back when the copy fails (one transaction)', async () => {
      const create = payload.create.bind(payload)
      const spy = vi.spyOn(payload, 'create').mockImplementation(((args: {
        collection: string
      }) => {
        if (args.collection === 'student-assignments') throw new Error('copy failed')
        return create(args as never)
      }) as typeof payload.create)
      try {
        await rejection(assign(anna, b1b2))
      } finally {
        spy.mockRestore()
      }
      const { totalDocs } = await payload.count({
        collection: 'enrollments',
        where: { student: { equals: anna.id } },
      })
      expect(totalDocs).toBe(0)
    })

    it('replaces the plan when the owner changes the program before the start', async () => {
      const enrollment = await assign(anna, b1b2)
      await quietly(() =>
        payload.update({
          collection: 'enrollments',
          id: enrollment.id,
          data: { program: a2b1.id },
          overrideAccess: false,
          user: owner,
        }),
      )
      const plan = await planOf(enrollment)
      expect(plan.map((item) => [item.week, item.day, item.order])).toEqual([[2, 1, 1]])
    })

    it('copies a full year (52 × 7 × 3) in one go', async () => {
      const big = await createProgram(slugs.big, 'B1', 'B2')
      for (let week = 1; week <= 52; week += 1) {
        for (let day = 1; day <= 7; day += 1) {
          for (let order = 1; order <= 3; order += 1) {
            await payload.db.create({
              collection: 'program-plan-items',
              data: { program: big.id, task: review.id, week, day, order },
            })
          }
        }
      }
      const enrollment = await assign(boris, big)
      const { totalDocs } = await payload.count({
        collection: 'student-assignments',
        where: { enrollment: { equals: enrollment.id } },
      })
      expect(totalDocs).toBe(1092)
    }, 180_000)
  })

  describe('3. the owner edits one student’s plan', () => {
    it('replaces a task with another pool task of an allowed level', async () => {
      const annas = await assign(anna, b1b2)
      const boriss = await assign(boris, b1b2)
      const item = at(await planOf(annas), 3, 2)!
      const updated = await ownerUpdate(item.id, { sourceTask: essay.id })
      expect(updated).toMatchObject({
        sourceTask: essay.id,
        text: { ru: 'Эссе о своём городе' },
        editedByOwner: true,
      })
      expect(at(await planOf(boriss), 3, 2)).toMatchObject({
        sourceTask: review.id,
        editedByOwner: false,
      })
    })

    it('writing a custom text makes the task «своё»', async () => {
      const item = at(await planOf(await assign(anna, b1b2)), 3, 2)!
      const updated = await ownerUpdate(item.id, { text: { ru: 'Посмотри серию с Мурадом' } })
      expect(updated).toMatchObject({
        sourceTask: null,
        text: { ru: 'Посмотри серию с Мурадом' },
        editedByOwner: true,
      })
    })

    it('adds a pool task to a free day, taking its text', async () => {
      const enrollment = await assign(anna, b1b2)
      const created = await ownerCreate({
        enrollment: enrollment.id,
        week: 10,
        day: 1,
        order: 1,
        sourceTask: review.id,
      })
      expect(created).toMatchObject({
        text: { ru: 'Напиши отзыв на любую серию (200 слов)' },
        editedByOwner: true,
      })
    })

    it('refuses a pool task outside the program levels', async () => {
      const item = at(await planOf(await assign(anna, b1b2)), 3, 2)!
      await expectInvalid(
        ownerUpdate(item.id, { sourceTask: a1Task.id }),
        'Уровень задания (A1) вне программы B1 → B2',
      )
    })

    it('refuses week 53 and day 8', async () => {
      const enrollment = await assign(anna, b1b2)
      await expectInvalid(
        ownerCreate({ enrollment: enrollment.id, week: 53, day: 1, order: 1, text: { ru: 'x' } }),
        'Неделя должна быть от 1 до 52',
      )
      await expectInvalid(
        ownerCreate({ enrollment: enrollment.id, week: 1, day: 8, order: 1, text: { ru: 'x' } }),
        'День должен быть от 1 до 7',
      )
    })

    it('needs a text or a pool task', async () => {
      const enrollment = await assign(anna, b1b2)
      const error = await rejection(
        ownerCreate({ enrollment: enrollment.id, week: 9, day: 1, order: 1 }),
      )
      expect(error.status).toBe(400)
    })
  })

  describe('4/7. the student reads her plan', () => {
    it('sees a future week’s tasks on day 10', async () => {
      const enrollment = await assign(anna, b1b2)
      await startedDaysAgo(enrollment, 9)
      const view = await getStudentWeek(payload, anna, 'ru', 3)
      expect(view.kind).toBe('plan')
      if (view.kind !== 'plan') return
      expect(view.currentWeek).toBe(2)
      expect(view.week).toBe(3)
      expect(view.totalWeeks).toBe(52)
      expect(view.days[1]).toMatchObject({
        day: 2,
        programDay: 16,
        tasks: [
          { text: 'Напиши отзыв на любую серию (200 слов)' },
          { text: 'Эссе о своём городе' },
        ],
      })
      expect(view.days[0]?.tasks).toEqual([])
    })

    it('reads the English text in English, the Russian one when there is none', async () => {
      const enrollment = await assign(anna, b1b2)
      await startedDaysAgo(enrollment, 0)
      const view = await getStudentWeek(payload, anna, 'en', 3)
      if (view.kind !== 'plan') throw new Error('expected a plan')
      expect(view.days[1]?.tasks.map((task) => task.text)).toEqual([
        'Write a review of any episode (200 words)',
        'Эссе о своём городе',
      ])
    })

    it('opens the current week by default', async () => {
      const enrollment = await assign(anna, b1b2)
      await startedDaysAgo(enrollment, 0)
      const view = await getStudentWeek(payload, anna, 'ru')
      if (view.kind !== 'plan') throw new Error('expected a plan')
      expect(view.week).toBe(1)
      expect(view.days[4]?.tasks).toHaveLength(1)
    })

    it('7. an empty program plan gives an empty personal plan', async () => {
      const empty = await createProgram(slugs.empty, 'B1', 'B2', 4)
      const enrollment = await assign(boris, empty)
      expect(await planOf(enrollment)).toHaveLength(0)
      await startedDaysAgo(enrollment, 0)
      const view = await getStudentWeek(payload, boris, 'ru')
      if (view.kind !== 'plan') throw new Error('expected a plan')
      expect(view.days.every((day) => day.tasks.length === 0)).toBe(true)
      await payload.delete({ collection: 'enrollments', id: enrollment.id })
      await payload.delete({ collection: 'programs', id: empty.id, context })
    })

    it('shows nothing before a program is assigned', async () => {
      expect(await getStudentWeek(payload, anna, 'ru')).toEqual({ kind: 'none' })
    })
  })

  describe('5. later edits of the pool or the program plan', () => {
    it('do not change existing students’ plans', async () => {
      const enrollment = await assign(anna, b1b2)
      const before = await planOf(enrollment)
      const pool = await createTask('later', 'B1', { ru: 'Старый текст' })
      await addPlanItem(b1b2, { week: 4, day: 1, order: 1 }, pool)
      await payload.update({
        collection: 'task-pool',
        id: review.id,
        data: { text: { ru: 'Новый текст пула' } },
        context,
      })
      try {
        const after = await planOf(enrollment)
        expect(after.map((item) => [item.id, item.text])).toEqual(
          before.map((item) => [item.id, item.text]),
        )
      } finally {
        await payload.delete({
          collection: 'program-plan-items',
          where: { task: { equals: pool.id } },
        })
        await payload.update({
          collection: 'task-pool',
          id: review.id,
          data: { text: review.text },
          context,
        })
      }
    })
  })

  describe('6. deleting a task', () => {
    it('removes only that task; the enrollment and the rest stay', async () => {
      const enrollment = await assign(anna, b1b2)
      await startedDaysAgo(enrollment, 20)
      const item = at(await planOf(enrollment), 3, 2)!
      await payload.delete({
        collection: 'student-assignments',
        id: item.id,
        overrideAccess: false,
        user: owner,
      })
      const plan = await planOf(enrollment)
      expect(plan).toHaveLength(2)
      expect(at(plan, 3, 2)).toBeUndefined()
      const kept = await payload.findByID({ collection: 'enrollments', id: enrollment.id })
      expect(kept.status).toBe('active')
    })
  })

  describe('8. at most 3 tasks a day', () => {
    it('refuses a 4th task', async () => {
      const enrollment = await assign(anna, b1b2)
      await ownerCreate({ enrollment: enrollment.id, week: 3, day: 2, order: 3, text: { ru: 'x' } })
      await expectInvalid(
        ownerCreate({ enrollment: enrollment.id, week: 3, day: 2, order: 1, text: { ru: 'y' } }),
        'В дне не больше 3 заданий',
      )
    })

    it('refuses a taken place', async () => {
      const enrollment = await assign(anna, b1b2)
      await expectInvalid(
        ownerCreate({ enrollment: enrollment.id, week: 1, day: 5, order: 1, text: { ru: 'x' } }),
        'Это место в плане уже занято',
      )
    })
  })

  describe('9. access', () => {
    it('a student reads her own plan and nobody else’s', async () => {
      await assign(anna, b1b2)
      const boriss = await assign(boris, a2b1)
      const own = await payload.find({
        collection: 'student-assignments',
        overrideAccess: false,
        user: anna,
        pagination: false,
      })
      expect(own.docs).toHaveLength(3)
      const others = await payload.find({
        collection: 'student-assignments',
        where: { enrollment: { equals: boriss.id } },
        overrideAccess: false,
        user: anna,
      })
      expect(others.docs).toHaveLength(0)
      const borisItem = (await planOf(boriss))[0]!
      const read = await rejection(
        payload.findByID({
          collection: 'student-assignments',
          id: borisItem.id,
          overrideAccess: false,
          user: anna,
        }),
      )
      expect([403, 404]).toContain(read.status)
    })

    it('a student cannot write any task, even in her own plan (403)', async () => {
      const annas = await assign(anna, b1b2)
      const item = (await planOf(annas))[0]!
      const attempts = [
        () =>
          payload.create({
            collection: 'student-assignments',
            data: { enrollment: annas.id, week: 9, day: 1, order: 1, text: { ru: 'x' } },
            overrideAccess: false,
            user: anna,
          }),
        () =>
          payload.update({
            collection: 'student-assignments',
            id: item.id,
            data: { text: { ru: 'моё' } },
            overrideAccess: false,
            user: anna,
          }),
        () =>
          payload.delete({
            collection: 'student-assignments',
            id: item.id,
            overrideAccess: false,
            user: anna,
          }),
      ]
      for (const attempt of attempts) {
        expect((await rejection(attempt())).status).toBe(403)
      }
    })

    it('an anonymous caller reads nothing (403)', async () => {
      await assign(anna, b1b2)
      const error = await rejection(
        payload.find({ collection: 'student-assignments', overrideAccess: false }),
      )
      expect(error.status).toBe(403)
    })
  })

  describe('integrity', () => {
    it('deleting an enrollment or the student deletes her plan', async () => {
      const gone = await createStudent(emails.gone)
      const enrollment = await assign(gone, b1b2)
      await payload.delete({ collection: 'users', id: gone.id })
      const { totalDocs } = await payload.count({
        collection: 'student-assignments',
        where: { enrollment: { equals: enrollment.id } },
      })
      expect(totalDocs).toBe(0)
    })
  })
})
