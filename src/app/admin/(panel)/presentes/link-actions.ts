'use server'

import { revalidatePath } from 'next/cache'
import { inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '@/lib/db'
import { requireAdmin } from '@/lib/auth/session'
import { audit } from '@/lib/audit'
import { mediaUrl } from '@/lib/media'
import { cleanLine, cleanText } from '@/lib/sanitize'
import { importarProduto, LinkError, type ProdutoImportado } from '@/lib/produto-busca'

export type ProdutoDoLink = ProdutoImportado & { imagemUrl: string | null }
export type BuscaLink = { ok: true; produto: ProdutoDoLink } | { ok: false; error: string }

/** Lê o link do produto (nome, valor, descrição) e já salva a foto no site. */
export async function buscarProdutoAction(link: string): Promise<BuscaLink> {
  await requireAdmin('editor')
  try {
    const produto = await importarProduto(String(link ?? '').slice(0, 2000))
    return { ok: true, produto: { ...produto, imagemUrl: mediaUrl(produto.mediaId, 'thumb') } }
  } catch (err) {
    if (err instanceof LinkError) return { ok: false, error: err.message }
    console.error('Falha ao ler o link do produto', err)
    return { ok: false, error: 'Não consegui ler este link agora. Tente de novo ou cadastre à mão.' }
  }
}

const novos = z
  .array(
    z.object({
      name: z.string().trim().min(1).max(160),
      description: z.string().max(600).nullable(),
      amountCents: z.number().int().min(100).max(100_000_000),
      mediaId: z.string().uuid().nullable(),
    }),
  )
  .min(1)
  .max(30)

export type CriarState = { error?: string; criados?: number }

/** "Adicionar por links": cria os presentes revisados (valor fixo). */
export async function criarPresentesAction(_prev: CriarState, form: FormData): Promise<CriarState> {
  const admin = await requireAdmin('editor')
  let itens: z.infer<typeof novos>
  try {
    itens = novos.parse(JSON.parse(String(form.get('itens') ?? '[]')))
  } catch {
    return { error: 'Confira os presentes: cada um precisa de nome e valor (mínimo R$ 1,00).' }
  }
  const categoryId = String(form.get('categoryId') ?? '')
  const availability = form.get('availability') === 'unlimited' ? 'unlimited' : 'unique'
  // Só fotos que existem (as salvas na busca).
  const ids = itens.map((i) => i.mediaId).filter((m): m is string => !!m)
  const existentes = new Set(ids.length ? (await db.select({ id: schema.media.id }).from(schema.media).where(inArray(schema.media.id, ids))).map((m) => m.id) : [])
  const criados = await db
    .insert(schema.gifts)
    .values(
      itens.map((i) => ({
        name: cleanLine(i.name, 160),
        description: cleanText(i.description, 600) || null,
        categoryId: /^[0-9a-f-]{36}$/.test(categoryId) ? categoryId : null,
        icon: 'presente',
        priceType: 'fixed' as const,
        amountCents: i.amountCents,
        availability: availability as 'unique' | 'unlimited',
        quantity: availability === 'unique' ? 1 : null,
        mediaId: i.mediaId && existentes.has(i.mediaId) ? i.mediaId : null,
        sortOrder: 100,
      })),
    )
    .returning({ id: schema.gifts.id })
  await audit(admin.id, 'gift.create_from_links', 'gift', null, { criados: criados.length })
  revalidatePath('/admin/presentes')
  revalidatePath('/presentes')
  return { criados: criados.length }
}
