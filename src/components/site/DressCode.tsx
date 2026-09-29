import { EngravedIcon } from '@/components/ornaments/EngravedIcon'
import type { Settings } from '@/lib/settings-schema'
import { mediaUrl } from '@/lib/media'

/**
 * A página /traje: a descrição e as imagens do traje enviadas no painel. O ícone com o tipo,
 * as paletas de cores e as recomendações são opcionais (Configurações → Dress Code).
 */
export function DressCode({ dress: d }: { dress: Settings['dressCode'] }) {
  return (
    <div className="dress">
      {d.showType ? (
        <>
          <EngravedIcon name="vestido" className="dress__icon" />
          <p className="dress__type">{d.type}</p>
        </>
      ) : null}
      {d.description ? <p className="dress__desc">“{d.description}”</p> : null}
      {d.referenceMediaIds.length ? (
        <div className="dress__imagens">
          {d.referenceMediaIds.map((id, i) => (
            <figure key={id} className="dress__imagem">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mediaUrl(id, 'web')!}
                srcSet={`${mediaUrl(id, 'thumb')} 720w, ${mediaUrl(id, 'web')} 1800w`}
                sizes="(max-width: 720px) 90vw, 640px"
                alt={d.type ? `Sugestão de traje: ${d.type}` : 'Sugestão de traje'}
                loading={i === 0 ? 'eager' : 'lazy'}
                decoding="async"
              />
            </figure>
          ))}
        </div>
      ) : null}
      {d.showColors && d.suggestedColors.length ? (
        <>
          <p className="dress__group-title">Paleta sugerida</p>
          <ul className="swatches">
            {d.suggestedColors.map((c) => (
              <li key={c.name + c.hex} className="swatch">
                <span className="swatch__chip" style={{ backgroundColor: c.hex }} />
                {c.name}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {d.showColors && d.reservedColors.length ? (
        <>
          <p className="dress__group-title">Cores reservadas</p>
          <ul className="swatches">
            {d.reservedColors.map((c) => (
              <li key={c.name + c.hex} className="swatch swatch--reserved">
                <span className="swatch__chip" style={{ backgroundColor: c.hex }} />
                {c.name}
              </li>
            ))}
          </ul>
          {d.reservedNote ? (
            <p className="muted italic" style={{ marginTop: 14 }}>
              {d.reservedNote}
            </p>
          ) : null}
        </>
      ) : null}
      {d.showRecommendations && d.recommendations ? <p style={{ marginTop: 26 }}>{d.recommendations}</p> : null}
    </div>
  )
}
