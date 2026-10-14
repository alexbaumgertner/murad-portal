// The fonts a planner can use (story 025). Pure data: the loaders live in `fonts.ts`
// (next/font cannot run outside Next). Every family here has Latin AND Cyrillic glyphs.

export const FONT_CATEGORIES = ['sans', 'serif', 'expressive'] as const
export type FontCategory = (typeof FONT_CATEGORIES)[number]

export const FONTS = [
  { id: 'inter', label: 'Inter', category: 'sans' },
  { id: 'manrope', label: 'Manrope', category: 'sans' },
  { id: 'montserrat', label: 'Montserrat', category: 'sans' },
  { id: 'unbounded', label: 'Unbounded', category: 'sans' },
  { id: 'roboto', label: 'Roboto', category: 'sans' },
  { id: 'open-sans', label: 'Open Sans', category: 'sans' },
  { id: 'pt-sans', label: 'PT Sans', category: 'sans' },
  { id: 'rubik', label: 'Rubik', category: 'sans' },
  { id: 'raleway', label: 'Raleway', category: 'sans' },
  { id: 'ibm-plex-sans', label: 'IBM Plex Sans', category: 'sans' },
  { id: 'jost', label: 'Jost', category: 'sans' },
  { id: 'nunito-sans', label: 'Nunito Sans', category: 'sans' },
  { id: 'ubuntu', label: 'Ubuntu', category: 'sans' },
  { id: 'onest', label: 'Onest', category: 'sans' },
  { id: 'golos-text', label: 'Golos Text', category: 'sans' },
  { id: 'fira-sans', label: 'Fira Sans', category: 'sans' },
  { id: 'cormorant-garamond', label: 'Cormorant Garamond', category: 'serif' },
  { id: 'playfair-display', label: 'Playfair Display', category: 'serif' },
  { id: 'pt-serif', label: 'PT Serif', category: 'serif' },
  { id: 'noto-serif', label: 'Noto Serif', category: 'serif' },
  { id: 'literata', label: 'Literata', category: 'serif' },
  { id: 'vollkorn', label: 'Vollkorn', category: 'serif' },
  { id: 'prata', label: 'Prata', category: 'serif' },
  { id: 'yeseva-one', label: 'Yeseva One', category: 'serif' },
  { id: 'lora', label: 'Lora', category: 'serif' },
  { id: 'merriweather', label: 'Merriweather', category: 'serif' },
  { id: 'caveat', label: 'Caveat', category: 'expressive' },
  { id: 'marck-script', label: 'Marck Script', category: 'expressive' },
  { id: 'bad-script', label: 'Bad Script', category: 'expressive' },
  { id: 'pacifico', label: 'Pacifico', category: 'expressive' },
  { id: 'lobster', label: 'Lobster', category: 'expressive' },
  { id: 'neucha', label: 'Neucha', category: 'expressive' },
  { id: 'comfortaa', label: 'Comfortaa', category: 'expressive' },
  { id: 'poiret-one', label: 'Poiret One', category: 'expressive' },
] as const

export type FontId = (typeof FONTS)[number]['id']
/** `default` is the portal's own font. */
export type FontChoice = FontId | 'default'

export const FONT_IDS = FONTS.map((font) => font.id) as [FontId, ...FontId[]]
export const isFontChoice = (value: string): value is FontChoice =>
  value === 'default' || (FONT_IDS as string[]).includes(value)
