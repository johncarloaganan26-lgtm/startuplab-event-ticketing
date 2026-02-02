import supabase from '../database/db.js'

const resolveActorUserId = (req, actorUserId) => {
  return actorUserId || req?.user?.id || req?.user?.userId || null
}

const resolveIpAddress = (req) => {
  if (!req) return null
  const forwarded = req.headers?.['x-forwarded-for']
  if (Array.isArray(forwarded) && forwarded.length > 0) return forwarded[0]
  if (typeof forwarded === 'string' && forwarded.length > 0) return forwarded.split(',')[0].trim()
  return req.ip || null
}

const resolveUserAgent = (req) => {
  return req?.headers?.['user-agent'] || null
}

export const logAudit = async ({
  actionType,
  actorUserId,
  orderId,
  ticketId,
  paymentTransactionId,
  webhookEventsId,
  details,
  req
}) => {
  if (!actionType) return
  try {
    const payload = {
      actionType,
      actorUserId: resolveActorUserId(req, actorUserId),
      orderId: orderId || null,
      ticketId: ticketId || null,
      paymentTransactionId: paymentTransactionId || null,
      webhookEventsId: webhookEventsId || null,
      details: details ?? null,
      ipAddress: resolveIpAddress(req),
      userAgent: resolveUserAgent(req)
    }

    const { error } = await supabase.from('auditLogs').insert(payload)
    if (error) console.error('[AuditLog] insert failed', error)
  } catch (err) {
    console.error('[AuditLog] unexpected error', err)
  }
}
