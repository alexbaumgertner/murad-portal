import type { Payload } from 'payload'

const context = { disableRevalidate: true }

const slotTypes = [
  { en: 'Anki', ru: 'Anki', minutes: 20 },
  { en: 'Series', ru: 'Сериал', minutes: 40 },
  { en: 'FMA', ru: 'FMA', minutes: 30 },
  { en: '30 words', ru: '30 слов', minutes: 15 },
] as const

/**
 * Idempotent demo for dev and tests: the four reference slot types and one draft B1→B2 program.
 * The week below is a placeholder shaped like the owner's spreadsheet; replace it in /admin.
 */
export async function seedDemoProgram(payload: Payload, slug = 'b1-b2') {
  const ids: number[] = []
  for (const type of slotTypes) {
    const existing = await payload.find({
      collection: 'slot-types',
      locale: 'en',
      where: { name: { equals: type.en } },
      depth: 0,
      limit: 1,
    })
    const doc =
      existing.docs[0] ??
      (await payload.create({
        collection: 'slot-types',
        locale: 'en',
        context,
        data: { name: type.en, defaultMinMinutes: type.minutes },
      }))
    if (!existing.docs[0]) {
      await payload.update({
        collection: 'slot-types',
        id: doc.id,
        locale: 'ru',
        context,
        data: { name: type.ru },
      })
    }
    ids.push(doc.id)
  }
  const [anki, series, fma, words] = ids as [number, number, number, number]

  const found = await payload.find({
    collection: 'programs',
    where: { slug: { equals: slug } },
    depth: 0,
    limit: 1,
  })
  if (found.docs[0]) return found.docs[0]

  const program = await payload.create({
    collection: 'programs',
    locale: 'en',
    context,
    data: {
      slug,
      title: 'From B1 to B2',
      levelFrom: 'B1',
      levelTo: 'B2',
      durationWeeks: 52,
      status: 'draft',
      weekTemplate: [
        { slots: [{ slotType: anki }, { slotType: series }, { slotType: words }] },
        { slots: [{ slotType: anki }, { slotType: fma }] },
        { slots: [{ slotType: anki }, { slotType: series }, { slotType: words }] },
        { slots: [{ slotType: anki }, { slotType: fma }] },
        { slots: [{ slotType: anki }, { slotType: series }, { slotType: words }] },
        { slots: [{ slotType: series, minMinutes: 60 }] },
        { slots: [] },
      ],
    },
  })
  await payload.update({
    collection: 'programs',
    id: program.id,
    locale: 'ru',
    context,
    data: { title: 'От B1 к B2' },
  })
  return program
}
