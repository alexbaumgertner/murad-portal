import localFont from 'next/font/local'

export const geistSans = localFont({
  src: [{ path: './files/geist.woff2', weight: '100 900', style: 'normal' }],
  display: 'swap',
  variable: '--font-geist-sans',
})

export const geistMono = localFont({
  src: [{ path: './files/geist-mono.woff2', weight: '100 900', style: 'normal' }],
  display: 'swap',
  variable: '--font-geist-mono',
})
