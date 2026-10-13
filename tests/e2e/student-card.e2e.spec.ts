import { expect, test, type Page } from '@playwright/test'
import { getPayload } from 'payload'

import config from '../../src/payload.config'
import { issueToken, SESSION_COOKIE } from '../../src/features/auth/session'
import { cleanupTestUser, seedTestUser, testUserEmail } from '../helpers/seedUser'

// Story 021: the student's card on /study and her own header.

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)
const TEACHER_MENU = ['Обо мне', 'Подход', 'Материалы', 'Экзамены', 'FAQ', 'Челлендж', 'Войти']

/** Signs in with a session cookie signed like the real one: the code flow is covered by student.e2e. */
async function signIn(page: Page, email: string) {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({ collection: 'users', where: { email: { equals: email } } })
  const { token } = issueToken(docs[0]!.id, payload.secret)
  await page.context().addCookies([
    {
      name: SESSION_COOKIE,
      value: token,
      url: 'http://localhost',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
  await page.goto('/study')
}

async function cleanupAvatars(email: string) {
  const payload = await getPayload({ config })
  await payload.update({
    collection: 'users',
    where: { email: { equals: email } },
    data: { avatar: null },
  })
  await payload.delete({ collection: 'avatars', where: { id: { exists: true } } })
}

test.describe('Student header (story 021)', () => {
  test('a student sees her name and sign out, and none of the teacher menu', async ({
    page,
  }, testInfo) => {
    const suffix = `card-header-${testInfo.project.name}`
    const email = await seedTestUser(suffix, 'student')
    try {
      const payload = await getPayload({ config })
      await payload.update({
        collection: 'users',
        where: { email: { equals: email } },
        data: { name: 'Анна Петрова' },
      })
      await signIn(page, email)

      for (const path of ['/study', '/study/settings']) {
        await page.goto(path)
        const header = page.getByRole('banner')
        await expect(header.getByTestId('header-user')).toHaveText('Анна Петрова')
        await expect(header.getByRole('button', { name: 'Выйти' })).toBeVisible()
        await expect(header.getByRole('group', { name: 'Язык' })).toBeVisible()
        for (const item of TEACHER_MENU) {
          await expect(header.getByRole('link', { name: item, exact: true })).toHaveCount(0)
        }
      }
    } finally {
      await cleanupTestUser(suffix)
    }
  })

  test('a signed-out visitor keeps the public header', async ({ page }, testInfo) => {
    await page.goto('/')
    const header = page.getByRole('banner')
    await expect(header.getByRole('link', { name: 'Войти', exact: true })).toBeVisible()
    // The in-page anchors are hidden on narrow screens.
    if (testInfo.project.name === 'desktop') {
      await expect(header.getByRole('link', { name: 'Обо мне', exact: true })).toBeVisible()
    }
    await page.goto('/challenge')
    await expect(
      page.getByRole('banner').getByRole('link', { name: 'Войти', exact: true }),
    ).toBeVisible()
  })
})

test.describe('Owner header under /study (story 021, AC 12)', () => {
  test('the owner keeps the full public header on /study/students', async ({ page }, testInfo) => {
    const suffix = `card-owner-${testInfo.project.name}`
    const email = await seedTestUser(suffix, 'owner')
    try {
      await signIn(page, email)
      await page.goto('/study/students')
      const header = page.getByRole('banner')
      await expect(header).toHaveCount(1)
      await expect(header.getByRole('link', { name: 'Челлендж', exact: true })).toBeVisible()
      await expect(header.getByTestId('header-user')).toHaveCount(0)
    } finally {
      await cleanupTestUser(suffix)
    }
  })
})

test.describe('Student card (story 021)', () => {
  test('shows her details, with initials and no empty rows for a fresh student', async ({
    page,
  }, testInfo) => {
    const suffix = `card-fresh-${testInfo.project.name}`
    const email = await seedTestUser(suffix, 'student')
    try {
      await signIn(page, email)
      const card = page.getByTestId('student-card')
      await expect(card).toContainText(email)
      await expect(card.getByTestId('card-initials')).toHaveText(email[0]!.toUpperCase())
      await expect(card.getByTestId('card-level')).toHaveCount(0)
      await expect(card.getByTestId('card-goal')).toHaveCount(0)
      await expect(card.getByTestId('card-since')).toHaveCount(0)
      await expect(card).not.toContainText('undefined')
    } finally {
      await cleanupTestUser(suffix)
    }
  })

  test('shows name, level, goal and the start date Murad set; follows the language', async ({
    page,
  }, testInfo) => {
    const suffix = `card-full-${testInfo.project.name}`
    const email = await seedTestUser(suffix, 'student')
    const payload = await getPayload({ config })
    try {
      await payload.update({
        collection: 'users',
        where: { email: { equals: email } },
        data: { name: 'Анна Петрова', level: 'B1', goal: 'IELTS 6.5' },
      })
      const user = (
        await payload.find({ collection: 'users', where: { email: { equals: email } } })
      ).docs[0]!
      const program = await payload.create({
        collection: 'programs',
        context: { disableRevalidate: true },
        data: {
          slug: `card-${suffix}`,
          title: `Card ${suffix}`,
          levelFrom: 'A2',
          levelTo: 'B1',
          weekTemplate: Array.from({ length: 7 }, () => ({ slots: [] })),
          status: 'published',
        } as never,
      })
      await payload.create({
        collection: 'enrollments',
        context: { disableRevalidate: true },
        data: {
          student: user.id,
          program: program.id,
          placement: { test: 'murad', cefr: 'A2', takenAt: '2026-10-01T12:00:00.000Z' },
        } as never,
      })

      await signIn(page, email)
      const card = page.getByTestId('student-card')
      await expect(card).toContainText('Анна Петрова')
      await expect(card.getByTestId('card-level')).toHaveText('B1')
      await expect(card.getByTestId('card-goal')).toHaveText('IELTS 6.5')
      await expect(card.getByTestId('card-since')).toContainText('1 октября 2026')
      await expect(card.getByTestId('card-initials')).toHaveText('АП')

      await page.goto('/en/study')
      await expect(page.getByTestId('card-since')).toContainText('October 1, 2026')
      await expect(page.getByTestId('student-card')).toContainText('Level')
    } finally {
      await payload.delete({
        collection: 'enrollments',
        where: { id: { exists: true } },
        context: { disableRevalidate: true },
      })
      await payload.delete({
        collection: 'programs',
        where: { slug: { equals: `card-${suffix}` } },
        context: { disableRevalidate: true },
      })
      await cleanupTestUser(suffix)
    }
  })

  test('does not overflow at 360px', async ({ page }, testInfo) => {
    const suffix = `card-narrow-${testInfo.project.name}`
    const email = await seedTestUser(suffix, 'student')
    try {
      await page.setViewportSize({ width: 360, height: 740 })
      await signIn(page, email)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
    } finally {
      await cleanupTestUser(suffix)
    }
  })
})

test.describe('Avatar upload (story 021)', () => {
  test('uploads a photo, shows it on the card and removes it again', async ({ page }, testInfo) => {
    const suffix = `card-avatar-${testInfo.project.name}`
    const email = await seedTestUser(suffix, 'student')
    try {
      await signIn(page, email)
      await page.goto('/study/settings')
      await page.getByLabel('Выбрать фото').setInputFiles({
        name: 'me.png',
        mimeType: 'image/png',
        buffer: PNG,
      })
      await page.getByRole('button', { name: 'Загрузить' }).click()
      await expect(page.getByText('Фото сохранено')).toBeVisible()

      await page.goto('/study')
      await expect(page.getByTestId('student-card').getByRole('img')).toHaveAttribute(
        'src',
        /^\/api\/avatars\/file\//,
      )

      await page.goto('/study/settings')
      await page.getByRole('button', { name: 'Убрать фото' }).click()
      await expect(page.getByText('Фото удалено')).toBeVisible()
      await page.goto('/study')
      await expect(page.getByTestId('card-initials')).toBeVisible()
    } finally {
      await cleanupAvatars(testUserEmail(suffix))
      await cleanupTestUser(suffix)
    }
  })

  test('a PDF and a 3 MB image are refused with a message', async ({ page }, testInfo) => {
    const suffix = `card-avatar-bad-${testInfo.project.name}`
    const email = await seedTestUser(suffix, 'student')
    try {
      await signIn(page, email)
      await page.goto('/study/settings')
      const pick = page.getByLabel('Выбрать фото')

      await pick.setInputFiles({
        name: 'a.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4'),
      })
      await page.getByRole('button', { name: 'Загрузить' }).click()
      await expect(page.getByText('Нужна картинка JPEG, PNG или WebP.')).toBeVisible()

      await pick.setInputFiles({
        name: 'big.png',
        mimeType: 'image/png',
        buffer: Buffer.alloc(2 * 1024 * 1024 + 1),
      })
      await page.getByRole('button', { name: 'Загрузить' }).click()
      await expect(page.getByText('Фото больше 2 МБ.')).toBeVisible()
    } finally {
      await cleanupAvatars(testUserEmail(suffix))
      await cleanupTestUser(suffix)
    }
  })
})
