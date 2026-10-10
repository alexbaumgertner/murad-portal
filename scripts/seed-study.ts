/**
 * Idempotent demo for the Study Programs epic: a published B1→B2 program, a task pool, three
 * students at different points (just assigned, mid-program with history, paused) and their personal
 * plans. Runs on dev and on Vercel preview builds only — never against production.
 *
 *   pnpm seed:study
 *
 * Optional: DEMO_STUDENT_EMAIL signs the "active" student in with a mailbox you own (the sign-in
 * is an emailed code); the other two keep example.com addresses.
 */
import 'dotenv/config'

import type { Payload } from 'payload'

import { seedDemoProgram } from './seed-programs'
import { canSeedStudy } from './seed-guard'

// `skipEmail`: the demo students have no real mailbox, so no invite or assignment email goes out.
const context = { disableRevalidate: true, skipEmail: true }
const DAY = 86_400_000
const ANTHROPIC = 'https://www.youtube.com/channel/UCrDwWp7EBBv4NwvScIpBDOA'
const CLAUDE = 'https://www.youtube.com/@claude'

const paragraphs = (lines: string[]) => ({
  root: {
    type: 'root',
    format: '' as const,
    indent: 0,
    version: 1,
    direction: 'ltr' as const,
    children: lines.map((text) => ({
      type: 'paragraph',
      format: '' as const,
      indent: 0,
      version: 1,
      direction: 'ltr' as const,
      textFormat: 0,
      children: [
        { type: 'text', text, format: 0, detail: 0, mode: 'normal', style: '', version: 1 },
      ],
    })),
  },
})

type Task = { level: 'B1' | 'B2'; title: string; ru: string; en: string }

const tasks: Task[] = [
  {
    level: 'B1',
    title: 'Anki: новые карточки',
    ru: 'Добавь 15 новых карточек из вчерашнего сериала и повтори всю очередь. Не оставляй просроченные.',
    en: 'Add 15 new cards from yesterday’s episode and clear the whole review queue.',
  },
  {
    level: 'B1',
    title: 'Сериал без субтитров',
    ru: 'Серия с английскими субтитрами, затем первые 10 минут без них. Выпиши 5 фраз, которые не расслышал(а).',
    en: 'One episode with English subtitles, then the first 10 minutes without. Write down 5 phrases you missed.',
  },
  {
    level: 'B1',
    title: 'Интервью Anthropic',
    ru: `Посмотри любое интервью на канале Anthropic (${ANTHROPIC}) на скорости 1x. Запиши 10 слов, которых не знал(а), и перескажи основную мысль в 3 предложениях.`,
    en: `Watch any interview on the Anthropic channel (${ANTHROPIC}) at 1x. Note 10 unknown words and retell the main idea in 3 sentences.`,
  },
  {
    level: 'B1',
    title: 'Shadowing 10 минут',
    ru: 'Включи отрывок из подкаста и повторяй вслух за диктором с задержкой в полфразы. Запиши себя и сравни интонацию.',
    en: 'Play a podcast excerpt and repeat after the speaker half a phrase behind. Record yourself and compare intonation.',
  },
  {
    level: 'B1',
    title: '30 слов: тема дня',
    ru: 'Выучи 30 слов по теме «Работа и карьера»: слово, пример, фраза для себя. Проверь себя в конце.',
    en: 'Learn 30 words on “Work and career”: word, example, a sentence of your own. Self-test at the end.',
  },
  {
    level: 'B1',
    title: 'Чтение: статья на выбор',
    ru: 'Прочитай статью на 800–1000 слов (BBC Learning English, Guardian). Подчеркни фразовые глаголы и добавь их в Anki.',
    en: 'Read a 800–1000 word article (BBC Learning English, The Guardian). Underline phrasal verbs and add them to Anki.',
  },
  {
    level: 'B1',
    title: 'Краткое изложение',
    ru: 'Напиши пересказ вчерашней серии в 6–8 предложениях, используя Past Simple и Past Continuous.',
    en: 'Write a 6–8 sentence summary of yesterday’s episode using Past Simple and Past Continuous.',
  },
  {
    level: 'B1',
    title: 'Грамматика: Present Perfect',
    ru: 'Разбери раздел Present Perfect в учебнике и сделай все упражнения. Ошибки запиши отдельно и вернись к ним в субботу.',
    en: 'Study the Present Perfect unit and do every exercise. Log mistakes separately and revisit them on Saturday.',
  },
  {
    level: 'B2',
    title: 'Видео про Claude',
    ru: `Посмотри короткое видео на канале Claude (${CLAUDE}). Выпиши 5 терминов про ИИ и объясни каждый своими словами по-английски.`,
    en: `Watch a short video on the Claude channel (${CLAUDE}). List 5 AI terms and explain each in your own words.`,
  },
  {
    level: 'B2',
    title: 'Дебаты: за и против',
    ru: 'Выбери спорную тему и запиши голосовое на 2 минуты: сначала аргументы «за», затем «против». Не подглядывай в записи.',
    en: 'Pick a debatable topic and record 2 minutes: arguments for, then against. No notes.',
  },
  {
    level: 'B2',
    title: 'Идиомы недели',
    ru: 'Выучи 10 идиом недели и придумай к каждой своё предложение из жизни. Используй хотя бы три в разговоре с Муратом.',
    en: 'Learn this week’s 10 idioms and write a sentence from your own life for each. Use at least three with Murad.',
  },
  {
    level: 'B2',
    title: 'Эссе 200 слов',
    ru: 'Напиши эссе на 200 слов «Does remote work make us more productive?». Вставь минимум 4 linking words.',
    en: 'Write a 200-word essay “Does remote work make us more productive?” with at least 4 linking words.',
  },
]

type Student = { email: string; name: string; locale: 'ru' | 'en'; addressForm: 'ty' | 'vy' }

async function ensureStudent(payload: Payload, data: Student) {
  const found = await payload.find({
    collection: 'users',
    where: { email: { equals: data.email } },
    depth: 0,
    limit: 1,
  })
  if (found.docs[0]) return { doc: found.docs[0], created: false }
  const doc = await payload.create({
    collection: 'users',
    context,
    data: { ...data, role: 'student' } as never,
    depth: 0,
  })
  return { doc, created: true }
}

const isoDay = (offset: number) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10)

export async function seedStudyDemo(payload: Payload) {
  const program = await seedDemoProgram(payload)
  await payload.update({
    collection: 'programs',
    id: program.id,
    locale: 'en',
    context,
    data: {
      status: 'published',
      summary:
        'A year-long path from confident B1 to B2: daily listening, vocabulary in context and weekly speaking practice.',
      materials: paragraphs([
        'Coursebook: English File Upper-Intermediate (Oxford).',
        'Listening: series you like, the Anthropic and Claude YouTube channels, BBC Learning English.',
        'Vocabulary: Anki deck “Murad B1→B2”.',
      ]),
    } as never,
  })
  await payload.update({
    collection: 'programs',
    id: program.id,
    locale: 'ru',
    context,
    data: {
      title: 'От B1 к B2',
      summary:
        'Годовой путь от уверенного B1 до B2: ежедневное аудирование, слова в контексте и разговорная практика каждую неделю.',
      materials: paragraphs([
        'Учебник: English File Upper-Intermediate (Oxford).',
        'Аудирование: любимые сериалы, каналы Anthropic и Claude на YouTube, BBC Learning English.',
        'Слова: колода Anki «Murad B1→B2».',
      ]),
    } as never,
  })

  const existingPlan = await payload.count({
    collection: 'program-plan-items',
    where: { program: { equals: program.id } },
  })
  if (existingPlan.totalDocs === 0) {
    const pool: number[] = []
    for (const task of tasks) {
      const created = await payload.create({
        collection: 'task-pool',
        locale: 'en',
        context,
        data: { level: task.level, title: task.title, text: { ru: task.ru, en: task.en } } as never,
        depth: 0,
      })
      pool.push(created.id)
    }
    const full = await payload.findByID({ collection: 'programs', id: program.id, depth: 0 })
    let cursor = 0
    for (let week = 1; week <= 8; week++) {
      for (let day = 1; day <= 7; day++) {
        const slots = full.weekTemplate?.[day - 1]?.slots?.length ?? 0
        for (let order = 1; order <= Math.min(slots, 2); order++) {
          await payload.create({
            collection: 'program-plan-items',
            context,
            data: {
              program: program.id,
              week,
              day,
              order,
              task: pool[cursor++ % pool.length] as number,
            },
            depth: 0,
          })
        }
      }
    }
  }

  const people: Array<{ person: Student; test: object; state: 'assigned' | 'active' | 'paused' }> =
    [
      {
        person: {
          email: process.env.DEMO_STUDENT_EMAIL ?? 'anna.demo@example.com',
          name: 'Анна Серикбаева',
          locale: 'ru',
          addressForm: 'ty',
        },
        test: { test: 'ielts', score: 5.5, cefr: 'B1', takenAt: `${isoDay(-24)}T10:00:00.000Z` },
        state: 'active',
      },
      {
        person: {
          email: 'dmitry.demo@example.com',
          name: 'Дмитрий Орлов',
          locale: 'ru',
          addressForm: 'vy',
        },
        test: { test: 'murad', cefr: 'B1', takenAt: `${isoDay(-2)}T10:00:00.000Z` },
        state: 'assigned',
      },
      {
        person: {
          email: 'aigerim.demo@example.com',
          name: 'Айгерим Нурлан',
          locale: 'ru',
          addressForm: 'ty',
        },
        test: { test: 'efset', score: 52, cefr: 'B1', takenAt: `${isoDay(-16)}T10:00:00.000Z` },
        state: 'paused',
      },
    ]

  const withTemplate = await payload.findByID({ collection: 'programs', id: program.id, depth: 1 })
  const template = withTemplate.weekTemplate ?? []

  for (const { person, test, state } of people) {
    const { doc: student, created } = await ensureStudent(payload, person)
    if (!created) continue

    const enrollment = await payload.create({
      collection: 'enrollments',
      context,
      data: { student: student.id, program: program.id, placement: test } as never,
      depth: 0,
    })
    if (state === 'assigned') continue

    const startOffset = state === 'active' ? -20 : -12
    const pauseFrom = state === 'active' ? -9 : -2
    const pauseTo = state === 'active' ? -6 : null
    await payload.db.updateOne({
      collection: 'enrollments',
      id: enrollment.id,
      data: {
        status: state,
        timezone: 'Asia/Almaty',
        startDate: `${isoDay(startOffset)}T00:00:00.000Z`,
      },
    })
    await payload.update({
      collection: 'enrollments',
      id: enrollment.id,
      context,
      depth: 0,
      data: {
        pauses: [
          {
            from: `${isoDay(pauseFrom)}T00:00:00.000Z`,
            to: pauseTo === null ? null : `${isoDay(pauseTo)}T00:00:00.000Z`,
          },
        ],
      } as never,
    })

    // History: walk calendar days from the start, skip paused ones, mark the rest by a fixed pattern.
    let programDay = 0
    for (let offset = startOffset; offset < 0; offset++) {
      if (offset >= pauseFrom && (pauseTo === null || offset <= pauseTo)) continue
      programDay++
      const slots = template[(programDay - 1) % 7]?.slots ?? []
      const pattern = programDay % 5
      for (const [slotIndex, slot] of slots.entries()) {
        const type = typeof slot.slotType === 'object' ? slot.slotType : null
        if (!type) continue
        const minimum = slot.minMinutes ?? type.defaultMinMinutes ?? 20
        if (pattern === 3) continue // a missed day
        const done = pattern !== 2 || slotIndex === 0
        await payload.create({
          collection: 'slot-logs',
          context,
          depth: 0,
          data: {
            enrollment: enrollment.id,
            date: `${isoDay(offset)}T00:00:00.000Z`,
            slotIndex,
            slotType: type.id,
            minutes: done ? minimum + 5 * (slotIndex % 2) : Math.floor(minimum / 3),
            completed: done,
          },
        })
      }
      if (state === 'active' && programDay === 4) {
        await payload.create({
          collection: 'day-comments',
          context,
          depth: 0,
          data: {
            enrollment: enrollment.id,
            student: student.id,
            date: `${isoDay(offset)}T00:00:00.000Z`,
            text: 'Сериал сегодня шёл тяжело: много сленга. Выписала 12 фраз в Anki, завтра повторю.',
          },
        })
      }
      if (state === 'active' && programDay === 11) {
        await payload.create({
          collection: 'day-comments',
          context,
          depth: 0,
          data: {
            enrollment: enrollment.id,
            student: student.id,
            date: `${isoDay(offset)}T00:00:00.000Z`,
            text: 'Пропустила из-за командировки, наверстаю в субботу.',
          },
        })
      }
    }
  }
}

async function main() {
  if (!canSeedStudy(process.env)) {
    throw new Error('seed:study runs only on a Vercel preview build or against a local database')
  }
  const { getPayload } = await import('payload')
  const { default: config } = await import('../src/payload.config')
  const payload = await getPayload({ config })
  await seedStudyDemo(payload)
  console.log('[seed:study] done')
  process.exit(0)
}

if (process.argv[1]?.endsWith('seed-study.ts')) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
