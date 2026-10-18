/** Link do convite (/i/<token>): a home do site, já com o nome de quem foi convidado. */

/** Cabeçalho que o proxy preenche com o token do endereço (o layout não recebe os params da página). */
export const CONVITE_HEADER = 'x-mc-convite'

/** Token do convite no endereço (/i/<token> e as páginas dentro dele). */
export function tokenDoCaminho(pathname: string): string | null {
  return /^\/i\/([A-Za-z0-9_-]{8,40})(?:\/|$)/.exec(pathname)?.[1] ?? null
}

/** A home: "/" ou o próprio link do convite. */
export function ehInicio(pathname: string) {
  return pathname === '/' || /^\/i\/[^/]+\/?$/.test(pathname)
}
