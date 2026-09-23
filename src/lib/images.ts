import 'server-only'
import sharp, { type Metadata } from 'sharp'

sharp.cache(false)

const ACCEPTED = new Set(['jpeg', 'png', 'webp', 'avif', 'heif', 'gif', 'tiff'])
const EXT: Record<string, string> = { jpeg: 'jpg', png: 'png', webp: 'webp', avif: 'avif', heif: 'heic', gif: 'gif', tiff: 'tif' }
const MIME: Record<string, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  heif: 'image/heic',
  gif: 'image/gif',
  tiff: 'image/tiff',
}

export class ImageError extends Error {}

export type ProcessedImage = {
  original: { data: Buffer; ext: string; mime: string }
  web: Buffer
  thumb: Buffer
  width: number
  height: number
  dominantColor: string
}

/**
 * Valida (pelo conteúdo real, não pela extensão) e gera as versões:
 * - original: bytes intactos (preservado para download)
 * - web: WebP até 1600 px, orientação corrigida, SEM metadados (remove GPS/EXIF)
 * - thumb: WebP até 640 px
 */
export async function processImage(
  input: Buffer,
  opts: { webMax?: number; thumbMax?: number } = {},
): Promise<ProcessedImage> {
  const webMax = opts.webMax ?? 1600
  const thumbMax = opts.thumbMax ?? 640
  let meta: Metadata
  try {
    meta = await sharp(input, { limitInputPixels: 120_000_000 }).metadata()
  } catch {
    throw new ImageError('Não conseguimos ler esta imagem.')
  }
  if (!meta.format || !ACCEPTED.has(meta.format)) throw new ImageError('Formato de imagem não suportado.')

  const base = () => sharp(input, { limitInputPixels: 120_000_000, failOn: 'truncated' }).rotate()
  try {
    const [web, thumb, stats] = await Promise.all([
      base()
        .resize({ width: webMax, height: webMax, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82, effort: 4 })
        .toBuffer({ resolveWithObject: true }),
      base()
        .resize({ width: thumbMax, height: thumbMax, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 74, effort: 4 })
        .toBuffer(),
      sharp(input).stats(),
    ])
    const { r, g, b } = stats.dominant
    const hex = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
    // Dimensões já com orientação aplicada (EXIF 5–8 troca largura/altura).
    const swap = (meta.orientation ?? 1) >= 5
    const width = swap ? (meta.height ?? web.info.height) : (meta.width ?? web.info.width)
    const height = swap ? (meta.width ?? web.info.width) : (meta.height ?? web.info.height)
    return {
      original: { data: input, ext: EXT[meta.format], mime: MIME[meta.format] },
      web: web.data,
      thumb,
      width,
      height,
      dominantColor: hex,
    }
  } catch (err) {
    if (err instanceof ImageError) throw err
    throw new ImageError('Não conseguimos processar esta imagem. Tente outra foto.')
  }
}
