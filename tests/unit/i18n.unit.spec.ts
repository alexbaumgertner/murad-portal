import { describe, expect, it } from 'vitest'

import { alternatesFor, localizedPath } from '@/i18n/alternates'
import { routing } from '@/i18n/routing'

import en from '../../messages/en.json'
import ru from '../../messages/ru.json'

type Tree = { [key: string]: string | Tree }

function keys(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : keys(value, `${prefix}${key}.`),
  )
}

const placeholders = (text: string) => [...text.matchAll(/[{<]\/?(\w+)/g)].map((m) => m[1]).sort()

describe('message catalogs', () => {
  it('Russian has exactly the same keys as English', () => {
    expect(keys(ru).sort()).toEqual(keys(en).sort())
  })

  it('no translation is left empty', () => {
    const flat = (tree: Tree): string[] =>
      Object.values(tree).flatMap((v) => (typeof v === 'string' ? [v] : flat(v)))
    expect(flat(ru).filter((text) => text.trim() === '')).toEqual([])
  })

  it('translations keep the same rich-text tags and placeholders', () => {
    expect(placeholders(ru.Changelog.emptyBody)).toEqual(placeholders(en.Changelog.emptyBody))
  })
})

describe('localized paths', () => {
  it('uses Russian as the unprefixed default', () => {
    expect(routing.defaultLocale).toBe('ru')
    expect(localizedPath('/', 'ru')).toBe('/')
    expect(localizedPath('/changelog', 'ru')).toBe('/changelog')
  })

  it('prefixes other locales', () => {
    expect(localizedPath('/', 'en')).toBe('/en')
    expect(localizedPath('/changelog', 'en')).toBe('/en/changelog')
  })

  it('advertises every locale plus x-default, with a self-referencing canonical', () => {
    expect(alternatesFor('/changelog', 'ru')).toEqual({
      canonical: '/changelog',
      languages: { en: '/en/changelog', ru: '/changelog', 'x-default': '/changelog' },
    })
  })
})
