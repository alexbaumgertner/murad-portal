import { ValidationError, type CollectionBeforeValidateHook, type CollectionConfig } from 'payload'

import { authenticated, publicChallengeOrAuthenticated } from '@/access'
import {
  DEFAULT_BLOCK_DAYS,
  DEFAULT_DAILY_MINUTES,
  DEFAULT_DURATION_DAYS,
  DEFAULT_TIME_ZONE,
  checkChallengeShape,
  isValidTimeZone,
} from '@/features/challenge/shape'

type ShapeData = { durationDays?: number; blockDays?: number; videos?: unknown[] | null }

// Cross-field rule: duration, block length and the number of videos must add up. Runs on the
// stored values merged with the incoming ones, so a partial update cannot slip past it.
const validateShape: CollectionBeforeValidateHook = ({ data, originalDoc }) => {
  const merged: ShapeData = { ...(originalDoc as ShapeData | undefined), ...(data as ShapeData) }
  const durationDays = merged.durationDays ?? DEFAULT_DURATION_DAYS
  const blockDays = merged.blockDays ?? DEFAULT_BLOCK_DAYS
  const videosCount = merged.videos?.length ?? 0

  const message = checkChallengeShape({ durationDays, blockDays, videosCount })
  if (message) {
    const divisible = Number.isInteger(durationDays) && durationDays % blockDays === 0
    throw new ValidationError({
      collection: 'challenges',
      errors: [{ path: divisible ? 'videos' : 'blockDays', message }],
    })
  }
  return data
}

const wholeNumber = (min: number, max: number, label: string) => (value: unknown) =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
    ? true
    : `${label} must be a whole number from ${min} to ${max}.`

export const Challenges: CollectionConfig = {
  slug: 'challenges',
  labels: { singular: 'Challenge', plural: 'Challenges' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'startDate', 'isPublic'],
  },
  // Anonymous readers only get public challenges; the Local API caller passes overrideAccess: false.
  access: {
    read: publicChallengeOrAuthenticated('isPublic'),
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  hooks: {
    beforeValidate: [validateShape],
  },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'Used in the public URL: /challenge/<slug>.' },
      validate: (value: unknown) =>
        typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
          ? true
          : 'Use lowercase letters, digits and single hyphens, e.g. "90-90-1".',
    },
    {
      name: 'startDate',
      type: 'date',
      required: true,
      admin: {
        date: { pickerAppearance: 'dayOnly' },
        description: 'Day 1 of the challenge, in the time zone below.',
      },
    },
    {
      name: 'timeZone',
      type: 'text',
      required: true,
      defaultValue: DEFAULT_TIME_ZONE,
      admin: { description: 'IANA name, e.g. Asia/Almaty. Days flip at local midnight.' },
      validate: (value: unknown) =>
        typeof value === 'string' && isValidTimeZone(value)
          ? true
          : 'Enter a valid IANA time zone, e.g. Asia/Almaty.',
    },
    {
      type: 'row',
      fields: [
        {
          name: 'durationDays',
          type: 'number',
          required: true,
          defaultValue: DEFAULT_DURATION_DAYS,
          min: 1,
          validate: wholeNumber(1, 365, 'Duration'),
        },
        {
          name: 'dailyMinutes',
          type: 'number',
          required: true,
          defaultValue: DEFAULT_DAILY_MINUTES,
          min: 1,
          max: 600,
          validate: wholeNumber(1, 600, 'Daily minutes'),
        },
        {
          name: 'blockDays',
          type: 'number',
          required: true,
          defaultValue: DEFAULT_BLOCK_DAYS,
          min: 1,
          validate: wholeNumber(1, 365, 'Block length'),
        },
      ],
    },
    {
      name: 'isPublic',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: {
        position: 'sidebar',
        description: 'Only public challenges (and their days) are visible to visitors.',
      },
    },
    {
      name: 'rules',
      type: 'richText',
      localized: true,
      admin: { description: 'What counts and what does not (allowed / not allowed content).' },
    },
    {
      name: 'videos',
      type: 'array',
      labels: { singular: 'Video', plural: 'Videos' },
      admin: {
        description: 'Exactly one video per block: durationDays / blockDays items, in block order.',
        initCollapsed: true,
      },
      fields: [
        { name: 'title', type: 'text', required: true },
        {
          name: 'youtubeUrl',
          type: 'text',
          validate: (value: unknown) => {
            if (!value) return true
            try {
              const url = new URL(String(value))
              return url.protocol === 'https:' || url.protocol === 'http:'
                ? true
                : 'Enter an http(s) link.'
            } catch {
              return 'Enter a valid link.'
            }
          },
        },
        { name: 'publishedAt', type: 'date' },
        { name: 'retroWorked', type: 'textarea', admin: { description: 'Retro: what worked.' } },
        { name: 'retroDropped', type: 'textarea', admin: { description: 'Retro: what to drop.' } },
        { name: 'retroChange', type: 'textarea', admin: { description: 'Retro: what to change.' } },
      ],
    },
  ],
}
