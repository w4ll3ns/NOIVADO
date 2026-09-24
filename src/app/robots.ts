import type { MetadataRoute } from 'next'

/** Site privado: convites pessoais não devem aparecer em buscadores. */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', disallow: '/' }] }
}
