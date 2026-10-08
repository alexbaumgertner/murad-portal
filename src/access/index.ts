import type { Access } from 'payload'

export const anyone: Access = () => true

export const authenticated: Access = ({ req }) => Boolean(req.user)

export const publishedOrAuthenticated: Access = ({ req }) => {
  if (req.user) return true
  return { publishedAt: { less_than_equal: new Date().toISOString() } }
}

// Public reads of challenge data: anonymous callers only match rows of a public challenge.
// `path` is the field to test: 'isPublic' on challenges, 'challenge.isPublic' on challenge-days.
export const publicChallengeOrAuthenticated =
  (path: 'isPublic' | 'challenge.isPublic'): Access =>
  ({ req }) => {
    if (req.user) return true
    return { [path]: { equals: true } }
  }
