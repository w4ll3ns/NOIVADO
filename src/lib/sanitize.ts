/**
 * Limpeza de texto livre vindo de convidados. O React já escapa tudo ao renderizar
 * (proteção contra XSS); aqui removemos caracteres de controle e normalizamos espaços.
 */
export function cleanText(input: unknown, max = 2000): string {
  if (typeof input !== 'string') return ''
  return input
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max)
}

export function cleanLine(input: unknown, max = 120): string {
  return cleanText(input, max * 2)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) && value.length <= 200
}
