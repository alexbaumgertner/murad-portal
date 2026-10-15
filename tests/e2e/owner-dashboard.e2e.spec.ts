import { expect, test } from '@playwright/test'
import { getPayload } from 'payload'

import { mondayOf } from '../../src/features/planner/shape'
import config from '../../src/payload.config'
import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUserEmail } from '../helpers/seedUser'

const context = { disableRevalidate: true, skipEmail: true }

test.describe('The owner dashboard (story 030)', () => {
  test('5/7/8/11. filters live in the URL, a row opens the planner, empty states, 360 px', async ({
    page,
  }, testInfo) => {
    const suffix = `own-dash-${testInfo.project.name}`
    const ownerSuffix = `${suffix}-owner`
    const stuckEmail = await seedTestUser(`${suffix}-a`, 'student')
    const noneEmail = await seedTestUser(`${suffix}-b`, 'student')
    await seedTestUser(ownerSuffix, 'owner')
    const payload = await getPayload({ config })
    const named = async (email: string, name: string) =>
      (
        await payload.update({
          collection: 'users',
          where: { email: { equals: email } },
          data: { name },
          context,
        })
      ).docs[0]!
    const stuck = await named(stuckEmail, `Анна ${suffix}`)
    await named(noneEmail, `Борис ${suffix}`)
    try {
      const monday = mondayOf(new Date().toISOString().slice(0, 10))
      const planner = await payload.create({
        collection: 'planners',
        data: { student: stuck.id, baseDate: monday },
        context,
      })
      const week = await payload.create({
        collection: 'planner-weeks',
        data: { planner: planner.id, index: 0, rowCount: 1 },
        context,
      })
      await payload.create({
        collection: 'planner-cells',
        data: { week: week.id, row: 0, day: 0, text: 'Anki' },
        context,
      })

      await login({ page, email: testUserEmail(ownerSuffix) })
      await page.goto('/study/students')
      await expect(page.getByRole('heading', { name: 'Ученики' })).toBeVisible()

      // Anna has a planner with a due task and no tick; Boris has no planner.
      const anna = page.getByRole('heading', { name: `Анна ${suffix}` })
      const boris = page.getByRole('heading', { name: `Борис ${suffix}` })
      await expect(anna).toBeVisible()
      await expect(boris).toBeVisible()
      const annaRow = page.getByRole('listitem').filter({ has: anna }).first()
      await expect(annaRow).toContainText('Нет отметок 3+ дня')
      await expect(annaRow).toContainText('0 из 1 заданий')
      await expect(page.getByRole('listitem').filter({ has: boris }).first()).toContainText(
        'Нет планнера',
      )

      // 5. the filter is in the URL and survives a reload
      await page.getByRole('link', { name: /^Нужна помощь/ }).click()
      await expect(page).toHaveURL(/\/study\/students\?filter=help$/)
      await expect(anna).toBeVisible()
      await expect(boris).toHaveCount(0)
      await page.reload()
      await expect(boris).toHaveCount(0)
      await page.getByRole('link', { name: /^Без планнера/ }).click()
      await expect(boris).toBeVisible()
      await expect(anna).toHaveCount(0)
      // an unknown value falls back to everyone
      await page.goto('/study/students?filter=nonsense')
      await expect(anna).toBeVisible()
      await expect(boris).toBeVisible()

      // the active filter is marked for assistive tech
      await page.goto('/study/students?filter=help')
      await expect(page.getByRole('link', { name: /^Нужна помощь/ })).toHaveAttribute(
        'aria-current',
        'page',
      )

      // 7. «Open planner» goes to this student's planner
      await page.goto('/study/students')
      await page.getByRole('link', { name: `Планнер: Анна ${suffix}` }).click()
      await expect(page).toHaveURL(new RegExp(`/study/planner\\?student=${stuck.id}$`))

      // 11. 360 px: no horizontal scroll
      await page.setViewportSize({ width: 360, height: 740 })
      await page.goto('/study/students')
      const width = await page.evaluate(() => document.documentElement.scrollWidth)
      expect(width).toBeLessThanOrEqual(360)

      // English
      await page.goto('/en/study/students')
      await expect(page.getByRole('heading', { name: 'Students' })).toBeVisible()
      await expect(page.getByRole('link', { name: /^Need help/ })).toBeVisible()
    } finally {
      await payload.delete({
        collection: 'planners',
        where: { student: { equals: stuck.id } },
        context,
      })
      await cleanupTestUser(`${suffix}-a`)
      await cleanupTestUser(`${suffix}-b`)
      await cleanupTestUser(ownerSuffix)
    }
  })

  test('1/3/7. create a planner from the list, then copy a week', async ({ page }, testInfo) => {
    const suffix = `own-create-${testInfo.project.name}`
    const ownerSuffix = `${suffix}-owner`
    const email = await seedTestUser(`${suffix}-a`, 'student')
    await seedTestUser(ownerSuffix, 'owner')
    const payload = await getPayload({ config })
    const student = (
      await payload.update({
        collection: 'users',
        where: { email: { equals: email } },
        data: { name: `Вера ${suffix}` },
        context,
      })
    ).docs[0]!
    try {
      await login({ page, email: testUserEmail(ownerSuffix) })
      await page.goto('/study/students')
      const row = page
        .getByRole('listitem')
        .filter({ has: page.getByRole('heading', { name: `Вера ${suffix}` }) })
        .first()
      await expect(row).toContainText('Планнера ещё нет.')
      await row.getByRole('button', { name: 'Создать планер' }).click()
      // the row refreshes: the button is gone and the planner state is shown
      await expect(row.getByRole('button', { name: 'Создать планер' })).toHaveCount(0)
      await expect(row).toContainText('Неделя 1')

      // copy the week from the planner page
      await page.getByRole('link', { name: `Планнер: Вера ${suffix}` }).click()
      const copy = page.getByRole('button', { name: 'Копировать неделю' })
      await copy.click()
      await expect
        .poll(
          async () =>
            (
              await payload.count({
                collection: 'planner-weeks',
                where: { 'planner.student': { equals: student.id } },
              })
            ).totalDocs,
        )
        .toBe(2)

      // 360 px: the bar does not overflow
      await page.setViewportSize({ width: 360, height: 740 })
      await page.reload()
      await expect(copy).toBeVisible()
      // (the planner header itself is wider than 360 px for an empty planner: out of scope here)
      for (const name of ['Добавить неделю', 'Копировать неделю', 'Удалить неделю']) {
        const box = await page.getByRole('button', { name: new RegExp(name) }).boundingBox()
        expect(box!.x + box!.width).toBeLessThanOrEqual(360)
      }
    } finally {
      await payload.delete({
        collection: 'planners',
        where: { student: { equals: student.id } },
        context,
      })
      await cleanupTestUser(`${suffix}-a`)
      await cleanupTestUser(ownerSuffix)
    }
  })
})
