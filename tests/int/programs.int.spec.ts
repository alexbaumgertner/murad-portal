import config from '@payload-config'
import { getPayload, type Payload, type TypedUser } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { Program, SlotType } from '@/payload-types'

let payload: Payload
let owner: TypedUser
let student: TypedUser
let anki: SlotType
let series: SlotType

const context = { disableRevalidate: true }
const emails = { owner: 'programs-owner@example.com', student: 'programs-student@example.com' }

const asUser = (doc: { id: number | string }): TypedUser =>
  ({ ...doc, collection: 'users' }) as unknown as TypedUser

// Payload keeps the specific message in `data.errors`; `.message` only names the invalid fields.
async function rejection(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (e: unknown) =>
      e as { status?: number; message?: string; data?: { errors?: { message: string }[] } },
  )
  if (!error) throw new Error('expected the write to be rejected')
  return error
}
async function expectInvalid(promise: Promise<unknown>, message: string) {
  const error = await rejection(promise)
  expect(error.data?.errors?.map((e) => e.message)).toContain(message)
}

const emptyWeek = () => Array.from({ length: 7 }, () => ({ slots: [] }))
const week = (days: Record<number, { slotType: number; minMinutes?: number }[]> = {}) =>
  emptyWeek().map((day, i) => ({ slots: days[i] ?? day.slots }))

type ProgramData = Parameters<Payload['create']>[0] extends infer T
  ? T extends { collection: 'programs'; data: infer D }
    ? D
    : never
  : never

const programData = (slug: string, extra: Record<string, unknown> = {}) =>
  ({
    slug,
    title: `Program ${slug}`,
    levelFrom: 'A2',
    levelTo: 'B1',
    weekTemplate: week(),
    ...extra,
  }) as unknown as ProgramData

async function createProgram(slug: string, extra: Record<string, unknown> = {}) {
  return payload.create({
    collection: 'programs',
    context,
    overrideAccess: false,
    user: owner,
    data: programData(slug, extra),
  }) as Promise<Program>
}

async function cleanup() {
  await payload.delete({ collection: 'programs', where: { id: { exists: true } }, context })
  await payload.delete({ collection: 'slot-types', where: { id: { exists: true } }, context })
  await payload.delete({
    collection: 'users',
    where: { email: { in: Object.values(emails) } },
    context,
  })
}

describe('slot types and programs (story 009)', () => {
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
  })

  afterAll(async () => {
    await cleanup()
    await payload.destroy()
  })

  describe('1. the owner creates a slot type', () => {
    it('saves «Anki» with 20 minutes and offers it to programs', async () => {
      anki = (await payload.create({
        collection: 'slot-types',
        context,
        overrideAccess: false,
        user: owner,
        data: { name: 'Anki', defaultMinMinutes: 20 },
      })) as SlotType
      expect(anki).toMatchObject({ name: 'Anki', defaultMinMinutes: 20 })

      const found = await payload.find({
        collection: 'slot-types',
        overrideAccess: false,
        user: owner,
      })
      expect(found.docs.map((d) => d.id)).toContain(anki.id)
    })

    it('defaults the minimum to 20 minutes and keeps ru and en names apart', async () => {
      series = (await payload.create({
        collection: 'slot-types',
        context,
        locale: 'en',
        data: { name: 'Series', defaultMinMinutes: 40 },
      })) as SlotType
      await payload.update({
        collection: 'slot-types',
        id: series.id,
        locale: 'ru',
        context,
        data: { name: 'Сериал' },
      })
      const ru = await payload.findByID({ collection: 'slot-types', id: series.id, locale: 'ru' })
      const en = await payload.findByID({ collection: 'slot-types', id: series.id, locale: 'en' })
      expect([ru.name, en.name]).toEqual(['Сериал', 'Series'])

      const bare = await payload.create({
        collection: 'slot-types',
        context,
        data: { name: 'Bare' } as SlotType,
      })
      expect(bare.defaultMinMinutes).toBe(20)
      await payload.delete({ collection: 'slot-types', id: bare.id, context })
    })

    it('rejects a minimum outside 1–240 and an over-long name', async () => {
      for (const defaultMinMinutes of [0, 241]) {
        await expect(
          payload.create({
            collection: 'slot-types',
            context,
            data: { name: 'Bad', defaultMinMinutes },
          }),
        ).rejects.toThrow()
      }
      await expect(
        payload.create({
          collection: 'slot-types',
          context,
          data: { name: 'x'.repeat(61), defaultMinMinutes: 10 },
        }),
      ).rejects.toThrow()
    })
  })

  describe('2. the owner creates a program with a week template', () => {
    it('saves A2→B1, 52 weeks, as a draft with 7 template days and day 4 empty', async () => {
      const program = await createProgram('a2-b1', {
        weekTemplate: week({
          0: [
            { slotType: anki.id, minMinutes: 20 },
            { slotType: series.id, minMinutes: 40 },
          ],
          3: [],
        }),
      })
      expect(program).toMatchObject({
        slug: 'a2-b1',
        levelFrom: 'A2',
        levelTo: 'B1',
        durationWeeks: 52,
        status: 'draft',
      })

      const stored = await payload.findByID({
        collection: 'programs',
        id: program.id,
        depth: 0,
        overrideAccess: false,
        user: owner,
      })
      const days = stored.weekTemplate ?? []
      expect(days).toHaveLength(7)
      expect(days[0]?.slots?.map((s) => [s.slotType, s.minMinutes])).toEqual([
        [anki.id, 20],
        [series.id, 40],
      ])
      expect(days[3]?.slots ?? []).toEqual([])
    })

    it('starts every new program with 7 empty days and lets a slot fall back to the type minimum', async () => {
      const program = await payload.create({
        collection: 'programs',
        context,
        data: { slug: 'defaults', title: 'Defaults', levelFrom: 'A1', levelTo: 'A2' } as Program,
      })
      expect(program.weekTemplate).toHaveLength(7)

      const withFallback = await createProgram('fallback', {
        weekTemplate: week({ 1: [{ slotType: anki.id }] }),
      })
      expect(withFallback.weekTemplate?.[1]?.slots?.[0]?.minMinutes ?? null).toBeNull()
    })

    it('accepts C2 as the target level only', async () => {
      await createProgram('c1-c2', { levelFrom: 'C1', levelTo: 'C2' })
      await expect(createProgram('c2-c2', { levelFrom: 'C2', levelTo: 'C2' })).rejects.toThrow()
    })

    it('rejects a week template that is not exactly 7 days', async () => {
      await expectInvalid(
        createProgram('six-days', { weekTemplate: week().slice(0, 6) }),
        'В шаблоне должно быть ровно 7 дней',
      )
      await expectInvalid(
        createProgram('eight-days', { weekTemplate: [...week(), { slots: [] }] }),
        'В шаблоне должно быть ровно 7 дней',
      )
    })

    it('keeps the duration within 1–104 weeks', async () => {
      for (const durationWeeks of [0, 105]) {
        await expect(createProgram(`weeks-${durationWeeks}`, { durationWeeks })).rejects.toThrow()
      }
    })
  })

  describe('3. levels', () => {
    it('rejects levelFrom B2 with levelTo B1', async () => {
      await expectInvalid(
        createProgram('b2-b1', { levelFrom: 'B2', levelTo: 'B1' }),
        'Начальный уровень должен быть ниже целевого',
      )
    })

    it('rejects equal levels, and a partial update that breaks the order', async () => {
      await expectInvalid(
        createProgram('b1-b1', { levelFrom: 'B1', levelTo: 'B1' }),
        'Начальный уровень должен быть ниже целевого',
      )
      const ok = await createProgram('b1-b2', { levelFrom: 'B1', levelTo: 'B2' })
      await expectInvalid(
        payload.update({ collection: 'programs', id: ok.id, context, data: { levelFrom: 'C1' } }),
        'Начальный уровень должен быть ниже целевого',
      )
    })
  })

  describe('4. at most 5 slots a day', () => {
    it('rejects a 6th slot', async () => {
      const slot = { slotType: anki.id, minMinutes: 10 }
      await expectInvalid(
        createProgram('six-slots', { weekTemplate: week({ 2: Array(6).fill(slot) }) }),
        'В дне не больше 5 занятий',
      )
      // five is fine
      await createProgram('five-slots', { weekTemplate: week({ 2: Array(5).fill(slot) }) })
    })
  })

  describe('5. slot minutes', () => {
    it.each([0, 241])('rejects minMinutes %i with the 1–240 message', async (minMinutes) => {
      await expectInvalid(
        createProgram(`minutes-${minMinutes}`, {
          weekTemplate: week({ 0: [{ slotType: anki.id, minMinutes }] }),
        }),
        'Минут должно быть от 1 до 240',
      )
    })

    it.each([1, 240])('accepts minMinutes %i', async (minMinutes) => {
      await createProgram(`minutes-ok-${minMinutes}`, {
        weekTemplate: week({ 0: [{ slotType: anki.id, minMinutes }] }),
      })
    })

    it('requires a slot type on every slot', async () => {
      await expect(
        createProgram('no-type', { weekTemplate: week({ 0: [{ minMinutes: 10 } as never] }) }),
      ).rejects.toThrow()
    })
  })

  describe('6. a used slot type cannot be deleted', () => {
    it('refuses with the titles of the programs that use it', async () => {
      const used = (await payload.create({
        collection: 'slot-types',
        context,
        data: { name: 'Used', defaultMinMinutes: 15 },
      })) as SlotType
      await createProgram('uses-one', {
        title: 'Alpha',
        weekTemplate: week({ 0: [{ slotType: used.id }] }),
      })
      await createProgram('uses-two', {
        title: 'Beta',
        status: 'draft',
        weekTemplate: week({ 5: [{ slotType: used.id }] }),
      })

      const error = await rejection(
        payload.delete({
          collection: 'slot-types',
          id: used.id,
          context,
          overrideAccess: false,
          user: owner,
        }),
      )
      expect(error.message).toMatch(/^Тип используется в программах: /)
      expect(error.message).toContain('Alpha')
      expect(error.message).toContain('Beta')
      expect(
        await payload.findByID({ collection: 'slot-types', id: used.id, disableErrors: true }),
      ).toBeTruthy()
    })

    it('deletes an unused slot type', async () => {
      const spare = await payload.create({
        collection: 'slot-types',
        context,
        data: { name: 'Spare', defaultMinMinutes: 15 } as SlotType,
      })
      await payload.delete({
        collection: 'slot-types',
        id: spare.id,
        context,
        overrideAccess: false,
        user: owner,
      })
      expect(
        await payload.findByID({ collection: 'slot-types', id: spare.id, disableErrors: true }),
      ).toBeNull()
    })
  })

  describe('7. the slug is unique', () => {
    it('rejects a second program with the same slug', async () => {
      await createProgram('same-slug')
      await expectInvalid(createProgram('same-slug'), 'Такой адрес уже занят')
    })

    it('lets a program keep its own slug on update', async () => {
      const program = await createProgram('keeps-slug')
      const updated = await payload.update({
        collection: 'programs',
        id: program.id,
        context,
        data: { slug: 'keeps-slug', durationWeeks: 40 },
      })
      expect(updated.durationWeeks).toBe(40)
    })

    it('accepts only lowercase letters, digits and hyphens, up to 60 characters', async () => {
      for (const slug of ['Upper', 'has space', 'under_score', '-lead', 'a'.repeat(61)]) {
        await expect(createProgram(slug)).rejects.toThrow()
      }
      await createProgram('a'.repeat(60))
    })
  })

  describe('8. access', () => {
    it.each(['programs', 'slot-types'] as const)(
      'a student and an anonymous caller cannot create or update %s',
      async (collection) => {
        const data =
          collection === 'programs'
            ? programData('blocked')
            : ({ name: 'Blocked', defaultMinMinutes: 10 } as unknown as ProgramData)
        const target = collection === 'programs' ? await createProgram('target') : anki
        for (const user of [student, undefined]) {
          const create = await rejection(
            payload.create({
              collection,
              data,
              context,
              overrideAccess: false,
              user,
            } as never),
          )
          expect(create.status).toBe(403)
          const update = await rejection(
            payload.update({
              collection,
              id: target.id,
              data: {},
              context,
              overrideAccess: false,
              user,
            } as never),
          )
          expect(update.status).toBe(403)
          const del = await rejection(
            payload.delete({
              collection,
              id: target.id,
              context,
              overrideAccess: false,
              user,
            } as never),
          )
          expect(del.status).toBe(403)
        }
      },
    )

    it('an anonymous request reads no programs', async () => {
      await createProgram('hidden-draft')
      await createProgram('hidden-published', { status: 'published' })
      const found = await payload.find({ collection: 'programs', overrideAccess: false })
      expect(found.docs).toEqual([])
      expect(found.totalDocs).toBe(0)
    })

    it('an anonymous request cannot read slot types', async () => {
      const error = await rejection(
        payload.find({ collection: 'slot-types', overrideAccess: false }),
      )
      expect(error.status).toBe(403)
    })

    it('a student can read slot types', async () => {
      const found = await payload.find({
        collection: 'slot-types',
        overrideAccess: false,
        user: student,
      })
      expect(found.docs.map((d) => d.id)).toContain(anki.id)
    })
  })

  describe('9. students see only published programs', () => {
    it('lists published programs and hides drafts, also by id', async () => {
      const published = await createProgram('visible-one', { status: 'published' })
      const draft = await createProgram('draft-one', { status: 'draft' })

      const found = await payload.find({
        collection: 'programs',
        overrideAccess: false,
        user: student,
        limit: 100,
        pagination: false,
      })
      expect(found.docs.length).toBeGreaterThan(0)
      expect(found.docs.every((p) => p.status === 'published')).toBe(true)
      expect(found.docs.map((p) => p.id)).toContain(published.id)
      expect(found.docs.map((p) => p.id)).not.toContain(draft.id)

      await expect(
        payload.findByID({
          collection: 'programs',
          id: draft.id,
          overrideAccess: false,
          user: student,
        }),
      ).rejects.toThrow()
    })

    it('the owner sees drafts and published programs', async () => {
      const found = await payload.find({
        collection: 'programs',
        overrideAccess: false,
        user: owner,
        limit: 100,
        pagination: false,
      })
      const statuses = new Set(found.docs.map((p) => p.status))
      expect(statuses).toEqual(new Set(['draft', 'published']))
    })
  })
})
