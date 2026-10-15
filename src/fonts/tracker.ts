import localFont from 'next/font/local'

export const trackerSans = localFont({
  src: [{ path: './files/ibm-plex-sans.woff2', weight: '400 600', style: 'normal' }],
  display: 'swap',
  variable: '--font-tracker-sans',
})

export const trackerSerif = localFont({
  src: [{ path: './files/newsreader.woff2', weight: '500', style: 'normal' }],
  display: 'swap',
  variable: '--font-tracker-serif',
  adjustFontFallback: 'Times New Roman',
})
