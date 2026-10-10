import { describe, expect, it } from 'vitest'

import { challengeListView } from '@/features/challenge/list'

describe('challengeListView', () => {
  it('is empty without public challenges', () => {
    expect(challengeListView([])).toEqual({ kind: 'empty' })
  })

  it('redirects to the only challenge', () => {
    expect(challengeListView([{ slug: 'a' }])).toEqual({ kind: 'redirect', slug: 'a' })
  })

  it('lists two or more', () => {
    const items = [{ slug: 'a' }, { slug: 'b' }]
    expect(challengeListView(items)).toEqual({ kind: 'list', items })
  })
})
