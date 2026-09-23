import { z } from 'zod'

/**
 * Tudo o que os noivos podem editar sem programação.
 * Cada chave é salva como JSON em `site_settings` e validada aqui (com valores padrão).
 */

const text = (def = '', max = 4000) => z.string().trim().max(max).default(def)
const hhmm = (def: string) =>
  z
    .string()
    .trim()
    .regex(/^(\d{1,2}:\d{2})?$/, 'Use o formato HH:MM')
    .default(def)
const isoDate = (def: string) =>
  z
    .string()
    .trim()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Use o formato AAAA-MM-DD')
    .default(def)

export const eventSettingsSchema = z.object({
  title: text('Noivado', 80),
  coupleNames: text('Maby & Chris', 80),
  date: isoDate('2026-10-31'),
  receptionTime: hhmm('19:30'),
  mainTime: hhmm('20:00'),
  venueName: text('Casa de Zaquia', 120),
  region: text('Centro Histórico de São Luís – MA', 160),
  address: text('Centro Histórico, São Luís – MA', 300),
  googleMapsUrl: text('', 600),
  wazeUrl: text('', 600),
  parking: text('', 1000),
  valet: text('', 1000),
  entrance: text('', 1000),
  notes: text('', 2000),
  recommendations: text('', 2000),
  contactName: text('Maby & Chris', 80),
  contactPhone: text('', 40),
})

export const introSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  phrase: text('Uma nova porta se abre para a nossa história.', 200),
  buttonLabel: text('Entrar', 30),
  welcomePhrase: text('Seja bem-vindo ao nosso noivado.', 200),
  welcomePhraseGuest: text('Entre e celebre conosco este novo capítulo.', 200),
})

export const homeSettingsSchema = z.object({
  countdownText: text('Faltam {{dias}} dias para celebrarmos juntos.', 200),
  countdownTodayText: text('É hoje! Estamos esperando por você.', 200),
  countdownPastText: text('Obrigado por celebrar conosco.', 200),
  showGiftsButton: z.boolean().default(true),
})

export const storySettingsSchema = z.object({
  enabled: z.boolean().default(true),
  title: text('Nossa História', 80),
  intro: text(
    'Nos encontramos.\nConstruímos nossa história.\nEscolhemos continuar caminhando juntos.\nE agora queremos celebrar esse novo capítulo ao lado de pessoas especiais.',
    3000,
  ),
})

const colorSchema = z.object({
  name: z.string().trim().min(1).max(40),
  hex: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/),
})

export const dressCodeSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  type: text('Esporte fino', 60),
  description: text('Elegante, confortável e pronto para celebrar conosco.', 1000),
  suggestedColors: z.array(colorSchema).max(12).default([
    { name: 'Areia', hex: '#D9C4AE' },
    { name: 'Terracota suave', hex: '#B9826A' },
    { name: 'Verde-oliva', hex: '#7F8363' },
    { name: 'Azul-petróleo', hex: '#3F5E66' },
    { name: 'Vinho', hex: '#6E2F3A' },
  ]),
  reservedColors: z.array(colorSchema).max(12).default([
    { name: 'Branco e off-white', hex: '#FBF8F3' },
  ]),
  reservedNote: text('Reservamos os tons de branco para a noiva.', 300),
  recommendations: text(
    'As ruas do Centro Histórico são de pedra: prefira saltos grossos ou sapatos confortáveis.',
    1500,
  ),
  referenceMediaIds: z.array(z.string().uuid()).max(12).default([]),
})

export const rsvpSettingsSchema = z.object({
  deadline: isoDate('2026-10-15'),
  intro: text('Sua presença é o que tornará esse momento completo. Conte para nós:', 500),
  askDietary: z.boolean().default(true),
  askSpecialNeeds: z.boolean().default(true),
  askNotes: z.boolean().default(true),
  askSong: z.boolean().default(true),
  askMessage: z.boolean().default(true),
  confirmedText: text('Que alegria! Mal podemos esperar para celebrar com você.', 500),
  declinedText: text('Sentiremos sua falta, mas agradecemos de coração por nos avisar.', 500),
  closedText: text(
    'O prazo para confirmar ou alterar a presença terminou. Se precisar de algo, fale diretamente com a gente.',
    500,
  ),
})

export const giftsSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  intro: text(
    'A sua presença já torna esse momento especial.\n\nMas, se desejar nos presentear, preparamos algumas ideias com muito carinho — e algumas com uma pequena dose de bom humor.',
    2000,
  ),
  maxInstallments: z.coerce.number().int().min(1).max(12).default(12),
  statementDescriptor: text('MABYECHRIS', 13),
  thanksTitle: text('Obrigado por fazer parte da nossa história.', 200),
  thanksText: text(
    'Seu presente foi recebido com muito carinho.\nEstamos muito felizes em compartilhar esse momento com você.',
    1000,
  ),
})

export const guestbookSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  title: text('Deixe uma mensagem para o nosso futuro.', 200),
  intro: text(
    'Um conselho, uma lembrança, um desejo para os próximos capítulos. Suas palavras chegarão somente a nós.',
    1000,
  ),
})

export const privacySettingsSchema = z.object({
  controllerName: text('Maby & Chris', 120),
  contactEmail: text('', 200),
  extra: text('', 4000),
})

export const seoSettingsSchema = z.object({
  siteTitle: text('Maby & Chris · Noivado', 120),
  description: text(
    'Noivado de Maby & Chris — 31 de outubro de 2026, Casa de Zaquia, Centro Histórico de São Luís.',
    300,
  ),
})

export const settingsSchemas = {
  event: eventSettingsSchema,
  intro: introSettingsSchema,
  home: homeSettingsSchema,
  story: storySettingsSchema,
  dressCode: dressCodeSettingsSchema,
  rsvp: rsvpSettingsSchema,
  gifts: giftsSettingsSchema,
  guestbook: guestbookSettingsSchema,
  privacy: privacySettingsSchema,
  seo: seoSettingsSchema,
} as const

export type SettingsKey = keyof typeof settingsSchemas
export type Settings = { [K in SettingsKey]: z.output<(typeof settingsSchemas)[K]> }
export type EventSettings = Settings['event']

export function parseSetting<K extends SettingsKey>(key: K, value: unknown): Settings[K] {
  const schema = settingsSchemas[key]
  const parsed = schema.safeParse(value ?? {})
  if (parsed.success) return parsed.data as Settings[K]
  // Valor salvo inválido (ex.: versão antiga): mantém o que for válido campo a campo.
  const base = schema.parse({}) as Record<string, unknown>
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const field = (schema.shape as Record<string, z.ZodType>)[k]
      if (field && field.safeParse(v).success) base[k] = v
    }
  }
  return base as Settings[K]
}

export function defaultSettings(): Settings {
  const out = {} as Record<string, unknown>
  for (const key of Object.keys(settingsSchemas) as SettingsKey[]) out[key] = parseSetting(key, {})
  return out as Settings
}
