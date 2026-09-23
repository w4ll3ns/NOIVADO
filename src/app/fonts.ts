import localFont from 'next/font/local'

export const cormorant = localFont({
  src: [
    { path: './fonts/cormorant-garamond-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/cormorant-garamond-latin-400-italic.woff2', weight: '400', style: 'italic' },
    { path: './fonts/cormorant-garamond-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/cormorant-garamond-latin-500-italic.woff2', weight: '500', style: 'italic' },
    { path: './fonts/cormorant-garamond-latin-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-cormorant',
  display: 'swap',
  fallback: ['Garamond', 'Times New Roman', 'serif'],
})

export const garamond = localFont({
  src: [
    { path: './fonts/eb-garamond-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/eb-garamond-latin-400-italic.woff2', weight: '400', style: 'italic' },
    { path: './fonts/eb-garamond-latin-500-normal.woff2', weight: '500', style: 'normal' },
  ],
  variable: '--font-garamond',
  display: 'swap',
  fallback: ['Garamond', 'Georgia', 'serif'],
})

export const pinyon = localFont({
  src: [{ path: './fonts/pinyon-script-latin-400-normal.woff2', weight: '400', style: 'normal' }],
  variable: '--font-pinyon',
  display: 'swap',
  fallback: ['Snell Roundhand', 'cursive'],
})
