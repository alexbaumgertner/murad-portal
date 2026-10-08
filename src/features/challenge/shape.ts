// Pure validation helpers shared by the Payload collection hooks and unit tests.
// No framework imports: the Payload CLI loads collections (and so this file) outside Next.js.

export const DEFAULT_TIME_ZONE = 'Asia/Almaty'
export const DEFAULT_DURATION_DAYS = 90
export const DEFAULT_DAILY_MINUTES = 90
export const DEFAULT_BLOCK_DAYS = 15

export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone) return false
  try {
    new Intl.DateTimeFormat('en', { timeZone })
    return true
  } catch {
    return false
  }
}

type Shape = { durationDays: number; blockDays: number; videosCount: number }

/** Returns an admin-facing message when the challenge calendar does not add up, else `null`. */
export function checkChallengeShape({
  durationDays,
  blockDays,
  videosCount,
}: Shape): string | null {
  if (
    !Number.isInteger(durationDays) ||
    !Number.isInteger(blockDays) ||
    durationDays < 1 ||
    blockDays < 1
  ) {
    return 'Duration and block length must be positive whole numbers.'
  }
  if (durationDays % blockDays !== 0) {
    return `Duration (${durationDays} days) must be divisible by the block length (${blockDays} days).`
  }
  const expected = durationDays / blockDays
  if (videosCount !== expected) {
    return `A ${durationDays}-day challenge in ${blockDays}-day blocks needs exactly ${expected} videos (one per block), but has ${videosCount}.`
  }
  return null
}
