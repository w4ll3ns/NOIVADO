import { headers } from 'next/headers'
import { CasaraoIntro } from './CasaraoIntro'
import { INTRO_STORAGE_KEY } from './constants'
import { Casarao, CASARAO_PORTA } from '@/components/casarao/Casarao'
import { CoupleNames } from '@/components/site/CoupleNames'

const TEMPO_SRC = '/brand/casarao-tempo.webp'

type Props = {
  coupleNames: string
  dateDots: string
  phrase: string
  buttonLabel: string
  welcomeTitle: string
  welcomeSub?: string
  force?: boolean
  venueName?: string
}

/**
 * Abertura com o casarão. Renderizada no servidor (pinta imediatamente, sem esperar JS);
 * um script inline esconde a abertura antes da primeira pintura se este dispositivo já a viu —
 * e, se ainda não viu, já começa a baixar o mapa de tempo da animação de desenho.
 */
export async function IntroGate(props: Props) {
  const nonce = (await headers()).get('x-nonce') ?? undefined
  const prefetch = `new Image().src='${TEMPO_SRC}'`
  const script = props.force
    ? `document.documentElement.classList.remove('intro-seen');${prefetch}`
    : `try{if(localStorage.getItem('${INTRO_STORAGE_KEY}'))document.documentElement.classList.add('intro-seen');else ${prefetch}}catch(e){}`
  return (
    <>
      <script nonce={nonce} dangerouslySetInnerHTML={{ __html: script }} />
      {/* Sem JavaScript não há como "entrar": vai direto ao site. */}
      <noscript dangerouslySetInnerHTML={{ __html: '<style>.intro{display:none!important}body{overflow:auto!important}</style>' }} />
      <CasaraoIntro
        names={<CoupleNames names={props.coupleNames} />}
        dateDots={props.dateDots}
        phrase={props.phrase}
        buttonLabel={props.buttonLabel}
        welcomeTitle={props.welcomeTitle}
        welcomeSub={props.welcomeSub}
        force={props.force}
        casarao={
          <Casarao
            luzes="acesas"
            priority
            sizes="(max-width: 640px) 94vw, 58vh"
            alt={props.venueName ? `Fachada da ${props.venueName}` : ''}
          />
        }
        porta={CASARAO_PORTA}
        tempoSrc={TEMPO_SRC}
      />
    </>
  )
}
