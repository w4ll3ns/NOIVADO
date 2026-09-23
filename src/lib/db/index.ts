import 'server-only'
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

type Db = PostgresJsDatabase<typeof schema>

const globalForDb = globalThis as unknown as { __noivadoDb?: { db: Db; client: postgres.Sql } }

function create() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL não configurada. Veja .env.example.')
  const client = postgres(url, {
    max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
    idle_timeout: 30,
    prepare: process.env.DATABASE_PREPARE !== 'false',
    onnotice: () => {},
  })
  return { db: drizzle(client, { schema }), client }
}

function instance() {
  if (!globalForDb.__noivadoDb) globalForDb.__noivadoDb = create()
  return globalForDb.__noivadoDb
}

/** Conexão lazy: nada acontece até a primeira consulta (o build não precisa de banco). */
export const db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    return Reflect.get(instance().db, prop, receiver)
  },
})

export { schema }
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
