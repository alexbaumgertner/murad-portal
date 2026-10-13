// Framework-free helpers for the student's card and avatar (story 021).

export const AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024
export const MAX_GOAL = 200

export type AvatarError = 'empty' | 'invalid_type' | 'too_large'

/** Why a picked file cannot be an avatar, or null when it can. */
export function avatarError(file: { type: string; size: number }): AvatarError | null {
  if (file.size <= 0) return 'empty'
  if (!(AVATAR_MIME_TYPES as readonly string[]).includes(file.type)) return 'invalid_type'
  if (file.size > MAX_AVATAR_BYTES) return 'too_large'
  return null
}

/** «AP» for «Anna Petrova»; the first letter of the email when she has no name. */
export function initialsOf(name: string | null | undefined, email: string): string {
  const words = (name ?? '').split(/\s+/).filter(Boolean)
  const letters = words.length > 0 ? words.slice(0, 2).map((word) => word[0]) : [email[0] ?? '?']
  return letters.join('').toUpperCase()
}

/** «1 октября 2026»: a calendar date (`YYYY-MM-DD`) with no time zone, so it never shifts a day. */
export function formatStartDate(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00.000Z`))
}

/** The image type the first bytes really are, whatever the client claimed; null when unknown. */
export function sniffImageType(data: Uint8Array): (typeof AVATAR_MIME_TYPES)[number] | null {
  const startsWith = (...bytes: number[]) => bytes.every((byte, i) => data[i] === byte)
  if (startsWith(0xff, 0xd8, 0xff)) return 'image/jpeg'
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png'
  // WebP: «RIFF» + size + «WEBP».
  if (startsWith(0x52, 0x49, 0x46, 0x46) && data[8] === 0x57 && data[9] === 0x45)
    return 'image/webp'
  return null
}
