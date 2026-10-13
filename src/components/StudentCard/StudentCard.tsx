import { initialsOf } from '@/features/students/shape'
import type { StudentCard as Card } from '@/features/students/queries'

import styles from './StudentCard.module.css'

export type StudentCardLabels = {
  label: string
  avatarAlt: string
  level: string
  goal: string
  /** «Занимаемся с Мурадом с 1 октября»: already formatted, or null when there is no start date. */
  since: string | null
}

/**
 * The student's own card on /study (story 021): avatar (initials without one), name, email and
 * whatever Murad has set up. Rows without data are left out, never shown empty.
 */
export function StudentCard({ card, labels }: { card: Card; labels: StudentCardLabels }) {
  const rows = [
    card.level ? { term: labels.level, value: card.level, testId: 'card-level' } : null,
    card.goal ? { term: labels.goal, value: card.goal, testId: 'card-goal' } : null,
  ].filter((row) => row !== null)

  return (
    <section className={styles.card} aria-label={labels.label} data-testid="student-card">
      {card.avatarUrl ? (
        // A private same-origin file served by Payload: next/image would only proxy it again.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.avatarUrl} alt={labels.avatarAlt} className={styles.avatar} />
      ) : (
        <span className={styles.avatar} aria-hidden="true" data-testid="card-initials">
          {initialsOf(card.name, card.email)}
        </span>
      )}
      <div className={styles.body}>
        {card.name ? <p className={styles.name}>{card.name}</p> : null}
        <p className={styles.email}>{card.email}</p>
        {rows.length > 0 ? (
          <dl className={styles.rows}>
            {rows.map((row) => (
              <div key={row.testId} className={styles.row}>
                <dt>{row.term}</dt>
                <dd data-testid={row.testId}>{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {labels.since ? (
          <p className={styles.since} data-testid="card-since">
            {labels.since}
          </p>
        ) : null}
      </div>
    </section>
  )
}
