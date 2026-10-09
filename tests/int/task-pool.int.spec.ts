import config from '@payload-config'
import { getPayload, type Payload, type TypedUser } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { copyWeek } from '@/features/program-plan/service'
import type { Program, ProgramPlanItem, SlotType, TaskPool } from '@/payload-types'

let payload: Payload
let owner: TypedUser
let student: TypedUser
let program: Program
let b1: TaskPool
let a1: TaskPool
let slot: SlotType

const context = { disableRevalidate: true }
const emails = { owner: 'plan-owner@example.com', student: 'plan-student@example.com' }

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

const emptyWeek = () => Array.from({ length: 7 }, () => ({ slots: [] }))

const createTask = (title: string, level: string, extra: Record<string, unknown> = {}) =>
  payload.create({
    collection: 'task-pool',
    context,
    overrideAccess: false,
    user: owner,
    data: { title, level, text: { ru: `Текст: ${title}` }, ...extra } as never,
  }) as Promise<TaskPool>

const addItem = (
  position: { week: number; day: number; order: number },
  task: number,
  programId = program.id,
) =>
  payload.create({
    collection: 'program-plan-items',
    context,
    overrideAccess: false,
    user: owner,
    data: { program: programId, task, ...position },
  }) as Promise<ProgramPlanItem>

const planItems = (programId = program.id) =>
  payload.find({
    collection: 'program-plan-items',
    where: { program: { equals: programId } },
    sort: ['week', 'day', 'order'],
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })

async function cleanup() {
  await payload.delete({
    collection: 'program-plan-items',
    where: { id: { exists: true } },
    context,
  })
  await payload.delete({ collection: 'task-pool', where: { id: { exists: true } }, context })
  await payload.delete({ collection: 'programs', where: { slug: { like: 'plan-' } }, context })
  await payload.delete({ collection: 'slot-types', where: { id: { exists: true } }, context })
  await payload.delete({
    collection: 'users',
    where: { email: { in: Object.values(emails) } },
    context,
  })
}

describe('task pool and program plan (story 010)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    await cleanup()
    owner = asUser(
      await payload.create({ collection: 'users', data: { email: emails.owner, role: 'owner' } }),
    )
    student = asUser(
      await payload.create({
        collection: 'users',
        data: { email: emails.student, role: 'student' },
      }),
    )
    slot = (await payload.create({
      collection: 'slot-types',
      context,
      data: { name: 'Series', defaultMinMinutes: 40 },
    })) as SlotType
    program = (await payload.create({
      collection: 'programs',
      context,
      data: {
        slug: 'plan-b1-b2',
        title: 'B1 → B2',
        levelFrom: 'B1',
        levelTo: 'B2',
        durationWeeks: 52,
        weekTemplate: emptyWeek(),
      } as never,
    })) as Program
  })

  afterAll(async () => {
    await cleanup()
    await payload.destroy()
  })

  describe('1. the owner creates a pool task', () => {
    it('saves a B1 task with a slot type and finds it by level and by slot type', async () => {
      b1 = await createTask('Отзыв на серию', 'B1', { slotType: slot.id })
      expect(b1).toMatchObject({ title: 'Отзыв на серию', level: 'B1' })
      expect(b1.text.ru).toBe('Текст: Отзыв на серию')

      a1 = await createTask('Алфавит', 'A1')
      const byLevel = await payload.find({
        collection: 'task-pool',
        where: { level: { equals: 'B1' } },
        overrideAccess: false,
        user: owner,
      })
      expect(byLevel.docs.map((d) => d.id)).toEqual([b1.id])
      const bySlot = await payload.find({
        collection: 'task-pool',
        where: { slotType: { equals: slot.id } },
        overrideAccess: false,
        user: owner,
      })
      expect(bySlot.docs.map((d) => d.id)).toEqual([b1.id])
    })

    it('needs a level, a title up to 80 characters and a Russian text up to 1000', async () => {
      const bad = (extra: Record<string, unknown>) =>
        payload.create({
          collection: 'task-pool',
          context,
          data: { title: 'x', level: 'B1', text: { ru: 'x' }, ...extra } as never,
        })
      await expect(bad({ level: 'D9' })).rejects.toThrow()
      await expect(bad({ level: undefined })).rejects.toThrow()
      await expect(bad({ title: 'x'.repeat(81) })).rejects.toThrow()
      await expect(bad({ text: { ru: '' } })).rejects.toThrow()
      await expect(bad({ text: { ru: 'x'.repeat(1001) } })).rejects.toThrow()
      const english = await bad({ text: { ru: 'Привет', en: 'Hello' } })
      expect(english).toMatchObject({ text: { ru: 'Привет', en: 'Hello' } })
    })
  })

  describe('2. the owner puts a task on the default plan', () => {
    it('saves week 1, day 5 and reads it back by position', async () => {
      const item = await addItem({ week: 1, day: 5, order: 1 }, b1.id)
      expect(item).toMatchObject({ week: 1, day: 5, order: 1 })
      const { docs } = await planItems()
      expect(docs.map((d) => [d.week, d.day, d.order, d.task])).toEqual([[1, 5, 1, b1.id]])
    })

    it('refuses the same place twice', async () => {
      await expect(addItem({ week: 1, day: 5, order: 1 }, b1.id)).rejects.toThrow()
    })
  })

  describe('4. the task level must fit the program', () => {
    it('refuses an A1 task in a B1 → B2 program', async () => {
      await expectInvalid(
        addItem({ week: 1, day: 1, order: 1 }, a1.id),
        'Уровень задания (A1) вне программы B1 → B2',
      )
    })
  })

  describe('5. at most 3 tasks a day', () => {
    it('refuses a 4th item on a full day', async () => {
      await addItem({ week: 2, day: 2, order: 1 }, b1.id)
      await addItem({ week: 2, day: 2, order: 2 }, b1.id)
      await addItem({ week: 2, day: 2, order: 3 }, b1.id)
      await expectInvalid(
        addItem({ week: 2, day: 2, order: 1 }, b1.id),
        'В дне не больше 3 заданий',
      )
    })

    it('refuses moving an item onto a full day', async () => {
      const lone = await addItem({ week: 2, day: 3, order: 1 }, b1.id)
      await expectInvalid(
        payload.update({
          collection: 'program-plan-items',
          id: lone.id,
          context,
          overrideAccess: false,
          user: owner,
          data: { day: 2 },
        }),
        'В дне не больше 3 заданий',
      )
    })
  })

  describe('6. ranges', () => {
    it('refuses week 53 in a 52-week program, week 0, day 8 and order 4', async () => {
      await expectInvalid(
        addItem({ week: 53, day: 1, order: 1 }, b1.id),
        'Неделя должна быть от 1 до 52',
      )
      await expectInvalid(
        addItem({ week: 0, day: 1, order: 1 }, b1.id),
        'Неделя должна быть от 1 до 52',
      )
      await expectInvalid(
        addItem({ week: 1, day: 8, order: 1 }, b1.id),
        'День должен быть от 1 до 7',
      )
      await expectInvalid(
        addItem({ week: 1, day: 1, order: 4 }, b1.id),
        'Порядок должен быть от 1 до 3',
      )
    })
  })

  describe('3. copying a week', () => {
    it('fills free places of weeks 2–4 and reports copied and skipped', async () => {
      const copyProgram = (await payload.create({
        collection: 'programs',
        context,
        data: {
          slug: 'plan-copy',
          title: 'Copy',
          levelFrom: 'B1',
          levelTo: 'B2',
          weekTemplate: emptyWeek(),
        } as never,
      })) as Program
      const t = (n: number) => n
      await addItem({ week: 1, day: 1, order: 1 }, b1.id, copyProgram.id)
      await addItem({ week: 1, day: 1, order: 2 }, b1.id, copyProgram.id)
      await addItem({ week: 1, day: 5, order: 1 }, b1.id, copyProgram.id)
      // week 3 already has one of the places week 1 would fill, week 2 another
      await addItem({ week: 3, day: 1, order: 1 }, t(b1.id), copyProgram.id)
      await addItem({ week: 2, day: 5, order: 1 }, b1.id, copyProgram.id)

      const result = await copyWeek(payload, owner, {
        programId: copyProgram.id,
        fromWeek: 1,
        toFirst: 2,
        toLast: 4,
      })
      expect(result).toEqual({ ok: true, copied: 7, skipped: 2 })

      const { docs } = await planItems(copyProgram.id)
      expect(docs.filter((d) => d.week === 1)).toHaveLength(3)
      expect(docs.filter((d) => d.week === 2)).toHaveLength(3)
      expect(docs.filter((d) => d.week === 3)).toHaveLength(3)
      expect(docs.filter((d) => d.week === 4)).toHaveLength(3)

      // a second run copies nothing and changes nothing
      const again = await copyWeek(payload, owner, {
        programId: copyProgram.id,
        fromWeek: 1,
        toFirst: 2,
        toLast: 4,
      })
      expect(again).toEqual({ ok: true, copied: 0, skipped: 9 })
    })

    it('refuses targets beyond the program, a backwards range and the source week', async () => {
      const bad = { programId: program.id, fromWeek: 1 }
      expect(await copyWeek(payload, owner, { ...bad, toFirst: 50, toLast: 53 })).toEqual({
        ok: false,
        error: 'invalid_range',
      })
      expect(await copyWeek(payload, owner, { ...bad, toFirst: 4, toLast: 2 })).toEqual({
        ok: false,
        error: 'invalid_range',
      })
      expect(await copyWeek(payload, owner, { ...bad, toFirst: 1, toLast: 2 })).toEqual({
        ok: false,
        error: 'invalid_range',
      })
    })

    it('does not copy for a student', async () => {
      await expect(
        copyWeek(payload, student, { programId: program.id, fromWeek: 1, toFirst: 2, toLast: 3 }),
      ).rejects.toThrow()
    })
  })

  describe('7. a pool task in use cannot be deleted', () => {
    it('refuses with the titles of the programs that use it', async () => {
      const error = await rejection(
        payload.delete({
          collection: 'task-pool',
          id: b1.id,
          context,
          overrideAccess: false,
          user: owner,
        }),
      )
      expect(error.message).toContain('Задание используется в программах: ')
      expect(error.message).toContain('B1 → B2')
    })

    it('deletes a task that no plan uses', async () => {
      const spare = await createTask('Лишнее', 'B2')
      await payload.delete({
        collection: 'task-pool',
        id: spare.id,
        context,
        overrideAccess: false,
        user: owner,
      })
      const { totalDocs } = await payload.count({
        collection: 'task-pool',
        where: { id: { equals: spare.id } },
      })
      expect(totalDocs).toBe(0)
    })
  })

  describe('8. shortening a program', () => {
    it('refuses 52 → 40 while items sit in weeks 41–52, allows it once they are gone', async () => {
      const short = (await payload.create({
        collection: 'programs',
        context,
        data: {
          slug: 'plan-short',
          title: 'Short',
          levelFrom: 'B1',
          levelTo: 'B2',
          durationWeeks: 52,
          weekTemplate: emptyWeek(),
        } as never,
      })) as Program
      const late = await addItem({ week: 45, day: 1, order: 1 }, b1.id, short.id)
      const update = (durationWeeks: number) =>
        payload.update({
          collection: 'programs',
          id: short.id,
          context,
          overrideAccess: false,
          user: owner,
          data: { durationWeeks },
        })
      await expectInvalid(update(40), 'Есть задания после недели 40: удали их сначала')
      expect((await update(45)).durationWeeks).toBe(45)

      await payload.delete({ collection: 'program-plan-items', id: late.id, context })
      expect((await update(40)).durationWeeks).toBe(40)
    })

    it('removes the plan of a deleted program', async () => {
      const gone = (await payload.create({
        collection: 'programs',
        context,
        data: {
          slug: 'plan-gone',
          title: 'Gone',
          levelFrom: 'B1',
          levelTo: 'B2',
          weekTemplate: emptyWeek(),
        } as never,
      })) as Program
      await addItem({ week: 1, day: 1, order: 1 }, b1.id, gone.id)
      await payload.delete({ collection: 'programs', id: gone.id, context })
      const { docs } = await planItems(gone.id)
      expect(docs).toHaveLength(0)
    })
  })

  describe('9. editing a pool task', () => {
    it('tells the owner in the editor that only new plans get the change', () => {
      const collection = payload.collections['task-pool']?.config
      const group = collection?.fields.find((f) => 'name' in f && f.name === 'text')
      const description =
        group && 'admin' in group ? (group.admin as { description?: string })?.description : ''
      expect(description).toBe('Изменения попадут только в новые планы')
    })
  })

  describe('10. access', () => {
    it('a student and an anonymous caller cannot read or write task-pool or program-plan-items', async () => {
      for (const collection of ['task-pool', 'program-plan-items'] as const) {
        for (const user of [student, undefined]) {
          const read = await rejection(payload.find({ collection, overrideAccess: false, user }))
          expect(read.status).toBe(403)
          const write = await rejection(
            payload.create({
              collection,
              overrideAccess: false,
              user,
              context,
              data: {} as never,
            }),
          )
          expect(write.status).toBe(403)
        }
      }
      const upd = await rejection(
        payload.update({
          collection: 'task-pool',
          id: b1.id,
          overrideAccess: false,
          user: student,
          context,
          data: { title: 'hack' },
        }),
      )
      expect(upd.status).toBe(403)
    })
  })
})
