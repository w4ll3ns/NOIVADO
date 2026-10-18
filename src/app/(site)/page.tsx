import { PaginaInicial } from '@/components/site/home/PaginaInicial'
import { getCurrentGuest } from '@/lib/invitations'

export default async function HomePage(props: PageProps<'/'>) {
  const sp = await props.searchParams
  return <PaginaInicial guest={await getCurrentGuest()} forcarAbertura={sp.abertura === '1'} />
}
