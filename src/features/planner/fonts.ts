import {
  Bad_Script,
  Caveat,
  Comfortaa,
  Cormorant_Garamond,
  Fira_Sans,
  Golos_Text,
  IBM_Plex_Sans,
  Inter,
  Jost,
  Literata,
  Lobster,
  Lora,
  Manrope,
  Marck_Script,
  Merriweather,
  Montserrat,
  Neucha,
  Noto_Serif,
  Nunito_Sans,
  Onest,
  Open_Sans,
  PT_Sans,
  PT_Serif,
  Pacifico,
  Playfair_Display,
  Poiret_One,
  Prata,
  Raleway,
  Roboto,
  Rubik,
  Ubuntu,
  Unbounded,
  Vollkorn,
  Yeseva_One,
} from 'next/font/google'

import type { FontId } from './font-list'

// next/font needs `const x = Font({ literal options })` at module scope. `preload: false`: the
// browser fetches a face only when a section really uses it. Latin + Cyrillic everywhere,
// because the teacher writes Russian. Single-weight display fonts only have 400.
const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '700'],
  display: 'swap',
  preload: false,
})
const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '700'],
  display: 'swap',
  preload: false,
})
const montserrat = Montserrat({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '700'],
  display: 'swap',
  preload: false,
})
const unbounded = Unbounded({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '700'],
  display: 'swap',
  preload: false,
})
const roboto = Roboto({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '700'],
  display: 'swap',
  preload: false,
})
const open_sans = Open_Sans({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '700'],
  display: 'swap',
  preload: false,
})
const pt_sans = PT_Sans({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '700'],
  display: 'swap',
  preload: false,
})
const rubik = Rubik({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '700'],
  display: 'swap',
  preload: false,
})
const raleway = Raleway({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '700'],
  display: 'swap',
  preload: false,
})
const ibm_plex_sans = IBM_Plex_Sans({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '700'],
  display: 'swap',
  preload: false,
})
const jost = Jost({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '700'],
  display: 'swap',
  preload: false,
})
const nunito_sans = Nunito_Sans({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '700'],
  display: 'swap',
  preload: false,
})
const ubuntu = Ubuntu({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '700'],
  display: 'swap',
  preload: false,
})
const onest = Onest({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '700'],
  display: 'swap',
  preload: false,
})
const golos_text = Golos_Text({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '700'],
  display: 'swap',
  preload: false,
})
const fira_sans = Fira_Sans({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '700'],
  display: 'swap',
  preload: false,
})
const cormorant_garamond = Cormorant_Garamond({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '700'],
  display: 'swap',
  preload: false,
})
const playfair_display = Playfair_Display({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '700'],
  display: 'swap',
  preload: false,
})
const pt_serif = PT_Serif({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '700'],
  display: 'swap',
  preload: false,
})
const noto_serif = Noto_Serif({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '700'],
  display: 'swap',
  preload: false,
})
const literata = Literata({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '700'],
  display: 'swap',
  preload: false,
})
const vollkorn = Vollkorn({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '700'],
  display: 'swap',
  preload: false,
})
const prata = Prata({
  subsets: ['latin', 'cyrillic'],
  weight: '400',
  display: 'swap',
  preload: false,
})
const yeseva_one = Yeseva_One({
  subsets: ['latin', 'cyrillic'],
  weight: '400',
  display: 'swap',
  preload: false,
})
const lora = Lora({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '700'],
  display: 'swap',
  preload: false,
})
const merriweather = Merriweather({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '700'],
  display: 'swap',
  preload: false,
})
const caveat = Caveat({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '700'],
  display: 'swap',
  preload: false,
})
const marck_script = Marck_Script({
  subsets: ['latin', 'cyrillic'],
  weight: '400',
  display: 'swap',
  preload: false,
})
const bad_script = Bad_Script({
  subsets: ['latin', 'cyrillic'],
  weight: '400',
  display: 'swap',
  preload: false,
})
const pacifico = Pacifico({
  subsets: ['latin', 'cyrillic'],
  weight: '400',
  display: 'swap',
  preload: false,
})
const lobster = Lobster({
  subsets: ['latin', 'cyrillic'],
  weight: '400',
  display: 'swap',
  preload: false,
})
const neucha = Neucha({
  subsets: ['latin', 'cyrillic'],
  weight: '400',
  display: 'swap',
  preload: false,
})
const comfortaa = Comfortaa({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '700'],
  display: 'swap',
  preload: false,
})
const poiret_one = Poiret_One({
  subsets: ['latin', 'cyrillic'],
  weight: '400',
  display: 'swap',
  preload: false,
})

/** CSS `font-family` value of each planner font, self-hosted by next/font. */
export const FONT_FAMILIES: Record<FontId, string> = {
  inter: inter.style.fontFamily,
  manrope: manrope.style.fontFamily,
  montserrat: montserrat.style.fontFamily,
  unbounded: unbounded.style.fontFamily,
  roboto: roboto.style.fontFamily,
  'open-sans': open_sans.style.fontFamily,
  'pt-sans': pt_sans.style.fontFamily,
  rubik: rubik.style.fontFamily,
  raleway: raleway.style.fontFamily,
  'ibm-plex-sans': ibm_plex_sans.style.fontFamily,
  jost: jost.style.fontFamily,
  'nunito-sans': nunito_sans.style.fontFamily,
  ubuntu: ubuntu.style.fontFamily,
  onest: onest.style.fontFamily,
  'golos-text': golos_text.style.fontFamily,
  'fira-sans': fira_sans.style.fontFamily,
  'cormorant-garamond': cormorant_garamond.style.fontFamily,
  'playfair-display': playfair_display.style.fontFamily,
  'pt-serif': pt_serif.style.fontFamily,
  'noto-serif': noto_serif.style.fontFamily,
  literata: literata.style.fontFamily,
  vollkorn: vollkorn.style.fontFamily,
  prata: prata.style.fontFamily,
  'yeseva-one': yeseva_one.style.fontFamily,
  lora: lora.style.fontFamily,
  merriweather: merriweather.style.fontFamily,
  caveat: caveat.style.fontFamily,
  'marck-script': marck_script.style.fontFamily,
  'bad-script': bad_script.style.fontFamily,
  pacifico: pacifico.style.fontFamily,
  lobster: lobster.style.fontFamily,
  neucha: neucha.style.fontFamily,
  comfortaa: comfortaa.style.fontFamily,
  'poiret-one': poiret_one.style.fontFamily,
}
