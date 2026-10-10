import { describe, expect, it } from 'vitest'

import {
  DEFAULT_TIMEZONE,
  isTakenAtValid,
  isTimeZone,
  placementAboveProgram,
  programDay,
  scoreError,
  scoreLabel,
  timeZoneOrDefault,
  todayIn,
} from '@/features/enrollments/shape'

describe('enrollment rules (story 012)', () => {
  describe('10. scores stay inside each test scale', () => {
    it('accepts IELTS 4.5 and rejects 9.5 and 4.3 with the range in the message', () => {
      expect(scoreError('ielts', 4.5)).toBeNull()
      expect(scoreError('ielts', 9)).toBeNull()
      expect(scoreError('ielts', 9.5)).toBe('IELTS: балл от 0 до 9 с шагом 0,5')
      expect(scoreError('ielts', 4.3)).toBe('IELTS: балл от 0 до 9 с шагом 0,5')
    })

    it('rejects TOEFL 121, Cambridge 79, Duolingo 12 and a missing score', () => {
      expect(scoreError('toefl', 120)).toBeNull()
      expect(scoreError('toefl', 121)).toBe('TOEFL iBT: балл от 0 до 120')
      expect(scoreError('cambridge', 79)).toBe('Cambridge: балл от 80 до 230')
      expect(scoreError('duolingo', 115)).toBeNull()
      expect(scoreError('duolingo', 12)).toMatch(/с шагом 5/)
      expect(scoreError('pte', undefined)).toBe('PTE Academic: балл от 10 до 90')
      expect(scoreError('efset', 101)).toBe('EF SET: балл от 0 до 100')
    })

    it('12. needs no score for Murad’s CEFR test or «Other»', () => {
      expect(scoreError('murad', undefined)).toBeNull()
      expect(scoreError('other', undefined)).toBeNull()
    })

    it('rejects a test date in the future but accepts today anywhere on Earth', () => {
      const now = new Date('2026-10-09T23:30:00.000Z')
      expect(isTakenAtValid('2026-10-09T12:00:00.000Z', now)).toBe(true)
      // Already Oct 10 in Kiritimati (UTC+14).
      expect(isTakenAtValid('2026-10-10T00:00:00.000Z', now)).toBe(true)
      expect(isTakenAtValid('2026-10-12T00:00:00.000Z', now)).toBe(false)
    })
  })

  describe('11. a placement above the program is a warning', () => {
    it('warns for B2 on A1 → A2, not for A2 on A2 → B1', () => {
      expect(placementAboveProgram('B2', 'A1')).toBe(true)
      expect(placementAboveProgram('A2', 'A2')).toBe(false)
      expect(placementAboveProgram('A1', 'A2')).toBe(false)
      expect(placementAboveProgram(undefined, 'A2')).toBe(false)
    })
  })

  describe('3/5. time zone and day 1', () => {
    it('takes today on the wall clock of the student’s zone', () => {
      const now = new Date('2026-10-09T20:00:00.000Z')
      expect(todayIn('Asia/Almaty', now)).toBe('2026-10-10')
      expect(todayIn('America/New_York', now)).toBe('2026-10-09')
    })

    it('falls back to Almaty when the browser reports no usable zone', () => {
      expect(isTimeZone('Europe/Moscow')).toBe(true)
      expect(isTimeZone('Mars/Olympus')).toBe(false)
      expect(timeZoneOrDefault(undefined)).toBe(DEFAULT_TIMEZONE)
      expect(timeZoneOrDefault('')).toBe('Asia/Almaty')
      expect(timeZoneOrDefault('Mars/Olympus')).toBe('Asia/Almaty')
    })

    it('counts the start date as day 1', () => {
      const now = new Date('2026-10-09T08:00:00.000Z')
      expect(programDay('2026-10-09T00:00:00.000Z', 'Asia/Almaty', now)).toBe(1)
      expect(programDay('2026-10-01', 'Asia/Almaty', now)).toBe(9)
    })
  })

  describe('2. the student sees her result', () => {
    it('labels IELTS, Cambridge, Other and Murad’s test', () => {
      expect(scoreLabel({ test: 'ielts', score: 4.5 })).toBe('4.5')
      expect(scoreLabel({ test: 'cambridge', score: 175, exam: 'FCE' })).toBe('FCE 175')
      expect(scoreLabel({ test: 'other', scoreText: ' 7/10 ' })).toBe('7/10')
      expect(scoreLabel({ test: 'murad' })).toBeNull()
    })
  })
})
