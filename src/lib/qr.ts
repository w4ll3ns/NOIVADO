import 'server-only'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import QRCode from 'qrcode'
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

const INK = '#4E3E31'

export async function qrPng(url: string, width = 1200): Promise<Buffer> {
  return QRCode.toBuffer(url, { type: 'png', width, margin: 2, errorCorrectionLevel: 'Q', color: { dark: INK, light: '#FFFFFF' } })
}

export async function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: 'svg', margin: 2, errorCorrectionLevel: 'Q', color: { dark: INK, light: '#FFFFFF' } })
}

const fontFile = (name: string) => readFile(path.join(process.cwd(), 'public', 'fonts', name))

/**
 * PDF A4 com 4 cartões (A6) prontos para recortar e espalhar pelas mesas, bar e entrada.
 */
export async function qrPdf(opts: { url: string; couple: string; dateDots: string; albumName: string; label?: string }): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  doc.setTitle(`${opts.albumName} — QR Code`)
  doc.setAuthor(opts.couple)
  const [script, title, italic] = await Promise.all([
    fontFile('pinyon-script-latin-400-normal.ttf').then((b) => doc.embedFont(b)),
    fontFile('cormorant-garamond-latin-500-normal.ttf').then((b) => doc.embedFont(b)),
    fontFile('eb-garamond-latin-400-italic.ttf').then((b) => doc.embedFont(b)),
  ])
  const qr = await doc.embedPng(await qrPng(opts.url, 900))
  const page = doc.addPage([595.28, 841.89])
  const w = page.getWidth() / 2
  const h = page.getHeight() / 2
  for (const [cx, cy] of [
    [0, h],
    [w, h],
    [0, 0],
    [w, 0],
  ]) {
    drawCard(page, { x: cx, y: cy, w, h }, { ...opts, script, title, italic, qr })
  }
  // Marcas de corte
  const cut = rgb(0.8, 0.75, 0.7)
  page.drawLine({ start: { x: w, y: 0 }, end: { x: w, y: page.getHeight() }, thickness: 0.3, color: cut, dashArray: [3, 4] })
  page.drawLine({ start: { x: 0, y: h }, end: { x: page.getWidth(), y: h }, thickness: 0.3, color: cut, dashArray: [3, 4] })
  return doc.save()
}

function drawCard(
  page: PDFPage,
  box: { x: number; y: number; w: number; h: number },
  o: { url: string; couple: string; dateDots: string; albumName: string; script: PDFFont; title: PDFFont; italic: PDFFont; qr: Awaited<ReturnType<PDFDocument['embedPng']>> },
) {
  const ink = rgb(0.486, 0.408, 0.333)
  const deep = rgb(0.306, 0.243, 0.192)
  const pad = 22
  page.drawRectangle({ x: box.x + pad, y: box.y + pad, width: box.w - 2 * pad, height: box.h - 2 * pad, borderColor: ink, borderWidth: 0.8 })
  page.drawRectangle({ x: box.x + pad + 5, y: box.y + pad + 5, width: box.w - 2 * pad - 10, height: box.h - 2 * pad - 10, borderColor: ink, borderWidth: 0.4, opacity: 0 })
  const center = (text: string, font: PDFFont, size: number, y: number, color = ink) => {
    const tw = font.widthOfTextAtSize(text, size)
    page.drawText(text, { x: box.x + (box.w - tw) / 2, y: box.y + y, size, font, color })
  }
  const top = box.h - pad
  center(o.albumName, o.script, 26, top - 48)
  center(`${o.couple.toUpperCase()}  ·  ${o.dateDots}`, o.title, 8.5, top - 64)
  center('Registre esse momento conosco.', o.title, 15, top - 92, deep)
  center('Queremos ver o nosso noivado pelos seus olhos.', o.italic, 10, top - 107)
  const size = 150
  page.drawImage(o.qr, { x: box.x + (box.w - size) / 2, y: box.y + top - 125 - size, width: size, height: size })
  center('Aponte a câmera do celular para o código', o.italic, 9.5, top - 125 - size - 18)
  center('e envie suas fotos direto para o nosso álbum.', o.italic, 9.5, top - 125 - size - 31)
  const short = o.url.replace(/^https?:\/\//, '')
  center(short, o.title, 7.5, pad + 16)
}
