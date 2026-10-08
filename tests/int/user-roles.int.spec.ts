import config from '@payload-config'
import { getPayload, type Payload, type TypedUser } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { currentAdmin } from '@/features/auth/current-user'
import { issueToken, SESSION_COOKIE } from '@/features/auth/session'
import { Media } from '@/collections/Media'
import { Users } from '@/collections/Users'

let payload: Payload
let owner: TypedUser
let anna: TypedUser
let boris: TypedUser

const context = { disableRevalidate: true }
const emails = {
  owner: 'roles-owner@example.com',
  anna: 'roles-anna@example.com',
  boris: 'roles-boris@example.com',
  created: 'roles-created@example.com',
  legacy: 'roles-legacy@example.com',
}

const asUser = (doc: { id: number | string }): TypedUser =>
  ({ ...doc, collection: 'users' }) as unknown as TypedUser

async function cleanup() {
  await payload.delete({
    collection: 'users',
    where: { email: { in: Object.values(emails) } },
    context,
  })
}

describe('user roles (story 011a)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    await cleanup()
    owner = asUser(
      await payload.create({ collection: 'users', data: { email: emails.owner, role: 'owner' } }),
    )
    anna = asUser(
      await payload.create({
        collection: 'users',
        data: { email: emails.anna, role: 'student', name: 'Anna' },
      }),
    )
    boris = asUser(
      await payload.create({ collection: 'users', data: { email: emails.boris, role: 'student' } }),
    )
  })

  afterAll(async () => {
    await payload.delete({ collection: 'waitlist-signups', where: { id: { exists: true } } })
    await cleanup()
    await payload.destroy()
  })

  describe('data model', () => {
    it('defaults to owner, locale ru and addressForm ty (existing users keep admin access)', async () => {
      const legacy = await payload.create({
        collection: 'users',
        data: { email: emails.legacy } as never, // role intentionally omitted: the default applies
      })
      expect(legacy.role).toBe('owner')
      expect(legacy.locale).toBe('ru')
      expect(legacy.addressForm).toBe('ty')
    })

    it('rejects an unknown role, a name over 80 characters and an unknown addressForm', async () => {
      const create = (data: Record<string, unknown>) =>
        payload.create({
          collection: 'users',
          data: { email: 'roles-bad@example.com', ...data } as never,
        })
      await expect(create({ role: 'teacher' })).rejects.toThrow()
      await expect(create({ role: 'student', name: 'x'.repeat(81) })).rejects.toThrow()
      await expect(create({ role: 'student', addressForm: 'thou' })).rejects.toThrow()
    })
  })

  describe('owner', () => {
    it('adds a student and presets addressForm and invitedAt', async () => {
      const created = await payload.create({
        collection: 'users',
        overrideAccess: false,
        user: owner,
        data: {
          email: emails.created,
          role: 'student',
          addressForm: 'vy',
          invitedAt: '2026-10-08T10:00:00.000Z',
        },
      })
      expect(created.role).toBe('student')
      expect(created.addressForm).toBe('vy')
      expect(created.invitedAt).toBe('2026-10-08T10:00:00.000Z')
    })

    it('reads all users and may delete a student', async () => {
      const all = await payload.find({
        collection: 'users',
        overrideAccess: false,
        user: owner,
        limit: 100,
      })
      expect(all.docs.map((d) => d.email)).toEqual(
        expect.arrayContaining([emails.owner, emails.anna, emails.boris]),
      )
      await payload.delete({
        collection: 'users',
        overrideAccess: false,
        user: owner,
        where: { email: { equals: emails.created } },
      })
      const left = await payload.count({
        collection: 'users',
        where: { email: { equals: emails.created } },
      })
      expect(left.totalDocs).toBe(0)
    })
  })

  describe('student [access] (criteria 6 and 7 at API level)', () => {
    it('has no admin panel access, the owner has', () => {
      const admin = Users.access?.admin
      expect(admin).toBeTypeOf('function')
      expect(admin!({ req: { user: anna } } as never)).toBe(false)
      expect(admin!({ req: { user: owner } } as never)).toBe(true)
    })

    it('is not an admin for the site (currentAdmin)', async () => {
      const header = (u: TypedUser) =>
        new Headers({ cookie: `${SESSION_COOKIE}=${issueToken(u.id, payload.secret).token}` })
      expect((await currentAdmin(payload, header(anna)))?.email).toBeUndefined()
      expect((await currentAdmin(payload, header(owner)))?.email).toBe(emails.owner)
    })

    it("cannot read another user's record, only her own", async () => {
      const list = await payload.find({
        collection: 'users',
        overrideAccess: false,
        user: anna,
        limit: 100,
      })
      expect(list.docs.map((d) => d.email)).toEqual([emails.anna])
      await expect(
        payload.findByID({ collection: 'users', id: boris.id, overrideAccess: false, user: anna }),
      ).rejects.toThrow()
      const own = await payload.findByID({
        collection: 'users',
        id: anna.id,
        overrideAccess: false,
        user: anna,
      })
      expect(own.email).toBe(emails.anna)
    })

    it("cannot update or delete another user's record", async () => {
      await expect(
        payload.update({
          collection: 'users',
          id: boris.id,
          data: { name: 'Hacked' },
          overrideAccess: false,
          user: anna,
        }),
      ).rejects.toThrow()
      await expect(
        payload.delete({ collection: 'users', id: boris.id, overrideAccess: false, user: anna }),
      ).rejects.toThrow()
    })

    it('cannot create users', async () => {
      await expect(
        payload.create({
          collection: 'users',
          data: { email: 'roles-friend@example.com', role: 'student' },
          overrideAccess: false,
          user: anna,
        }),
      ).rejects.toThrow()
    })

    it('edits her own name, locale and addressForm', async () => {
      const updated = await payload.update({
        collection: 'users',
        id: anna.id,
        data: { name: 'Anna K.', locale: 'en', addressForm: 'vy' },
        overrideAccess: false,
        user: anna,
      })
      expect(updated).toMatchObject({ name: 'Anna K.', locale: 'en', addressForm: 'vy' })
    })

    it('cannot promote herself or change her invitedAt (the fields are ignored)', async () => {
      const result = await payload.update({
        collection: 'users',
        id: anna.id,
        data: { role: 'owner', invitedAt: '2020-01-01T00:00:00.000Z' },
        overrideAccess: false,
        user: anna,
      })
      expect(result.role).toBe('student')
      expect(result.invitedAt).toBeNull()
      const after = await payload.findByID({ collection: 'users', id: anna.id })
      expect(after.role).toBe('student')
    })

    it('cannot change her email (the login identity)', async () => {
      await expect(
        payload.update({
          collection: 'users',
          id: anna.id,
          data: { email: 'roles-anna-new@example.com' },
          overrideAccess: false,
          user: anna,
        }),
      ).rejects.toThrow()
      const after = await payload.findByID({ collection: 'users', id: anna.id })
      expect(after.email).toBe(emails.anna)
    })

    it('cannot write media (owner only)', () => {
      for (const op of ['create', 'update', 'delete'] as const) {
        expect(Media.access?.[op]?.({ req: { user: anna } } as never)).toBe(false)
        expect(Media.access?.[op]?.({ req: { user: owner } } as never)).toBe(true)
      }
    })

    it('has no owner powers over other collections', async () => {
      await expect(
        payload.find({ collection: 'waitlist-signups', overrideAccess: false, user: anna }),
      ).rejects.toThrow()
      await expect(
        payload.create({
          collection: 'waitlist-signups',
          data: { email: 'roles-w@example.com' } as never,
          overrideAccess: false,
          user: anna,
        }),
      ).rejects.toThrow()
    })

    it('does not see a non-public challenge (it is not an owner)', async () => {
      const slug = 'roles-private'
      await payload.delete({ collection: 'challenges', where: { slug: { equals: slug } }, context })
      await payload.create({
        collection: 'challenges',
        context,
        data: {
          title: 'Private',
          slug,
          isPublic: false,
          startDate: '2026-10-07T12:00:00.000Z',
          videos: Array.from({ length: 6 }, (_, i) => ({ title: `Topic ${i + 1}` })),
        } as never,
      })
      const asStudent = await payload.find({
        collection: 'challenges',
        where: { slug: { equals: slug } },
        overrideAccess: false,
        user: anna,
      })
      const asOwner = await payload.find({
        collection: 'challenges',
        where: { slug: { equals: slug } },
        overrideAccess: false,
        user: owner,
      })
      await payload.delete({ collection: 'challenges', where: { slug: { equals: slug } }, context })
      expect(asStudent.totalDocs).toBe(0)
      expect(asOwner.totalDocs).toBe(1)
    })
  })

  describe('deleting a student (criterion 10, sessions)', () => {
    it('ends her session: the cookie stops authenticating', async () => {
      const temp = await payload.create({
        collection: 'users',
        data: { email: emails.created, role: 'student' },
      })
      const headers = new Headers({
        cookie: `${SESSION_COOKIE}=${issueToken(temp.id, payload.secret).token}`,
      })
      expect((await payload.auth({ headers })).user?.email).toBe(emails.created)
      await payload.delete({
        collection: 'users',
        id: temp.id,
        overrideAccess: false,
        user: owner,
      })
      expect((await payload.auth({ headers })).user).toBeNull()
    })
  })
})
