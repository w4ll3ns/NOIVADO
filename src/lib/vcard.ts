/**
 * Agenda do celular exportada em vCard (.vcf) — iPhone, Android e Google Contatos. Roda no navegador:
 * o arquivo não sai do aparelho; o painel só grava os números que o admin escolher.
 */
import { normalizePhone } from '@/lib/format'

export type Contato = { nome: string; telefones: string[] }

/** Junta as linhas dobradas (continuação começa com espaço ou tab) e as quebras "suaves" do quoted-printable. */
function linhas(texto: string): string[] {
  const brutas = texto.replace(/\r\n?/g, '\n').split('\n')
  const out: string[] = []
  for (const l of brutas) {
    const anterior = out.length - 1
    if (anterior >= 0 && /^[ \t]/.test(l)) out[anterior] += l.slice(1)
    else if (anterior >= 0 && /ENCODING=QUOTED-PRINTABLE/i.test(out[anterior].split(':')[0]) && out[anterior].endsWith('=')) out[anterior] = out[anterior].slice(0, -1) + l
    else out.push(l)
  }
  return out
}

function quotedPrintable(valor: string, charset = 'utf-8') {
  const bytes: number[] = []
  for (let i = 0; i < valor.length; i++) {
    if (valor[i] === '=' && /^[0-9A-F]{2}$/i.test(valor.slice(i + 1, i + 3))) {
      bytes.push(parseInt(valor.slice(i + 1, i + 3), 16))
      i += 2
    } else bytes.push(valor.charCodeAt(i) & 0xff)
  }
  try {
    return new TextDecoder(charset).decode(new Uint8Array(bytes))
  } catch {
    return new TextDecoder('utf-8').decode(new Uint8Array(bytes))
  }
}

/** Separa por ";" sem quebrar os "\;" escapados (sem lookbehind: iPhones antigos não entendem). */
function campos(v: string): string[] {
  const out = ['']
  for (let i = 0; i < v.length; i++) {
    if (v[i] === '\\' && i + 1 < v.length) out[out.length - 1] += v[i] + v[++i]
    else if (v[i] === ';') out.push('')
    else out[out.length - 1] += v[i]
  }
  return out
}

const desescapar = (v: string) => v.replace(/\\([,;:\\nN])/g, (_, c: string) => (c === 'n' || c === 'N' ? ' ' : c))

/** Lê um .vcf com um ou mais contatos (vCard 2.1, 3.0 e 4.0). Só nome e telefones. */
export function lerVcard(texto: string): Contato[] {
  const contatos: Contato[] = []
  let atual: { fn: string; n: string; tels: string[] } | null = null
  for (const linha of linhas(texto)) {
    const sep = linha.indexOf(':')
    if (sep < 0) continue
    const cabeca = linha.slice(0, sep)
    let valor = linha.slice(sep + 1)
    const [nomeProp, ...params] = cabeca.split(';')
    // "item1.TEL" (iPhone) → TEL
    const prop = nomeProp.replace(/^[^.]*\./, '').toUpperCase()
    if (prop === 'BEGIN' && /^vcard$/i.test(valor.trim())) {
      atual = { fn: '', n: '', tels: [] }
      continue
    }
    if (!atual) continue
    if (prop === 'END' && /^vcard$/i.test(valor.trim())) {
      const nome = (atual.fn || atual.n).replace(/\s+/g, ' ').trim()
      const telefones = [...new Set(atual.tels.map((t) => normalizePhone(t)).filter((t): t is string => !!t))]
      if (nome && telefones.length) contatos.push({ nome, telefones })
      atual = null
      continue
    }
    if (prop !== 'FN' && prop !== 'N' && prop !== 'TEL') continue
    if (params.some((p) => /ENCODING=QUOTED-PRINTABLE/i.test(p) || /^QUOTED-PRINTABLE$/i.test(p))) {
      const charset = params.find((p) => /^CHARSET=/i.test(p))?.split('=')[1]
      valor = quotedPrintable(valor, charset)
    }
    if (prop === 'FN') atual.fn = desescapar(valor)
    else if (prop === 'N') {
      // N: Sobrenome;Nome;Do meio;Prefixo;Sufixo
      const [sobrenome = '', nome = '', meio = ''] = campos(valor).map(desescapar)
      atual.n = [nome, meio, sobrenome].filter(Boolean).join(' ')
    } else atual.tels.push(valor.replace(/^tel:/i, ''))
  }
  return contatos
}

const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const LIGACOES = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])
const palavras = (s: string) => normalizar(s).split(' ').filter((p) => p.length > 1 && !LIGACOES.has(p))

/**
 * Contatos que podem ser a pessoa, comparando todas as palavras do nome ("Maria José" ≠ "Maria
 * Clara"). Ficam só os que batem mais palavras; empate no primeiro nome vem antes ("Tia Rosina" também
 * aparece para "Rosina").
 */
export function sugerirContatos(pessoa: { firstName: string; lastName?: string | null }, contatos: Contato[], limite = 5): Contato[] {
  const nome = palavras(`${pessoa.firstName} ${pessoa.lastName ?? ''}`)
  if (!nome.length) return []
  const pontuados = contatos
    .map((c) => {
      const partes = palavras(c.nome)
      const batem = nome.filter((p) => partes.includes(p)).length
      // Com uma palavra só em comum, ela precisa ser o primeiro nome (evita "Silva" puxar meia agenda).
      const valido = batem > 1 || (batem === 1 && partes.includes(nome[0]))
      return { c, batem: valido ? batem : 0, primeiro: partes[0] === nome[0] }
    })
    .filter((x) => x.batem > 0)
  const melhor = Math.max(0, ...pontuados.map((x) => x.batem))
  return pontuados
    .filter((x) => x.batem === melhor)
    .sort((a, b) => Number(b.primeiro) - Number(a.primeiro) || a.c.nome.localeCompare(b.c.nome))
    .slice(0, limite)
    .map((x) => x.c)
}

