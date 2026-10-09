import { describe, expect, it } from 'vitest'

import { messagesFor, parseAddressForm, STUDENT_NAMESPACES } from '@/i18n/address-form'

import ru from '../../messages/ru.json'
import ruVy from '../../messages/ru-vy.json'

type Tree = { [key: string]: string | Tree }

function keys(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : keys(value, `${prefix}${key}.`),
  )
}

function texts(tree: Tree): string[] {
  return Object.values(tree).flatMap((v) => (typeof v === 'string' ? [v] : texts(v)))
}

const placeholders = (text: string) => [...text.matchAll(/[{<]\/?(\w+)/g)].map((m) => m[1]).sort()

// Whole words only: \b does not understand Cyrillic.
const word = (list: string[]) => new RegExp(`(?<![\\p{L}])(${list.join('|')})(?![\\p{L}])`, 'iu')
const TY_FORMS = word([
  'ты',
  'тебя',
  'тебе',
  'тобой',
  'твой',
  'твоя',
  'твоё',
  'твои',
  'твоих',
  'твоего',
  'введи',
  'проверь',
  'попробуй',
  'запроси',
  'подожди',
  'войди',
  'выбери',
])

describe('«вы» catalog (story 011, criterion 8)', () => {
  it('covers exactly the student-facing namespaces, with the same keys as «ты»', () => {
    expect(Object.keys(ruVy).sort()).toEqual([...STUDENT_NAMESPACES].sort())
    for (const ns of STUDENT_NAMESPACES) {
      expect(keys(ruVy[ns] as Tree).sort(), ns).toEqual(keys(ru[ns] as Tree).sort())
    }
  })

  it('keeps the same placeholders in every text', () => {
    const flatten = (tree: Tree, prefix = ''): [string, string][] =>
      Object.entries(tree).flatMap(([k, v]) =>
        typeof v === 'string'
          ? [[`${prefix}${k}`, v] as [string, string]]
          : flatten(v, `${prefix}${k}.`),
      )
    const ty = new Map(flatten(ru as Tree))
    for (const [key, text] of flatten(ruVy as Tree)) {
      expect(placeholders(text), key).toEqual(placeholders(ty.get(key) ?? ''))
    }
  })

  it('leaves no «ты» form behind and no empty text', () => {
    for (const text of texts(ruVy as Tree)) {
      expect(text.trim()).not.toBe('')
      // «ты» in guillemets is the name of the choice on the settings page, not an address.
      expect(text.replaceAll('«ты»', '')).not.toMatch(TY_FORMS)
    }
  })

  it('switches the copy to «вы»: «Введи почту» becomes «Введите почту»', () => {
    expect(messagesFor('ru', 'ty').Login.lead).toContain('Введи почту')
    expect(messagesFor('ru', 'vy').Login.lead).toContain('Введите почту')
    expect(messagesFor('ru', 'vy').Login.errors.code_expired).toBe('Код устарел, запросите новый')
  })

  it('leaves the rest of the site as it is', () => {
    expect(messagesFor('ru', 'vy').Home).toEqual(ru.Home)
  })
})

describe('English is not affected by the address form (criterion 9)', () => {
  it('gives the same English texts for «ты» and «вы»', () => {
    expect(messagesFor('en', 'vy')).toEqual(messagesFor('en', 'ty'))
  })
})

describe('parseAddressForm', () => {
  it('accepts only vy, everything else is «ты»', () => {
    expect(parseAddressForm('vy')).toBe('vy')
    expect(parseAddressForm('ty')).toBe('ty')
    expect(parseAddressForm('formal')).toBe('ty')
    expect(parseAddressForm(undefined)).toBe('ty')
  })
})
