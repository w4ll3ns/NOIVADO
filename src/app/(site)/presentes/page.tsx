import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Divider } from '@/components/ornaments/Ornaments'
import { EngravedIcon } from '@/components/ornaments/EngravedIcon'
import { ViewBeacon } from '@/components/guest/Beacons'
import { getSettings } from '@/lib/settings'
import { getCurrentGuest } from '@/lib/invitations'
import { listPublicGifts } from '@/lib/gifts'
import { formatBRLShort } from '@/lib/format'
import { mediaUrl } from '@/lib/media'

export const metadata: Metadata = { title: 'Lista de presentes' }

export default async function GiftsPage() {
  const [settings, guest, groups] = await Promise.all([getSettings(), getCurrentGuest(), listPublicGifts()])
  if (!settings.gifts.enabled) notFound()
  return (
    <div className="container">
      <header className="page-head">
        <span className="eyebrow">Com carinho</span>
        <h1 className="section-title">Lista de Presentes</h1>
        <Divider />
        <p className="section-lead">{settings.gifts.intro}</p>
      </header>
      {guest ? <ViewBeacon type="gifts_viewed" /> : null}

      <div style={{ paddingBottom: 'var(--section-y)' }}>
        {groups.map(({ category, gifts }) => (
          <section key={category.id} className="gift-category" aria-labelledby={`cat-${category.slug}`}>
            <header className="gift-category__head">
              <h2 id={`cat-${category.slug}`} className="gift-category__title">
                {category.name}
              </h2>
              {category.description ? <p className="gift-category__desc">{category.description}</p> : null}
              <Divider />
            </header>
            <div className="gift-grid">
              {gifts.map((g) => {
                const body = (
                  <>
                    {g.featured && g.avail.available ? <span className="gift__ribbon">Especial</span> : null}
                    {g.mediaId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="gift__media" src={mediaUrl(g.mediaId, 'thumb')!} alt="" loading="lazy" decoding="async" />
                    ) : (
                      <EngravedIcon name={g.icon} />
                    )}
                    <h3 className="gift__name">{g.name}</h3>
                    {g.description ? <p className="gift__desc">{g.description}</p> : null}
                    <div className="gift__foot">
                      {g.avail.available ? (
                        <>
                          {g.priceType === 'fixed' ? (
                            <span className="gift__value">{formatBRLShort(g.amountCents)}</span>
                          ) : (
                            <span className="gift__value gift__value--free">Valor livre</span>
                          )}
                          {g.avail.remaining !== null && g.availability === 'limited' ? (
                            <span className="field__hint">
                              {g.avail.remaining === 1 ? 'Resta 1' : `Restam ${g.avail.remaining}`}
                            </span>
                          ) : null}
                          <span className="gift__cta">Presentear ›</span>
                        </>
                      ) : (
                        <span className="gift__given">Já fomos presenteados ❤️</span>
                      )}
                    </div>
                  </>
                )
                return g.avail.available ? (
                  <Link key={g.id} href={`/presentes/${g.id}`} className="gift">
                    {body}
                  </Link>
                ) : (
                  <div key={g.id} className="gift gift--given">
                    {body}
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
