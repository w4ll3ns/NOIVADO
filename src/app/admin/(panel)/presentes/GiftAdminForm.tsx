'use client'

import { useActionState, useState, useTransition } from 'react'
import { EngravedIcon, ICON_NAMES } from '@/components/ornaments/EngravedIcon'
import type { GiftFormState } from './actions'
import { buscarProdutoAction, type ProdutoDoLink } from './link-actions'

/** 89990 → "899,90" (campo de valor) */
const reais = (c: number) => (c / 100).toFixed(2).replace('.', ',')

type Props = {
  action: (prev: GiftFormState, form: FormData) => Promise<GiftFormState>
  categories: { id: string; name: string }[]
  imageUrl: string | null
  /** Link vindo do "Adicionar por links" (quando a loja não deixou ler): já aparece no campo. */
  linkInicial?: string
  initial: {
    name: string
    description: string
    categoryId: string
    icon: string
    priceType: 'fixed' | 'custom'
    amount: string
    min: string
    max: string
    suggested: string
    quick: string
    availability: 'unique' | 'limited' | 'unlimited'
    quantity: number
    featured: boolean
    isActive: boolean
    sortOrder: number
  }
}

export function GiftAdminForm({ action, categories, imageUrl, linkInicial = '', initial }: Props) {
  const [state, formAction, pending] = useActionState<GiftFormState, FormData>(action, {})
  const [priceType, setPriceType] = useState(initial.priceType)
  const [availability, setAvailability] = useState(initial.availability)
  const [icon, setIcon] = useState(initial.icon)
  // "Preencher pelo link": os campos recebem o que veio da loja (versao remonta os campos com o novo valor).
  const [link, setLink] = useState(linkInicial)
  const [importado, setImportado] = useState<ProdutoDoLink | null>(null)
  const [versao, setVersao] = useState(0)
  const [erroLink, setErroLink] = useState<string | null>(null)
  const [buscando, startBusca] = useTransition()
  const buscarLink = () =>
    startBusca(async () => {
      setErroLink(null)
      const r = await buscarProdutoAction(link)
      if (!r.ok) return setErroLink(r.error)
      setImportado(r.produto)
      if (r.produto.precoCents) setPriceType('fixed')
      setVersao((v) => v + 1)
    })
  const valor = (campo: 'titulo' | 'descricao', inicial: string) => importado?.[campo] ?? inicial
  const fotoUrl = importado?.imagemUrl ?? imageUrl

  return (
    <form action={formAction} className="a-form a-card">
      <div className="a-link-produto">
        <label className="a-field">
          <span>Preencher pelo link do produto</span>
          <input
            className="a-input"
            type="url"
            inputMode="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => {
              // Enter aqui busca o link (não salva o presente).
              if (e.key === 'Enter') {
                e.preventDefault()
                if (link.trim()) buscarLink()
              }
            }}
            placeholder="https://… (Mercado Livre, Amazon, lojas…)"
          />
        </label>
        <button type="button" className="a-btn" disabled={!link.trim() || buscando} onClick={buscarLink}>
          {buscando ? 'Buscando…' : 'Buscar dados'}
        </button>
        {erroLink ? <p className="a-alert a-alert--bad a-link-produto__aviso">{erroLink}</p> : null}
        {importado ? (
          <p className="a-alert a-alert--ok a-link-produto__aviso">
            Dados de {importado.loja} preenchidos abaixo: confira antes de salvar.
            {importado.faltando.length ? ` Faltou ${importado.faltando.join(', ')}: complete à mão.` : ''}
          </p>
        ) : null}
        {importado?.mediaId ? <input type="hidden" name="importedMediaId" value={importado.mediaId} /> : null}
      </div>
      <div className="a-form-grid">
        <label className="a-field span-2">
          <span>Nome *</span>
          <input key={`nome-${versao}`} className="a-input" name="name" required defaultValue={valor('titulo', initial.name)} />
        </label>
        <label className="a-field span-2">
          <span>Descrição</span>
          <textarea key={`desc-${versao}`} className="a-textarea" name="description" rows={3} defaultValue={valor('descricao', initial.description)} />
        </label>
        <label className="a-field">
          <span>Categoria</span>
          <select className="a-select" name="categoryId" defaultValue={initial.categoryId}>
            <option value="">Sem categoria</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="a-field">
          <span>Ícone em gravura (usado quando não há imagem)</span>
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <EngravedIcon name={icon} size={32} />
            <select className="a-select" name="icon" value={icon} onChange={(e) => setIcon(e.target.value)}>
              {ICON_NAMES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </span>
        </label>
        <label className="a-field">
          <span>Imagem (opcional)</span>
          <input className="a-input" type="file" name="image" accept="image/*" />
          {fotoUrl ? (
            <span style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fotoUrl} alt="" style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 4 }} />
              {importado?.mediaId ? (
                <span className="a-help">Foto do produto. Para trocar, envie outra acima.</span>
              ) : (
                <label className="a-check">
                  <input type="checkbox" name="removeImage" /> Remover imagem
                </label>
              )}
            </span>
          ) : null}
        </label>
        <label className="a-field">
          <span>Ordem</span>
          <input className="a-input" type="number" name="sortOrder" defaultValue={initial.sortOrder} />
        </label>
      </div>

      <fieldset className="a-fieldset">
        <legend>Valor</legend>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 10 }}>
          <label className="a-check">
            <input type="radio" name="priceType" value="fixed" checked={priceType === 'fixed'} onChange={() => setPriceType('fixed')} /> Valor fixo
          </label>
          <label className="a-check">
            <input type="radio" name="priceType" value="custom" checked={priceType === 'custom'} onChange={() => setPriceType('custom')} /> Valor personalizado
          </label>
        </div>
        {priceType === 'fixed' ? (
          <label className="a-field" style={{ maxWidth: 220 }}>
            <span>Valor (R$)</span>
            <input
              key={`valor-${versao}`}
              className="a-input"
              name="amount"
              inputMode="decimal"
              defaultValue={importado?.precoCents ? reais(importado.precoCents) : initial.amount}
              placeholder="350,00"
            />
          </label>
        ) : (
          <div className="a-form-grid">
            <label className="a-field">
              <span>Valor mínimo (R$)</span>
              <input className="a-input" name="min" inputMode="decimal" defaultValue={initial.min} placeholder="50,00" />
            </label>
            <label className="a-field">
              <span>Valor máximo (R$) — opcional</span>
              <input className="a-input" name="max" inputMode="decimal" defaultValue={initial.max} placeholder="sem limite" />
            </label>
            <label className="a-field">
              <span>Valor sugerido (R$)</span>
              <input className="a-input" name="suggested" inputMode="decimal" defaultValue={initial.suggested} placeholder="200,00" />
            </label>
            <label className="a-field">
              <span>Valores rápidos (separe por ; )</span>
              <input className="a-input" name="quick" defaultValue={initial.quick} placeholder="100; 200; 300; 500" />
            </label>
          </div>
        )}
      </fieldset>

      <fieldset className="a-fieldset">
        <legend>Disponibilidade</legend>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <label className="a-check">
            <input type="radio" name="availability" value="unique" checked={availability === 'unique'} onChange={() => setAvailability('unique')} /> Presente único
          </label>
          <label className="a-check">
            <input type="radio" name="availability" value="unlimited" checked={availability === 'unlimited'} onChange={() => setAvailability('unlimited')} /> Múltiplas compras
          </label>
          <label className="a-check">
            <input type="radio" name="availability" value="limited" checked={availability === 'limited'} onChange={() => setAvailability('limited')} /> Quantidade limitada
          </label>
        </div>
        {availability === 'limited' ? (
          <label className="a-field" style={{ maxWidth: 160, marginTop: 10 }}>
            <span>Quantidade</span>
            <input className="a-input" type="number" min={1} name="quantity" defaultValue={initial.quantity || 1} />
          </label>
        ) : null}
        <p className="a-help" style={{ marginTop: 8 }}>
          Quando esgota, o site mostra “Já fomos presenteados ❤️”. Nenhum registro é apagado.
        </p>
      </fieldset>

      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        <label className="a-check">
          <input type="checkbox" name="featured" defaultChecked={initial.featured} /> Destaque
        </label>
        <label className="a-check">
          <input type="checkbox" name="isActive" defaultChecked={initial.isActive} /> Ativo (visível no site)
        </label>
      </div>
      {state.error ? <p className="a-alert a-alert--bad">{state.error}</p> : null}
      <div>
        <button className="a-btn a-btn--primary" disabled={pending}>
          {pending ? 'Salvando…' : 'Salvar presente'}
        </button>
      </div>
    </form>
  )
}
