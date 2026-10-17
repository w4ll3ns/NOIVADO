/**
 * Lê nome, preço, fotos e descrição de um produto a partir do que a loja publica: dados estruturados
 * (JSON-LD "Product"), etiquetas de compartilhamento (og:*), o JSON das lojas Shopify e da VTEX e, na
 * Amazon, os elementos da página. Só funções puras — a busca na internet fica em produto-busca.ts.
 */

export type ProdutoLido = {
  titulo: string | null
  descricao: string | null
  precoCents: number | null
  imagens: string[]
}

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" }

export function decodificar(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m
    }
    return ENTIDADES[e.toLowerCase()] ?? m
  })
}

/** Texto limpo: sem tags, entidades decodificadas, espaços normais. */
export function textoPuro(html: string): string {
  return decodificar(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>|<\/(p|li|div|h\d)>/gi, '. ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s*\.\s*(\.\s*)+/g, '. ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/([.!?])\.+/g, '$1')
    .replace(/^[\s.]+/, '')
    .trim()
}

/**
 * "R$ 1.234,56", "1234.56", "449,90", 449.9 → centavos. Com ponto e vírgula, o último separador é o
 * decimal; "1.234" (três dígitos depois do ponto) é milhar, como se escreve no Brasil.
 */
export function precoParaCents(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? Math.round(v * 100) : null
  if (typeof v !== 'string') return null
  let s = decodificar(v).replace(/[^\d.,]/g, '')
  if (!s) return null
  const virgula = s.lastIndexOf(',')
  const ponto = s.lastIndexOf('.')
  if (virgula >= 0 && ponto >= 0) s = virgula > ponto ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  else if (virgula >= 0) s = s.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null
}

/** Tira o nome da loja do fim do título ("… | Amazon.com.br", "… - Mercado Livre"). */
export function limparTitulo(t: string | null | undefined): string | null {
  if (!t) return null
  const s = decodificar(t)
    .replace(/\s+/g, ' ')
    .replace(/\s*[|–—-]\s*(amazon\.com\.br|amazon|mercado ?livre|mercadolivre|magalu|americanas|shopee|loja .*|[^|–—-]{2,30}\.com(\.br)?)\s*$/i, '')
    .replace(/^\s*(compre|comprar)\s+/i, '')
    .trim()
  return s ? s.slice(0, 160) : null
}

/** Propaganda de loja não serve de descrição de presente ("Frete grátis… Compre em até 12x…"). */
const PROPAGANDA = /frete gr[aá]tis|sem juros|compre (j[aá]|agora|online|em)|encontre milhares|mercado ?livre|amazon\.com|em at[eé] \d+x|parcel/i

/** Descrição curta para o cartão do presente: até ~280 caracteres, terminando numa frase. */
export function limparDescricao(d: string | null | undefined, titulo?: string | null): string | null {
  if (!d) return null
  let s = textoPuro(d)
  if (!s || PROPAGANDA.test(s)) return null
  if (titulo && s.toLowerCase() === titulo.toLowerCase()) return null
  if (s.length > 280) {
    const corte = s.slice(0, 280)
    const fim = Math.max(corte.lastIndexOf('. '), corte.lastIndexOf('! '), corte.lastIndexOf('; '))
    s = fim > 120 ? corte.slice(0, fim + 1) : `${corte.replace(/\s+\S*$/, '')}…`
  }
  return s
}

function absoluta(u: unknown, base: string): string | null {
  if (typeof u !== 'string' || !u.trim()) return null
  try {
    const url = new URL(decodificar(u.trim()), base)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch {
    return null
  }
}

const unicos = (l: (string | null)[]) => [...new Set(l.filter((x): x is string => !!x))]

/* ------------------------------------------------------------------ */
/* HTML: JSON-LD, og:*, microdados e Amazon                             */
/* ------------------------------------------------------------------ */

type Json = Record<string, unknown>

function produtosJsonLd(html: string): Json[] {
  const out: Json[] = []
  const visitar = (n: unknown) => {
    if (Array.isArray(n)) return n.forEach(visitar)
    if (!n || typeof n !== 'object') return
    const o = n as Json
    const tipo = o['@type']
    if ((Array.isArray(tipo) ? tipo : [tipo]).some((t) => typeof t === 'string' && /^(Product|ProductGroup)$/i.test(t))) out.push(o)
    if (o['@graph']) visitar(o['@graph'])
    if (o.mainEntity) visitar(o.mainEntity)
  }
  for (const m of html.matchAll(/<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      visitar(JSON.parse(m[1].trim()))
    } catch {
      /* bloco quebrado: ignora */
    }
  }
  return out
}

function imagensJsonLd(v: unknown): unknown[] {
  if (Array.isArray(v)) return v.flatMap(imagensJsonLd)
  if (v && typeof v === 'object') return [(v as Json).url ?? (v as Json).contentUrl]
  return [v]
}

function precoJsonLd(offers: unknown): number | null {
  const lista = Array.isArray(offers) ? offers : [offers]
  for (const o of lista) {
    if (!o || typeof o !== 'object') continue
    const of = o as Json
    const p = precoParaCents(of.price) ?? precoParaCents(of.lowPrice) ?? precoParaCents((of.priceSpecification as Json | undefined)?.price)
    if (p) return p
    if (of.offers) {
      const dentro = precoJsonLd(of.offers)
      if (dentro) return dentro
    }
  }
  return null
}

function meta(html: string, nome: string): string | null {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0]
    const chave = tag.match(/\b(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i)?.[1]
    if (chave?.toLowerCase() !== nome.toLowerCase()) continue
    const conteudo = tag.match(/\bcontent\s*=\s*"([^"]*)"/i)?.[1] ?? tag.match(/\bcontent\s*=\s*'([^']*)'/i)?.[1]
    if (conteudo?.trim()) return decodificar(conteudo.trim())
  }
  return null
}

/** Texto do elemento com este id (Amazon: productTitle). */
function porId(html: string, id: string): string | null {
  const m = html.match(new RegExp(`<([a-z0-9]+)[^>]*\\bid=["']${id}["'][^>]*>([\\s\\S]*?)</\\1>`, 'i'))
  return m ? textoPuro(m[2]) || null : null
}

function amazon(html: string, base: string): ProdutoLido {
  const preco =
    html.match(/<span[^>]*class=["'][^"']*\ba-offscreen\b[^"']*["'][^>]*>\s*([^<]*\d[^<]*)<\/span>/i)?.[1] ??
    html.match(/"priceAmount"\s*:\s*([\d.]+)/)?.[1] ??
    null
  const img = html.match(/<img[^>]*\bid=["']landingImage["'][^>]*>/i)?.[0] ?? ''
  const hires = img.match(/data-old-hires=["']([^"']+)["']/i)?.[1]
  const dinamica = img.match(/data-a-dynamic-image=["']([^"']+)["']/i)?.[1]
  let maiores: string[] = []
  if (dinamica) {
    try {
      const mapa = JSON.parse(decodificar(dinamica)) as Record<string, [number, number]>
      maiores = Object.entries(mapa)
        .sort((a, b) => b[1][0] * b[1][1] - a[1][0] * a[1][1])
        .map(([u]) => u)
    } catch {
      /* ignora */
    }
  }
  const bullets = html.match(/<div[^>]*\bid=["']feature-bullets["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]
  return {
    titulo: porId(html, 'productTitle'),
    descricao: bullets ? textoPuro(bullets) : null,
    precoCents: precoParaCents(preco),
    imagens: unicos([absoluta(hires, base), ...maiores.map((u) => absoluta(u, base))]),
  }
}

/** Lê a página do produto. Junta as fontes: o que faltar numa, vem de outra. */
export function deHtml(html: string, url: string): ProdutoLido {
  const ld = produtosJsonLd(html)[0]
  const az = /(^|\.)amazon\.[a-z.]+$/i.test(new URL(url).hostname) || /id=["']productTitle["']/.test(html) ? amazon(html, url) : null
  const tituloHtml = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  const titulo = limparTitulo(
    (typeof ld?.name === 'string' ? ld.name : null) ?? az?.titulo ?? meta(html, 'og:title') ?? meta(html, 'twitter:title') ?? (tituloHtml ? textoPuro(tituloHtml) : null),
  )
  const precoCents =
    (ld ? precoJsonLd(ld.offers) : null) ??
    az?.precoCents ??
    precoParaCents(meta(html, 'product:price:amount') ?? meta(html, 'og:price:amount') ?? meta(html, 'price')) ??
    precoParaCents(html.match(/itemprop=["']price["'][^>]*content=["']([^"']+)["']/i)?.[1] ?? null)
  const descricao =
    limparDescricao(typeof ld?.description === 'string' ? ld.description : null, titulo) ??
    limparDescricao(az?.descricao, titulo) ??
    limparDescricao(meta(html, 'og:description'), titulo) ??
    limparDescricao(meta(html, 'description'), titulo)
  const imagens = unicos([
    ...(az?.imagens ?? []),
    ...(ld ? imagensJsonLd(ld.image).map((u) => absoluta(u, url)) : []),
    absoluta(meta(html, 'og:image:secure_url'), url),
    absoluta(meta(html, 'og:image'), url),
    absoluta(meta(html, 'twitter:image'), url),
  ])
  return { titulo, descricao, precoCents, imagens }
}

/* ------------------------------------------------------------------ */
/* Lojas com JSON próprio                                               */
/* ------------------------------------------------------------------ */

/** Shopify: /products/<handle>.json → { product: { title, body_html, variants[].price, images[].src } } */
export function deShopify(json: unknown, base: string): ProdutoLido | null {
  const p = (json as { product?: Json } | null)?.product
  if (!p || typeof p.title !== 'string') return null
  const variantes = (Array.isArray(p.variants) ? p.variants : []) as Json[]
  const disponivel = variantes.find((v) => v.available !== false) ?? variantes[0]
  const titulo = limparTitulo(p.title)
  return {
    titulo,
    descricao: limparDescricao(typeof p.body_html === 'string' ? p.body_html : null, titulo),
    precoCents: precoParaCents(disponivel?.price ?? null),
    imagens: unicos(((Array.isArray(p.images) ? p.images : []) as Json[]).map((i) => absoluta(i.src, base))),
  }
}

/** VTEX: /api/catalog_system/pub/products/search/<slug>/p → [{ productName, description, items[].images[], sellers[].commertialOffer.Price }] */
export function deVtex(json: unknown, base: string): ProdutoLido | null {
  const p = Array.isArray(json) ? (json[0] as Json | undefined) : null
  if (!p || typeof p.productName !== 'string') return null
  const itens = (Array.isArray(p.items) ? p.items : []) as Json[]
  let precoCents: number | null = null
  for (const it of itens) {
    for (const s of (Array.isArray(it.sellers) ? it.sellers : []) as Json[]) {
      const oferta = s.commertialOffer as Json | undefined
      const c = precoParaCents(oferta?.Price ?? null)
      if (c && (oferta?.AvailableQuantity === undefined || Number(oferta.AvailableQuantity) > 0)) {
        precoCents = c
        break
      }
      precoCents ??= c
    }
    if (precoCents) break
  }
  const titulo = limparTitulo(p.productName)
  return {
    titulo,
    descricao: limparDescricao((typeof p.description === 'string' && p.description) || (typeof p.metaTagDescription === 'string' ? p.metaTagDescription : null), titulo),
    precoCents,
    imagens: unicos(itens.flatMap((it) => ((Array.isArray(it.images) ? it.images : []) as Json[]).map((i) => absoluta(i.imageUrl, base)))),
  }
}

/** Shopify: "/products/<handle>" (com ou sem idioma na frente). */
export function handleShopify(url: URL): string | null {
  return url.pathname.match(/\/products\/([^/?#.]+)\/?$/)?.[1] ?? null
}

/** VTEX: "/<slug>/p" (com ou sem idioma na frente). */
export function slugVtex(url: URL): string | null {
  return url.pathname.match(/\/([^/]+)\/p\/?$/)?.[1] ?? null
}

/** Pega de cada fonte o que faltar na anterior. */
export function juntar(...fontes: (ProdutoLido | null)[]): ProdutoLido {
  const ok = fontes.filter((f): f is ProdutoLido => !!f)
  return {
    titulo: ok.find((f) => f.titulo)?.titulo ?? null,
    descricao: ok.find((f) => f.descricao)?.descricao ?? null,
    precoCents: ok.find((f) => f.precoCents)?.precoCents ?? null,
    imagens: unicos(ok.flatMap((f) => f.imagens)),
  }
}
