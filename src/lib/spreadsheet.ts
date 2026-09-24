import 'server-only'
import ExcelJS from 'exceljs'

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(buf as any)
  const ws = wb.worksheets[0]
  if (!ws) return []
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
