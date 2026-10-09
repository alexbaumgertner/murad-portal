import type { TypedUser, UIFieldServerProps } from 'payload'

import { PLAN_DAYS } from '@/features/program-plan/shape'

import styles from './StudentPlanGrid.module.css'

const collectionPath = '/admin/collections/student-assignments'
const PREVIEW = 60

type Cell = { id: number; text: string; fromPool: boolean }

const preview = (text: string) => (text.length > PREVIEW ? `${text.slice(0, PREVIEW - 1)}…` : text)

/**
 * «План ученика» on a student's page (story 018): her current program's personal plan as the same
 * week × day grid as the default plan (010). Each task opens its own editor; copies are marked
 * «из пула», Murad's own texts «своё». Russian, like the default plan grid: Murad's working tool.
 */
export async function StudentPlanGrid({ id, payload, req }: UIFieldServerProps) {
  if (id == null) return null
  const user = req.user ?? undefined
  const { docs: enrollments } = await payload.find({
    collection: 'enrollments',
    where: { student: { equals: id } },
    // The open program first (at most one), otherwise the last finished one.
    sort: ['-assignedAt'],
    limit: 10,
    depth: 1,
    select: { program: true, status: true },
    populate: { programs: { title: true, durationWeeks: true } },
    locale: 'ru',
    fallbackLocale: 'en',
    overrideAccess: false,
    user,
  })
  const enrollment = enrollments.find((e) => e.status !== 'finished') ?? enrollments[0]
  const program = enrollment && typeof enrollment.program === 'object' ? enrollment.program : null

  return (
    <section className={styles.panel} aria-labelledby="student-plan-title">
      <h2 id="student-plan-title" className={styles.title}>
        План ученика
      </h2>
      {!enrollment || !program ? (
        <p className={styles.empty}>Назначьте программу — её план скопируется сюда.</p>
      ) : (
        <>
          <p className={styles.hint}>
            {program.title}. Копия плана программы на момент назначения: правки меняют только этого
            ученика. <a href={`${collectionPath}/create`}>Добавить задание</a>
          </p>
          <PlanTable
            enrollmentId={enrollment.id}
            durationWeeks={program.durationWeeks}
            payload={payload}
            user={user}
          />
        </>
      )}
    </section>
  )
}

async function PlanTable({
  enrollmentId,
  durationWeeks,
  payload,
  user,
}: {
  enrollmentId: number
  durationWeeks: number
  payload: UIFieldServerProps['payload']
  user: TypedUser | undefined
}) {
  const { docs } = await payload.find({
    collection: 'student-assignments',
    where: { enrollment: { equals: enrollmentId } },
    sort: ['week', 'day', 'order'],
    pagination: false,
    depth: 0,
    select: { week: true, day: true, order: true, text: true, sourceTask: true },
    overrideAccess: false,
    user,
  })

  const cells = new Map<string, Cell[]>()
  for (const item of docs) {
    const key = `${item.week}:${item.day}`
    cells.set(key, [
      ...(cells.get(key) ?? []),
      { id: item.id, text: item.text?.ru ?? '', fromPool: item.sourceTask != null },
    ])
  }

  const days = Array.from({ length: PLAN_DAYS }, (_, i) => i + 1)
  const weeks = Array.from({ length: durationWeeks }, (_, i) => i + 1)

  return (
    <div className={styles.scroll}>
      <table className={styles.table} aria-label="План ученика">
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
                      {preview(cell.text)}{' '}
                      <span className={cell.fromPool ? styles.pool : styles.own}>
                        {cell.fromPool ? 'из пула' : 'своё'}
                      </span>
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
