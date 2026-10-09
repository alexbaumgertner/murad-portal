import { describe, expect, it } from 'vitest'

import { saveCommentSchema } from '@/features/day-comments/schema'
import { MAX_COMMENT_LENGTH } from '@/features/day-comments/shape'

describe('day comment input (story 016)', () => {
  const date = '2026-10-10'

  it('accepts a comment and trims it', () => {
    expect(
      saveCommentSchema.parse({ date, text: '  Не понял Present Perfect в серии 3 \n' }),
    ).toEqual({ date, text: 'Не понял Present Perfect в серии 3' })
  })

  it('4. 1000 characters pass, 1001 do not', () => {
    expect(MAX_COMMENT_LENGTH).toBe(1000)
    expect(saveCommentSchema.safeParse({ date, text: 'a'.repeat(1000) }).success).toBe(true)
    const tooLong = saveCommentSchema.safeParse({ date, text: 'a'.repeat(1001) })
    expect(tooLong.success).toBe(false)
  })

  it('3. empty or blank text is valid (it deletes the comment)', () => {
    expect(saveCommentSchema.parse({ date, text: '   ' }).text).toBe('')
  })

  it('takes only a calendar date and text: no enrollment, no extra keys', () => {
    expect(saveCommentSchema.safeParse({ date: '10.10.2026', text: 'x' }).success).toBe(false)
    expect(saveCommentSchema.safeParse({ date: '2026-02-31', text: 'x' }).success).toBe(false)
    expect(saveCommentSchema.safeParse({ date, text: 'x', enrollment: 1 }).success).toBe(false)
    expect(saveCommentSchema.safeParse({ date }).success).toBe(false)
    expect(saveCommentSchema.safeParse({ date, text: 5 }).success).toBe(false)
  })
})
