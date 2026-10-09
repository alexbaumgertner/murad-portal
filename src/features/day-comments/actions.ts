'use server'

import { headers } from 'next/headers'

import { currentStudent } from '@/features/auth/current-user'
import { captureServerError, monitorAction } from '@/lib/monitoring/server'
import { getPayloadClient } from '@/lib/payload'

import { saveCommentSchema, type CommentActionState } from './schema'
import { saveDayComment } from './service'

/**
 * Saves (or, for empty text, deletes) the signed-in student's comment on one day. No analytics on
 * purpose: the text of a comment must never leave the database (story 016).
 */
export async function saveDayCommentAction(input: unknown): Promise<CommentActionState> {
  return monitorAction('saveDayCommentAction', async () => {
    const parsed = saveCommentSchema.safeParse(input)
    if (!parsed.success) {
      const tooLong = parsed.error.issues.some((issue) => issue.code === 'too_big')
      return { status: 'error', error: tooLong ? 'too_long' : 'invalid_input' }
    }
    const payload = await getPayloadClient()
    const student = await currentStudent(payload, await headers())
    if (!student) return { status: 'error', error: 'unauthorized' }
    try {
      const result = await saveDayComment(payload, student, parsed.data)
      if (!result.ok) return { status: 'error', error: result.error }
      return { status: 'success', saved: result.saved }
    } catch (error) {
      console.error('[day-comments] save failed', error)
      await captureServerError(error, 'day-comments')
      return { status: 'error', error: 'server' }
    }
  })
}
