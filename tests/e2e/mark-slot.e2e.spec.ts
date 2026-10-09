import { expect, test, type Page } from '@playwright/test'
import { getPayload } from 'payload'

import { todayIn } from '../../src/features/enrollments/shape'
import { dateOfDay } from '../../src/features/study-today/shape'
import config from '../../src/payload.config'
import { clearTestLoginCodes, E2E_CODE, issueKnownCode } from '../helpers/login'
import { cleanupTestUser, seedTestUser } from '../helpers/seedUser'

const context = { disableRevalidate: true }

/** Template day 3 = [Anki 20, Сериал 40]; the other days rest. Day 10 is a day 3, a past day when today is day 11. */
async function seed(suffix: string) {
  const payload = await getPayload({ config })
  await cleanup(suffix)
  const anki = await payload.create({
    collection: 'slot-types',
    context,
    data: { name: `Anki ${suffix}`, defaultMinMinutes: 20 },
  })
  const series = await payload.create({
    collection: 'slot-types',
    context,
    data: { name: `Сериал ${suffix}`, defaultMinMinutes: 30 },
  })
  const rest = { slots: [] }
  const program = await payload.create({
    collection: 'programs',
    context,
    data: {
      slug: `e2e-mark-${suffix}`,
      title: `E2E отметка ${suffix}`,
      levelFrom: 'B1',
      levelTo: 'B2',
      durationWeeks: 8,
      status: 'published',
      weekTemplate: [
        rest,
        rest,
        { slots: [{ slotType: anki.id }, { slotType: series.id, minMinutes: 40 }] },
        rest,
        rest,
        rest,
        rest,
      ],
    } as never,
  })
  return { program, anki, series }
}

async function cleanup(suffix: string) {
  const payload = await getPayload({ config })
  await payload.delete({
    collection: 'enrollments',
    where: { 'program.slug': { equals: `e2e-mark-${suffix}` } },
  })
  await payload.delete({
    collection: 'programs',
    where: { slug: { equals: `e2e-mark-${suffix}` } },
    context,
  })
  await payload.delete({ collection: 'slot-types', where: { name: { like: suffix } }, context })
}

/** Assigns and starts so that today is program day 11 (day 10 is a past day with slots) in Asia/Almaty. */
async function enrollAtDay11(email: string, programId: number) {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    depth: 0,
  })
  const enrollment = await payload.create({
    collection: 'enrollments',
    data: {
      student: docs[0]!.id,
      program: programId,
      placement: { test: 'murad', cefr: 'B1', takenAt: '2026-10-01T12:00:00.000Z' },
    } as never,
  })
  const startDate = dateOfDay(todayIn('Asia/Almaty'), 2 - 11)
  await payload.db.updateOne({
    collection: 'enrollments',
    id: enrollment.id,
    data: { status: 'active', timezone: 'Asia/Almaty', startDate: `${startDate}T00:00:00.000Z` },
  })
  return { enrollment, startDate }
}

async function logs(enrollmentId: number) {
  const payload = await getPayload({ config })
  return (
    await payload.find({
      collection: 'slot-logs',
      where: { enrollment: { equals: enrollmentId } },
      sort: 'slotIndex',
      pagination: false,
      depth: 0,
    })
  ).docs
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

test.describe('Mark a slot manually (story 015)', () => {
  test('1/2/3/4/5. a missed past day: ✕ → ½ → ✓, repeat updates, 0 resets, 601 refused', async ({
    page,
  }, testInfo) => {
    const suffix = `mark-${testInfo.project.name}`
    const { program } = await seed(suffix)
    const email = await seedTestUser(suffix, 'student')
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    try {
      const { enrollment } = await enrollAtDay11(email, program.id)
      await studentSignsIn(page, email)

      const cell = page.getByRole('list', { name: 'Дни недели 2' }).getByRole('link').nth(2)
      await expect(cell).toHaveAccessibleName(/День 10, .*: Пропущено/)
      await cell.click()
      await page.waitForURL(/day=10/)
      const ankiName = `Anki ${suffix}`
      const seriesName = `Сериал ${suffix}`
      const slot = (name: string) => page.getByRole('listitem').filter({ hasText: name })

      // 1/2. Anki 30 of 20 → done, the day is ½
      await page.getByRole('button', { name: `Отметить вручную: ${ankiName}` }).click()
      await page.getByLabel(`Минут: ${ankiName}`).fill('30')
      await slot(ankiName).getByRole('button', { name: 'Сохранить' }).click()
      await expect(slot(ankiName).getByText('Минимум выполнен ✓')).toBeVisible()
      await expect(cell).toHaveAccessibleName(/День 10, .*: Выполнено частично/)
      expect(await logs(enrollment.id)).toMatchObject([
        { slotIndex: 0, minutes: 30, completed: true },
      ])

      // 4. 601 is refused in the form, nothing changes
      await page.getByRole('button', { name: `Отметить вручную: ${seriesName}` }).click()
      await page.getByLabel(`Минут: ${seriesName}`).fill('601')
      await slot(seriesName).getByRole('button', { name: 'Сохранить' }).click()
      await expect(page.getByRole('alert').filter({ hasText: 'Не больше 600 минут' })).toBeVisible()
      expect(await logs(enrollment.id)).toHaveLength(1)

      // 2. Series 25 of 40 → still not done (D-SP-7); 40 → the day is ✓
      await page.getByLabel(`Минут: ${seriesName}`).fill('25')
      await slot(seriesName).getByRole('button', { name: 'Сохранить' }).click()
      await expect(slot(seriesName).getByText('25 из 40 мин')).toBeVisible()
      await expect(cell).toHaveAccessibleName(/День 10, .*: Выполнено частично/)
      await page.getByRole('button', { name: `Отметить вручную: ${seriesName}` }).click()
      await page.getByLabel(`Минут: ${seriesName}`).fill('40')
      await slot(seriesName).getByRole('button', { name: 'Сохранить' }).click()
      await expect(cell).toHaveAccessibleName(/День 10, .*: Выполнено$/)

      // 3. marking again updated the same record; 0 resets the slot and the day goes back to ½
      expect(await logs(enrollment.id)).toHaveLength(2)
      await page.getByRole('button', { name: `Отметить вручную: ${seriesName}` }).click()
      await page.getByLabel(`Минут: ${seriesName}`).fill('0')
      await slot(seriesName).getByRole('button', { name: 'Сохранить' }).click()
      await expect(cell).toHaveAccessibleName(/День 10, .*: Выполнено частично/)
      expect(await logs(enrollment.id)).toMatchObject([
        { slotIndex: 0, minutes: 30, completed: true },
        { slotIndex: 1, minutes: 0, completed: false },
      ])
      expect(errors).toEqual([])
    } finally {
      await cleanupTestUser(suffix)
      await cleanup(suffix)
    }
  })

  test('5/7. a future day has no controls; today can be marked and replaces a running timer', async ({
    page,
  }, testInfo) => {
    const suffix = `mark-today-${testInfo.project.name}`
    const { program, anki } = await seed(suffix)
    const email = await seedTestUser(suffix, 'student')
    try {
      const { enrollment } = await enrollAtDay11(email, program.id)
      const payload = await getPayload({ config })
      await studentSignsIn(page, email)
      const slot = (name: string) => page.getByRole('listitem').filter({ hasText: name })

      // Day 17 is next week, not in the grid; a hand-made ?day=14 (a rest day ahead) has no slots.
      await page.goto('/study?day=14')
      await expect(page.getByRole('button', { name: /Отметить вручную/ })).toHaveCount(0)

      // Today is day 11 (template day 4, a rest day): move the program so that today is day 10.
      await payload.db.updateOne({
        collection: 'enrollments',
        id: enrollment.id,
        data: { startDate: `${dateOfDay(todayIn('Asia/Almaty'), 2 - 10)}T00:00:00.000Z` },
      })
      await payload.create({
        collection: 'slot-logs',
        data: {
          enrollment: enrollment.id,
          date: `${todayIn('Asia/Almaty')}T00:00:00.000Z`,
          slotIndex: 0,
          slotType: anki.id,
          minutes: 5,
          completed: false,
          timerStartedAt: new Date(Date.now() - 3 * 60_000).toISOString(),
        },
      })
      await page.goto('/study')
      await expect(page.getByRole('timer').first()).toBeVisible()
      await page.getByRole('button', { name: `Отметить вручную: Anki ${suffix}` }).click()
      await page.getByLabel(`Минут: Anki ${suffix}`).fill('15')
      await slot(`Anki ${suffix}`).getByRole('button', { name: 'Сохранить' }).click()
      await expect(page.getByText('15 из 20 мин')).toBeVisible()
      await expect(page.getByRole('timer')).toHaveCount(0)
      expect(await logs(enrollment.id)).toMatchObject([
        { slotIndex: 0, minutes: 15, completed: false, timerStartedAt: null },
      ])
    } finally {
      await cleanupTestUser(suffix)
      await cleanup(suffix)
    }
  })
})
