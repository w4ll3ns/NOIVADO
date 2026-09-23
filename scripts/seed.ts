/**
 * Popula o banco com o conteúdo inicial editável.
 * Idempotente: cada bloco só é inserido se a tabela correspondente estiver vazia.
 *
 *   npm run db:seed            conteúdo inicial
 *   npm run db:seed -- --demo  + convites de demonstração
 */
import { count, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import type { PgTable } from 'drizzle-orm/pg-core'
import postgres from 'postgres'
import * as schema from '../src/lib/db/schema'
import { hashPassword } from '../src/lib/auth/password'
import { randomToken } from '../src/lib/security/tokens'
import {
  demoInvitations,
  seedAlbum,
  seedFaqs,
  seedGiftCategories,
  seedGifts,
  seedSchedule,
  seedStory,
  seedWhatsappTemplates,
} from '../src/lib/seed-data'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL não configurada')
const client = postgres(url, { max: 1, onnotice: () => {} })
const db = drizzle(client, { schema })

async function isEmpty(table: PgTable) {
  const [row] = await db.select({ n: count() }).from(table)
  return Number(row.n) === 0
}

async function main() {
  const demo = process.argv.includes('--demo')

  if (await isEmpty(schema.giftCategories)) {
    const cats = await db
      .insert(schema.giftCategories)
      .values(seedGiftCategories.map((c, i) => ({ ...c, sortOrder: i })))
      .returning()
    const bySlug = new Map(cats.map((c) => [c.slug, c.id]))
    await db.insert(schema.gifts).values(
      seedGifts.map((g, i) => {
        const custom = g.price === null
        const availability = g.availability ?? 'unlimited'
        return {
          categoryId: bySlug.get(g.category)!,
          name: g.name,
          description: g.description ?? null,
          icon: g.icon,
          priceType: custom ? ('custom' as const) : ('fixed' as const),
          amountCents: custom ? null : g.price! * 100,
          minCents: custom ? 5000 : null,
          maxCents: null,
          suggestedCents: custom ? 20000 : null,
          quickAmountsCents: custom ? [10000, 20000, 30000, 50000] : null,
          availability,
          quantity: availability === 'unique' ? 1 : availability === 'limited' ? (g.quantity ?? 1) : null,
          featured: g.featured ?? false,
          sortOrder: i,
        }
      }),
    )
    console.log(`✓ ${cats.length} categorias e ${seedGifts.length} presentes`)
  }

  if (await isEmpty(schema.scheduleItems)) {
    await db.insert(schema.scheduleItems).values(seedSchedule.map((s, i) => ({ ...s, sortOrder: i })))
    console.log('✓ programação')
  }

  if (await isEmpty(schema.storyMilestones)) {
    await db.insert(schema.storyMilestones).values(seedStory.map((s, i) => ({ ...s, sortOrder: i })))
    console.log('✓ nossa história')
  }

  if (await isEmpty(schema.faqs)) {
    await db.insert(schema.faqs).values(seedFaqs.map((f, i) => ({ ...f, sortOrder: i })))
    console.log('✓ perguntas frequentes')
  }

  if (await isEmpty(schema.whatsappTemplates)) {
    await db.insert(schema.whatsappTemplates).values(seedWhatsappTemplates.map((t) => ({ ...t, isDefault: true })))
    console.log('✓ modelos de WhatsApp')
  }

  if (await isEmpty(schema.albums)) {
    const [album] = await db.insert(schema.albums).values(seedAlbum).returning()
    await db.insert(schema.albumTokens).values({ albumId: album.id, token: randomToken(10), label: 'Geral' })
    console.log('✓ álbum colaborativo + QR Code geral')
  }

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const adminPassword = process.env.ADMIN_PASSWORD
  if (adminEmail && adminPassword) {
    const [existing] = await db.select().from(schema.admins).where(eq(schema.admins.email, adminEmail))
    if (!existing) {
      await db.insert(schema.admins).values({
        name: process.env.ADMIN_NAME || 'Maby & Chris',
        email: adminEmail,
        passwordHash: await hashPassword(adminPassword),
        role: 'owner',
      })
      console.log(`✓ administrador ${adminEmail}`)
    }
  }

  if (demo && (await isEmpty(schema.invitations))) {
    for (const inv of demoInvitations) {
      const [row] = await db
        .insert(schema.invitations)
        .values({
          label: inv.label,
          kind: inv.kind,
          phone: inv.phone ? '55' + inv.phone : null,
          allowCompanions: 'allowCompanions' in inv ? inv.allowCompanions : false,
          maxCompanions: 'maxCompanions' in inv ? inv.maxCompanions : 0,
        })
        .returning()
      await db.insert(schema.guests).values(inv.guests.map((g, i) => ({ ...g, invitationId: row.id, sortOrder: i })))
      const token = randomToken(12)
      await db.insert(schema.invitationTokens).values({ invitationId: row.id, token })
      await db.insert(schema.invitationEvents).values({ invitationId: row.id, type: 'created', actor: 'system' })
      console.log(`✓ convite demo "${inv.label}": /i/${token}`)
    }
  }

  await client.end()
}

main().catch(async (err) => {
  console.error(err)
  await client.end()
  process.exit(1)
})
