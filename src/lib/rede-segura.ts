/**
 * O painel busca páginas de produtos na internet a pedido do admin. Isto garante que um link não faça
 * o servidor acessar a si mesmo ou a rede interna (ex.: 127.0.0.1, 10.x, 169.254.169.254).
 */
import { lookup } from 'node:dns/promises'
import net from 'node:net'

export class DestinoProibido extends Error {}

export function ipInterno(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19))
    )
  }
  const v6 = ip.toLowerCase()
  if (v6.startsWith('::ffff:')) return ipInterno(v6.slice(7))
  return v6 === '::' || v6 === '::1' || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6)
}

/** O link aponta para a internet de verdade? (permitirLocal: só para testes com loja simulada) */
export async function conferirDestino(u: URL, permitirLocal = false) {
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new DestinoProibido('Use um link que comece com https://')
  if (permitirLocal) return
  if (u.username || u.password || (u.port && u.port !== '80' && u.port !== '443')) throw new DestinoProibido('Este link não é permitido.')
  const host = u.hostname.replace(/^\[|\]$/g, '')
  let enderecos: { address: string }[]
  try {
    enderecos = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true })
  } catch {
    throw new DestinoProibido('Não encontrei este site. Confira o link.')
  }
  if (!enderecos.length || enderecos.some((e) => ipInterno(e.address))) throw new DestinoProibido('Este link não é permitido.')
}
