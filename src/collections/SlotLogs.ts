import type { Access, CollectionConfig } from 'payload'

import { isOwner, owner } from '@/access'
import { MAX_SLOT_INDEX, MAX_SLOT_MINUTES } from '@/features/slot-timer/shape'

// Owner: everything. Student: only the logs of her own enrollments. Anonymous: 403.
const ownLogsOrOwner: Access = ({ req }) => {
  if (isOwner(req.user)) return true
  if (req.user) return { 'enrollment.student': { equals: req.user.id } }
  return false
}

/**
 * What a student did in one slot of one program day (story 014). A student only reads: every write
 * goes through the Server Actions in `features/slot-timer`, which check the enrollment, the date
 * and the slot and compute the minutes on the server (D-SP-4), so no minutes are ever trusted from
 * the browser and a direct API write is refused (403).
 */
export const SlotLogs: CollectionConfig = {
  slug: 'slot-logs',
  labels: { singular: 'Запись слота', plural: 'Записи слотов' },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['enrollment', 'date', 'slotIndex', 'minutes', 'completed'],
    description: 'Минуты ученика по слотам. Заполняется таймером ученика; здесь — для разбора.',
  },
  access: {
    read: ownLogsOrOwner,
    create: owner,
    update: owner,
    delete: owner,
  },
  fields: [
    {
      name: 'enrollment',
      type: 'relationship',
      relationTo: 'enrollments',
      required: true,
      index: true,
    },
    {
      name: 'date',
      type: 'date',
      required: true,
      index: true,
      admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'dd.MM.yyyy' } },
    },
    { name: 'slotIndex', type: 'number', required: true, min: 0, max: MAX_SLOT_INDEX },
    {
      name: 'slotType',
      type: 'relationship',
      relationTo: 'slot-types',
      required: true,
      admin: { description: 'Тип слота на момент записи (снимок).' },
    },
    {
      name: 'minutes',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
      max: MAX_SLOT_MINUTES,
    },
    { name: 'completed', type: 'checkbox', required: true, defaultValue: false },
    {
      name: 'timerStartedAt',
      type: 'date',
      index: true,
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        description: 'Пока таймер идёт. Пусто — таймер остановлен.',
      },
    },
  ],
  indexes: [{ fields: ['enrollment', 'date', 'slotIndex'], unique: true }],
}
