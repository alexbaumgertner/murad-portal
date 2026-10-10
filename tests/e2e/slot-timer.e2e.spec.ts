import { expect, test, type Page } from '@playwright/test'
import { getPayload } from 'payload'

import { todayIn } from '../../src/features/enrollments/shape'
import { dateOfDay } from '../../src/features/study-today/shape'
import config from '../../src/payload.config'
import { clearTestLoginCodes, E2E_CODE, issueKnownCode } from '../helpers/login'
import { cleanupTestUser, seedTestUser } from '../helpers/seedUser'

const context = { disableRevalidate: true }

/** Template day 3 = [Anki 20, Сериал 40]; the other days rest. Day 10 is a day 3. */
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
      slug: `e2e-timer-${suffix}`,
      title: `E2E таймер ${suffix}`,
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
    where: { 'program.slug': { equals: `e2e-timer-${suffix}` } },
  })
  await payload.delete({
    collection: 'programs',
    where: { slug: { equals: `e2e-timer-${suffix}` } },
    context,
  })
  await payload.delete({ collection: 'slot-types', where: { name: { like: suffix } }, context })
}

/** Assigns and starts so that today is program day 10 in Asia/Almaty. */
async function enrollAtDay10(email: string, programId: number) {
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
  const startDate = dateOfDay(todayIn('Asia/Almaty'), 2 - 10)
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

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

test.describe('The slot timer (story 014)', () => {
  test('1/3/4/10. start, a double tap, stop; a saved 25 of 40 continues from 25:00', async ({
    page,
  }, testInfo) => {
    const suffix = `timer-${testInfo.project.name}`
    const { program, series } = await seed(suffix)
    const email = await seedTestUser(suffix, 'student')
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    try {
      const { enrollment } = await enrollAtDay10(email, program.id)
      const payload = await getPayload({ config })
      await payload.create({
        collection: 'slot-logs',
        data: {
          enrollment: enrollment.id,
          date: todayIn('Asia/Almaty') + 'T00:00:00.000Z',
          slotIndex: 1,
          slotType: series.id,
          minutes: 25,
          completed: false,
        },
      })
      await studentSignsIn(page, email)

      // 4. a saved 25 of 40 is shown as such
      await expect(page.getByText('25 из 40 мин')).toBeVisible()
      await expect(page.getByText('Минимум выполнен ✓')).toHaveCount(0)

      // 1/10. a double tap on «Старт» starts once; the counter continues from 25:00
      const start = page.getByRole('listitem').filter({ hasText: `Сериал ${suffix}` })
      await start.getByRole('button', { name: 'Старт' }).dblclick()
      const clock = start.getByRole('timer')
      await expect(clock).toBeVisible()
      await expect(clock).toHaveText(/^25:\d\d$/)
      await expect
        .poll(async () => (await logs(enrollment.id)).filter((l) => l.timerStartedAt).length)
        .toBe(1)

      // 5. the counter is the server's: a reload keeps it running
      await page.reload()
      await expect(page.getByRole('timer')).toHaveText(/^25:\d\d$/)

      // 3. «Стоп» (under 30 s adds nothing) clears the timer; the 25 minutes stay
      await page.getByRole('button', { name: 'Стоп' }).click()
      await expect(page.getByText('25 из 40 мин')).toBeVisible()
      await expect
        .poll(async () => (await logs(enrollment.id)).map((l) => l.timerStartedAt ?? null))
        .toEqual([null])
      expect(await logs(enrollment.id)).toMatchObject([{ minutes: 25, completed: false }])
      expect(errors).toEqual([])
    } finally {
      await cleanupTestUser(suffix)
      await cleanup(suffix)
    }
  })

  test('2/5/9. the minimum passed while closed: «✓» once, banner when sound is blocked, day turns ✓', async ({
    page,
  }, testInfo) => {
    const suffix = `timer-done-${testInfo.project.name}`
    const { program, anki, series } = await seed(suffix)
    const email = await seedTestUser(suffix, 'student')
    try {
      const { enrollment } = await enrollAtDay10(email, program.id)
      const payload = await getPayload({ config })
      const date = todayIn('Asia/Almaty') + 'T00:00:00.000Z'
      // Anki ran 30 minutes while the tab was closed (minimum 20); the series is done already.
      await payload.create({
        collection: 'slot-logs',
        data: {
          enrollment: enrollment.id,
          date,
          slotIndex: 0,
          slotType: anki.id,
          minutes: 0,
          completed: false,
          timerStartedAt: minutesAgo(30),
        },
      })
      await payload.create({
        collection: 'slot-logs',
        data: {
          enrollment: enrollment.id,
          date,
          slotIndex: 1,
          slotType: series.id,
          minutes: 40,
          completed: true,
        },
      })
      // Browsers keep audio locked until a tap: simulate that, count the notes that get played.
      await page.addInitScript(() => {
        const w = window as unknown as { __beeps: number; __audioBlocked: boolean }
        w.__beeps = 0
        w.__audioBlocked = true
        const Original = window.AudioContext
        window.AudioContext = class extends Original {
          get state() {
            return w.__audioBlocked ? 'suspended' : super.state
          }
          resume() {
            return w.__audioBlocked
              ? Promise.reject(new DOMException('blocked', 'NotAllowedError'))
              : super.resume()
          }
          createOscillator() {
            w.__beeps += 1
            return super.createOscillator()
          }
        }
      })
      await studentSignsIn(page, email)

      // 5. correct elapsed time after returning; the server flagged the slot as completed
      await expect(page.getByRole('timer')).toHaveText(/^30:\d\d$/)
      const item = page.getByRole('listitem').filter({ hasText: `Anki ${suffix}` })
      await expect(item.getByText('Минимум выполнен ✓')).toBeVisible()
      expect((await logs(enrollment.id))[0]).toMatchObject({ completed: true })

      // 9. without a tap the browser keeps audio locked → the visual banner stands in, no errors
      await expect(page.getByText('Минимум выполнен', { exact: true })).toBeVisible()
      await expect(page.getByText(/Браузер не дал включить звук/)).toBeVisible()
      // …and «Проверить звук» (a tap) unlocks it and plays
      await page.evaluate(() => {
        ;(window as unknown as { __audioBlocked: boolean }).__audioBlocked = false
      })
      await page.getByRole('button', { name: 'Проверить звук' }).click()
      await expect(page.getByText('Звук работает')).toBeVisible()
      expect(
        await page.evaluate(() => (window as unknown as { __beeps: number }).__beeps),
      ).toBeGreaterThan(0)

      // 013: both slots completed → today's cell in the grid is «Выполнено»
      const cells = page.getByRole('list', { name: 'Дни недели 2' }).getByRole('link')
      await expect(cells.nth(2)).toHaveAccessibleName(/День 10, .*: Выполнено/)

      // the signal is not tried again on a reload of the same run: no banner, no notes
      await page.reload()
      await expect(page.getByRole('timer')).toBeVisible()
      await expect(page.getByText(/Браузер не дал включить звук/)).toHaveCount(0)
      expect(await page.evaluate(() => (window as unknown as { __beeps: number }).__beeps)).toBe(0)
    } finally {
      await cleanupTestUser(suffix)
      await cleanup(suffix)
    }
  })

  test('10. 360 px: a running timer does not overflow; a partial past day counts its minutes but is not done', async ({
    page,
  }, testInfo) => {
    const suffix = `timer-narrow-${testInfo.project.name}`
    const { program, anki } = await seed(suffix)
    const email = await seedTestUser(suffix, 'student')
    try {
      const { enrollment, startDate } = await enrollAtDay10(email, program.id)
      const payload = await getPayload({ config })
      // Day 3 (week 1) was a training day: 10 of 20 minutes of Anki is partial.
      await payload.create({
        collection: 'slot-logs',
        data: {
          enrollment: enrollment.id,
          date: `${dateOfDay(startDate, 3)}T00:00:00.000Z`,
          slotIndex: 0,
          slotType: anki.id,
          minutes: 10,
          completed: false,
        },
      })
      await studentSignsIn(page, email)
      await page.setViewportSize({ width: 360, height: 740 })
      await page.getByRole('button', { name: 'Старт' }).first().click()
      await expect(page.getByRole('timer')).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        360,
      )

      await expect(page.getByTestId('stat-minutes')).toHaveText('10')
      await expect(page.getByTestId('stat-missed')).toHaveText('1') // partial is not done
    } finally {
      await cleanupTestUser(suffix)
      await cleanup(suffix)
    }
  })
})
