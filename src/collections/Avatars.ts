import type { Access, CollectionConfig } from 'payload'

import { isOwner } from '@/access'
import { AVATAR_MIME_TYPES } from '@/features/students/shape'

// The owner sees every avatar, a student only her own; an anonymous caller is refused with 403.
const ownOrOwner: Access = ({ req }) => {
  if (!req.user) return false
  return isOwner(req.user) ? true : { owner: { equals: req.user.id } }
}

// Story 021: one profile picture per student. Not public: the file is served through Payload's
// access control (`/api/avatars/file/…`), so only she and the owner can open it.
export const Avatars: CollectionConfig = {
  slug: 'avatars',
  admin: { useAsTitle: 'filename', defaultColumns: ['filename', 'owner', 'createdAt'] },
  access: {
    create: ({ req }) => Boolean(req.user),
    read: ownOrOwner,
    update: ownOrOwner,
    delete: ownOrOwner,
  },
  hooks: {
    beforeValidate: [
      ({ data, operation, originalDoc, req }) => {
        // A student's avatar is always hers, on create and on update, whatever the request says.
        if (data && req.user && !isOwner(req.user)) {
          if (operation === 'create') data.owner = req.user.id
          else if (originalDoc) {
            const current = originalDoc.owner
            data.owner = typeof current === 'object' ? current.id : current
          }
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'owner',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      unique: true,
      index: true,
    },
  ],
  upload: { mimeTypes: [...AVATAR_MIME_TYPES] },
}
