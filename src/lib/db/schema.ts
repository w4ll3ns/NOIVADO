import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

const id = () => uuid('id').primaryKey().defaultRandom()
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
const ts = (name: string) => timestamp(name, { withTimezone: true })

/* ------------------------------------------------------------------ */
/* Administração                                                        */
/* ------------------------------------------------------------------ */

export const ADMIN_ROLES = ['owner', 'editor', 'viewer'] as const
export type AdminRole = (typeof ADMIN_ROLES)[number]

export const admins = pgTable('admins', {
  id: id(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ADMIN_ROLES }).notNull().default('editor'),
  lastLoginAt: ts('last_login_at'),
  disabledAt: ts('disabled_at'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const adminSessions = pgTable(
  'admin_sessions',
  {
    id: id(),
    adminId: uuid('admin_id')
      .notNull()
      .references(() => admins.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    ipHash: text('ip_hash'),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
    lastSeenAt: ts('last_seen_at').notNull().defaultNow(),
    expiresAt: ts('expires_at').notNull(),
  },
  (t) => [index('admin_sessions_admin_idx').on(t.adminId)],
)

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: id(),
    adminId: uuid('admin_id').references(() => admins.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entity: text('entity'),
    entityId: text('entity_id'),
    details: jsonb('details').$type<Record<string, unknown>>(),
    ipHash: text('ip_hash'),
    createdAt: createdAt(),
  },
  (t) => [index('audit_logs_created_idx').on(t.createdAt)],
)

export const rateLimits = pgTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
  resetAt: ts('reset_at').notNull(),
})

/* ------------------------------------------------------------------ */
/* Configurações e conteúdo                                             */
/* ------------------------------------------------------------------ */

export const siteSettings = pgTable('site_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: updatedAt(),
  updatedBy: uuid('updated_by').references(() => admins.id, { onDelete: 'set null' }),
})

/** Imagens enviadas pelo admin (presentes, história, galeria do casal, dress code). */
export const media = pgTable('media', {
  id: id(),
  originalKey: text('original_key').notNull(),
  webKey: text('web_key').notNull(),
  thumbKey: text('thumb_key').notNull(),
  mime: text('mime').notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  bytes: integer('bytes').notNull(),
  dominantColor: text('dominant_color'),
  alt: text('alt'),
  createdAt: createdAt(),
})

export const storyMilestones = pgTable('story_milestones', {
  id: id(),
  dateLabel: text('date_label'),
  title: text('title').notNull(),
  text: text('text'),
  mediaId: uuid('media_id').references(() => media.id, { onDelete: 'set null' }),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const scheduleItems = pgTable('schedule_items', {
  id: id(),
  timeLabel: text('time_label').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const faqs = pgTable('faqs', {
  id: id(),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

/** "Nossa História em Fotos" — fotos oficiais do casal (separadas do álbum colaborativo). */
export const galleryPhotos = pgTable('gallery_photos', {
  id: id(),
  mediaId: uuid('media_id')
    .notNull()
    .references(() => media.id, { onDelete: 'cascade' }),
  caption: text('caption'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: createdAt(),
})

/* ------------------------------------------------------------------ */
/* Convites e convidados                                                */
/* ------------------------------------------------------------------ */

/** Categoria livre para organizar convites ("Família da noiva", "Amigos do trabalho"...). */
export const guestGroups = pgTable('guest_groups', {
  id: id(),
  name: text('name').notNull().unique(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: createdAt(),
})

export const INVITATION_KINDS = ['individual', 'couple', 'family', 'group'] as const
export type InvitationKind = (typeof INVITATION_KINDS)[number]

export const RSVP_STATUSES = ['pending', 'attending', 'declined'] as const
export type RsvpStatus = (typeof RSVP_STATUSES)[number]

export const invitations = pgTable(
  'invitations',
  {
    id: id(),
    /** Nome do convite: "Família Silva", "João e Maria". */
    label: text('label').notNull(),
    /** Como saudar no portal/WhatsApp. Vazio = gerado a partir dos primeiros nomes. */
    greetingName: text('greeting_name'),
    kind: text('kind', { enum: INVITATION_KINDS }).notNull().default('individual'),
    groupId: uuid('group_id').references(() => guestGroups.id, { onDelete: 'set null' }),
    isCloseFamily: boolean('is_close_family').notNull().default(false),
    phone: text('phone'),
    email: text('email'),
    allowCompanions: boolean('allow_companions').notNull().default(false),
    maxCompanions: integer('max_companions').notNull().default(0),
    notes: text('notes'),
    whatsappTemplateId: uuid('whatsapp_template_id'),
    sentAt: ts('sent_at'),
    sentVia: text('sent_via'),
    firstAccessedAt: ts('first_accessed_at'),
    lastAccessedAt: ts('last_accessed_at'),
    accessCount: integer('access_count').notNull().default(0),
    rsvpStatus: text('rsvp_status', { enum: RSVP_STATUSES }).notNull().default('pending'),
    rsvpRespondedAt: ts('rsvp_responded_at'),
    archivedAt: ts('archived_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('invitations_rsvp_idx').on(t.rsvpStatus),
    index('invitations_group_idx').on(t.groupId),
  ],
)

export const invitationTokens = pgTable(
  'invitation_tokens',
  {
    id: id(),
    invitationId: uuid('invitation_id')
      .notNull()
      .references(() => invitations.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    createdAt: createdAt(),
    revokedAt: ts('revoked_at'),
  },
  (t) => [index('invitation_tokens_invitation_idx').on(t.invitationId)],
)

export const ATTENDANCE = ['pending', 'yes', 'no'] as const
export type Attendance = (typeof ATTENDANCE)[number]

export const guests = pgTable(
  'guests',
  {
    id: id(),
    invitationId: uuid('invitation_id')
      .notNull()
      .references(() => invitations.id, { onDelete: 'cascade' }),
    firstName: text('first_name').notNull(),
    lastName: text('last_name'),
    phone: text('phone'),
    email: text('email'),
    /** Acompanhante informado pelo próprio convidado no RSVP. */
    isCompanion: boolean('is_companion').notNull().default(false),
    isChild: boolean('is_child').notNull().default(false),
    attendance: text('attendance', { enum: ATTENDANCE }).notNull().default('pending'),
    dietaryRestrictions: text('dietary_restrictions'),
    specialNeeds: text('special_needs'),
    notes: text('notes'),
    sortOrder: integer('sort_order').notNull().default(0),
    removedAt: ts('removed_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('guests_invitation_idx').on(t.invitationId)],
)

export const INVITATION_EVENT_TYPES = [
  'created',
  'updated',
  'whatsapp_prepared',
  'reminder_prepared',
  'marked_sent',
  'unmarked_sent',
  'link_accessed',
  'link_revisited',
  'event_info_viewed',
  'gifts_viewed',
  'rsvp_submitted',
  'rsvp_changed',
  'gift_selected',
  'payment_approved',
  'payment_failed',
  'payment_refunded',
  'message_sent',
  'photo_uploaded',
  'token_regenerated',
] as const
export type InvitationEventType = (typeof INVITATION_EVENT_TYPES)[number]

export const invitationEvents = pgTable(
  'invitation_events',
  {
    id: id(),
    invitationId: uuid('invitation_id')
      .notNull()
      .references(() => invitations.id, { onDelete: 'cascade' }),
    type: text('type', { enum: INVITATION_EVENT_TYPES }).notNull(),
    actor: text('actor', { enum: ['guest', 'admin', 'system'] }).notNull().default('system'),
    adminId: uuid('admin_id').references(() => admins.id, { onDelete: 'set null' }),
    data: jsonb('data').$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index('invitation_events_invitation_idx').on(t.invitationId, t.createdAt)],
)

/** Cada envio do RSVP é um registro imutável: o conjunto forma o histórico. */
export const rsvps = pgTable(
  'rsvps',
  {
    id: id(),
    invitationId: uuid('invitation_id')
      .notNull()
      .references(() => invitations.id, { onDelete: 'cascade' }),
    status: text('status', { enum: RSVP_STATUSES }).notNull(),
    attendingCount: integer('attending_count').notNull().default(0),
    declinedCount: integer('declined_count').notNull().default(0),
    dietaryRestrictions: text('dietary_restrictions'),
    specialNeeds: text('special_needs'),
    notes: text('notes'),
    songRequest: text('song_request'),
    messageToCouple: text('message_to_couple'),
    isChange: boolean('is_change').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index('rsvps_invitation_idx').on(t.invitationId, t.createdAt)],
)

export const rsvpGuests = pgTable(
  'rsvp_guests',
  {
    id: id(),
    rsvpId: uuid('rsvp_id')
      .notNull()
      .references(() => rsvps.id, { onDelete: 'cascade' }),
    guestId: uuid('guest_id').references(() => guests.id, { onDelete: 'set null' }),
    /** Nome no momento da resposta (preserva o histórico mesmo que o convidado mude). */
    guestName: text('guest_name').notNull(),
    isCompanion: boolean('is_companion').notNull().default(false),
    attending: boolean('attending').notNull(),
  },
  (t) => [index('rsvp_guests_rsvp_idx').on(t.rsvpId)],
)

/* ------------------------------------------------------------------ */
/* Presentes e pagamentos                                               */
/* ------------------------------------------------------------------ */

export const giftCategories = pgTable('gift_categories', {
  id: id(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  icon: text('icon'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: createdAt(),
})

export const GIFT_PRICE_TYPES = ['fixed', 'custom'] as const
export const GIFT_AVAILABILITY = ['unique', 'limited', 'unlimited'] as const
export type GiftPriceType = (typeof GIFT_PRICE_TYPES)[number]
export type GiftAvailability = (typeof GIFT_AVAILABILITY)[number]

export const gifts = pgTable(
  'gifts',
  {
    id: id(),
    categoryId: uuid('category_id').references(() => giftCategories.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    description: text('description'),
    icon: text('icon'),
    mediaId: uuid('media_id').references(() => media.id, { onDelete: 'set null' }),
    priceType: text('price_type', { enum: GIFT_PRICE_TYPES }).notNull().default('fixed'),
    amountCents: integer('amount_cents'),
    minCents: integer('min_cents'),
    maxCents: integer('max_cents'),
    suggestedCents: integer('suggested_cents'),
    quickAmountsCents: integer('quick_amounts_cents').array(),
    availability: text('availability', { enum: GIFT_AVAILABILITY }).notNull().default('unlimited'),
    quantity: integer('quantity'),
    featured: boolean('featured').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    archivedAt: ts('archived_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('gifts_category_idx').on(t.categoryId)],
)

export const PAYMENT_STATUSES = [
  'awaiting',
  'approved',
  'rejected',
  'cancelled',
  'expired',
  'refunded',
] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export const giftPayments = pgTable(
  'gift_payments',
  {
    /** Também é o `external_reference` enviado ao Mercado Pago. */
    id: id(),
    giftId: uuid('gift_id')
      .notNull()
      .references(() => gifts.id, { onDelete: 'restrict' }),
    invitationId: uuid('invitation_id').references(() => invitations.id, { onDelete: 'set null' }),
    giftName: text('gift_name').notNull(),
    payerName: text('payer_name').notNull(),
    payerEmail: text('payer_email').notNull(),
    payerPhone: text('payer_phone'),
    message: text('message'),
    amountCents: integer('amount_cents').notNull(),
    status: text('status', { enum: PAYMENT_STATUSES }).notNull().default('awaiting'),
    statusDetail: text('status_detail'),
    provider: text('provider', { enum: ['mercadopago', 'simulation'] }).notNull().default('mercadopago'),
    mpPreferenceId: text('mp_preference_id'),
    mpPaymentId: text('mp_payment_id'),
    paymentMethod: text('payment_method'),
    paymentType: text('payment_type'),
    checkoutUrl: text('checkout_url'),
    expiresAt: ts('expires_at'),
    approvedAt: ts('approved_at'),
    messageDelivered: boolean('message_delivered').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('gift_payments_gift_idx').on(t.giftId, t.status),
    index('gift_payments_invitation_idx').on(t.invitationId),
    index('gift_payments_mp_payment_idx').on(t.mpPaymentId),
  ],
)

export const paymentEvents = pgTable(
  'payment_events',
  {
    id: id(),
    paymentId: uuid('payment_id').references(() => giftPayments.id, { onDelete: 'set null' }),
    source: text('source', { enum: ['webhook', 'return', 'sync', 'admin', 'simulation', 'system'] }).notNull(),
    /** Chave única: garante idempotência no processamento de notificações. */
    dedupeKey: text('dedupe_key').notNull().unique(),
    mpPaymentId: text('mp_payment_id'),
    mpStatus: text('mp_status'),
    mpStatusDetail: text('mp_status_detail'),
    data: jsonb('data').$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index('payment_events_payment_idx').on(t.paymentId)],
)

/* ------------------------------------------------------------------ */
/* Mensagens e WhatsApp                                                 */
/* ------------------------------------------------------------------ */

export const MESSAGE_SOURCES = ['rsvp', 'gift', 'guestbook'] as const
export type MessageSource = (typeof MESSAGE_SOURCES)[number]

export const messages = pgTable(
  'messages',
  {
    id: id(),
    invitationId: uuid('invitation_id').references(() => invitations.id, { onDelete: 'set null' }),
    source: text('source', { enum: MESSAGE_SOURCES }).notNull(),
    authorName: text('author_name').notNull(),
    content: text('content').notNull(),
    rsvpId: uuid('rsvp_id').references(() => rsvps.id, { onDelete: 'set null' }),
    paymentId: uuid('payment_id').references(() => giftPayments.id, { onDelete: 'set null' }),
    readAt: ts('read_at'),
    favorite: boolean('favorite').notNull().default(false),
    archivedAt: ts('archived_at'),
    createdAt: createdAt(),
  },
  (t) => [index('messages_created_idx').on(t.createdAt)],
)

export const WHATSAPP_TEMPLATE_KINDS = [
  'invite_individual',
  'invite_couple',
  'invite_family',
  'invite_close_family',
  'rsvp_reminder',
  'thanks_after_rsvp',
  'final_reminder',
  'custom',
] as const
export type WhatsappTemplateKind = (typeof WHATSAPP_TEMPLATE_KINDS)[number]

export const whatsappTemplates = pgTable('whatsapp_templates', {
  id: id(),
  name: text('name').notNull(),
  kind: text('kind', { enum: WHATSAPP_TEMPLATE_KINDS }).notNull().default('custom'),
  body: text('body').notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

/* ------------------------------------------------------------------ */
/* Álbum colaborativo                                                   */
/* ------------------------------------------------------------------ */

export const albums = pgTable('albums', {
  id: id(),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status', { enum: ['draft', 'open', 'closed'] }).notNull().default('open'),
  uploadsEnabled: boolean('uploads_enabled').notNull().default(true),
  publicGalleryEnabled: boolean('public_gallery_enabled').notNull().default(true),
  requireApproval: boolean('require_approval').notNull().default(true),
  allowAnonymous: boolean('allow_anonymous').notNull().default(true),
  allowGalleryUpload: boolean('allow_gallery_upload').notNull().default(true),
  allowCamera: boolean('allow_camera').notNull().default(true),
  allowMultiple: boolean('allow_multiple').notNull().default(true),
  startsAt: ts('starts_at'),
  endsAt: ts('ends_at'),
  closedMessage: text('closed_message'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const albumTokens = pgTable(
  'album_tokens',
  {
    id: id(),
    albumId: uuid('album_id')
      .notNull()
      .references(() => albums.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    label: text('label').notNull().default('Geral'),
    scanCount: integer('scan_count').notNull().default(0),
    createdAt: createdAt(),
    revokedAt: ts('revoked_at'),
  },
  (t) => [index('album_tokens_album_idx').on(t.albumId)],
)

export const PHOTO_STATUSES = ['pending', 'approved', 'hidden', 'rejected'] as const
export type PhotoStatus = (typeof PHOTO_STATUSES)[number]

export const photos = pgTable(
  'photos',
  {
    id: id(),
    albumId: uuid('album_id')
      .notNull()
      .references(() => albums.id, { onDelete: 'cascade' }),
    tokenId: uuid('token_id').references(() => albumTokens.id, { onDelete: 'set null' }),
    invitationId: uuid('invitation_id').references(() => invitations.id, { onDelete: 'set null' }),
    uploaderName: text('uploader_name'),
    showNamePublicly: boolean('show_name_publicly').notNull().default(false),
    status: text('status', { enum: PHOTO_STATUSES }).notNull().default('pending'),
    source: text('source', { enum: ['camera', 'gallery'] }).notNull().default('gallery'),
    originalKey: text('original_key').notNull(),
    webKey: text('web_key').notNull(),
    thumbKey: text('thumb_key').notNull(),
    originalName: text('original_name'),
    mime: text('mime').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    bytes: integer('bytes').notNull(),
    dominantColor: text('dominant_color'),
    ipHash: text('ip_hash'),
    approvedAt: ts('approved_at'),
    createdAt: createdAt(),
  },
  (t) => [
    index('photos_album_status_idx').on(t.albumId, t.status, t.createdAt),
    index('photos_invitation_idx').on(t.invitationId),
  ],
)

export const photoModeration = pgTable(
  'photo_moderation',
  {
    id: id(),
    photoId: uuid('photo_id')
      .notNull()
      .references(() => photos.id, { onDelete: 'cascade' }),
    adminId: uuid('admin_id').references(() => admins.id, { onDelete: 'set null' }),
    fromStatus: text('from_status', { enum: PHOTO_STATUSES }),
    toStatus: text('to_status', { enum: PHOTO_STATUSES }).notNull(),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [index('photo_moderation_photo_idx').on(t.photoId)],
)
