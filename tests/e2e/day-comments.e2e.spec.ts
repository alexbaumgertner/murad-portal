import { expect, test, type Page } from '@playwright/test'
import { getPayload } from 'payload'

import { todayIn } from '../../src/features/enrollments/shape'
import { dateOfDay } from '../../src/features/study-today/shape'
import config from '../../src/payload.config'
import { clearTestLoginCodes, E2E_CODE, issueKnownCode, login } from '../helpers/login'
import { cleanupTestUser, seedTestUser } from '../helpers/seedUser'

const context = { disableRevalidate: true }

async function seed(suffix: string) {
  const payload = await getPayload({ config })
  await cleanup(suffix)
  const rest = { slots: [] }
  return payload.create({
    collection: 'programs',
    context,
    data: {
      slug: `e2e-comments-${suffix}`,
      title: `E2E комментарии ${suffix}`,
      levelFrom: 'B1',
      levelTo: 'B2',
      durationWeeks: 8,
      status: 'published',
      weekTemplate: [rest, rest, rest, rest, rest, rest, rest],
    } as never,
  })
}

async function cleanup(suffix: string) {
  const payload = await getPayload({ config })
  await payload.delete({
    collection: 'day-comments',
    where: { 'enrollment.program.slug': { equals: `e2e-comments-${suffix}` } },
  })
  await payload.delete({
    collection: 'enrollments',
    where: { 'program.slug': { equals: `e2e-comments-${suffix}` } },
  })
  await payload.delete({
    collection: 'programs',
    where: { slug: { equals: `e2e-comments-${suffix}` } },
    context,
  })
}

/** Assigns and starts so that today is program day 10 in Asia/Almaty (week 2, days 8–14). */
async function enrollAtDay10(email: string, programId: number, name: string) {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    depth: 0,
  })
  await payload.update({ collection: 'users', id: docs[0]!.id, data: { name } })
  const enrollment = await payload.create({
    collection: 'enrollments',
    data: {
      student: docs[0]!.id,
      program: programId,
      placement: { test: 'murad', cefr: 'B1', takenAt: '2026-10-01T12:00:00.000Z' },
    } as never,
  })
  const startDate = dateOfDay(todayIn('Asia/Almaty'), 2 - 10)
  await payload.db.updateOne({
    collection: 'enrollments',
    id: enrollment.id,
    data: { status: 'active', timezone: 'Asia/Almaty', startDate: `${startDate}T00:00:00.000Z` },
  })
  return { enrollment, startDate, studentId: docs[0]!.id }
}

async function studentSignsIn(page: Page, email: string) {
  await clearTestLoginCodes(email)
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `e2e:${email}` })
  await page.goto('/login')
  await page.getByLabel('Почта').fill(email)
  await page.getByRole('button', { name: 'Получить код' }).click()
  await expect(page.getByLabel('Код из письма')).toBeVisible()
  await issueKnownCode(email)
  await page.getByLabel('Код из письма').fill(E2E_CODE)
  await page.getByRole('button', { name: 'Войти' }).click()
  await page.waitForURL(/\/study$/)
}

/** The calendar day `n` days before `today` (`dateOfDay` counts program days: day 1 is `today`). */
const daysBefore = (today: string, n: number) => dateOfDay(today, 1 - n)

const stored = async (enrollmentId: number) => {
  const payload = await getPayload({ config })
  return (
    await payload.find({
      collection: 'day-comments',
      where: { enrollment: { equals: enrollmentId } },
      sort: 'date',
      pagination: false,
      depth: 0,
    })
  ).docs
}

test.describe('Day comments (story 016)', () => {
  test('1/3/4/5. write, replace, clear, too long; no field on a future day; no horizontal scroll', async ({
    page,
  }, testInfo) => {
    const suffix = `comment-${testInfo.project.name}`
    const program = await seed(suffix)
    const email = await seedTestUser(suffix, 'student')
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    try {
      const { enrollment } = await enrollAtDay10(email, program.id, 'Анна')
      await studentSignsIn(page, email)

      // 1. today
      const field = page.getByLabel('Комментарий к дню')
      await expect(field).toBeVisible()
      await field.fill('Не понял Present Perfect в серии 3')
      await page.getByRole('button', { name: 'Сохранить' }).click()
      await expect(
        page.getByRole('status').filter({ hasText: /Сохранено|Комментарий удалён/ }),
      ).toHaveText('Сохранено')
      expect(await stored(enrollment.id)).toMatchObject([
        { text: 'Не понял Present Perfect в серии 3' },
      ])
      // …and it is shown under the day after a reload
      await page.reload()
      await expect(page.getByLabel('Комментарий к дню')).toHaveValue(
        'Не понял Present Perfect в серии 3',
      )

      // 3. saving again replaces the text
      await page.getByLabel('Комментарий к дню').fill('Теперь понял')
      await page.getByRole('button', { name: 'Сохранить' }).click()
      await expect(
        page.getByRole('status').filter({ hasText: /Сохранено|Комментарий удалён/ }),
      ).toHaveText('Сохранено')
      expect(await stored(enrollment.id)).toMatchObject([{ text: 'Теперь понял' }])

      // 4. 1001 characters
      await page.getByLabel('Комментарий к дню').fill('я'.repeat(1001))
      await expect(
        page.getByRole('alert').filter({ hasText: 'Не больше 1000 символов' }),
      ).toHaveText('Не больше 1000 символов')
      expect(await stored(enrollment.id)).toMatchObject([{ text: 'Теперь понял' }])

      // 3. empty text deletes
      await page.getByLabel('Комментарий к дню').fill('')
      await page.getByRole('button', { name: 'Сохранить' }).click()
      await expect(
        page.getByRole('status').filter({ hasText: /Сохранено|Комментарий удалён/ }),
      ).toHaveText('Комментарий удалён')
      expect(await stored(enrollment.id)).toEqual([])

      // a past day of this week has its own comment
      await page.goto('/study?day=9')
      await page.getByLabel('Комментарий к дню').fill('Вчера было тяжело')
      await page.getByRole('button', { name: 'Сохранить' }).click()
      await expect(
        page.getByRole('status').filter({ hasText: /Сохранено|Комментарий удалён/ }),
      ).toHaveText('Сохранено')
      expect(await stored(enrollment.id)).toMatchObject([
        {
          text: 'Вчера было тяжело',
          date: `${daysBefore(todayIn('Asia/Almaty'), 1)}T00:00:00.000Z`,
        },
      ])

      // 5. a future day has no comment field
      await page.goto('/study?day=11')
      await expect(page.getByRole('heading', { name: /День 11/ })).toBeVisible()
      await expect(page.getByLabel('Комментарий к дню')).toHaveCount(0)

      // 360px: no horizontal scroll
      await page.goto('/study')
      await expect(page.getByLabel('Комментарий к дню')).toBeVisible()
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true)
      expect(errors).toEqual([])
    } finally {
      await cleanupTestUser(suffix)
      await cleanup(suffix)
    }
  })

  test('2/6. Murad reads the list newest first and filters by student; a student gets 403 on the API', async ({
    page,
    browser,
  }, testInfo) => {
    const suffix = `comment-admin-${testInfo.project.name}`
    const program = await seed(suffix)
    const annaEmail = await seedTestUser(`${suffix}-anna`, 'student')
    const borisEmail = await seedTestUser(`${suffix}-boris`, 'student')
    const ownerEmail = await seedTestUser(suffix)
    try {
      const anna = await enrollAtDay10(annaEmail, program.id, `Анна ${suffix}`)
      const boris = await enrollAtDay10(borisEmail, program.id, `Борис ${suffix}`)
      const payload = await getPayload({ config })
      const today = todayIn('Asia/Almaty')
      const create = (enrollment: number, date: string, text: string) =>
        payload.create({
          collection: 'day-comments',
          data: { enrollment, date: `${date}T00:00:00.000Z`, text },
        })
      await create(anna.enrollment.id, daysBefore(today, 2), 'старый вопрос Анны')
      await create(anna.enrollment.id, today, 'новый вопрос Анны')
      await create(boris.enrollment.id, daysBefore(today, 1), 'вопрос Бориса')

      await login({ page, email: ownerEmail })
      await page.goto('/admin/collections/day-comments')
      await expect(page.getByRole('heading', { name: 'Комментарии учеников' })).toBeVisible()
      const rows = page.getByRole('row').filter({ hasText: suffix })
      await expect(rows).toHaveCount(3)
      await expect(rows.nth(0)).toContainText('новый вопрос Анны')
      await expect(rows.nth(1)).toContainText('вопрос Бориса')
      await expect(rows.nth(2)).toContainText('старый вопрос Анны')
      await expect(rows.nth(0)).toContainText(`Анна ${suffix}`)
      await expect(rows.nth(0)).toContainText(`E2E комментарии ${suffix}`)
      await expect(rows.nth(0)).toContainText('10')
      await expect(rows.nth(2)).toContainText('8')

      // filter by student
      const annaId = anna.studentId
      await page.goto(`/admin/collections/day-comments?where[and][0][student][equals]=${annaId}`)
      await expect(page.getByRole('row').filter({ hasText: suffix })).toHaveCount(2)
      await expect(page.getByText('вопрос Бориса')).toHaveCount(0)

      // 6. Boris, signed in, gets nothing of Anna's through the REST API
      const student = await (await browser.newContext()).newPage()
      await studentSignsIn(student, borisEmail)
      const answer = await student.request.get('/api/day-comments?limit=50')
      const body = await answer.json()
      expect(JSON.stringify(body)).not.toContain('вопрос Анны')
      const write = await student.request.post('/api/day-comments', {
        data: { enrollment: anna.enrollment.id, date: today, text: 'взлом' },
      })
      expect(write.status()).toBe(403)
      expect(await stored(anna.enrollment.id)).toHaveLength(2)
      // anonymous
      const anonymous = await (await browser.newContext()).request.get('/api/day-comments')
      expect(anonymous.status()).toBe(403)
    } finally {
      await cleanupTestUser(`${suffix}-anna`)
      await cleanupTestUser(`${suffix}-boris`)
      await cleanupTestUser(suffix)
      await cleanup(suffix)
    }
  })
})
