import { APIError, type CollectionConfig, type FieldAccess } from 'payload'

import { isOwner, owner } from '@/access'
import { emailCodeStrategy } from '@/features/auth/strategy'

// Field-level twin of `owner`: students may not set `role` or `invitedAt`.
const ownerOnly: FieldAccess = ({ req }) => isOwner(req.user)

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'role', 'name', 'invitedAt'],
  },
  auth: {
    // No passwords: users sign in with a one-time code sent by email (features/auth).
    // enableFields keeps the email field (and the existing columns) in the schema.
    disableLocalStrategy: { enableFields: true, optionalPassword: true },
    strategies: [emailCodeStrategy],
  },
  // There is no "create first user" screen without passwords: use `pnpm create-admin <email>`.
  access: {
    // /admin is for the owner only; students have their own pages on the public site.
    admin: ({ req }) => isOwner(req.user),
    create: owner,
    // Students read and edit only their own record (the owner reads everyone).
    read: ({ req }) =>
      isOwner(req.user) ? true : req.user ? { id: { equals: req.user.id } } : false,
    update: ({ req }) =>
      isOwner(req.user) ? true : req.user ? { id: { equals: req.user.id } } : false,
    delete: owner,
  },
  hooks: {
    beforeChange: [
      // `email` is the login identity: only the owner may change it, not a student on her own record.
      ({ data, originalDoc, req }) => {
        if (
          !isOwner(req.user) &&
          req.user &&
          originalDoc &&
          data.email !== undefined &&
          data.email !== originalDoc.email
        ) {
          throw new APIError('Only the owner can change an email address.', 403)
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      required: true,
      // Every user that existed before roles is an owner (`pnpm create-admin` makes owners).
      defaultValue: 'owner',
      options: [
        { label: 'Owner', value: 'owner' },
        { label: 'Student', value: 'student' },
      ],
      saveToJWT: false,
      index: true,
      access: { create: ownerOnly, update: ownerOnly },
    },
    { name: 'name', type: 'text', maxLength: 80 },
    {
      name: 'invitedAt',
      type: 'date',
      admin: { date: { pickerAppearance: 'dayAndTime' } },
      access: { create: ownerOnly, update: ownerOnly },
    },
    {
      name: 'locale',
      type: 'select',
      defaultValue: 'ru',
      options: [
        { label: 'Русский', value: 'ru' },
        { label: 'English', value: 'en' },
      ],
    },
    {
      // D-SP-8: «ты» (default) or «вы». The owner may preset it when inviting; the student can change it.
      name: 'addressForm',
      type: 'select',
      defaultValue: 'ty',
      options: [
        { label: 'Ты', value: 'ty' },
        { label: 'Вы', value: 'vy' },
      ],
    },
  ],
}
