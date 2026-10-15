import localFont from 'next/font/local'

import type { FontId } from './font-list'

// Files include Latin and Cyrillic. Keep preload off: only the selected faces are fetched.
const inter = localFont({
  src: [{ path: '../../fonts/files/inter.woff2', weight: '400 700', style: 'normal' }],
  display: 'swap',
  preload: false,
})
const manrope = localFont({
  src: [{ path: '../../fonts/files/manrope.woff2', weight: '400 700', style: 'normal' }],
  display: 'swap',
  preload: false,
})
const montserrat = localFont({
  src: [{ path: '../../fonts/files/montserrat.woff2', weight: '400 700', style: 'normal' }],
  display: 'swap',
  preload: false,
})
const unbounded = localFont({
  src: [{ path: '../../fonts/files/unbounded.woff2', weight: '400 700', style: 'normal' }],
  display: 'swap',
  preload: false,
})
const roboto = localFont({
  src: [{ path: '../../fonts/files/roboto.woff2', weight: '400 700', style: 'normal' }],
  display: 'swap',
  preload: false,
})
const open_sans = localFont({
  src: [{ path: '../../fonts/files/open-sans.woff2', weight: '400 700', style: 'normal' }],
  display: 'swap',
  preload: false,
})
const pt_sans = localFont({
  src: [
    { path: '../../fonts/files/pt-sans-400.woff2', weight: '400', style: 'normal' },
    { path: '../../fonts/files/pt-sans-700.woff2', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  preload: false,
})
const rubik = localFont({
  src: [{ path: '../../fonts/files/rubik.woff2', weight: '400 700', style: 'normal' }],
  display: 'swap',
  preload: false,
})
const raleway = localFont({
  src: [{ path: '../../fonts/files/raleway.woff2', weight: '400 700', style: 'normal' }],
  display: 'swap',
  preload: false,
})
const ibm_plex_sans = localFont({
  src: [{ path: '../../fonts/files/ibm-plex-sans.woff2', weight: '400 700', style: 'normal' }],
  display: 'swap',
  preload: false,
})
const jost = localFont({
  src: [{ path: '../../fonts/files/jost.woff2', weight: '400 700', style: 'normal' }],
  display: 'swap',
  preload: false,
})
const nunito_sans = localFont({
  src: [{ path: '../../fonts/files/nunito-sans.woff2', weight: '400 700', style: 'normal' }],
  display: 'swap',
  preload: false,
})
const ubuntu = localFont({
  src: [
    { path: '../../fonts/files/ubuntu-400.woff2', weight: '400', style: 'normal' },
    { path: '../../fonts/files/ubuntu-700.woff2', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  preload: false,
})
const onest = localFont({
  src: [{ path: '../../fonts/files/onest.woff2', weight: '400 700', style: 'normal' }],
  display: 'swap',
  preload: false,
})
const golos_text = localFont({
  src: [{ path: '../../fonts/files/golos-text.woff2', weight: '400 700', style: 'normal' }],
  display: 'swap',
  preload: false,
})
const fira_sans = localFont({
  src: [
    { path: '../../fonts/files/fira-sans-400.woff2', weight: '400', style: 'normal' },
    { path: '../../fonts/files/fira-sans-700.woff2', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  preload: false,
})
const cormorant_garamond = localFont({
  src: [{ path: '../../fonts/files/cormorant-garamond.woff2', weight: '400 700', style: 'normal' }],
  display: 'swap',
  preload: false,
  adjustFontFallback: 'Times New Roman',
})
const playfair_display = localFont({
  src: [{ path: '../../fonts/files/playfair-display.woff2', weight: '400 700', style: 'normal' }],
  display: 'swap',
  preload: false,
  adjustFontFallback: 'Times New Roman',
})
const pt_serif = localFont({
  src: [
    { path: '../../fonts/files/pt-serif-400.woff2', weight: '400', style: 'normal' },
    { path: '../../fonts/files/pt-serif-700.woff2', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  preload: false,
  adjustFontFallback: 'Times New Roman',
})
const noto_serif = localFont({
  src: [{ path: '../../fonts/files/noto-serif.woff2', weight: '400 700', style: 'normal' }],
  display: 'swap',
  preload: false,
  adjustFontFallback: 'Times New Roman',
})
const literata = localFont({
  src: [{ path: '../../fonts/files/literata.woff2', weight: '400 700', style: 'normal' }],
  display: 'swap',
  preload: false,
  adjustFontFallback: 'Times New Roman',
})
const vollkorn = localFont({
  src: [{ path: '../../fonts/files/vollkorn.woff2', weight: '400 700', style: 'normal' }],
  display: 'swap',
  preload: false,
  adjustFontFallback: 'Times New Roman',
})
const prata = localFont({
  src: [{ path: '../../fonts/files/prata-400.woff2', weight: '400', style: 'normal' }],
  display: 'swap',
  preload: false,
  adjustFontFallback: 'Times New Roman',
})
const yeseva_one = localFont({
  src: [{ path: '../../fonts/files/yeseva-one-400.woff2', weight: '400', style: 'normal' }],
  display: 'swap',
  preload: false,
  adjustFontFallback: 'Times New Roman',
})
const lora = localFont({
  src: [{ path: '../../fonts/files/lora.woff2', weight: '400 700', style: 'normal' }],
  display: 'swap',
  preload: false,
  adjustFontFallback: 'Times New Roman',
})
const merriweather = localFont({
  src: [{ path: '../../fonts/files/merriweather.woff2', weight: '400 700', style: 'normal' }],
  display: 'swap',
  preload: false,
  adjustFontFallback: 'Times New Roman',
})
const caveat = localFont({
  src: [{ path: '../../fonts/files/caveat.woff2', weight: '400 700', style: 'normal' }],
  display: 'swap',
  preload: false,
})
const marck_script = localFont({
  src: [{ path: '../../fonts/files/marck-script-400.woff2', weight: '400', style: 'normal' }],
  display: 'swap',
  preload: false,
})
const bad_script = localFont({
  src: [{ path: '../../fonts/files/bad-script-400.woff2', weight: '400', style: 'normal' }],
  display: 'swap',
  preload: false,
})
const pacifico = localFont({
  src: [{ path: '../../fonts/files/pacifico-400.woff2', weight: '400', style: 'normal' }],
  display: 'swap',
  preload: false,
})
const lobster = localFont({
  src: [{ path: '../../fonts/files/lobster-400.woff2', weight: '400', style: 'normal' }],
  display: 'swap',
  preload: false,
})
const neucha = localFont({
  src: [{ path: '../../fonts/files/neucha-400.woff2', weight: '400', style: 'normal' }],
  display: 'swap',
  preload: false,
})
const comfortaa = localFont({
  src: [{ path: '../../fonts/files/comfortaa.woff2', weight: '400 700', style: 'normal' }],
  display: 'swap',
  preload: false,
})
const poiret_one = localFont({
  src: [{ path: '../../fonts/files/poiret-one-400.woff2', weight: '400', style: 'normal' }],
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
