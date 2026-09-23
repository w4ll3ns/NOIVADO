import { headers } from 'next/headers'
import { DoorIntro } from './DoorIntro'
import { INTRO_STORAGE_KEY } from './constants'
import { DOOR, DoorLeafArt, FACADE_H, FACADE_W, Facade } from '@/components/casarao/Facade'
import { CoupleNames } from '@/components/site/CoupleNames'

function Leaf({ side }: { side: 'left' | 'right' }) {
  const id = `intro-leaf-${side}-hatch`
  return (
    <svg viewBox={`0 0 ${DOOR.w / 2} ${DOOR.h}`} preserveAspectRatio="none" className="cz" aria-hidden="true" focusable="false">
      <defs>
        <pattern id={id} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="5" className="cz-hatch-line" />
        </pattern>
      </defs>
      <DoorLeafArt side={side} hatch={`url(#${id})`} />
    </svg>
  )
}

type Props = {
  coupleNames: string
  dateDots: string
  phrase: string
  buttonLabel: string
  welcomeTitle: string
  welcomeSub?: string
  force?: boolean
  monogram?: string
}

/**
 * Abertura com o casarão. Renderizada no servidor (pinta imediatamente, sem esperar JS);
 * um script inline esconde a abertura antes da primeira pintura se este dispositivo já a viu.
 */
export async function IntroGate(props: Props) {
  const nonce = (await headers()).get('x-nonce') ?? undefined
  const script = props.force
    ? `document.documentElement.classList.remove('intro-seen')`
    : `try{if(localStorage.getItem('${INTRO_STORAGE_KEY}'))document.documentElement.classList.add('intro-seen')}catch(e){}`
  return (
    <>
      <script nonce={nonce} dangerouslySetInnerHTML={{ __html: script }} />
      <DoorIntro
        names={<CoupleNames names={props.coupleNames} />}
        dateDots={props.dateDots}
        phrase={props.phrase}
        buttonLabel={props.buttonLabel}
        welcomeTitle={props.welcomeTitle}
        welcomeSub={props.welcomeSub}
        force={props.force}
        facade={<Facade idPrefix="intro" withDoor={false} monogram={props.monogram} />}
        leftLeaf={<Leaf side="left" />}
        rightLeaf={<Leaf side="right" />}
        door={{
          left: (DOOR.x / FACADE_W) * 100,
          top: (DOOR.y / FACADE_H) * 100,
          width: (DOOR.w / FACADE_W) * 100,
          height: (DOOR.h / FACADE_H) * 100,
        }}
      />
    </>
  )
}
