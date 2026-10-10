import { expect, test, type Page } from '@playwright/test'
import { getPayload } from 'payload'

import { dateOfDay } from '../../src/features/study-today/shape'
import { todayIn } from '../../src/features/enrollments/shape'
import config from '../../src/payload.config'
import { clearTestLoginCodes, E2E_CODE, issueKnownCode, login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUserEmail } from '../helpers/seedUser'

const context = { disableRevalidate: true, skipEmail: true }

async function seed(suffix: string) {
  const payload = await getPayload({ config })
  await cleanup(suffix)
  const anki = await payload.create({
    collection: 'slot-types',
    context,
    data: { name: `Anki ${suffix}`, defaultMinMinutes: 20 },
  })
  const day = (slots: object[]) => ({ slots })
  const program = await payload.create({
    collection: 'programs',
    context,
    data: {
      slug: `e2e-owner-${suffix}`,
      title: `E2E ученики ${suffix}`,
      levelFrom: 'B1',
      levelTo: 'B2',
      durationWeeks: 8,
      status: 'published',
      weekTemplate: [
        day([{ slotType: anki.id }]),
        day([]),
        day([]),
        day([]),
        day([]),
        day([]),
        day([]),
      ],
    } as never,
  })
  return { program, anki }
}

async function cleanup(suffix: string) {
  const payload = await getPayload({ config })
  await payload.delete({
    collection: 'enrollments',
    where: { 'program.slug': { equals: `e2e-owner-${suffix}` } },
    context,
  })
  await payload.delete({
    collection: 'programs',
    where: { slug: { equals: `e2e-owner-${suffix}` } },
    context,
  })
  await payload.delete({ collection: 'slot-types', where: { name: { like: suffix } }, context })
}

async function enroll(
  email: string,
  programId: number,
  state: 'assigned' | { day: number },
): Promise<number> {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    depth: 0,
  })
  const enrollment = await payload.create({
    collection: 'enrollments',
    context,
    data: {
      student: docs[0]!.id,
      program: programId,
      placement: { test: 'murad', cefr: 'B1', takenAt: '2026-10-01T12:00:00.000Z' },
    } as never,
  })
  if (state !== 'assigned') {
    const start = dateOfDay(todayIn('Asia/Almaty'), 2 - state.day)
    await payload.db.updateOne({
      collection: 'enrollments',
      id: enrollment.id,
      data: { status: 'active', timezone: 'Asia/Almaty', startDate: `${start}T00:00:00.000Z` },
    })
  }
  return enrollment.id
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

test.describe('The owner sees student progress (story 019)', () => {
  test('1. anonymous is sent to sign-in, a student gets «not found», the owner sees the page', async ({
    page,
  }, testInfo) => {
    const suffix = `own-access-${testInfo.project.name}`
    const ownerSuffix = `${suffix}-owner`
    const studentEmail = await seedTestUser(suffix, 'student')
    await seedTestUser(ownerSuffix, 'owner')
    try {
      // Anonymous: the sign-in page, which brings the owner back here.
      await page.goto('/study/students')
      await expect(page).toHaveURL(/\/admin\/login\?redirect=%2Fstudy%2Fstudents/, {
        timeout: 30_000,
      })

      // A student: the page does not exist for her, and says nothing about anyone else.
      await studentSignsIn(page, studentEmail)
      // (`study/loading.tsx` streams the page, so the status line is 200 and the body says so.)
      await page.goto('/study/students')
      await expect(page.getByRole('heading', { name: 'Страница не найдена' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Ученики' })).toHaveCount(0)
      await page.goto('/study/students/1')
      await expect(page.getByRole('heading', { name: 'Страница не найдена' })).toBeVisible()

      // The owner.
      await page.context().clearCookies()
      await login({ page, email: testUserEmail(ownerSuffix) })
      await page.goto('/study/students')
      await expect(page.getByRole('heading', { name: 'Ученики' })).toBeVisible()
    } finally {
      await cleanupTestUser(suffix)
      await cleanupTestUser(ownerSuffix)
    }
  })

  test('2–5. the list, a student’s page with read-only grids and comments, empty states, 360 px', async ({
    page,
  }, testInfo) => {
    const suffix = `own-view-${testInfo.project.name}`
    const ownerSuffix = `${suffix}-owner`
    const { program } = await seed(suffix)
    const activeEmail = await seedTestUser(`${suffix}-a`, 'student')
    const freshEmail = await seedTestUser(`${suffix}-b`, 'student')
    const ownerEmail = await seedTestUser(ownerSuffix, 'owner')
    const payload = await getPayload({ config })
    await payload.update({
      collection: 'users',
      where: { email: { equals: activeEmail } },
      data: { name: `Анна ${suffix}` },
      context,
    })
    await payload.update({
      collection: 'users',
      where: { email: { equals: freshEmail } },
      data: { name: `Борис ${suffix}` },
      context,
    })
    try {
      const activeId = await enroll(activeEmail, program.id, { day: 10 })
      const freshId = await enroll(freshEmail, program.id, 'assigned')
      await payload.create({
        collection: 'day-comments',
        context,
        data: {
          enrollment: activeId,
          student: (
            await payload.find({ collection: 'users', where: { email: { equals: activeEmail } } })
          ).docs[0]!.id,
          date: `${todayIn('Asia/Almaty')}T00:00:00.000Z`,
          text: 'Было тяжело.\nЗавтра повторю.',
        },
      })

      await login({ page, email: ownerEmail })
      await page.goto('/study/students')

      // 2. the list: the started student with her numbers, the other with her status only
      const active = page.getByRole('link', { name: `Открыть: Анна ${suffix}` })
      await expect(active).toContainText('Идёт')
      await expect(active).toContainText('День 10 из 56')
      await expect(active).toContainText('Дней выполнено')
      const fresh = page.getByRole('link', { name: `Открыть: Борис ${suffix}` })
      await expect(fresh).toContainText('Назначена')
      await expect(fresh).toContainText('Ещё не начато')

      // 3/4. her page: this and the previous week, no link in the grids, the comment with its day
      await active.click()
      await expect(page).toHaveURL(new RegExp(`/study/students/${activeId}$`))
      await expect(page.getByRole('heading', { name: `Анна ${suffix}` })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Неделя 1' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Неделя 2' })).toBeVisible()
      const grid = page.getByRole('list', { name: 'Дни недели 2' })
      await expect(grid.getByRole('img')).toHaveCount(7)
      await expect(grid.getByRole('link')).toHaveCount(0)
      await expect(page.getByText('Было тяжело.')).toBeVisible()
      await expect(page.getByText(/· день 10$/)).toBeVisible()

      // 5. nothing started and nothing written: empty states, not blanks
      await page.goto(`/study/students/${freshId}`)
      await expect(page.getByText('Ещё не начато')).toBeVisible()
      await expect(page.getByText('Комментариев пока нет.')).toBeVisible()

      // 6. an id that does not exist
      await page.goto('/study/students/999999999')
      await expect(page.getByRole('heading', { name: 'Страница не найдена' })).toBeVisible()

      // 8. 360 px: nothing wider than the screen, on the list and on a student's page
      await page.setViewportSize({ width: 360, height: 740 })
      for (const path of ['/study/students', `/study/students/${activeId}`]) {
        await page.goto(path)
        const width = await page.evaluate(() => document.documentElement.scrollWidth)
        expect(width).toBeLessThanOrEqual(360)
      }
    } finally {
      await cleanupTestUser(`${suffix}-a`)
      await cleanupTestUser(`${suffix}-b`)
      await cleanupTestUser(ownerSuffix)
      await cleanup(suffix)
    }
  })
})
