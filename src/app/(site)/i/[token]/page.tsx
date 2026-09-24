import type { Metadata } from 'next'
import Link from 'next/link'
import { IntroGate } from '@/components/intro/IntroGate'
import { AccessBeacon, ViewBeacon } from '@/components/guest/Beacons'
import { Crest, Divider, FrameCorners } from '@/components/ornaments/Ornaments'
import { EngravedIcon } from '@/components/ornaments/EngravedIcon'
import { getSettings } from '@/lib/settings'
import { getAdmin } from '@/lib/auth/session'
import {
  findInvitationByToken,
  greetingFor,
  listGuests,
  loadInvitationGifts,
  loadInvitationMessages,
} from '@/lib/invitations'
import { getAlbumEntryToken, getMainAlbum } from '@/lib/content'
import { albumUploadState } from '@/lib/album-state'
import { endOfDayInTz, formatBRL, formatDate, formatDateDots, formatDateLong, formatTime, fullName, weekdayOf } from '@/lib/format'
import { googleMapsUrl, wazeUrl } from '@/lib/event'
import { InvalidInvite } from './InvalidInvite'

export const metadata: Metadata = {
  title: 'Seu convite',
  robots: { index: false, follow: false },
}

export default async function PortalPage(props: PageProps<'/i/[token]'>) {
  const { token } = await props.params
  const sp = await props.searchParams
  const [settings, found] = await Promise.all([getSettings(), findInvitationByToken(token)])
  if (!found) return <InvalidInvite contactPhone={settings.event.contactPhone} />

  const inv = found.invitation
  const preview = sp.preview === '1' && !!(await getAdmin())
  const [guests, gifts, messages, album] = await Promise.all([
    listGuests(inv.id),
    loadInvitationGifts(inv.id),
    loadInvitationMessages(inv.id),
    getMainAlbum(),
  ])
  const albumToken = album ? await getAlbumEntryToken(album.id) : null
  const albumState = album ? albumUploadState(album) : 'draft'

  const e = settings.event
  const greeting = greetingFor(inv, guests)
  const plural = guests.filter((g) => !g.isCompanion).length > 1
  const deadline = settings.rsvp.deadline ? endOfDayInTz(settings.rsvp.deadline) : null
  const rsvpOpen = !deadline || deadline.getTime() > Date.now()
  const attending = guests.filter((g) => g.attendance === 'yes')
  const approvedGifts = gifts.filter((g) => g.status === 'approved')
  const pendingGifts = gifts.filter((g) => g.status === 'awaiting')

  const seal =
    inv.rsvpStatus === 'attending'
      ? { cls: 'seal--ok', mark: '✓', text: 'Presença confirmada' }
      : inv.rsvpStatus === 'declined'
        ? { cls: 'seal--no', mark: '—', text: 'Não comparecerá' }
        : { cls: 'seal--pending', mark: '…', text: 'Aguardando resposta' }

  return (
    <>
      <AccessBeacon token={token} preview={preview} />
      {settings.intro.enabled && !preview ? (
        <IntroGate
          coupleNames={e.coupleNames}
          venueName={e.venueName}
          dateDots={formatDateDots(e.date)}
          phrase={settings.intro.phrase}
          buttonLabel={settings.intro.buttonLabel}
          welcomeTitle={`Olá, ${greeting}!`}
          welcomeSub={settings.intro.welcomePhraseGuest}
        />
      ) : null}

      {preview ? (
        <p className="notice" style={{ textAlign: 'center', borderLeft: 0 }}>
          Pré-visualização do painel — acessos não são registrados.
        </p>
      ) : null}

      <div className="container">
        <header className="portal-head">
          <Crest />
          <h1 className="greeting script">
            Olá, {greeting}! <span aria-hidden="true">❤️</span>
          </h1>
          <p className="portal-head__sub">{plural ? 'Que bom ter vocês por aqui.' : 'Que bom ter você por aqui.'}</p>
          <Divider />
          <p className="muted">
            Este é o {plural ? 'convite de vocês' : 'seu convite'} para o {e.title.toLowerCase()} de {e.coupleNames}.
          </p>
        </header>

        <div className="portal-grid">
          {/* ---------------- Minha presença ---------------- */}
          <section className="paper paper--ornate center" aria-labelledby="p-presenca">
            <FrameCorners />
            <h2 id="p-presenca" className="paper__title">
              {plural ? 'Nossa presença' : 'Minha presença'}
            </h2>
            <div className={`seal ${seal.cls}`}>
              <span className="seal__mark" aria-hidden="true">
                {seal.mark}
              </span>
              {seal.text}
            </div>
            <ul className="names-list">
              {guests.map((g) => (
                <li key={g.id} className={g.attendance === 'no' ? 'is-no' : undefined}>
                  {g.attendance === 'yes' ? '✓ ' : ''}
                  {fullName(g.firstName, g.lastName)}
                  {g.isCompanion ? <small>acompanhante</small> : null}
                </li>
              ))}
            </ul>
            {inv.rsvpStatus !== 'pending' && attending.length ? (
              <p className="muted" style={{ marginTop: -8, marginBottom: 18 }}>
                {attending.length === 1 ? '1 pessoa confirmada' : `${attending.length} pessoas confirmadas`}
              </p>
            ) : null}
            {rsvpOpen ? (
              <>
                <Link href={`/i/${token}/presenca${preview ? '?preview=1' : ''}`} className="btn btn--primary btn--block">
                  {inv.rsvpStatus === 'pending' ? 'Confirmar presença' : 'Alterar confirmação'}
                </Link>
                {deadline ? (
                  <p className="field__hint" style={{ marginTop: 10 }}>
                    {inv.rsvpStatus === 'pending' ? 'Confirme' : 'Você pode alterar'} até {formatDateLong(settings.rsvp.deadline)}.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="muted italic">{settings.rsvp.closedText}</p>
            )}
          </section>

          {/* ---------------- Meu presente ---------------- */}
          {settings.gifts.enabled ? (
            <section className="paper paper--ornate" aria-labelledby="p-presente">
              <FrameCorners />
              <h2 id="p-presente" className="paper__title">
                {plural ? 'Nosso presente' : 'Meu presente'}
              </h2>
              {gifts.length ? (
                <>
                  {[...approvedGifts, ...pendingGifts].map((g) => (
                    <div key={g.id} className="gift-summary">
                      <EngravedIcon name={g.icon} />
                      <p className="gift-summary__name">{g.giftName}</p>
                      <p className="gift-summary__value">{formatBRL(g.amountCents)}</p>
                      {g.status === 'approved' ? (
                        <>
                          <p className="status-line status-line--ok">✓ Presente recebido</p>
                          <p className="field__hint">
                            Pagamento aprovado{g.approvedAt ? ` em ${formatDate(g.approvedAt)}` : ''}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="status-line status-line--pending">Aguardando confirmação do pagamento</p>
                          <p className="field__hint">Assim que o Mercado Pago confirmar, ele aparece aqui como recebido.</p>
                        </>
                      )}
                      {g.message ? (
                        <p className="quote" style={{ marginTop: 12, fontSize: '1.02rem' }}>
                          {g.message}
                        </p>
                      ) : null}
                    </div>
                  ))}
                  <p className="center" style={{ marginTop: 20 }}>
                    <Link href="/presentes" className="btn btn--link">
                      Ver a lista de presentes
                    </Link>
                  </p>
                </>
              ) : (
                <div className="center">
                  <EngravedIcon name="presente" size={52} className="teaser-icon" />
                  <p className="muted italic">Você ainda não escolheu um presente.</p>
                  <p className="muted" style={{ fontSize: '1rem' }}>
                    A sua presença já é o nosso maior presente — mas, se quiser, preparamos algumas ideias com carinho.
                  </p>
                  <Link href="/presentes" className="btn btn--block" style={{ marginTop: 16 }}>
                    Ver presentes
                  </Link>
                </div>
              )}
            </section>
          ) : null}

          {/* ---------------- Minha mensagem ---------------- */}
          <section className="paper paper--ornate center" aria-labelledby="p-mensagem">
            <FrameCorners />
            <h2 id="p-mensagem" className="paper__title">
              {plural ? 'Nossa mensagem' : 'Minha mensagem'}
            </h2>
            {messages.length ? (
              <>
                <p className="quote">{messages[0].content}</p>
                <p className="field__hint" style={{ marginTop: 10 }}>
                  Enviada em {formatDate(messages[0].createdAt)}
                </p>
              </>
            ) : (
              <p className="muted italic">Nenhuma mensagem ainda. Os noivos vão adorar ler algumas palavras suas.</p>
            )}
            {settings.guestbook.enabled ? (
              <Link href="/mensagens" className="btn btn--block" style={{ marginTop: 18 }}>
                {messages.length ? 'Escrever outra mensagem' : 'Deixar uma mensagem'}
              </Link>
            ) : null}
          </section>

          {/* ---------------- Álbum ---------------- */}
          {album && albumToken && albumState !== 'draft' ? (
            <section className="paper paper--ornate center" aria-labelledby="p-album">
              <FrameCorners />
              <h2 id="p-album" className="paper__title">
                {album.name}
              </h2>
              <EngravedIcon name="camera" size={52} className="teaser-icon" />
              {albumState === 'open' ? (
                <>
                  <p className="muted">No dia, registre os momentos com a gente — as fotos vão direto para o nosso álbum.</p>
                  <Link href={`/a/${albumToken}`} className="btn btn--block" style={{ marginTop: 16 }}>
                    Abrir o álbum
                  </Link>
                </>
              ) : albumState === 'not_started' ? (
                <p className="muted">O álbum colaborativo abre no dia do evento. Guarde este convite!</p>
              ) : (
                <>
                  <p className="muted">{album.closedMessage}</p>
                  <Link href="/galeria#album" className="btn btn--block" style={{ marginTop: 16 }}>
                    Ver as fotos
                  </Link>
                </>
              )}
            </section>
          ) : null}

          {/* ---------------- Informações do evento ---------------- */}
          <section className="paper paper--ornate paper--wide" aria-labelledby="p-evento">
            <FrameCorners />
            <h2 id="p-evento" className="paper__title">
              O {e.title.toLowerCase()}
            </h2>
            <ViewBeacon type="event_info_viewed" disabled={preview} />
            <dl className="info-list">
              <div>
                <dt>Data</dt>
                <dd>
                  {formatDateLong(e.date)}, {weekdayOf(e.date)}
                </dd>
              </div>
              <div>
                <dt>Horário</dt>
                <dd>
                  {e.receptionTime ? `Recepção às ${formatTime(e.receptionTime)}` : formatTime(e.mainTime)}
                </dd>
              </div>
              <div>
                <dt>Local</dt>
                <dd>
                  {e.venueName} — {e.region}
                </dd>
              </div>
              <div>
                <dt>Endereço</dt>
                <dd>{e.address}</dd>
              </div>
              {settings.dressCode.enabled ? (
                <div>
                  <dt>Traje</dt>
                  <dd>
                    {settings.dressCode.type} — <span className="italic">{settings.dressCode.description}</span>
                  </dd>
                </div>
              ) : null}
            </dl>
            <div className="btn-row btn-row--inline">
              <a className="btn btn--primary" href={googleMapsUrl(e)} target="_blank" rel="noopener noreferrer">
                Como chegar (Google Maps)
              </a>
              <a className="btn" href={wazeUrl(e)} target="_blank" rel="noopener noreferrer">
                Abrir no Waze
              </a>
            </div>
            <p className="center" style={{ marginTop: 18 }}>
              <Link href="/#noivado" className="btn btn--link">
                Programação, dress code e dúvidas
              </Link>
            </p>
          </section>
        </div>
      </div>
    </>
  )
}
