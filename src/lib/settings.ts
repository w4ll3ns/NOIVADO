import 'server-only'
import { cache } from 'react'
import { connection } from 'next/server'
import { db, schema } from '@/lib/db'
import { parseSetting, settingsSchemas, type Settings, type SettingsKey } from '@/lib/settings-schema'

/** Todas as configurações (com padrões), uma consulta por requisição. */
export const getSettings = cache(async (): Promise<Settings> => {
  await connection()
  const rows = await db.select().from(schema.siteSettings)
  const stored = new Map(rows.map((r) => [r.key, r.value]))
  const out = {} as Record<string, unknown>
  for (const key of Object.keys(settingsSchemas) as SettingsKey[]) {
    out[key] = parseSetting(key, stored.get(key))
  }
  return out as Settings
})

export async function saveSetting<K extends SettingsKey>(key: K, value: unknown, adminId?: string) {
  const parsed = settingsSchemas[key].parse(value)
  await db
    .insert(schema.siteSettings)
    .values({ key, value: parsed, updatedBy: adminId ?? null })
    .onConflictDoUpdate({
      target: schema.siteSettings.key,
      set: { value: parsed, updatedAt: new Date(), updatedBy: adminId ?? null },
    })
  return parsed as Settings[K]
}
