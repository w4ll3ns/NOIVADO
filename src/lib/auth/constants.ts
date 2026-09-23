export const ADMIN_COOKIE_DEV = 'mc_admin'
export const ADMIN_COOKIE_PROD = '__Host-mc_admin'

export function adminCookieName() {
  return process.env.NODE_ENV === 'production' ? ADMIN_COOKIE_PROD : ADMIN_COOKIE_DEV
}
