import config from '@payload-config'
import { getPayload, type Payload, type TypedUser } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { getStudentCard } from '@/features/students/queries'
import { removeAvatar, saveAvatar } from '@/features/students/service'
import { MAX_AVATAR_BYTES } from '@/features/students/shape'

// Story 021: the student's card (level, goal, start date, avatar) and who may write what.

let payload: Payload
let owner: TypedUser
let anna: TypedUser
let boris: TypedUser

const context = { disableRevalidate: true, skipEmail: true }
const emails = {
  owner: 'card-owner@example.com',
  anna: 'card-anna@example.com',
  boris: 'card-boris@example.com',
}

const asUser = (doc: { id: number | string }): TypedUser =>
  ({ ...doc, collection: 'users' }) as unknown as TypedUser

// A 1×1 PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)
const png = (name = 'me.png') => ({ data: PNG, name, type: 'image/png', size: PNG.length })

async function cleanup() {
  await payload.update({
    collection: 'users',
    where: { email: { in: Object.values(emails) } },
    data: { avatar: null },
    context,
  })
  await payload.delete({ collection: 'avatars', where: { id: { exists: true } }, context })
  await payload.delete({ collection: 'enrollments', where: { id: { exists: true } }, context })
  await payload.delete({ collection: 'programs', where: { id: { exists: true } }, context })
  await payload.delete({
    collection: 'users',
    where: { email: { in: Object.values(emails) } },
    context,
  })
}

async function rejection(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e as { status?: number },
  )
  if (!error) throw new Error('expected the write to be rejected')
  return error
}

describe('student card (story 021)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    await cleanup()
    owner = asUser(
      await payload.create({
        collection: 'users',
        context,
        data: { email: emails.owner, role: 'owner' },
      }),
    )
    anna = asUser(
      await payload.create({
        collection: 'users',
        context,
        data: { email: emails.anna, role: 'student', name: 'Anna Petrova' },
      }),
    )
    boris = asUser(
      await payload.create({
        collection: 'users',
        context,
        data: { email: emails.boris, role: 'student' },
      }),
    )
  })

  beforeEach(async () => {
    await removeAvatar(payload, anna)
    await removeAvatar(payload, boris)
    await payload.update({
      collection: 'users',
      where: { email: { in: [emails.anna, emails.boris] } },
      data: { level: null, goal: null },
      context,
    })
    await payload.delete({ collection: 'enrollments', where: { id: { exists: true } }, context })
  })

  afterAll(async () => {
    await cleanup()
    await payload.destroy()
  })

  describe('1, 5 — the card content', () => {
    it('shows name, email, level, goal and the date of the level test', async () => {
      await payload.update({
        collection: 'users',
        id: anna.id,
        data: { level: 'B1', goal: 'IELTS 6.5 до весны' },
        overrideAccess: false,
        user: owner,
      })
      const program = await payload.create({
        collection: 'programs',
        context,
        data: {
          slug: 'card-program',
          title: 'Card program',
          levelFrom: 'A2',
          levelTo: 'B1',
          weekTemplate: Array.from({ length: 7 }, () => ({ slots: [] })),
          status: 'published',
        } as never,
      })
      await payload.create({
        collection: 'enrollments',
        context,
        data: {
          student: anna.id,
          program: program.id,
          placement: { test: 'murad', cefr: 'A2', takenAt: '2026-10-01T12:00:00.000Z' },
        } as never,
      })

      const card = await getStudentCard(payload, anna)

      expect(card).toMatchObject({
        name: 'Anna Petrova',
        email: emails.anna,
        level: 'B1',
        goal: 'IELTS 6.5 до весны',
        startedAt: '2026-10-01',
        avatarUrl: null,
      })
    })

    it('has no level, goal, date or avatar for a student Murad has not set up yet', async () => {
      const card = await getStudentCard(payload, boris)
      expect(card).toEqual({
        name: null,
        email: emails.boris,
        level: null,
        goal: null,
        startedAt: null,
        avatarUrl: null,
      })
    })
  })

  describe('9, 11 — level and goal are Murad’s to write', () => {
    it('the owner sets them', async () => {
      const updated = await payload.update({
        collection: 'users',
        id: boris.id,
        data: { level: 'A2', goal: 'Работа' },
        overrideAccess: false,
        user: owner,
      })
      expect(updated).toMatchObject({ level: 'A2', goal: 'Работа' })
    })

    it('a student’s own write to them is dropped', async () => {
      await payload.update({
        collection: 'users',
        id: anna.id,
        data: { level: 'C2', goal: 'Hack' },
        overrideAccess: false,
        user: anna,
      })
      const fresh = await payload.findByID({ collection: 'users', id: anna.id })
      expect(fresh.level ?? null).toBeNull()
      expect(fresh.goal ?? null).toBeNull()
    })
  })

  describe('7, 8 — the avatar upload', () => {
    it('stores a PNG, links it to her and shows its URL on the card', async () => {
      expect(await saveAvatar(payload, anna, png())).toEqual({ ok: true })
      const card = await getStudentCard(payload, anna)
      expect(card.avatarUrl).toMatch(/^\/api\/avatars\/file\//)
    })

    it('replaces the old file: one avatar per student', async () => {
      await saveAvatar(payload, anna, png('first.png'))
      await saveAvatar(payload, anna, png('second.png'))
      const { totalDocs } = await payload.count({
        collection: 'avatars',
        where: { owner: { equals: anna.id } },
      })
      expect(totalDocs).toBe(1)
    })

    it('removes it again', async () => {
      await saveAvatar(payload, anna, png())
      await removeAvatar(payload, anna)
      expect((await getStudentCard(payload, anna)).avatarUrl).toBeNull()
      expect((await payload.count({ collection: 'avatars' })).totalDocs).toBe(0)
    })

    it('refuses a file whose bytes are not the image it claims to be', async () => {
      const fake = {
        data: Buffer.from('<script>alert(1)</script>'),
        name: 'x.png',
        type: 'image/png',
        size: 25,
      }
      expect(await saveAvatar(payload, anna, fake)).toEqual({ ok: false, error: 'invalid_type' })
      expect((await payload.count({ collection: 'avatars' })).totalDocs).toBe(0)
    })

    it('keeps the old photo when a replacement is refused', async () => {
      await saveAvatar(payload, anna, png('keep.png'))
      const fake = { data: Buffer.from('nope'), name: 'x.png', type: 'image/png', size: 4 }
      await saveAvatar(payload, anna, fake)
      expect((await getStudentCard(payload, anna)).avatarUrl).toContain('keep')
    })

    it('refuses a file over 2 MB and a non-image, and stores nothing', async () => {
      const big = {
        data: Buffer.alloc(MAX_AVATAR_BYTES + 1),
        name: 'b.png',
        type: 'image/png',
        size: MAX_AVATAR_BYTES + 1,
      }
      const pdf = { data: Buffer.from('%PDF-1.4'), name: 'a.pdf', type: 'application/pdf', size: 8 }
      expect(await saveAvatar(payload, anna, big)).toEqual({ ok: false, error: 'too_large' })
      expect(await saveAvatar(payload, anna, pdf)).toEqual({ ok: false, error: 'invalid_type' })
      expect((await payload.count({ collection: 'avatars' })).totalDocs).toBe(0)
    })
  })

  describe('10 — nobody else reads or changes her avatar', () => {
    it('another student cannot read it', async () => {
      await saveAvatar(payload, anna, png())
      const { docs } = await payload.find({
        collection: 'avatars',
        overrideAccess: false,
        user: boris,
      })
      expect(docs).toEqual([])
    })

    it('an anonymous caller is refused', async () => {
      await saveAvatar(payload, anna, png())
      const error = await rejection(
        payload.find({ collection: 'avatars', overrideAccess: false, user: null }),
      )
      expect(error.status).toBe(403)
    })

    it('another student cannot replace or delete it', async () => {
      await saveAvatar(payload, anna, png())
      const { docs } = await payload.find({ collection: 'avatars', limit: 1 })
      const id = docs[0]?.id as number
      await rejection(
        payload.delete({ collection: 'avatars', id, overrideAccess: false, user: boris }),
      )
      expect((await payload.count({ collection: 'avatars' })).totalDocs).toBe(1)
    })

    it('a student cannot link another student’s avatar to her own record', async () => {
      await saveAvatar(payload, anna, png())
      const { docs } = await payload.find({ collection: 'avatars', limit: 1 })
      await rejection(
        payload.update({
          collection: 'users',
          id: boris.id,
          data: { avatar: docs[0]?.id as number },
          overrideAccess: false,
          user: boris,
        }),
      )
      expect(
        (await payload.findByID({ collection: 'users', id: boris.id })).avatar ?? null,
      ).toBeNull()
    })

    it('a student cannot hand her avatar to someone else by changing its owner', async () => {
      await saveAvatar(payload, anna, png())
      const { docs } = await payload.find({ collection: 'avatars', limit: 1 })
      await payload.update({
        collection: 'avatars',
        id: docs[0]?.id as number,
        data: { owner: boris.id },
        overrideAccess: false,
        user: anna,
      })
      const after = await payload.findByID({
        collection: 'avatars',
        id: docs[0]?.id as number,
        depth: 0,
      })
      expect(after.owner).toBe(anna.id)
    })

    it('the owner may read it', async () => {
      await saveAvatar(payload, anna, png())
      const { docs } = await payload.find({
        collection: 'avatars',
        overrideAccess: false,
        user: owner,
      })
      expect(docs).toHaveLength(1)
    })
  })
})

vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
