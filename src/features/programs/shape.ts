// Pure rules of a study program, shared by the collection hooks and unit tests. No framework imports.

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export type Level = (typeof LEVELS)[number]
// C2 is a target only: nobody starts a program at C2.
export const START_LEVELS = LEVELS.slice(0, 5)

export const WEEK_DAYS = 7
export const MAX_SLOTS_PER_DAY = 5
export const MIN_MINUTES = 1
export const MAX_MINUTES = 240
export const DEFAULT_SLOT_MINUTES = 20
export const DEFAULT_DURATION_WEEKS = 52

export const messages = {
  levelOrder: 'Начальный уровень должен быть ниже целевого',
  weekDays: 'В шаблоне должно быть ровно 7 дней',
  daySlots: 'В дне не больше 5 занятий',
  minutes: 'Минут должно быть от 1 до 240',
  slugTaken: 'Такой адрес уже занят',
  slugShape: 'Только строчные латинские буквы, цифры и дефисы, например «a2-b1»',
  typeInUse: 'Тип используется в программах: ',
} as const

export const isLevel = (value: unknown): value is Level =>
  typeof value === 'string' && (LEVELS as readonly string[]).includes(value)

/** True when `from` is a lower CEFR level than `to`; unknown values are left to the select field. */
export const levelsInOrder = (from: unknown, to: unknown): boolean =>
  !isLevel(from) || !isLevel(to) || LEVELS.indexOf(from) < LEVELS.indexOf(to)

export const isValidSlug = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 60 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)

export const isValidMinutes = (value: unknown): boolean =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= MIN_MINUTES &&
  value <= MAX_MINUTES
