import type { CollectionConfig } from 'payload'

import { owner } from '@/access'

export const WaitlistSignups: CollectionConfig = {
  slug: 'waitlist-signups',
  labels: { singular: 'Waitlist signup', plural: 'Waitlist' },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'source', 'createdAt'],
  },
  // Signups are created server-side via the Local API; the public REST/GraphQL API stays closed.
  access: {
    create: owner,
    read: owner,
    update: owner,
    delete: owner,
  },
  fields: [
    {
      name: 'email',
      type: 'email',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'source',
      type: 'text',
      admin: { description: 'Where the signup came from, e.g. "landing-hero".' },
    },
  ],
}
