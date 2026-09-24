/**
 * Poeira dourada na luz do portão: poucas partículas subindo devagar enquanto o convite espera
 * o "Entrar"; na entrada, um pouco mais de poeira sai do portão.
 * O canvas fica dentro do palco da abertura, então o zoom da câmera as amplia (bokeh).
 */

type Porta = { x: number; y: number; w: number; h: number }
type P = { x: number; y: number; vx: number; vy: number; r: number; age: number; life: number; a: number }

const COR = '255, 214, 138'

function sprite(size: number) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grd.addColorStop(0, 'rgba(255, 250, 232, 1)')
  grd.addColorStop(0.28, `rgba(${COR}, 0.9)`)
  grd.addColorStop(1, `rgba(${COR}, 0)`)
  g.fillStyle = grd
  g.fillRect(0, 0, size, size)
  return c
}

export function iniciarParticulas(canvas: HTMLCanvasElement, porta: Porta) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return { revoada() {}, parar() {} }
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const rect = canvas.getBoundingClientRect()
  const W = rect.width
  const H = rect.height
  canvas.width = Math.round(W * dpr)
  canvas.height = Math.round(H * dpr)
  ctx.scale(dpr, dpr)
  const img = sprite(64)
  const door = { x: porta.x * W, y: porta.y * H, w: porta.w * W, h: porta.h * H }
  const ps: P[] = []
  let burst = 0
  let raf = 0
  let last = performance.now()

  const spawn = (saindo: boolean) => {
    ps.push({
      x: door.x + (Math.random() - 0.5) * door.w * 0.8,
      y: door.y + (Math.random() - 0.2) * door.h * 0.5,
      vx: (Math.random() - 0.5) * (saindo ? 26 : 6),
      vy: -(6 + Math.random() * (saindo ? 22 : 12)),
      r: 0.8 + Math.random() * 1.6,
      age: 0,
      life: 2200 + Math.random() * 2400,
      a: 0.45 + Math.random() * 0.4,
    })
  }

  const frame = (now: number) => {
    const dt = Math.min(50, now - last)
    last = now
    if (ps.length < 26 && Math.random() < dt / 110) spawn(false)
    if (burst > 0) {
      if (Math.random() < dt / 45) spawn(true)
      burst -= dt
    }
    ctx.clearRect(0, 0, W, H)
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i]
      p.age += dt
      if (p.age >= p.life) {
        ps.splice(i, 1)
        continue
      }
      const s = dt / 1000
      p.x += p.vx * s + Math.sin((p.age + i * 97) / 700) * 0.12
      p.y += p.vy * s
      const t = p.age / p.life
      const fade = t < 0.2 ? t / 0.2 : t > 0.7 ? (1 - t) / 0.3 : 1
      const r = p.r * 4 * (1 + t * 0.6)
      ctx.globalAlpha = p.a * fade
      ctx.drawImage(img, p.x - r, p.y - r, r * 2, r * 2)
    }
    ctx.globalAlpha = 1
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)

  return {
    /** Na entrada: mais poeira saindo do portão por um instante. */
    revoada() {
      burst = 1300
    },
    parar() {
      cancelAnimationFrame(raf)
      ctx.clearRect(0, 0, W, H)
    },
  }
}
