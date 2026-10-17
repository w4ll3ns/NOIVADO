import 'server-only'
import { saveMedia } from '@/lib/media'
import { conferirDestino as conferir, DestinoProibido } from './rede-segura'
import { deHtml, deShopify, deVtex, handleShopify, juntar, slugVtex, type ProdutoLido } from './produto-link'

export class LinkError extends Error {}

async function conferirDestino(u: URL) {
  try {
    await conferir(u, permitirLocal())
  } catch (err) {
    if (err instanceof DestinoProibido) throw new LinkError(err.message)
    throw err
  }
}

export type ProdutoImportado = {
  url: string
  loja: string
  titulo: string | null
  descricao: string | null
  precoCents: number | null
  /** Foto já salva no site (media). */
  mediaId: string | null
  /** O que não deu para ler (o admin completa). */
  faltando: string[]
}

/** Só para testes com uma loja simulada no próprio computador. Nunca ligue em produção. */
const permitirLocal = () => process.env.PRODUCT_FETCH_ALLOW_LOCAL === 'true'

const NAVEGADOR = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
  'accept-language': 'pt-BR,pt;q=0.9,en;q=0.6',
}

/** GET com redirecionamentos conferidos um a um, tempo e tamanho limitados. */
async function buscar(url: string, opts: { aceitar: string; maxBytes: number }): Promise<{ url: string; tipo: string; corpo: Buffer; status: number }> {
  let atual = new URL(url)
  for (let saltos = 0; saltos <= 5; saltos++) {
    await conferirDestino(atual)
    let res: Response
    try {
      res = await fetch(atual, { redirect: 'manual', headers: { ...NAVEGADOR, accept: opts.aceitar }, signal: AbortSignal.timeout(15_000) })
    } catch {
      throw new LinkError('O site demorou demais ou não respondeu. Tente de novo em instantes.')
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      atual = new URL(res.headers.get('location')!, atual)
      continue
    }
    const tamanho = Number(res.headers.get('content-length') ?? 0)
    if (tamanho > opts.maxBytes) throw new LinkError('A página é grande demais.')
    const partes: Uint8Array[] = []
    let lidos = 0
    const leitor = res.body?.getReader()
    while (leitor) {
      const { done, value } = await leitor.read()
      if (done) break
      lidos += value.length
      if (lidos > opts.maxBytes) {
        await leitor.cancel()
        throw new LinkError('A página é grande demais.')
      }
      partes.push(value)
    }
    return { url: atual.href, tipo: res.headers.get('content-type') ?? '', corpo: Buffer.concat(partes), status: res.status }
  }
  throw new LinkError('O link redireciona demais.')
}

async function buscarJson(url: string): Promise<unknown> {
  try {
    const r = await buscar(url, { aceitar: 'application/json', maxBytes: 4 * 1024 * 1024 })
    if (r.status !== 200) return null
    return JSON.parse(r.corpo.toString('utf8'))
  } catch {
    return null
  }
}

const BLOQUEIO = /captcha|robot check|digite os caracteres|não sou um robô|nao sou um robo|verifica(ção|cao) de seguran|account-verification|access denied|are you a human/i

/** Lê o produto: JSON da loja (Shopify/VTEX) quando houver, e a página. */
export async function lerProduto(link: string): Promise<{ url: string; loja: string; produto: ProdutoLido }> {
  let url: URL
  try {
    url = new URL(link.trim())
  } catch {
    throw new LinkError('Isso não parece um link. Copie o endereço inteiro da página do produto.')
  }
  const loja = url.hostname.replace(/^www\./, '')
  const fontes: (ProdutoLido | null)[] = []
  const handle = handleShopify(url)
  if (handle) fontes.push(deShopify(await buscarJson(`${url.origin}/products/${handle}.json`), url.origin))
  const slug = slugVtex(url)
  if (slug) fontes.push(deVtex(await buscarJson(`${url.origin}/api/catalog_system/pub/products/search/${encodeURIComponent(slug)}/p`), url.origin))

  let pagina: ProdutoLido | null = null
  let bloqueado = false
  if (!fontes.some((f) => f?.titulo && f.precoCents && f.imagens.length)) {
    try {
      const r = await buscar(url.href, { aceitar: 'text/html,application/xhtml+xml', maxBytes: 6 * 1024 * 1024 })
      const html = r.corpo.toString('utf8')
      if (r.status >= 400) bloqueado = true
      else {
        pagina = deHtml(html, r.url)
        // Página de "não sou um robô" no lugar do produto (o título dela seria só o nome da loja).
        if (!pagina.precoCents && BLOQUEIO.test(html)) {
          bloqueado = true
          pagina = null
        }
      }
    } catch (err) {
      if (!fontes.some((f) => f?.titulo)) throw err
    }
  }
  const produto = juntar(...fontes, pagina)
  if (!produto.titulo && !produto.precoCents) {
    throw new LinkError(
      bloqueado
        ? `O site ${loja} não deixou o painel ler a página automaticamente. Cadastre este presente à mão.`
        : `Não encontrei os dados do produto nesta página de ${loja}. Cadastre este presente à mão.`,
    )
  }
  return { url: url.href, loja, produto }
}

/** Baixa a primeira foto que der certo e salva no site (mesmo processamento das fotos enviadas). */
export async function salvarFoto(imagens: string[], alt: string | null): Promise<string | null> {
  for (const src of imagens.slice(0, 4)) {
    try {
      const r = await buscar(src, { aceitar: 'image/avif,image/webp,image/jpeg,image/png,image/*', maxBytes: 15 * 1024 * 1024 })
      if (r.status !== 200 || !r.tipo.startsWith('image/')) continue
      const file = new File([new Uint8Array(r.corpo)], 'produto', { type: r.tipo })
      return (await saveMedia(file, alt)).id
    } catch {
      /* tenta a próxima */
    }
  }
  return null
}

/** Lê o link e já salva a foto: pronto para o formulário do presente. */
export async function importarProduto(link: string): Promise<ProdutoImportado> {
  const { url, loja, produto } = await lerProduto(link)
  const mediaId = await salvarFoto(produto.imagens, produto.titulo)
  const faltando = [!produto.titulo && 'nome', !produto.precoCents && 'valor', !mediaId && 'foto', !produto.descricao && 'descrição'].filter(
    (x): x is string => !!x,
  )
  return { url, loja, titulo: produto.titulo, descricao: produto.descricao, precoCents: produto.precoCents, mediaId, faltando }
}
