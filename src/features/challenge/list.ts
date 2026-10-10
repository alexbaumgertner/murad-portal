// Pure: what `/challenge` shows for a given set of public challenges (no framework imports).
export type ChallengeListView<T extends { slug: string }> =
  { kind: 'empty' } | { kind: 'redirect'; slug: string } | { kind: 'list'; items: T[] }

export function challengeListView<T extends { slug: string }>(items: T[]): ChallengeListView<T> {
  if (items.length === 0) return { kind: 'empty' }
  if (items.length === 1) return { kind: 'redirect', slug: items[0]!.slug }
  return { kind: 'list', items }
}
