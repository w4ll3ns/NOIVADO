import 'server-only'
import ExcelJS from 'exceljs'
import { strFromU8, unzipSync } from 'fflate'

export type Cell = string | number | boolean | Date | null | undefined
export type Table = { headers: string[]; rows: Cell[][] }

function cellToText(v: Cell): string {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'boolean') return v ? 'sim' : 'não'
  return String(v)
}

/** CSV com ";" e BOM UTF-8 — abre corretamente no Excel em português. */
export function toCsv(t: Table): string {
  const esc = (s: string) => {
    // Neutraliza fórmulas (CSV injection) e escapa aspas.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
    return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
  }
  const lines = [t.headers, ...t.rows.map((r) => r.map(cellToText))].map((r) => r.map((c) => esc(String(c))).join(';'))
  return '﻿' + lines.join('\r\n')
}

export async function toXlsx(sheetName: string, t: Table): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Noivado Maby & Chris'
  wb.created = new Date()
  const ws = wb.addWorksheet(sheetName.slice(0, 31))
  ws.addRow(t.headers)
  for (const r of t.rows) ws.addRow(r.map((v) => (v === undefined ? null : typeof v === 'string' && /^[=+\-@]/.test(v) ? `'${v}` : v)))
  const header = ws.getRow(1)
  header.font = { bold: true, color: { argb: 'FF4E3E31' } }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2E4D8' } }
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  ws.columns.forEach((col, i) => {
    const max = Math.max(t.headers[i]?.length ?? 10, ...t.rows.slice(0, 200).map((r) => cellToText(r[i]).length))
    col.width = Math.min(60, Math.max(10, max + 2))
  })
  return Buffer.from(await wb.xlsx.writeBuffer())
}

/** Parser CSV (RFC 4180) com detecção de separador (; , ou tab). */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '')
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? ''
  const sep = [';', ',', '\t'].map((s) => ({ s, n: firstLine.split(s).length })).sort((a, b) => b.n - a.n)[0].s
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === sep) {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim()))
}

export async function parseXlsx(buf: Buffer): Promise<string[][]> {
  const wb = new ExcelJS.Workbook()
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buf as any)
  } catch {
    // Planilhas geradas por outros programas (caminhos absolutos, prefixo "x:"…) que o Excel abre
    // normalmente, mas o exceljs não entende.
    return parseXlsxRaw(buf)
  }
  const ws = wb.worksheets[0]
  if (!ws) return parseXlsxRaw(buf)
  const out: string[][] = []
  ws.eachRow({ includeEmpty: false }, (r) => {
    const values: string[] = []
    r.eachCell({ includeEmpty: true }, (cell, col) => {
      const v = cell.value as unknown
      let text = ''
      if (v === null || v === undefined) text = ''
      else if (typeof v === 'object' && v && 'text' in v) text = String((v as { text: unknown }).text)
      else if (typeof v === 'object' && v && 'result' in v) text = String((v as { result: unknown }).result ?? '')
      else if (v instanceof Date) text = v.toISOString().slice(0, 10)
      else text = String(v)
      values[col - 1] = text
    })
    out.push(Array.from(values, (x) => x ?? ''))
  })
  return out.filter((r) => r.some((c) => c && c.trim()))
}

const XML_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const xmlText = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
    e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (XML_ENTITIES[e] ?? m),
  )
/** Textos dos <t> (com ou sem prefixo de namespace), juntando os trechos de texto formatado. */
const textsOf = (xml: string) => [...xml.matchAll(/<(?:\w+:)?t(?:\s[^>]*)?>([^<]*)<\/(?:\w+:)?t>/g)].map((m) => xmlText(m[1])).join('')
const attr = (attrs: string, name: string) => attrs.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))?.[1]
/** "A" → 0, "AB" → 27 */
const columnIndex = (letters: string) => [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1

/**
 * Leitor mínimo de .xlsx (só os valores da primeira aba), para os arquivos que o exceljs não abre.
 * Resolve as relações do pacote em vez de supor os caminhos padrão.
 */
export function parseXlsxRaw(buf: Buffer): string[][] {
  let total = 0
  const files = unzipSync(new Uint8Array(buf), {
    // Só o que interessa, e nada de "bomba" de compressão.
    filter: (f) => /\.(xml|rels)$/i.test(f.name) && (total += f.originalSize) < 60 * 1024 * 1024,
  })
  const read = (path: string | null | undefined) => (path && files[path] ? strFromU8(files[path]) : null)
  const resolve = (base: string, target: string) => {
    if (target.startsWith('/')) return target.slice(1)
    const parts = base.split('/').slice(0, -1)
    for (const seg of target.split('/')) {
      if (seg === '..') parts.pop()
      else if (seg && seg !== '.') parts.push(seg)
    }
    return parts.join('/')
  }
  const relations = (owner: string) => {
    const dir = owner.split('/').slice(0, -1).join('/')
    const name = owner.split('/').pop()
    const xml = read(`${dir ? `${dir}/` : ''}_rels/${name}.rels`) ?? ''
    return [...xml.matchAll(/<(?:\w+:)?Relationship\b([^>]*)>/g)].map((m) => ({
      id: attr(m[1], 'Id') ?? '',
      type: attr(m[1], 'Type') ?? '',
      target: resolve(owner, xmlText(attr(m[1], 'Target') ?? '')),
    }))
  }
  const workbookPath = relations('').find((r) => r.type.endsWith('/officeDocument'))?.target ?? 'xl/workbook.xml'
  const workbook = read(workbookPath)
  if (!workbook) throw new Error('Planilha sem workbook')
  const rels = relations(workbookPath)
  const firstSheetId = workbook.match(/<(?:\w+:)?sheet\b[^>]*\sr:id="([^"]+)"/)?.[1]
  const sheetPath = rels.find((r) => r.id === firstSheetId)?.target ?? rels.find((r) => r.type.endsWith('/worksheet'))?.target
  const sheet = read(sheetPath)
  if (!sheet) return []
  const shared = [...(read(rels.find((r) => r.type.endsWith('/sharedStrings'))?.target) ?? '').matchAll(/<(?:\w+:)?si>([\s\S]*?)<\/(?:\w+:)?si>/g)].map(
    (m) => textsOf(m[1].replace(/<(?:\w+:)?rPh\b[\s\S]*?<\/(?:\w+:)?rPh>/g, '')),
  )
  const out: string[][] = []
  for (const row of sheet.matchAll(/<(?:\w+:)?row\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?row>)/g)) {
    const values: string[] = []
    for (const c of (row[1] ?? '').matchAll(/<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)) {
      const ref = attr(c[1], 'r')?.match(/^([A-Z]+)\d+$/)?.[1]
      const col = ref ? columnIndex(ref) : values.length
      const type = attr(c[1], 't')
      const inner = c[2] ?? ''
      const v = inner.match(/<(?:\w+:)?v>([^<]*)<\/(?:\w+:)?v>/)?.[1]
      let text = ''
      if (type === 's') text = v !== undefined ? (shared[Number(v)] ?? '') : ''
      else if (type === 'inlineStr') text = textsOf(inner)
      else if (type === 'b') text = v === '1' ? 'sim' : 'não'
      else text = v !== undefined ? xmlText(v) : ''
      values[col] = text
    }
    out.push(Array.from(values, (x) => x ?? ''))
  }
  return out.filter((r) => r.some((c) => c && c.trim()))
}
