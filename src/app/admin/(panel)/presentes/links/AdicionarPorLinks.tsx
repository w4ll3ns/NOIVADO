'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { formatBRL, parseBRLToCents } from '@/lib/format'
import { buscarProdutoAction, criarPresentesAction, type CriarState, type ProdutoDoLink } from '../link-actions'

type Item =
  | { link: string; estado: 'buscando' }
  | { link: string; estado: 'erro'; erro: string }
  | { link: string; estado: 'ok'; produto: ProdutoDoLink; nome: string; valor: string; descricao: string; incluir: boolean }

const MAX_LINKS = 30
const reais = (c: number | null) => (c ? (c / 100).toFixed(2).replace('.', ',') : '')

/** Cola vários links, confere nome/valor/foto/descrição de cada um e adiciona todos de uma vez. */
export function AdicionarPorLinks({ categories }: { categories: { id: string; name: string }[] }) {
  const [texto, setTexto] = useState('')
  const [itens, setItens] = useState<Item[]>([])
  const [state, action, pending] = useActionState<CriarState, FormData>(criarPresentesAction, {})
  const buscando = itens.some((i) => i.estado === 'buscando')

  const buscar = async () => {
    const links = [...new Set(texto.split(/\s+/).filter((l) => /^https?:\/\//i.test(l)))].slice(0, MAX_LINKS)
    setItens(links.map((link) => ({ link, estado: 'buscando' })))
    // Dois de cada vez: rápido, sem sobrecarregar as lojas.
    let proximo = 0
    const trabalhar = async () => {
      while (proximo < links.length) {
        const i = proximo++
        const r = await buscarProdutoAction(links[i]).catch(() => ({ ok: false as const, error: 'Não consegui ler este link agora.' }))
        setItens((lista) =>
          lista.map((it, n) =>
            n !== i
              ? it
              : r.ok
                ? { link: it.link, estado: 'ok', produto: r.produto, nome: r.produto.titulo ?? '', valor: reais(r.produto.precoCents), descricao: r.produto.descricao ?? '', incluir: true }
                : { link: it.link, estado: 'erro', erro: r.error },
          ),
        )
      }
    }
    await Promise.all([trabalhar(), trabalhar()])
  }

  const mudar = (n: number, campos: Partial<Extract<Item, { estado: 'ok' }>>) =>
    setItens((lista) => lista.map((it, i) => (i === n && it.estado === 'ok' ? { ...it, ...campos } : it)))

  const escolhidos = itens.filter((i): i is Extract<Item, { estado: 'ok' }> => i.estado === 'ok' && i.incluir)
  const invalidos = escolhidos.filter((i) => !i.nome.trim() || (parseBRLToCents(i.valor) ?? 0) < 100)
  const payload = JSON.stringify(
    escolhidos.map((i) => ({ name: i.nome.trim(), description: i.descricao.trim() || null, amountCents: parseBRLToCents(i.valor) ?? 0, mediaId: i.produto.mediaId })),
  )

  if (state.criados) {
    return (
      <div className="a-card">
        <p className="a-alert a-alert--ok">
          {state.criados === 1 ? '1 presente adicionado' : `${state.criados} presentes adicionados`} à lista. Eles já aparecem no site.
        </p>
        <div className="a-actions" style={{ marginTop: 12 }}>
          <Link className="a-btn a-btn--primary" href="/admin/presentes">
            Ver a lista de presentes
          </Link>
          <a className="a-btn" href="/admin/presentes/links">
            Adicionar mais
          </a>
        </div>
      </div>
    )
  }

  return (
    <>
      <section className="a-card a-form">
        <label className="a-field">
          <span>Links dos produtos (um por linha)</span>
          <textarea
            className="a-textarea"
            rows={6}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={'https://www.mercadolivre.com.br/…\nhttps://www.amazon.com.br/…\nhttps://loja.com.br/products/…'}
          />
        </label>
        <p className="a-help">
          O painel lê o nome, o valor, a foto e a descrição de cada produto. Você confere e ajusta antes de adicionar. Até {MAX_LINKS} links por vez.
        </p>
        <div className="a-actions">
          <button type="button" className="a-btn a-btn--primary" disabled={buscando || !/https?:\/\//i.test(texto)} onClick={() => void buscar()}>
            {buscando ? 'Buscando…' : 'Buscar produtos'}
          </button>
        </div>
      </section>

      {itens.length ? (
        <form action={action} className="a-card a-form">
          <h2 className="a-card__title">
            Conferir antes de adicionar <small>{escolhidos.length} selecionado(s)</small>
          </h2>
          <div className="a-produtos">
            {itens.map((it, n) => (
              <div key={it.link} className={`a-produto${it.estado === 'ok' && !it.incluir ? ' is-fora' : ''}`}>
                {it.estado === 'buscando' ? (
                  <p className="a-muted">
                    Buscando… <small className="a-produto__link">{it.link}</small>
                  </p>
                ) : it.estado === 'erro' ? (
                  <div>
                    <p className="a-alert a-alert--bad">{it.erro}</p>
                    <p style={{ marginTop: 6 }}>
                      <small className="a-produto__link">{it.link}</small>{' '}
                      <Link className="a-btn a-btn--sm" href={`/admin/presentes/novo?link=${encodeURIComponent(it.link)}`} target="_blank">
                        Cadastrar à mão
                      </Link>
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="a-produto__foto">
                      {it.produto.imagemUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.produto.imagemUrl} alt="" />
                      ) : (
                        <span className="a-muted">sem foto</span>
                      )}
                    </div>
                    <div className="a-produto__campos">
                      <label className="a-check">
                        <input type="checkbox" checked={it.incluir} onChange={(e) => mudar(n, { incluir: e.target.checked })} /> Adicionar · <small>{it.produto.loja}</small>
                      </label>
                      <label className="a-field">
                        <span>Nome</span>
                        <input className="a-input" value={it.nome} onChange={(e) => mudar(n, { nome: e.target.value })} />
                      </label>
                      <label className="a-field a-produto__valor">
                        <span>Valor (R$)</span>
                        <input className="a-input" inputMode="decimal" value={it.valor} onChange={(e) => mudar(n, { valor: e.target.value })} placeholder="0,00" />
                      </label>
                      <label className="a-field">
                        <span>Descrição</span>
                        <textarea className="a-textarea" rows={2} value={it.descricao} onChange={(e) => mudar(n, { descricao: e.target.value })} />
                      </label>
                      {it.produto.faltando.length ? <p className="a-help">Faltou {it.produto.faltando.join(', ')}: complete aqui ou depois, no cadastro.</p> : null}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="a-form-grid" style={{ marginTop: 14 }}>
            <label className="a-field">
              <span>Categoria</span>
              <select className="a-select" name="categoryId" defaultValue={categories[0]?.id ?? ''}>
                <option value="">Sem categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="a-field">
              <span>Disponibilidade</span>
              <select className="a-select" name="availability" defaultValue="unique">
                <option value="unique">Presente único (sai da lista quando alguém dá)</option>
                <option value="unlimited">Múltiplas compras</option>
              </select>
            </label>
          </div>
          <input type="hidden" name="itens" value={payload} />
          {invalidos.length ? <p className="a-alert a-alert--warn">Confira nome e valor (mínimo R$ 1,00) de: {invalidos.map((i) => i.nome || i.link).join(', ')}.</p> : null}
          {state.error ? <p className="a-alert a-alert--bad">{state.error}</p> : null}
          <div className="a-actions">
            <button className="a-btn a-btn--primary" disabled={pending || buscando || !escolhidos.length || invalidos.length > 0}>
              {pending
                ? 'Adicionando…'
                : `Adicionar ${escolhidos.length === 1 ? '1 presente' : `${escolhidos.length} presentes`}${escolhidos.length ? ` · ${formatBRL(escolhidos.reduce((s, i) => s + (parseBRLToCents(i.valor) ?? 0), 0))}` : ''}`}
            </button>
          </div>
        </form>
      ) : null}
    </>
  )
}
