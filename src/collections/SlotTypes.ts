import { APIError, type CollectionBeforeDeleteHook, type CollectionConfig } from 'payload'

import { authenticated, owner } from '@/access'
import {
  DEFAULT_SLOT_MINUTES,
  MAX_MINUTES,
  MIN_MINUTES,
  isValidMinutes,
  messages,
} from '@/features/programs/shape'

// programs.weekTemplate.slots.slotType would be silently nulled by the database: refuse the
// delete and name the programs (drafts included) that still use the type.
const blockDeleteWhenUsed: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const { docs } = await req.payload.find({
    collection: 'programs',
    where: { 'weekTemplate.slots.slotType': { equals: id } },
    locale: 'ru',
    fallbackLocale: 'en',
    depth: 0,
    limit: 50,
    pagination: false,
    select: { title: true },
    overrideAccess: true, // integrity check, not a visitor read
    req,
  })
  if (docs.length > 0) {
    throw new APIError(
      messages.typeInUse + docs.map((program) => program.title).join(', '),
      400,
      undefined,
      true,
    )
  }
}

export const SlotTypes: CollectionConfig = {
  slug: 'slot-types',
  labels: { singular: 'Slot type', plural: 'Slot types' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'defaultMinMinutes', 'updatedAt'],
    description: 'Kinds of daily activity (Anki, series …) that programs are built from.',
  },
  access: {
    read: authenticated,
    create: owner,
    update: owner,
    delete: owner,
  },
  hooks: { beforeDelete: [blockDeleteWhenUsed] },
  fields: [
    { name: 'name', type: 'text', required: true, localized: true, maxLength: 60 },
    { name: 'description', type: 'textarea', localized: true, maxLength: 500 },
    {
      name: 'defaultMinMinutes',
      type: 'number',
      required: true,
      defaultValue: DEFAULT_SLOT_MINUTES,
      min: MIN_MINUTES,
      max: MAX_MINUTES,
      admin: {
        description: 'Minimum time for the slot to count as done, unless a program overrides it.',
      },
      validate: (value: unknown) => (isValidMinutes(value) ? true : messages.minutes),
    },
  ],
}
