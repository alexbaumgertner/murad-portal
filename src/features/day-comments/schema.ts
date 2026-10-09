import { z } from 'zod'

import { MAX_COMMENT_LENGTH } from './shape'

/**
 * What the browser names: the calendar day and the text. The enrollment is never an input — it is
 * the signed-in student's own (D-SP-4 pattern of story 014). Empty text deletes the comment.
 */
export const saveCommentSchema = z.strictObject({
  date: z.iso.date(),
  text: z.string().trim().max(MAX_COMMENT_LENGTH),
})

export type SaveCommentInput = z.infer<typeof saveCommentSchema>

export type CommentError =
  | 'unauthorized'
  | 'invalid_input'
  | 'too_long'
  | 'no_program'
  | 'future_day'
  | 'invalid_day'
  | 'server'

export type CommentActionState =
  { status: 'success'; saved: boolean } | { status: 'error'; error: CommentError }
