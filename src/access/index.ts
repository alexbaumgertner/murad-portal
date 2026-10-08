import type { Access, TypedUser } from 'payload'

export const anyone: Access = () => true

// The site has two roles (`users.role`): the owner runs /admin, students only see their own data.
// A student is signed in but is NOT an admin, so "signed in" must never grant owner powers.
export const isOwner = (user: TypedUser | null | undefined): boolean =>
  user?.collection === 'users' && user.role === 'owner'

export const owner: Access = ({ req }) => isOwner(req.user)

export const publishedOrOwner: Access = ({ req }) => {
  if (isOwner(req.user)) return true
  return { publishedAt: { less_than_equal: new Date().toISOString() } }
}

// Public reads of challenge data: anyone but the owner only matches rows of a public challenge.
// `path` is the field to test: 'isPublic' on challenges, 'challenge.isPublic' on challenge-days.
export const publicChallengeOrOwner =
  (path: 'isPublic' | 'challenge.isPublic'): Access =>
  ({ req }) => {
    if (isOwner(req.user)) return true
    return { [path]: { equals: true } }
  }
