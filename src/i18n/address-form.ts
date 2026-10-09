import type { Locale } from './routing'

import en from '../../messages/en.json'
import ru from '../../messages/ru.json'
import ruVy from '../../messages/ru-vy.json'

// «Ты» or «вы» (D-SP-8). Russian copy for students exists twice: `ru.json` is «ты», `ru-vy.json` is «вы».
// The «вы» file holds only the student-facing namespaces, each with every key of its «ты» twin
// (a unit test enforces it), so a missing «вы» text cannot silently fall back to «ты».
// Framework-free: the users collection hook and e-mail templates import it.

export const addressForms = ['ty', 'vy'] as const
export type AddressForm = (typeof addressForms)[number]
export const defaultAddressForm: AddressForm = 'ty'

/** Remembers the choice for the signed-out /login page; a preference, not a credential. */
export const ADDRESS_FORM_COOKIE = 'address_form'

export const addressFormCookieOptions = () =>
  ({
    path: '/',
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
  }) as const

export const STUDENT_NAMESPACES = [
  'Login',
  'Study',
  'StudySettings',
  'StudyProgram',
  'StudyPlan',
  'StudyToday',
  'StudyTimer',
  'StudyComment',
  'StudyPause',
] as const

export function parseAddressForm(value: unknown): AddressForm {
  return value === 'vy' ? 'vy' : defaultAddressForm
}

export type Messages = typeof en

/** The catalog for `locale`; for a «вы» student in Russian the student namespaces are swapped. English never changes. */
export function messagesFor(locale: Locale, form: AddressForm): Messages {
  if (locale !== 'ru') return en
  return form === 'vy' ? { ...ru, ...ruVy } : ru
}

/** Only the student namespaces, for a nested client provider (keeps the page payload small). */
export function studentMessages(locale: Locale, form: AddressForm) {
  const all = messagesFor(locale, form)
  return {
    Login: all.Login,
    Study: all.Study,
    StudySettings: all.StudySettings,
    StudyProgram: all.StudyProgram,
    StudyTimer: all.StudyTimer,
    StudyComment: all.StudyComment,
    StudyPause: all.StudyPause,
  }
}
