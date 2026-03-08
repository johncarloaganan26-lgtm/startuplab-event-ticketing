import express from 'express';
import {
  getOrganizerSubscription,
  getAvailablePlans,
  createSubscription,
  handleSubscriptionWebhook,
  cancelSubscription,
  getSubscriptionHistory,
  verifySubscription,
} from '../controller/subscriptionController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Public webhook endpoint (HitPay will call this)
router.post('/webhook', handleSubscriptionWebhook);

// Protected routes (require authentication)
router.use(authMiddleware);

// Get current subscription for logged-in organizer's account
router.get('/current', getOrganizerSubscription);

// Get available plans for subscription
router.get('/plans', getAvailablePlans);

// Create new subscription
router.post('/', createSubscription);

// Cancel subscription
router.delete('/:subscriptionId', cancelSubscription);

// Get subscription history
router.get('/history', getSubscriptionHistory);

// Verify subscription after payment
router.get('/verify/:subscriptionId', verifySubscription);

export default router;
