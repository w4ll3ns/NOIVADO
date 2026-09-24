'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/session'
import { syncPaymentWithMp } from '@/lib/payments/service'
import { audit } from '@/lib/audit'

export async function syncPaymentAction(form: FormData) {
  const admin = await requireAdmin('editor')
  const id = String(form.get('id'))
  if (!/^[0-9a-f-]{36}$/.test(id)) return
  await syncPaymentWithMp(id, 'sync')
  await audit(admin.id, 'payment.sync', 'gift_payment', id)
  revalidatePath('/admin/pagamentos')
}
