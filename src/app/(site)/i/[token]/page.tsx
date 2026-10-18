import type { Metadata } from 'next'
import { AccessBeacon } from '@/components/guest/Beacons'
import { PaginaInicial } from '@/components/site/home/PaginaInicial'
import { getSettings } from '@/lib/settings'
import { getAdmin } from '@/lib/auth/session'
import { getGuestByToken } from '@/lib/invitations'
import { InvalidInvite } from './InvalidInvite'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

/** Link do convite: a mesma home do site (com a abertura), já com o nome de quem foi convidado. */
export default async function ConvitePage(props: PageProps<'/i/[token]'>) {
  const { token } = await props.params
  const sp = await props.searchParams
  const guest = await getGuestByToken(token)
  if (!guest) return <InvalidInvite contactPhone={(await getSettings()).event.contactPhone} />

  const preview = sp.preview === '1' && !!(await getAdmin())
  return (
    <>
      <AccessBeacon token={token} preview={preview} />
      {preview ? (
        <p className="notice" style={{ textAlign: 'center', borderLeft: 0 }}>
          Pré-visualização do painel — acessos não são registrados.
        </p>
      ) : null}
      <PaginaInicial guest={guest} abertura={!preview} forcarAbertura={sp.abertura === '1'} preview={preview} />
    </>
  )
}
