import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations } from 'next-intl/server'

import { siteConfig } from '@/config/site'
import { alternatesFor } from '@/i18n/alternates'
import { routing } from '@/i18n/routing'

import styles from './page.module.css'

export const revalidate = 3600

// Example numbers from the design reference — Murad replaces them with real results.
const BREAKDOWN = [
  { key: 'a1b1', count: '[18]*' },
  { key: 'a2b2', count: '[21]*' },
  { key: 'b1c1', count: '[15]*' },
] as const
const NUMBERED = ['1', '2', '3', '4', '5'] as const
const LEVELS = [
  { level: 'A1', year: '2022', score: '82/150*' },
  { level: 'A2', year: '2023', score: '104/150*' },
  { level: 'B1', year: '2024', score: '121/150*' },
  { level: 'B2', year: '2025', score: '138/150*' },
] as const
const RESOURCES = [
  { key: 'prep', confirm: 'confirmTitle' },
  { key: 'grammar', confirm: 'confirmTitle' },
  { key: 'skills', confirm: 'confirmTitle' },
  { key: 'extra', confirm: 'confirmList' },
] as const
const SCORES = [
  { section: 'Reading & Writing', score: '133/150*' },
  { section: 'Listening', score: '128/150*' },
  { section: 'Speaking', score: '141/150*' },
] as const
const EVERYDAY = ['news', 'health', 'culture'] as const
const ABROAD_EXAMS = [
  'IELTS',
  'TOEFL',
  'Cambridge C1 Advanced',
  'Cambridge C2 Proficiency',
] as const
const BLOG = ['book', 'case', 'science'] as const
const FAQ = ['low', 'it', 'group', 'fail'] as const

type PageProps = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  return { alternates: alternatesFor('/', locale) }
}

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return null
  const t = await getTranslations({ locale, namespace: 'Home' })

  const telegram = (className: string) => (
    <div className={styles.ctaGroup}>
      <a href={siteConfig.telegramUrl} target="_blank" rel="noopener" className={className}>
        {t('hero.cta')}
      </a>
      <span className={styles.ctaHandle}>{siteConfig.telegramHandle}</span>
    </div>
  )

  return (
    <div className={styles.landing}>
      <section className={`${styles.section} ${styles.hero}`}>
        <div className={`${styles.wrap} ${styles.heroGrid}`}>
          <div>
            <h1 className={styles.heroTitle}>{t('hero.title')}</h1>
            <p className={`${styles.heroLead} ${styles.measure}`}>{t('hero.lead')}</p>
            <div className={styles.heroActions}>
              {telegram(`${styles.btnCta} ${styles.btnLarge}`)}
            </div>
            <div className={styles.heroStat}>
              <p className={styles.heroStatNum}>54</p>
              <p className={styles.heroStatLabel}>{t('hero.statLabel')}</p>
              <ul className={styles.breakdown}>
                {BREAKDOWN.map(({ key, count }) => (
                  <li key={key}>
                    <span>{t(`hero.${key}`)}</span>
                    <b>{count}</b>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className={styles.heroVisual}>
            <div className={styles.windowFrame}>
              <svg
                viewBox="0 0 400 320"
                width="100%"
                role="img"
                aria-label={t('hero.illustrationAlt')}
              >
                <rect x="0" y="0" width="400" height="320" fill="#F4F0E6" />
                <circle cx="300" cy="90" r="24" fill="none" stroke="#A9723C" strokeWidth="1.4" />
                <path
                  d="M270 258 L270 188 M282 258 L282 188 M294 258 L294 188 M306 258 L306 188"
                  stroke="#20242B"
                  strokeWidth="1.1"
                />
                <path
                  d="M262 188 L314 188 L288 162 Z"
                  fill="none"
                  stroke="#20242B"
                  strokeWidth="1.1"
                />
                <line x1="256" y1="258" x2="320" y2="258" stroke="#20242B" strokeWidth="1.1" />
                <rect
                  x="335"
                  y="150"
                  width="28"
                  height="108"
                  fill="none"
                  stroke="#3F5C58"
                  strokeWidth="1"
                  opacity="0.7"
                />
                <path
                  d="M120 44 L120 296 L258 296 L258 44 Z"
                  fill="none"
                  stroke="#20242B"
                  strokeWidth="1.6"
                />
                <path
                  d="M120 44 L233 62 L233 284 L120 296 Z"
                  fill="#F4F0E6"
                  stroke="#20242B"
                  strokeWidth="1.4"
                />
                <circle cx="144" cy="172" r="3" fill="#20242B" />
                <circle cx="150" cy="222" r="12" fill="none" stroke="#A9723C" strokeWidth="1.3" />
                <path
                  d="M145 222 l4 4 l7 -8"
                  fill="none"
                  stroke="#A9723C"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <line x1="0" y1="272" x2="400" y2="272" stroke="#20242B" strokeWidth="1" />
              </svg>
            </div>
            <div className={styles.photoSlot}>
              <span>{t('hero.photo')}</span>
            </div>
          </div>
        </div>
      </section>

      <section
        id="about"
        aria-labelledby="about-title"
        className={`${styles.section} ${styles.dark}`}
      >
        <div className={`${styles.wrap} ${styles.aboutGrid}`}>
          <div>
            <div className={`${styles.photoSlot} ${styles.photoInline}`}>
              <span>{t('hero.photo')}</span>
            </div>
            <h2 id="about-title" className={styles.h2Small}>
              {t('about.title')}
            </h2>
          </div>
          <div>
            <p className={`${styles.measure} ${styles.darkLead}`}>{t('about.lead')}</p>
            <dl className={styles.credTable}>
              {(
                [
                  ['education', 'educationValue'],
                  ['certificate', 'certificateValue'],
                  ['level', 'levelValue'],
                  ['experience', 'experienceValue'],
                ] as const
              ).map(([term, value]) => (
                <div key={term} className={styles.credRow}>
                  <dt>{t(`about.${term}`)}</dt>
                  <dd>{t(`about.${value}`)}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className={styles.aboutNotes}>
            <div>
              <h3>{t('about.mentorTitle')}</h3>
              <p>{t('about.mentorBody')}</p>
            </div>
            <div>
              <h3>{t('about.benefitTitle')}</h3>
              <p>{t('about.benefitBody')}</p>
            </div>
          </div>
        </div>
      </section>

      <section id="approach" aria-labelledby="approach-title" className={styles.section}>
        <div className={`${styles.wrap} ${styles.approachGrid}`}>
          <div>
            <span className={styles.label}>{t('approach.label')}</span>
            <h2 id="approach-title" className={styles.h2Large}>
              {t('approach.title')}
            </h2>
            <p className={`${styles.measure} ${styles.lead}`}>{t('approach.body')}</p>
          </div>
          <div>
            <div className={styles.zpd}>
              <svg viewBox="0 0 300 300" role="img" aria-label={t('approach.diagramAlt')}>
                <circle cx="150" cy="150" r="135" fill="#E1D9C6" stroke="#20242B" strokeWidth="1" />
                <circle cx="150" cy="150" r="92" fill="#A9723C" opacity="0.4" />
                <circle cx="150" cy="150" r="46" fill="#20242B" />
              </svg>
              <ul className={styles.zpdLegend}>
                <li>
                  <span className={`${styles.dot} ${styles.dotInner}`} aria-hidden="true" />
                  {t('approach.inner')}
                </li>
                <li>
                  <span className={`${styles.dot} ${styles.dotMid}`} aria-hidden="true" />
                  {t('approach.middle')}
                </li>
                <li>
                  <span className={`${styles.dot} ${styles.dotOuter}`} aria-hidden="true" />
                  {t('approach.outer')}
                </li>
              </ul>
            </div>
            <blockquote className={styles.quote}>
              {t('approach.quote')}
              <cite>{t('approach.cite')}</cite>
            </blockquote>
          </div>
        </div>
      </section>

      <section aria-labelledby="method-title" className={styles.section}>
        <div className={styles.wrap}>
          <span className={styles.label}>{t('method.label')}</span>
          <h2 id="method-title" className={styles.h2Medium}>
            {t('method.title')}
          </h2>
          <p className={`${styles.measure} ${styles.leadSmall}`}>{t('method.lead')}</p>
          <ol className={styles.reasonGrid}>
            {NUMBERED.map((n) => (
              <li key={n} className={styles.reasonItem}>
                <span className={styles.reasonNum} aria-hidden="true">
                  {n}
                </span>
                <p>{t(`method.reasons.${n}`)}</p>
              </li>
            ))}
          </ol>
          <p className={styles.footnote}>{t('method.footnote')}</p>
        </div>
      </section>

      <section
        id="bridge"
        aria-labelledby="bridge-title"
        className={`${styles.section} ${styles.deep}`}
      >
        <div className={styles.wrap}>
          <span className={styles.label}>{t('bridge.label')}</span>
          <h2 id="bridge-title" className={`${styles.h2Large} ${styles.chBridge}`}>
            {t('bridge.title')}
          </h2>
          <p className={`${styles.measure} ${styles.lead}`}>{t('bridge.body')}</p>
          <ol className={styles.levels}>
            {LEVELS.map(({ level, year, score }) => (
              <li key={level} className={styles.levelNode}>
                <span className={styles.levelDot}>{level}</span>
                <span className={styles.levelLabel}>{year}</span>
                <span className={styles.levelScore}>{score}</span>
              </li>
            ))}
            <li className={`${styles.levelNode} ${styles.levelFinal}`}>
              <span className={styles.levelDot}>C1</span>
              <span className={styles.levelLabel}>{t('bridge.now')}</span>
              <span className={styles.levelScore}>147/150*</span>
            </li>
          </ol>
          <p className={styles.bridgeFootnote}>{t('bridge.footnote')}</p>
        </div>
      </section>

      <section id="materials" aria-labelledby="materials-title" className={styles.section}>
        <div className={styles.wrap}>
          <span className={styles.label}>{t('materials.label')}</span>
          <h2 id="materials-title" className={`${styles.h2Medium} ${styles.chMaterials}`}>
            {t('materials.title')}
          </h2>
          <p className={`${styles.measure} ${styles.leadSmall}`}>{t('materials.lead')}</p>
          <ul className={styles.resourceGrid}>
            {RESOURCES.map(({ key, confirm }) => (
              <li key={key} className={styles.resourceCard}>
                <p className={styles.resourceType}>{t(`materials.items.${key}.type`)}</p>
                <p className={styles.resourceName}>{t(`materials.items.${key}.name`)}</p>
                <p className={styles.resourceNote}>{t(`materials.${confirm}`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="proof" aria-label={t('proof.label')} className={styles.section}>
        <div className={`${styles.wrap} ${styles.proofGrid}`}>
          <div>
            <p className={styles.bigStat}>54</p>
            <p className={styles.bigStatLabel}>{t('proof.statLabel')}</p>
          </div>
          <div>
            <span className={styles.label}>{t('proof.label')}</span>
            <div className={styles.proofCards}>
              {(['video', 'certificates'] as const).map((key) => (
                <div key={key} className={styles.proofCard}>
                  <h3>{t(`proof.${key}.title`)}</h3>
                  <p>{t(`proof.${key}.body`)}</p>
                  <span className={styles.placeholderTag}>{t(`proof.${key}.tag`)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className={styles.chartBlock}>
            <h3>{t('proof.chartTitle')}</h3>
            <svg viewBox="0 0 640 210" role="img" aria-label={t('proof.chartAlt')}>
              <line x1="36" y1="170" x2="600" y2="170" stroke="currentColor" strokeWidth="1" />
              <polyline
                points="80,145 220,115 360,80 500,35"
                fill="none"
                stroke="#A9723C"
                strokeWidth="2"
              />
              {(
                [
                  [80, 145, '82', '2022'],
                  [220, 115, '104', '2023'],
                  [360, 80, '121', '2024'],
                  [500, 35, '138', '2025'],
                ] as const
              ).map(([x, y, score, year]) => (
                <g key={year}>
                  <circle cx={x} cy={y} r="4" fill="#A9723C" />
                  <text x={x} y={y - 12} fontSize="12" fill="currentColor" textAnchor="middle">
                    {score}
                  </text>
                  <text
                    x={x}
                    y="188"
                    fontSize="11"
                    fill="currentColor"
                    opacity="0.7"
                    textAnchor="middle"
                  >
                    {year}
                  </text>
                </g>
              ))}
            </svg>
            <p className={styles.caption}>{t('proof.chartCaption')}</p>
            <table className={styles.scoreTable}>
              <thead>
                <tr>
                  <th scope="col">{t('proof.section')}</th>
                  <th scope="col">{t('proof.score')}</th>
                </tr>
              </thead>
              <tbody>
                {SCORES.map(({ section, score }) => (
                  <tr key={section}>
                    <td>{section}</td>
                    <td>{score}</td>
                  </tr>
                ))}
                <tr>
                  <td>{t('proof.overall')}</td>
                  <td>134/150*</td>
                </tr>
              </tbody>
            </table>
            <p className={styles.caption}>{t('proof.tableCaption')}</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="benefits-title" className={styles.section}>
        <div className={styles.wrap}>
          <span className={styles.label}>{t('benefits.label')}</span>
          <h2 id="benefits-title" className={styles.h2Medium}>
            {t('benefits.title')}
          </h2>
          <ol className={styles.reasonGrid}>
            {NUMBERED.map((n) => (
              <li key={n} className={styles.reasonItem}>
                <span className={styles.reasonNum} aria-hidden="true">
                  {n}
                </span>
                <p>{t(`benefits.items.${n}`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="guarantee-title" className={`${styles.section} ${styles.deep}`}>
        <div className={styles.wrap}>
          <div className={styles.guarantee}>
            <span className={styles.guaranteeMark} aria-hidden="true">
              ✓
            </span>
            <div>
              <h2 id="guarantee-title" className={styles.h2Small}>
                {t('guarantee.title')}
              </h2>
              <p className={`${styles.measure} ${styles.leadSmall}`}>{t('guarantee.body')}</p>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="everyday-title" className={`${styles.section} ${styles.dark}`}>
        <div className={styles.wrap}>
          <span className={styles.label}>{t('everyday.label')}</span>
          <h2 id="everyday-title" className={`${styles.h2Medium} ${styles.chEveryday}`}>
            {t('everyday.title')}
          </h2>
          <div className={styles.compareList}>
            {EVERYDAY.map((key) => (
              <div key={key} className={styles.compareRow}>
                <h3>{t(`everyday.items.${key}.title`)}</h3>
                <p>{t(`everyday.items.${key}.body`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="audience" aria-labelledby="audience-title" className={styles.section}>
        <div className={styles.wrap}>
          <span className={styles.label}>{t('audience.label')}</span>
          <h2 id="audience-title" className={styles.h2Large}>
            {t('audience.title')}
          </h2>
          <div className={styles.audGrid}>
            <div className={`${styles.audCard} ${styles.audPrimary}`}>
              <h3>{t('audience.abroadTitle')}</h3>
              <ul>
                {ABROAD_EXAMS.map((exam) => (
                  <li key={exam}>{exam}</li>
                ))}
              </ul>
            </div>
            <div className={styles.audCard}>
              <h3>{t('audience.schoolTitle')}</h3>
              <ul>
                <li>{t('audience.schoolExams')}</li>
                <li>{t('audience.schoolLevels')}</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="pricing-title" className={`${styles.section} ${styles.deep}`}>
        <div className={styles.wrap}>
          <span className={styles.label}>{t('pricing.label')}</span>
          <div className={styles.priceBox}>
            <div>
              <h2 id="pricing-title" className={styles.priceRange}>
                {t('pricing.range')}
              </h2>
              <p className={styles.priceNote}>{t('pricing.note')}</p>
            </div>
            <a href="#contact" className={styles.btnGhost}>
              {t('pricing.cta')}
            </a>
          </div>
        </div>
      </section>

      <section id="blog" aria-labelledby="blog-title" className={styles.section}>
        <div className={styles.wrap}>
          <span className={styles.label}>{t('blog.label')}</span>
          <h2 id="blog-title" className={`${styles.h2Large} ${styles.chBlog}`}>
            {t('blog.title')}
          </h2>
          <p className={`${styles.measure} ${styles.leadSmall}`}>{t('blog.lead')}</p>
          <ul className={styles.blogGrid}>
            {BLOG.map((key) => (
              <li key={key} className={styles.blogCard}>
                <span className={styles.blogSoon}>{t('blog.soon')}</span>
                <h3>{t(`blog.items.${key}.title`)}</h3>
                <p>{t(`blog.items.${key}.body`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="faq" aria-labelledby="faq-title" className={`${styles.section} ${styles.deep}`}>
        <div className={styles.wrap}>
          <span className={styles.label}>{t('faq.label')}</span>
          <h2 id="faq-title" className={styles.h2Medium}>
            {t('faq.title')}
          </h2>
          <div className={styles.faqList}>
            {FAQ.map((key) => (
              <div key={key} className={styles.faqItem}>
                <h3>{t(`faq.items.${key}.q`)}</h3>
                <p>{t(`faq.items.${key}.a`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" aria-labelledby="contact-title" className={styles.section}>
        <div className={styles.wrap}>
          <h2 id="contact-title" className={styles.finalTitle}>
            {t('contact.title')}
          </h2>
          <p className={`${styles.measure} ${styles.lead}`}>{t('contact.body')}</p>
          <div className={styles.finalCta}>
            <div className={styles.ctaGroup}>
              <a
                href={siteConfig.telegramUrl}
                target="_blank"
                rel="noopener"
                className={`${styles.btnCta} ${styles.btnLarge}`}
              >
                {t('contact.cta')}
              </a>
              <span className={styles.ctaHandle}>{siteConfig.telegramHandle}</span>
            </div>
          </div>
          <p className={styles.ps}>{t('contact.ps')}</p>
        </div>
      </section>
    </div>
  )
}
