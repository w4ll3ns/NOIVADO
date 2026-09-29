/**
 * Cabeçalho Range de uma requisição: "bytes=0-1023", "bytes=500-" ou "bytes=-500" (sufixo).
 * null = sem Range (ou em formato não suportado, como vários trechos): responde o arquivo inteiro.
 * 'invalid' = fora do arquivo (416).
 */
export function parseRange(header: string | null, total: number): { start: number; end: number } | null | 'invalid' {
  if (!header) return null
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!m || (!m[1] && !m[2])) return null
  let start: number
  let end: number
  if (!m[1]) {
    start = Math.max(0, total - Number(m[2]))
    end = total - 1
  } else {
    start = Number(m[1])
    end = m[2] ? Math.min(Number(m[2]), total - 1) : total - 1
  }
  if (start >= total || end < start) return 'invalid'
  return { start, end }
}
