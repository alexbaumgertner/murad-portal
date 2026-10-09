import { postgresAdapter } from '@payloadcms/db-postgres'
import { resendAdapter } from '@payloadcms/email-resend'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { owner } from './access'
import { AuthCodes } from './collections/AuthCodes'
import { ChallengeDays } from './collections/ChallengeDays'
import { Challenges } from './collections/Challenges'
import { ChangelogEntries } from './collections/ChangelogEntries'
import { Media } from './collections/Media'
import { Programs } from './collections/Programs'
import { SlotTypes } from './collections/SlotTypes'
import { Users } from './collections/Users'
import { WaitlistSignups } from './collections/WaitlistSignups'
import { siteConfig } from './config/site'
import { contentDefaultLocale, localeLabels, locales } from './i18n/locales'
import { env } from './lib/env'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  serverURL: env.NEXT_PUBLIC_SITE_URL,
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      beforeLogin: ['/components/admin/EmailCodeLogin/EmailCodeLogin#EmailCodeLogin'],
      logout: { Button: '/components/admin/LogoutButton/LogoutButton#LogoutButton' },
      views: {
        // A signed-in student has no admin access; Payload sends her here, we send her to /study.
        unauthorized: {
          Component: '/components/admin/StudentRedirect/StudentRedirect#StudentRedirect',
          path: '/unauthorized',
        },
      },
    },
  },
  collections: [
    Users,
    Media,
    ChangelogEntries,
    WaitlistSignups,
    Challenges,
    ChallengeDays,
    SlotTypes,
    Programs,
    AuthCodes,
  ],
  // Content locales (the admin UI itself stays English). Missing translations fall back to English.
  localization: {
    locales: locales.map((code) => ({ code, label: localeLabels[code] })),
    defaultLocale: contentDefaultLocale,
    fallback: true,
  },
  editor: lexicalEditor(),
  email: env.RESEND_API_KEY
    ? resendAdapter({
        apiKey: env.RESEND_API_KEY,
        defaultFromAddress: env.EMAIL_FROM_ADDRESS,
        defaultFromName: siteConfig.name,
      })
    : undefined,
  secret: env.PAYLOAD_SECRET,
  onInit: (payload) => {
    // Payload adds `payload-locked-documents` itself with "any signed-in user" access, which would
    // let a student read or clear the owner's edit locks. There is no config hook for it: replace
    // the access functions once the config is sanitized.
    const locks = payload.collections['payload-locked-documents']?.config
    if (locks)
      locks.access = { ...locks.access, create: owner, read: owner, update: owner, delete: owner }
  },
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: env.DATABASE_URL,
    },
    migrationDir: path.resolve(dirname, 'migrations'),
    push: env.PAYLOAD_DB_PUSH,
  }),
  sharp,
  plugins: [
    vercelBlobStorage({
      enabled: Boolean(env.BLOB_READ_WRITE_TOKEN),
      collections: { media: true },
      token: env.BLOB_READ_WRITE_TOKEN,
    }),
  ],
})
