import { expect, test, type Page } from '@playwright/test'
import { getPayload } from 'payload'

import { todayIn } from '../../src/features/enrollments/shape'
import config from '../../src/payload.config'
import { clearTestLoginCodes, E2E_CODE, issueKnownCode, login } from '../helpers/login'
import { cleanupTestUser, seedTestUser } from '../helpers/seedUser'

const context = { disableRevalidate: true }
const week = () => Array.from({ length: 7 }, () => ({ slots: [] as { slotType: number }[] }))

async function seedPrograms(suffix: string) {
  const payload = await getPayload({ config })
  await payload.delete({
    collection: 'programs',
    where: { slug: { like: `e2e-enroll-${suffix}` } },
    context,
  })
  const anki = await payload.create({
    collection: 'slot-types',
    data: { name: `Anki ${suffix}`, defaultMinMinutes: 20 },
    context,
  })
  const template = week()
  template[0]?.slots.push({ slotType: anki.id })
  const create = (key: string, levelFrom: string, levelTo: string, status: string) =>
    payload.create({
      collection: 'programs',
      context,
      data: {
        slug: `e2e-enroll-${suffix}-${key}`,
        title: `E2E ${levelFrom} → ${levelTo} ${suffix}`,
        levelFrom,
        levelTo,
        status,
        summary: 'Год регулярной практики.',
        weekTemplate: template,
      } as never,
    })
  return {
    anki,
    a2b1: await create('a2b1', 'A2', 'B1', 'published'),
    a1a2: await create('a1a2', 'A1', 'A2', 'published'),
    draft: await create('draft', 'B1', 'B2', 'draft'),
  }
}

async function cleanupPrograms(suffix: string, slotTypeId: number) {
  const payload = await getPayload({ config })
  await payload.delete({
    collection: 'programs',
    where: { slug: { like: `e2e-enroll-${suffix}` } },
    context,
  })
  await payload.delete({ collection: 'slot-types', id: slotTypeId, context })
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

test.describe('Murad assigns a program in the admin (story 012)', () => {
  test.describe.configure({ mode: 'serial' })

  let page: Page
  let suffix: string
  let programs: Awaited<ReturnType<typeof seedPrograms>>
  let studentEmail: string

  test.beforeAll(async ({ browser }, testInfo) => {
    suffix = `assign-${testInfo.project.name}`
    programs = await seedPrograms(suffix)
    studentEmail = await seedTestUser(`${suffix}-student`, 'student')
    const email = await seedTestUser(suffix)
    page = await (await browser.newContext()).newPage()
    await login({ page, email })
  })

  test.afterAll(async () => {
    await cleanupTestUser(`${suffix}-student`)
    await cleanupTestUser(suffix)
    await cleanupPrograms(suffix, programs.anki.id)
  })

  // Payload rebuilds the form state (conditions) on the server after a change and may skip a change
  // made while that request runs. Give each change its round-trip, as a person naturally does;
  // Payload may also batch changes into one request, so a missing response is not an error.
  const settled = async (change: () => Promise<void>) => {
    const response = page
      .waitForResponse(
        (r) =>
          r.request().method() === 'POST' && r.url().includes('/admin/collections/enrollments'),
        { timeout: 5_000 },
      )
      .catch(() => undefined)
    await change()
    await response
  }
  const pick = (id: string, option: string) =>
    settled(async () => {
      await page.locator(`#field-${id}`).click()
      await page.getByRole('option', { name: option, exact: true }).click()
    })
  // Relationship selects load one page of options: type to search, as Murad would.
  const search = (id: string, option: string) =>
    settled(async () => {
      await page.locator(`#field-${id}`).click()
      await page.locator(`#field-${id} input`).first().fill(option)
      await page.getByRole('option', { name: option, exact: true }).click()
    })

  test('enters the placement, sees the warnings and assigns A2 → B1', async () => {
    await page.goto('/admin/collections/enrollments/create')
    await search('student', studentEmail)

    // 12. Murad's own CEFR test: no score field.
    await expect(page.locator('#field-placement__test')).toContainText('Мурад (CEFR)')
    await expect(page.locator('input[name="placement.score"]')).toHaveCount(0)

    await expect(async () => {
      await pick('placement__test', 'TOEFL iBT')
      await pick('placement__test', 'IELTS')
      await expect(page.locator('input[name="placement.score"]')).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 20_000 })
    await page.locator('input[name="placement.score"]').fill('4.5')
    await pick('placement__cefr', 'B2')
    await page.locator('#field-placement__takenAt input').fill('01.10.2026')
    await page.keyboard.press('Escape')

    // 9. Drafts are not offered.
    await settled(async () => {
      await page.locator('#field-program').click()
      await page.locator('#field-program input').first().fill(suffix)
      await expect(page.getByRole('option', { name: `E2E A1 → A2 ${suffix}` })).toBeVisible()
      await expect(page.getByRole('option', { name: `E2E B1 → B2 ${suffix}` })).toHaveCount(0)
      await page.getByRole('option', { name: `E2E A1 → A2 ${suffix}` }).click()
    })

    // 11. B2 is above an A1 → A2 program: a warning, saving still allowed.
    await expect(page.getByText('Уровень по тесту (B2) выше программы')).toBeVisible()
    await pick('placement__cefr', 'A2')
    await search('program', `E2E A2 → B1 ${suffix}`)
    await expect(page.getByText('Уровень по тесту (A2) выше программы')).toHaveCount(0)

    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page).toHaveURL(/\/enrollments\/\d+$/)

    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'enrollments',
      where: { 'student.email': { equals: studentEmail } },
      depth: 0,
    })
    expect(docs[0]).toMatchObject({ status: 'assigned', program: programs.a2b1.id })
    expect(docs[0]?.placement).toMatchObject({ test: 'ielts', score: 4.5, cefr: 'A2' })
  })

  test('the program shows on the student’s page; a second one is refused', async () => {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'users',
      where: { email: { equals: studentEmail } },
      depth: 0,
    })
    await page.goto(`/admin/collections/users/${docs[0]?.id}`)
    // The list cell loads the program title once it scrolls into view.
    const row = page.getByRole('row', { name: /assigned/ })
    await row.scrollIntoViewIfNeeded()
    await expect(row).toBeVisible()
    await expect(page.getByText(`E2E A2 → B1 ${suffix}`).first()).toBeVisible()

    await page.goto('/admin/collections/enrollments/create')
    await search('student', studentEmail)
    await pick('placement__cefr', 'A1')
    await page.locator('#field-placement__takenAt input').fill('01.10.2026')
    await page.keyboard.press('Escape')
    await search('program', `E2E A1 → A2 ${suffix}`)
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(
      page.getByText(`У ученика уже есть программа: E2E A2 → B1 ${suffix}`).first(),
    ).toBeAttached()
    await expect(page).toHaveURL(/\/enrollments\/create/)
  })
})

test.describe('The student starts her program (story 012)', () => {
  test('sees the result and the card, presses «Начать» and lands on day 1', async ({
    page,
  }, testInfo) => {
    const suffix = `start-${testInfo.project.name}`
    const programs = await seedPrograms(suffix)
    const email = await seedTestUser(suffix, 'student')
    try {
      const payload = await getPayload({ config })
      const { docs } = await payload.find({
        collection: 'users',
        where: { email: { equals: email } },
      })
      await payload.create({
        collection: 'enrollments',
        data: {
          student: docs[0]!.id,
          program: programs.a2b1.id,
          placement: {
            test: 'ielts',
            score: 4.5,
            cefr: 'A2',
            takenAt: '2026-10-01T12:00:00.000Z',
            note: 'Только для Мурада',
          },
        } as never,
      })

      await studentSignsIn(page, email)
      await expect(page.getByText('Тест: IELTS 4.5 · уровень A2')).toBeVisible()
      await expect(page.getByText('A2 → B1', { exact: true })).toBeVisible()
      await expect(page.getByText('52 недели')).toBeVisible()
      await expect(page.getByText('Год регулярной практики.')).toBeVisible()
      await expect(page.getByText(`Anki ${suffix} — 20 мин`)).toBeVisible()
      await expect(page.getByText('Только для Мурада')).toHaveCount(0)

      await page.getByRole('button', { name: 'Начать' }).click()
      await expect(page.getByText('Начать A2 → B1 сегодня?')).toBeVisible()
      await page.getByRole('button', { name: 'Да, начать' }).click()

      await expect(page.getByRole('heading', { name: 'Сегодня' })).toBeVisible()
      await expect(page.getByText('День 1 из 364')).toBeVisible()

      const { docs: enrollments } = await payload.find({
        collection: 'enrollments',
        where: { student: { equals: docs[0]!.id } },
      })
      const zone = enrollments[0]?.timezone ?? ''
      expect(enrollments[0]?.status).toBe('active')
      expect(enrollments[0]?.startDate?.slice(0, 10)).toBe(todayIn(zone))
    } finally {
      await cleanupTestUser(suffix)
      await cleanupPrograms(suffix, programs.anki.id)
    }
  })

  test('4. without a program she sees only the empty state', async ({ page }, testInfo) => {
    const suffix = `empty-${testInfo.project.name}`
    const email = await seedTestUser(suffix, 'student')
    try {
      await studentSignsIn(page, email)
      await expect(page.getByText('Мурад назначит программу после теста уровня')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Начать' })).toHaveCount(0)
    } finally {
      await cleanupTestUser(suffix)
    }
  })
})
