import type { ListViewServerProps } from 'payload'

import { PLAN_DAYS } from '@/features/program-plan/shape'

import { CopyWeekForm } from './CopyWeekForm'
import styles from './PlanGrid.module.css'

const collectionPath = '/admin/collections/program-plan-items'

type Cell = { id: number; title: string }

/**
 * "План по умолчанию" above the plan list: pick a program, see its tasks in a week × day grid and
 * copy a week into the following ones. The admin UI is rendered in Russian here because the plan
 * is Murad's working tool (the story's wording), unlike the English-only generated admin.
 */
export async function PlanGrid({ payload, user, searchParams }: ListViewServerProps) {
  const { docs: programs } = await payload.find({
    collection: 'programs',
    sort: 'title',
    pagination: false,
    depth: 0,
    select: { title: true, durationWeeks: true, levelFrom: true, levelTo: true },
    locale: 'ru',
    fallbackLocale: 'en',
    overrideAccess: false,
    user,
  })

  const asked = Number(Array.isArray(searchParams?.program) ? '' : searchParams?.program)
  const program = programs.find((p) => p.id === asked) ?? programs[0]

  return (
    <section className={styles.panel} aria-labelledby="plan-grid-title">
      <h2 id="plan-grid-title" className={styles.title}>
        План по умолчанию
      </h2>
      {programs.length === 0 || !program ? (
        <p className={styles.empty}>Сначала создай программу.</p>
      ) : (
        <>
          <nav className={styles.programs} aria-label="Программа">
            {programs.map((p) => (
              <a
                key={p.id}
                href={`${collectionPath}?program=${p.id}`}
                className={p.id === program.id ? styles.programCurrent : styles.programLink}
                aria-current={p.id === program.id ? 'page' : undefined}
              >
                {p.title} · {p.levelFrom} → {p.levelTo}
              </a>
            ))}
          </nav>
          <PlanTable
            programId={program.id}
            durationWeeks={program.durationWeeks}
            payload={payload}
            user={user}
          />
          <CopyWeekForm programId={program.id} durationWeeks={program.durationWeeks} />
        </>
      )}
    </section>
  )
}

async function PlanTable({
  programId,
  durationWeeks,
  payload,
  user,
}: {
  programId: number
  durationWeeks: number
} & Pick<ListViewServerProps, 'payload' | 'user'>) {
  const { docs } = await payload.find({
    collection: 'program-plan-items',
    where: { program: { equals: programId } },
    sort: ['week', 'day', 'order'],
    pagination: false,
    depth: 1,
    select: { week: true, day: true, order: true, task: true },
    populate: { 'task-pool': { title: true } },
    overrideAccess: false,
    user,
  })

  const cells = new Map<string, Cell[]>()
  for (const item of docs) {
    const task = typeof item.task === 'object' ? item.task : null
    const key = `${item.week}:${item.day}`
    cells.set(key, [
      ...(cells.get(key) ?? []),
      { id: item.id, title: task?.title ?? `#${item.id}` },
    ])
  }

  const days = Array.from({ length: PLAN_DAYS }, (_, i) => i + 1)
  const weeks = Array.from({ length: durationWeeks }, (_, i) => i + 1)

  return (
    <div className={styles.scroll}>
      <table className={styles.table} aria-label="План по умолчанию">
        <thead>
          <tr>
            <th scope="col">Неделя</th>
            {days.map((day) => (
              <th key={day} scope="col">
                День {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week}>
              <th scope="row">Неделя {week}</th>
              {days.map((day) => (
                <td key={day}>
                  {(cells.get(`${week}:${day}`) ?? []).map((cell) => (
                    <a key={cell.id} href={`${collectionPath}/${cell.id}`} className={styles.task}>
                      {cell.title}
                    </a>
                  ))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
