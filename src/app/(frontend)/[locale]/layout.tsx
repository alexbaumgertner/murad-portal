import type { Metadata, Viewport } from 'next'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { Geist, Geist_Mono, IBM_Plex_Sans, Newsreader } from 'next/font/google'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

import { PageViews } from '@/components/PageViews/PageViews'
import { SiteFooter } from '@/components/SiteFooter/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader/SiteHeader'
import { siteConfig } from '@/config/site'
import { routing } from '@/i18n/routing'
import { analyticsProvider } from '@/lib/analytics'

import '../globals.css'

const geistSans = Geist({ subsets: ['latin', 'cyrillic'], variable: '--font-geist-sans' })
const geistMono = Geist_Mono({ subsets: ['latin', 'cyrillic'], variable: '--font-geist-mono' })
// Landing typography. Newsreader has no Cyrillic: Russian headings fall back to Georgia.
const newsreader = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  weight: ['400', '500', '600'],
  variable: '--font-newsreader',
})
const plexSans = IBM_Plex_Sans({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-sans',
})

type LayoutProps = { children: ReactNode; params: Promise<{ locale: string }> }

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'Metadata' })
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
    title: { default: siteConfig.name, template: `%s · ${siteConfig.name}` },
    description: t('description'),
  }
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfaf7' },
    { media: '(prefers-color-scheme: dark)', color: '#121110' },
  ],
}

export default async function LocaleLayout({ children, params }: LayoutProps) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} ${plexSans.variable}`}
    >
      <body>
        <NextIntlClientProvider>
          <SiteHeader />
          <main>{children}</main>
          <SiteFooter />
        </NextIntlClientProvider>
        {analyticsProvider() === 'vercel' && <PageViews />}
      </body>
    </html>
  )
}
