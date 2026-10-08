import { z } from 'zod'

export const CODE_LENGTH = 6

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Enter a valid email address.' }).max(254))

export const codeSchema = z
  .string()
  .transform((value) => value.replace(/\s+/g, ''))
  .pipe(z.string().regex(new RegExp(`^\\d{${CODE_LENGTH}}$`), 'Enter the 6-digit code.'))

export const requestCodeSchema = z.object({ email: emailSchema })
export const verifyCodeSchema = z.object({ email: emailSchema, code: codeSchema })

export type LoginError =
  'invalid_email' | 'rate_limited' | 'mail_failed' | 'wrong_code' | 'code_expired'

export type LoginState =
  | { step: 'email'; email?: string; error?: LoginError }
  | { step: 'code'; email: string; error?: LoginError }
  | { step: 'done'; redirectTo: string }

export const initialLoginState: LoginState = { step: 'email' }
