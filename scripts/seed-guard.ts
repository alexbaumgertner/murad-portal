/**
 * `pnpm seed:study` fails closed: it runs only on a Vercel preview build or against a database on
 * this machine. Anything else — a production URL pasted into a shell, an unknown CI — is refused.
 */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

export function canSeedStudy(env: Record<string, string | undefined>): boolean {
  if (env.VERCEL_ENV === 'preview') return true
  if (env.VERCEL_ENV) return false
  try {
    return LOCAL_HOSTS.has(new URL(env.DATABASE_URL ?? '').hostname)
  } catch {
    return false
  }
}
