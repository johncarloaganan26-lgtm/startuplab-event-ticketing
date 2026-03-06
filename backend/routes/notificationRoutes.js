import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  getMyNotifications,
  markMyNotificationRead,
  markAllMyNotificationsRead,
} from '../controller/notificationController.js';

const router = express.Router();

// In-app notifications feed
router.get('/notifications/me', authMiddleware, getMyNotifications);
router.patch('/notifications/:id/read', authMiddleware, markMyNotificationRead);
router.patch('/notifications/read-all', authMiddleware, markAllMyNotificationsRead);

export default router;
