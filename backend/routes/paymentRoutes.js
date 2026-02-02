import express from 'express'
import { createHitpayCheckoutSession, hitpayWebhook, getPaymentStatus } from '../controller/paymentController.js'

const router = express.Router()

const createRateLimiter = ({ windowMs, max }) => {
  const hits = new Map()

  return (req, res, next) => {
    const forwarded = req.headers['x-forwarded-for']
    const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim() || req.ip || 'unknown'
    const now = Date.now()
    const entry = hits.get(ip)

    if (!entry || entry.resetTime <= now) {
      hits.set(ip, { count: 1, resetTime: now + windowMs })
      return next()
    }

    if (entry.count >= max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetTime - now) / 1000))
      return res.status(429).json({ error: 'Rate limit exceeded' })
    }

    entry.count += 1
    hits.set(ip, entry)
    return next()
  }
}

const checkoutLimiter = createRateLimiter({ windowMs: 60_000, max: 30 })
const statusLimiter = createRateLimiter({ windowMs: 60_000, max: 120 })
const webhookLimiter = createRateLimiter({ windowMs: 60_000, max: 120 })

// Create HitPay checkout session (sandbox-ready)
router.post('/hitpay/checkout-session', checkoutLimiter, createHitpayCheckoutSession)

// Payment status polling endpoint
router.get('/status', statusLimiter, getPaymentStatus)

// HitPay webhook endpoint
router.post('/hitpay/webhook', webhookLimiter, hitpayWebhook)

export default router
