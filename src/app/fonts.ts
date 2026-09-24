import localFont from 'next/font/local'

// As mesmas fontes do Save the Date: EB Garamond (títulos e textos) e MonteCarlo (caligrafia).

export const garamond = localFont({
  src: [
    { path: './fonts/eb-garamond-latin-var-normal.woff2', weight: '400 800', style: 'normal' },
    { path: './fonts/eb-garamond-latin-var-italic.woff2', weight: '400 800', style: 'italic' },
  ],
  variable: '--font-garamond',
  display: 'swap',
  fallback: ['Garamond', 'Georgia', 'serif'],
})

export const monteCarlo = localFont({
  src: [{ path: './fonts/montecarlo-latin-400-normal.woff2', weight: '400', style: 'normal' }],
  variable: '--font-montecarlo',
  display: 'swap',
  fallback: ['Snell Roundhand', 'cursive'],
})
