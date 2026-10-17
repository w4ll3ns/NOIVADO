'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { confirmImportAction, previewImportAction, type ImportState } from './actions'
import { formatPhone } from '@/lib/format'

const KIND = { individual: 'Individual', couple: 'Casal', family: 'Família', group: 'Grupo' } as const

export function ImportForm() {
  const [preview, previewAction, previewing] = useActionState<ImportState, FormData>(previewImportAction, {})
  const [result, confirmAction, importing] = useActionState<ImportState, FormData>(confirmImportAction, {})

  const existentes = new Set(preview.existing ?? [])
  const novos = (preview.preview?.length ?? 0) - existentes.size

  if (result.done) {
    return (
      <div className="a-card">
        <p className="a-alert a-alert--ok">
          {result.done.created} convite(s) importado(s), cada um com seu link único (o mesmo para todas as pessoas do convite).
        </p>
        {result.done.skipped.length ? (
          <p className="a-alert a-alert--warn" style={{ marginTop: 10 }}>
            Já estavam cadastrados (não duplicados): {result.done.skipped.join(', ')}
          </p>
        ) : null}
        <p style={{ marginTop: 12 }}>
          <Link className="a-btn a-btn--primary" href="/admin/convites?filtro=nao-enviados">
            Ver convites não enviados
          </Link>
        </p>
      </div>
    )
  }

  return (
    <>
      <form action={previewAction} className="a-card a-form">
        <label className="a-field">
          <span>Arquivo .xlsx ou .csv</span>
          <input className="a-input" type="file" name="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required />
        </label>
        <p className="a-help">
          Colunas: Convite, Tipo, Grupo, Nome, Sobrenome, Telefone, E-mail, Acompanhante (sim/não), Máx. acompanhantes, Familiares próximos, Observações. Linhas com o mesmo “Convite” formam um único convite:
          um link só para todos, e cada pessoa com o seu telefone. Sem “Convite” (ou com o tipo “Individual”), cada linha vira um convite.
        </p>
        <p className="a-help">
          Numerou as famílias (“Família 1”, “Família 2”…)? O número só junta as pessoas: o convite recebe o nome delas (“Edson e Jordania”) e o número não aparece em lugar nenhum.
        </p>
        <div className="a-actions">
          <button className="a-btn a-btn--primary" disabled={previewing}>
            {previewing ? 'Lendo…' : 'Pré-visualizar'}
          </button>
          <a className="a-btn" href="/api/admin/export/modelo-importacao?format=xlsx">
            Baixar modelo (Excel)
          </a>
          <a className="a-btn" href="/api/admin/export/modelo-importacao?format=csv">
            Baixar modelo (CSV)
          </a>
        </div>
        {preview.error ? <p className="a-alert a-alert--bad">{preview.error}</p> : null}
      </form>

      {preview.preview ? (
        <section className="a-card">
          <h2 className="a-card__title">
            Pré-visualização{' '}
            <small>
              {preview.preview.length} convite(s) · {preview.preview.reduce((s, i) => s + i.guests.length, 0)} pessoa(s)
              {novos !== preview.preview.length ? ` · ${preview.preview.length - novos} já cadastrado(s)` : ''}
            </small>
          </h2>
          {preview.errors?.length ? (
            <div className="a-alert a-alert--warn" style={{ marginBottom: 10 }}>
              {preview.errors.map((e) => (
                <div key={e}>{e}</div>
              ))}
            </div>
          ) : null}
          <div className="a-table-wrap" style={{ maxHeight: 420, overflow: 'auto' }}>
            <table className="a-table">
              <thead>
                <tr>
                  <th>Convite (um link)</th>
                  <th>Tipo</th>
                  <th>Pessoas e telefones</th>
                  <th>Acompanhante</th>
                  <th>Grupo</th>
                </tr>
              </thead>
              <tbody>
                {preview.preview.map((i, n) => (
                  <tr key={n} style={existentes.has(n) ? { opacity: 0.55 } : undefined}>
                    <td>
                      {i.label}
                      {existentes.has(n) ? (
                        <>
                          <br />
                          <small>já cadastrado — não será importado de novo</small>
                        </>
                      ) : null}
                    </td>
                    <td>{KIND[i.kind]}</td>
                    <td>
                      {i.guests.map((g, k) => (
                        <div key={k} className="nowrap">
                          {[g.firstName, g.lastName].filter(Boolean).join(' ')}
                          <span className="a-muted"> · {g.phone ? formatPhone(g.phone) : 'sem telefone'}</span>
                        </div>
                      ))}
                    </td>
                    <td>{i.allowCompanions ? `até ${i.maxCompanions}` : 'não'}</td>
                    <td>{i.groupName ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form action={confirmAction} style={{ marginTop: 12 }}>
            <input type="hidden" name="payload" value={preview.payload} />
            <button className="a-btn a-btn--primary" disabled={importing || !novos}>
              {importing ? 'Importando…' : novos ? `Importar ${novos} convite(s)` : 'Tudo já está cadastrado'}
            </button>
          </form>
          {result.error ? <p className="a-alert a-alert--bad">{result.error}</p> : null}
        </section>
      ) : null}
    </>
  )
}
