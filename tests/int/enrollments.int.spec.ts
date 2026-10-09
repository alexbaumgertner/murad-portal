import config from '@payload-config'
import { getPayload, type Payload, type TypedUser } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { startEnrollment } from '@/features/enrollments/service'
import { getStudyView } from '@/features/enrollments/queries'
import { todayIn } from '@/features/enrollments/shape'
import type { Enrollment, Program } from '@/payload-types'

let payload: Payload
let owner: TypedUser
let anna: TypedUser
let boris: TypedUser
let a2b1: Program
let a1a2: Program
let draft: Program

const context = { disableRevalidate: true }
const emails = {
  owner: 'enroll-owner@example.com',
  anna: 'enroll-anna@example.com',
  boris: 'enroll-boris@example.com',
  gone: 'enroll-gone@example.com',
}

const asUser = (doc: { id: number | string }): TypedUser =>
  ({ ...doc, collection: 'users' }) as unknown as TypedUser

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

/** Without RESEND_API_KEY every email is printed by the dev sender; capture what was "sent". */
async function captureMail<T>(work: () => Promise<T>): Promise<{ result: T; mail: string }> {
  const info = vi.spyOn(console, 'info').mockImplementation(() => {})
  try {
    const result = await work()
    return { result, mail: info.mock.calls.flat().join('\n') }
  } finally {
    info.mockRestore()
  }
}

let lastMail = ''

type EnrollmentData = Omit<Enrollment, 'id' | 'createdAt' | 'updatedAt' | 'student' | 'program'>

const ielts45 = {
  test: 'ielts',
  score: 4.5,
  cefr: 'A2',
  takenAt: '2026-10-01T12:00:00.000Z',
  note: 'Слабое аудирование',
} as const

async function assign(
  student: TypedUser,
  program: Program,
  placement: Record<string, unknown> = ielts45,
) {
  const { result, mail } = await captureMail(() =>
    payload.create({
      collection: 'enrollments',
      overrideAccess: false,
      user: owner,
      data: {
        student: student.id as number,
        program: program.id,
        placement,
      } as unknown as EnrollmentData & { student: number; program: number },
    }),
  )
  lastMail = mail
  return result
}

const week = () => Array.from({ length: 7 }, () => ({ slots: [] }))

async function createProgram(slug: string, levelFrom: string, levelTo: string, status: string) {
  return payload.create({
    collection: 'programs',
    context,
    data: {
      slug,
      title: `Program ${levelFrom} → ${levelTo}`,
      levelFrom,
      levelTo,
      weekTemplate: week(),
      status,
    } as unknown as Program,
  }) as Promise<Program>
}

async function cleanEnrollments() {
  await payload.delete({ collection: 'enrollments', where: { id: { exists: true } } })
}

async function cleanup() {
  await cleanEnrollments()
  await payload.delete({ collection: 'programs', where: { id: { exists: true } }, context })
  await payload.delete({
    collection: 'users',
    where: { email: { in: Object.values(emails) } },
    context,
  })
}

async function student(email: string) {
  const { result } = await captureMail(() =>
    payload.create({ collection: 'users', data: { email, role: 'student' } }),
  )
  return asUser(result)
}

describe('owner assigns a program, the student starts it (story 012)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    await cleanup()
    owner = asUser(
      await payload.create({ collection: 'users', data: { email: emails.owner, role: 'owner' } }),
    )
    anna = await student(emails.anna)
    boris = await student(emails.boris)
    a2b1 = await createProgram('enroll-a2-b1', 'A2', 'B1', 'published')
    a1a2 = await createProgram('enroll-a1-a2', 'A1', 'A2', 'published')
    draft = await createProgram('enroll-draft', 'B1', 'B2', 'draft')
  })

  beforeEach(cleanEnrollments)

  afterAll(async () => {
    await cleanup()
    await payload.destroy()
  })

  describe('1. the owner assigns a program', () => {
    it('creates an assigned enrollment and emails «Мурад назначил тебе программу A2 → B1»', async () => {
      const { result, mail } = await captureMail(() =>
        payload.create({
          collection: 'enrollments',
          overrideAccess: false,
          user: owner,
          data: {
            student: anna.id as number,
            program: a2b1.id,
            placement: ielts45,
          } as unknown as Enrollment,
        }),
      )
      expect(result.status).toBe('assigned')
      expect(result.assignedAt).toBeTruthy()
      expect(result.startDate ?? null).toBeNull()
      expect(result.timezone ?? null).toBeNull()
      expect(result.placement).toMatchObject({ test: 'ielts', score: 4.5, cefr: 'A2' })
      expect(mail).toContain('Мурад назначил тебе программу A2 → B1')
      expect(mail).toContain('/study')
      expect(mail).not.toContain('Слабое аудирование')
    })

    it('writes the email in «вы» when the student chose it', async () => {
      await payload.update({ collection: 'users', id: boris.id, data: { addressForm: 'vy' } })
      await assign(boris, a2b1)
      expect(lastMail).toContain('Мурад назначил вам программу A2 → B1')
      await payload.update({ collection: 'users', id: boris.id, data: { addressForm: 'ty' } })
    })

    it('refuses to assign a program to the owner', async () => {
      await expectInvalid(assign(owner, a2b1), 'Программу можно назначить только ученику')
    })
  })

  describe('2/4. the student sees her program', () => {
    it('shows the placement result and the program, never the note', async () => {
      await assign(anna, a2b1)
      const view = await getStudyView(payload, anna, 'ru')
      expect(view.kind).toBe('assigned')
      if (view.kind !== 'assigned') return
      expect(view.placement).toEqual({ test: 'IELTS', score: '4.5', cefr: 'A2' })
      expect(view.program).toMatchObject({ levelFrom: 'A2', levelTo: 'B1', durationWeeks: 52 })
      expect(JSON.stringify(view)).not.toContain('Слабое аудирование')
    })

    it('shows nothing but the empty state without an enrollment', async () => {
      expect(await getStudyView(payload, anna, 'ru')).toEqual({ kind: 'none' })
    })
  })

  describe('3/7. «Начать»', () => {
    it('sets today in her zone, status active, day 1 — exactly once', async () => {
      await assign(anna, a2b1)
      const first = await startEnrollment(payload, anna, 'America/New_York')
      expect(first).toMatchObject({ ok: true, started: true })
      const second = await startEnrollment(payload, anna, 'Asia/Tokyo')
      expect(second).toMatchObject({ ok: true, started: false })

      const [doc] = (
        await payload.find({ collection: 'enrollments', where: { student: { equals: anna.id } } })
      ).docs
      expect(doc?.status).toBe('active')
      expect(doc?.timezone).toBe('America/New_York')
      expect(doc?.startDate?.slice(0, 10)).toBe(todayIn('America/New_York'))

      const view = await getStudyView(payload, anna, 'ru')
      expect(view).toMatchObject({ kind: 'active', day: 1 })
    })

    it('5. falls back to Almaty for an unknown zone', async () => {
      await assign(anna, a2b1)
      await startEnrollment(payload, anna, 'Mars/Olympus')
      const { docs } = await payload.find({
        collection: 'enrollments',
        where: { student: { equals: anna.id } },
      })
      expect(docs[0]?.timezone).toBe('Asia/Almaty')
    })

    it('reports not_found when nothing is assigned', async () => {
      expect(await startEnrollment(payload, anna, 'Asia/Almaty')).toEqual({
        ok: false,
        error: 'not_found',
      })
    })
  })

  describe('6/8. one open program per student', () => {
    it('refuses a second program and names the current one', async () => {
      await assign(anna, a2b1)
      await expectInvalid(assign(anna, a1a2), 'У ученика уже есть программа: Program A2 → B1')
    })

    it('lets the owner change the program while it is assigned, not after the start', async () => {
      const enrollment = await assign(anna, a2b1)
      const changed = await payload.update({
        collection: 'enrollments',
        id: enrollment.id,
        overrideAccess: false,
        user: owner,
        data: { program: a1a2.id },
      })
      expect(typeof changed.program === 'object' ? changed.program.id : changed.program).toBe(
        a1a2.id,
      )

      await startEnrollment(payload, anna, 'Asia/Almaty')
      await expectInvalid(
        payload.update({
          collection: 'enrollments',
          id: enrollment.id,
          overrideAccess: false,
          user: owner,
          data: { program: a2b1.id },
        }),
        'Программу можно сменить, только пока ученик не начал',
      )
    })

    it('assigns the next program once the previous one is finished; history stays', async () => {
      const first = await assign(anna, a2b1)
      await payload.update({
        collection: 'enrollments',
        id: first.id,
        overrideAccess: false,
        user: owner,
        data: { status: 'finished' },
      })
      await assign(anna, a1a2)
      const { totalDocs } = await payload.count({
        collection: 'enrollments',
        where: { student: { equals: anna.id } },
      })
      expect(totalDocs).toBe(2)
    })
  })

  describe('9. only published programs', () => {
    it('refuses a draft program', async () => {
      await expectInvalid(assign(anna, draft), 'Назначить можно только опубликованную программу')
    })
  })

  describe('10/12. placement validation', () => {
    it.each([
      [{ ...ielts45, score: 9.5 }, 'IELTS: балл от 0 до 9 с шагом 0,5'],
      [{ ...ielts45, score: 4.3 }, 'IELTS: балл от 0 до 9 с шагом 0,5'],
      [{ ...ielts45, test: 'toefl', score: 121 }, 'TOEFL iBT: балл от 0 до 120'],
      [
        { ...ielts45, test: 'cambridge', score: 175 },
        'Cambridge: выберите экзамен (KET, PET, FCE, CAE, CPE)',
      ],
      [
        { ...ielts45, takenAt: new Date(Date.now() + 3 * 864e5).toISOString() },
        'Дата теста: не позже сегодняшнего дня',
      ],
    ])('refuses %o', async (placement, message) => {
      await expectInvalid(assign(anna, a2b1, placement), message)
    })

    it('needs only the CEFR level for Murad’s test and drops a stray score', async () => {
      const doc = await assign(anna, a2b1, {
        test: 'murad',
        score: 7,
        cefr: 'A2',
        takenAt: '2026-10-01T12:00:00.000Z',
      })
      expect(doc.placement.score ?? null).toBeNull()
      expect(doc.placement.cefr).toBe('A2')
    })
  })

  describe('13. access', () => {
    it('a student cannot create an enrollment', async () => {
      const error = await rejection(
        payload.create({
          collection: 'enrollments',
          overrideAccess: false,
          user: anna,
          data: {
            student: anna.id as number,
            program: a2b1.id,
            placement: ielts45,
          } as unknown as Enrollment,
        }),
      )
      expect(error.status).toBe(403)
    })

    it('a student cannot change her program or placement', async () => {
      const enrollment = await assign(anna, a2b1)
      for (const data of [{ program: a1a2.id }, { placement: { ...ielts45, cefr: 'C1' } }]) {
        const error = await rejection(
          payload.update({
            collection: 'enrollments',
            id: enrollment.id,
            overrideAccess: false,
            user: anna,
            data: data as Partial<Enrollment>,
          }),
        )
        expect(error.status).toBe(403)
      }
      const stored = await payload.findByID({ collection: 'enrollments', id: enrollment.id })
      expect(stored.placement.cefr).toBe('A2')
    })

    it('a student cannot backdate her start', async () => {
      const enrollment = await assign(anna, a2b1)
      const started = await payload.update({
        collection: 'enrollments',
        id: enrollment.id,
        overrideAccess: false,
        user: anna,
        data: { status: 'active', timezone: 'Asia/Almaty', startDate: '2020-01-01T00:00:00.000Z' },
      })
      expect(started.startDate?.slice(0, 10)).toBe(todayIn('Asia/Almaty'))
    })

    it('a student reads her own enrollment without the note, and nobody else’s', async () => {
      await assign(anna, a2b1)
      await assign(boris, a1a2)
      const { docs } = await payload.find({
        collection: 'enrollments',
        overrideAccess: false,
        user: anna,
        depth: 0,
      })
      expect(docs).toHaveLength(1)
      expect(docs[0]?.placement.cefr).toBe('A2')
      expect(docs[0]?.placement).not.toHaveProperty('note')

      const ownerView = await payload.find({
        collection: 'enrollments',
        overrideAccess: false,
        user: owner,
        where: { student: { equals: anna.id } },
      })
      expect(ownerView.docs[0]?.placement.note).toBe('Слабое аудирование')
    })

    it('a student cannot start or delete someone else’s enrollment', async () => {
      const borisEnrollment = await assign(boris, a1a2)
      const update = await rejection(
        payload.update({
          collection: 'enrollments',
          id: borisEnrollment.id,
          overrideAccess: false,
          user: anna,
          data: { status: 'active', timezone: 'Asia/Almaty' },
        }),
      )
      expect([403, 404]).toContain(update.status)
      const remove = await rejection(
        payload.delete({
          collection: 'enrollments',
          id: borisEnrollment.id,
          overrideAccess: false,
          user: anna,
        }),
      )
      expect(remove.status).toBe(403)
    })

    it('an anonymous caller reads nothing', async () => {
      await assign(anna, a2b1)
      const error = await rejection(
        payload.find({ collection: 'enrollments', overrideAccess: false }),
      )
      expect(error.status).toBe(403)
    })
  })

  describe('integrity', () => {
    it('a program a student was assigned cannot be deleted', async () => {
      await assign(anna, a1a2)
      await expectInvalid(
        payload.delete({ collection: 'programs', id: a1a2.id, overrideAccess: false, user: owner }),
        'Программа назначена ученикам — её нельзя удалить. Сними её с публикации.',
      )
    })

    it('a student cannot filter by the private note', async () => {
      await assign(anna, a2b1)
      const result = await payload
        .find({
          collection: 'enrollments',
          overrideAccess: false,
          user: anna,
          where: { 'placement.note': { like: 'Слаб' } },
        })
        .then(
          (found) => found.docs.length,
          () => 'refused',
        )
      expect(result).toBe('refused')
    })
  })

  describe('15. deleting a student', () => {
    it('deletes her enrollments with her', async () => {
      const gone = await student(emails.gone)
      await assign(gone, a2b1)
      await payload.delete({ collection: 'users', id: gone.id })
      const { totalDocs } = await payload.count({
        collection: 'enrollments',
        where: { student: { equals: gone.id } },
      })
      expect(totalDocs).toBe(0)
    })
  })
})
