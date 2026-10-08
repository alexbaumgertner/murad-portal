import { ValidationError, type CollectionBeforeValidateHook, type CollectionConfig } from 'payload'

import { owner, publicChallengeOrOwner } from '@/access'

type DayData = { challenge?: number | { id: number } | null; dayNumber?: number }

const idOf = (value: DayData['challenge']) => (typeof value === 'object' ? value?.id : value)

// Integrity checks that need the parent challenge. The lookups bypass access on purpose: they are
// not a visitor read, and the write itself was already authorised by the collection access above.
const validateDay: CollectionBeforeValidateHook = async ({ data, originalDoc, req }) => {
  const merged: DayData = { ...(originalDoc as DayData | undefined), ...(data as DayData) }
  const challengeId = idOf(merged.challenge)
  const { dayNumber } = merged
  if (challengeId == null || typeof dayNumber !== 'number') return data

  const { docs } = await req.payload.find({
    collection: 'challenges',
    where: { id: { equals: challengeId } },
    limit: 1,
    depth: 0,
    select: { durationDays: true },
    overrideAccess: true,
    req,
  })
  const challenge = docs[0]
  if (!challenge) {
    throw new ValidationError({
      collection: 'challenge-days',
      errors: [{ path: 'challenge', message: 'This challenge does not exist.' }],
    })
  }
  if (dayNumber > challenge.durationDays) {
    throw new ValidationError({
      collection: 'challenge-days',
      errors: [
        {
          path: 'dayNumber',
          message: `Day ${dayNumber} is outside this ${challenge.durationDays}-day challenge.`,
        },
      ],
    })
  }

  const { totalDocs } = await req.payload.count({
    collection: 'challenge-days',
    where: {
      challenge: { equals: challengeId },
      dayNumber: { equals: dayNumber },
      ...(originalDoc?.id ? { id: { not_equals: originalDoc.id } } : {}),
    },
    overrideAccess: true,
    req,
  })
  if (totalDocs > 0) {
    throw new ValidationError({
      collection: 'challenge-days',
      errors: [
        { path: 'dayNumber', message: `Day ${dayNumber} is already logged for this challenge.` },
      ],
    })
  }
  return data
}

const wholeNumber = (min: number, max: number, label: string) => (value: unknown) =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
    ? true
    : `${label} must be a whole number from ${min} to ${max}.`

export const ChallengeDays: CollectionConfig = {
  slug: 'challenge-days',
  labels: { singular: 'Challenge day', plural: 'Challenge days' },
  admin: {
    useAsTitle: 'dayNumber',
    defaultColumns: ['challenge', 'dayNumber', 'minutes', 'closedAt'],
  },
  defaultSort: '-dayNumber',
  // A day is public exactly when its challenge is. Writes: signed-in admin only.
  access: {
    read: publicChallengeOrOwner('challenge.isPublic'),
    create: owner,
    update: owner,
    delete: owner,
  },
  // The database enforces one row per (challenge, day); the hook above gives a readable message first.
  indexes: [{ fields: ['challenge', 'dayNumber'], unique: true }],
  hooks: {
    beforeValidate: [validateDay],
  },
  fields: [
    {
      name: 'challenge',
      type: 'relationship',
      relationTo: 'challenges',
      required: true,
      index: true,
    },
    {
      name: 'dayNumber',
      type: 'number',
      required: true,
      min: 1,
      validate: wholeNumber(1, 365, 'Day number'),
      admin: { description: '1…durationDays of the challenge.' },
    },
    {
      name: 'minutes',
      type: 'number',
      required: true,
      min: 1,
      max: 600,
      validate: wholeNumber(1, 600, 'Minutes'),
    },
    { name: 'notes', type: 'textarea', maxLength: 500 },
    {
      name: 'closedAt',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        description: 'Set when the day is closed. Only closed days count towards progress.',
      },
    },
  ],
}
