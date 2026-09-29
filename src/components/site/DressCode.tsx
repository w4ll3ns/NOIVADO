import { EngravedIcon } from '@/components/ornaments/EngravedIcon'
import type { Settings } from '@/lib/settings-schema'
import { mediaUrl } from '@/lib/media'

/** O traje sugerido: tipo, descrição, paletas e referências (página /traje). */
export function DressCode({ dress: d }: { dress: Settings['dressCode'] }) {
  return (
    <div className="dress">
      <EngravedIcon name="vestido" className="dress__icon" />
      <p className="dress__type">{d.type}</p>
      <p className="dress__desc">“{d.description}”</p>
      {d.suggestedColors.length ? (
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
      {d.reservedColors.length ? (
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
          {d.reservedNote ? <p className="muted italic" style={{ marginTop: 14 }}>{d.reservedNote}</p> : null}
        </>
      ) : null}
      {d.recommendations ? <p style={{ marginTop: 26 }}>{d.recommendations}</p> : null}
      {d.referenceMediaIds.length ? (
        <div className="dress__refs">
          {d.referenceMediaIds.map((id) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={id} src={mediaUrl(id, 'thumb')!} alt="Referência de traje" loading="lazy" decoding="async" />
          ))}
        </div>
      ) : null}
    </div>
  )
}
