import 'server-only'

import type { Payload, TypedUser } from 'payload'

import { captureServerError } from '@/lib/monitoring/server'

import type { AddressForm } from '@/i18n/address-form'

import { InviteEmailError } from './send-invite'
import type { InviteInput } from './schema'
import { avatarError, sniffImageType } from './shape'

export type InviteResult =
  { ok: true; email: string } | { ok: false; error: 'already_invited' | 'mail_failed' }

/**
 * Creates a student account on behalf of the owner. The role is fixed here, never taken from
 * input, so the invite flow cannot mint another owner. The users hook stamps `invitedAt` and
 * sends the invite inside the same transaction: if the email fails, no account is left behind.
 */
export async function inviteStudent(
  payload: Payload,
  input: InviteInput,
  owner: TypedUser,
): Promise<InviteResult> {
  const { totalDocs } = await payload.count({
    collection: 'users',
    where: { email: { equals: input.email } },
    overrideAccess: false,
    user: owner,
  })
  if (totalDocs > 0) return { ok: false, error: 'already_invited' }

  try {
    await payload.create({
      collection: 'users',
      data: { email: input.email, name: input.name, role: 'student' },
      overrideAccess: false,
      user: owner,
      depth: 0,
    })
  } catch (error) {
    if (!(error instanceof InviteEmailError)) throw error
    console.error('[students] invite email failed', error.cause)
    await captureServerError(error, 'students-invite')
    return { ok: false, error: 'mail_failed' }
  }
  return { ok: true, email: input.email }
}

/**
 * Saves how the interface addresses the student. The write runs as her (`overrideAccess: false`),
 * so Payload's own rule applies: a student can only update her own record.
 */
export async function updateAddressForm(
  payload: Payload,
  student: TypedUser,
  addressForm: AddressForm,
): Promise<void> {
  await payload.update({
    collection: 'users',
    id: student.id,
    data: { addressForm },
    overrideAccess: false,
    user: student,
    depth: 0,
  })
}

export type AvatarFile = { data: Buffer; name: string; type: string; size: number }
export type AvatarResult =
  { ok: true } | { ok: false; error: 'empty' | 'invalid_type' | 'too_large' }

/**
 * Replaces the student's profile picture. Everything runs as her (`overrideAccess: false`), so the
 * avatars access rules apply: the new file is hers, and only hers is ever touched. The old file goes
 * first (one avatar per student), but only after the new one passed the checks.
 */
export async function saveAvatar(
  payload: Payload,
  student: TypedUser,
  file: AvatarFile,
): Promise<AvatarResult> {
  const error = avatarError(file)
  if (error) return { ok: false, error }
  // The bytes must be the image the client says they are.
  if (sniffImageType(file.data) !== file.type) return { ok: false, error: 'invalid_type' }

  // An existing avatar is replaced in place, so a failed upload never costs her the old photo.
  const upload = { data: file.data, name: file.name, mimetype: file.type, size: file.size }
  const { docs } = await payload.find({
    collection: 'avatars',
    where: { owner: { equals: student.id } },
    limit: 1,
    depth: 0,
    overrideAccess: false,
    user: student,
  })
  const avatar = docs[0]
    ? await payload.update({
        collection: 'avatars',
        id: docs[0].id,
        data: {},
        file: upload,
        overrideAccess: false,
        user: student,
        depth: 0,
      })
    : await payload.create({
        collection: 'avatars',
        data: { owner: student.id as number },
        file: upload,
        overrideAccess: false,
        user: student,
        depth: 0,
      })
  await payload.update({
    collection: 'users',
    id: student.id,
    data: { avatar: avatar.id },
    overrideAccess: false,
    user: student,
    depth: 0,
  })
  return { ok: true }
}

/** Unlinks and deletes the student's avatar file(s); a no-op when she has none. */
export async function removeAvatar(payload: Payload, student: TypedUser): Promise<void> {
  await payload.update({
    collection: 'users',
    id: student.id,
    data: { avatar: null },
    overrideAccess: false,
    user: student,
    depth: 0,
  })
  await payload.delete({
    collection: 'avatars',
    where: { owner: { equals: student.id } },
    overrideAccess: false,
    user: student,
  })
}
