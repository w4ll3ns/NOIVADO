'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { confirmImportAction, previewImportAction, type ImportState } from './actions'
import { formatPhone } from '@/lib/format'

const KIND = { individual: 'Individual', couple: 'Casal', family: 'Família', group: 'Grupo' } as const

export function ImportForm() {
  const [preview, previewAction, previewing] = useActionState<ImportState, FormData>(previewImportAction, {})
  const [result, confirmAction, importing] = useActionState<ImportState, FormData>(confirmImportAction, {})

  if (result.done) {
    return (
      <div className="a-card">
        <p className="a-alert a-alert--ok">{result.done.created} convite(s) importado(s), cada um com seu link único.</p>
        {result.done.skipped.length ? (
          <p className="a-alert a-alert--warn" style={{ marginTop: 10 }}>
            Já existiam (não duplicados): {result.done.skipped.join(', ')}
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
          Colunas: Convite, Tipo, Grupo, Nome, Sobrenome, Telefone, E-mail, Acompanhante (sim/não), Máx. acompanhantes, Familiares próximos, Observações. Linhas com o mesmo “Convite” formam um único convite
          (um link para a família toda). Sem “Convite”, cada pessoa vira um convite individual.
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
            Pré-visualização <small>{preview.preview.length} convite(s) · {preview.preview.reduce((s, i) => s + i.guests.length, 0)} pessoa(s)</small>
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
                  <th>Convite</th>
                  <th>Tipo</th>
                  <th>Pessoas</th>
                  <th>Telefone</th>
                  <th>Acompanhante</th>
                  <th>Grupo</th>
                </tr>
              </thead>
              <tbody>
                {preview.preview.map((i) => (
                  <tr key={i.label}>
                    <td>{i.label}</td>
                    <td>{KIND[i.kind]}</td>
                    <td>{i.guests.map((g) => [g.firstName, g.lastName].filter(Boolean).join(' ')).join(', ')}</td>
                    <td className="nowrap">{i.phone ? formatPhone(i.phone) : '—'}</td>
                    <td>{i.allowCompanions ? `até ${i.maxCompanions}` : 'não'}</td>
                    <td>{i.groupName ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form action={confirmAction} style={{ marginTop: 12 }}>
            <input type="hidden" name="payload" value={preview.payload} />
            <button className="a-btn a-btn--primary" disabled={importing}>
              {importing ? 'Importando…' : `Importar ${preview.preview.length} convite(s)`}
            </button>
          </form>
          {result.error ? <p className="a-alert a-alert--bad">{result.error}</p> : null}
        </section>
      ) : null}
    </>
  )
}
