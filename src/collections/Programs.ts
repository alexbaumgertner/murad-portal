import {
  ValidationError,
  type CollectionBeforeValidateHook,
  type CollectionConfig,
  type Validate,
} from 'payload'

import { owner, publishedForStudentsOrOwner } from '@/access'
import {
  DEFAULT_DURATION_WEEKS,
  LEVELS,
  MAX_MINUTES,
  MAX_SLOTS_PER_DAY,
  MIN_MINUTES,
  START_LEVELS,
  WEEK_DAYS,
  isValidMinutes,
  isValidSlug,
  levelsInOrder,
  messages,
} from '@/features/programs/shape'

type RuleData = { slug?: string; levelFrom?: string; levelTo?: string }

const fail = (path: string, message: string): never => {
  throw new ValidationError({ collection: 'programs', errors: [{ path, message }] })
}

// Cross-field and cross-document rules. Run on the stored values merged with the incoming ones,
// so a partial update (only levelFrom) cannot slip past them.
const validateRules: CollectionBeforeValidateHook = async ({ data, originalDoc, req }) => {
  const merged: RuleData = { ...(originalDoc as RuleData | undefined), ...(data as RuleData) }
  if (!levelsInOrder(merged.levelFrom, merged.levelTo)) fail('levelTo', messages.levelOrder)

  const id = (originalDoc as { id?: number } | undefined)?.id
  if (
    typeof merged.slug === 'string' &&
    merged.slug !== (originalDoc as RuleData | undefined)?.slug
  ) {
    const { totalDocs } = await req.payload.count({
      collection: 'programs',
      where: {
        slug: { equals: merged.slug },
        ...(id != null ? { id: { not_equals: id } } : {}),
      },
      overrideAccess: true, // uniqueness is global, whatever the caller may read
      req,
    })
    if (totalDocs > 0) fail('slug', messages.slugTaken)
  }
  return data
}

const validateWeekTemplate: Validate = (value) =>
  Array.isArray(value) && value.length === WEEK_DAYS ? true : messages.weekDays

const validateDaySlots: Validate = (value) =>
  !Array.isArray(value) || value.length <= MAX_SLOTS_PER_DAY ? true : messages.daySlots

export const Programs: CollectionConfig = {
  slug: 'programs',
  labels: { singular: 'Program', plural: 'Programs' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'levelFrom', 'levelTo', 'status'],
  },
  // Students only see published programs; anonymous callers get an empty list.
  access: {
    read: publishedForStudentsOrOwner,
    create: owner,
    update: owner,
    delete: owner,
  },
  hooks: { beforeValidate: [validateRules] },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true, maxLength: 80 },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      maxLength: 60,
      admin: { description: 'Lowercase letters, digits and hyphens, e.g. "a2-b1".' },
      validate: (value: unknown) => (isValidSlug(value) ? true : messages.slugShape),
    },
    {
      type: 'row',
      fields: [
        {
          name: 'levelFrom',
          type: 'select',
          required: true,
          options: [...START_LEVELS],
        },
        {
          name: 'levelTo',
          type: 'select',
          required: true,
          options: [...LEVELS.slice(1)],
        },
        {
          name: 'durationWeeks',
          type: 'number',
          required: true,
          defaultValue: DEFAULT_DURATION_WEEKS,
          min: 1,
          max: 104,
          validate: (value: unknown) =>
            typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 104
              ? true
              : 'Недель должно быть от 1 до 104',
        },
      ],
    },
    { name: 'summary', type: 'textarea', localized: true, maxLength: 1000 },
    {
      name: 'materials',
      type: 'richText',
      localized: true,
      admin: { description: 'Textbooks and resources for the program.' },
    },
    {
      name: 'weekTemplate',
      type: 'array',
      required: true,
      labels: { singular: 'Day', plural: 'Days' },
      defaultValue: Array.from({ length: WEEK_DAYS }, () => ({ slots: [] })),
      minRows: WEEK_DAYS,
      maxRows: WEEK_DAYS,
      validate: validateWeekTemplate,
      admin: {
        description: 'Exactly 7 days, repeated every week. Day 1 is the day the student starts.',
        initCollapsed: true,
      },
      fields: [
        {
          name: 'slots',
          type: 'array',
          labels: { singular: 'Slot', plural: 'Slots' },
          maxRows: MAX_SLOTS_PER_DAY,
          validate: validateDaySlots,
          admin: { description: 'Up to 5 activities. Leave empty for a rest day.' },
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'slotType',
                  type: 'relationship',
                  relationTo: 'slot-types',
                  required: true,
                },
                {
                  name: 'minMinutes',
                  type: 'number',
                  min: MIN_MINUTES,
                  max: MAX_MINUTES,
                  admin: { description: "Empty = the slot type's default minimum." },
                  validate: (value: unknown) =>
                    value == null || isValidMinutes(value) ? true : messages.minutes,
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      index: true,
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
      admin: { position: 'sidebar', description: 'Students see only published programs.' },
    },
  ],
}
