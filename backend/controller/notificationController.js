import {
  listNotificationsForUser,
  markNotificationReadForUser,
  markAllNotificationsReadForUser,
  isNotificationsSchemaError,
  NOTIFICATIONS_NOT_INITIALIZED_MESSAGE,
} from '../utils/notificationService.js';

export const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const limit = Number(req.query?.limit || 25);
    const notifications = await listNotificationsForUser(userId, limit);
    const unreadCount = notifications.reduce((count, item) => count + (item.isRead ? 0 : 1), 0);
    return res.json({ notifications, unreadCount });
  } catch (err) {
    if (isNotificationsSchemaError(err)) {
      return res.status(503).json({ error: NOTIFICATIONS_NOT_INITIALIZED_MESSAGE });
    }
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

export const markMyNotificationRead = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const notificationId = req.params?.id;
    if (!notificationId) return res.status(400).json({ error: 'notificationId is required' });

    const notification = await markNotificationReadForUser(notificationId, userId);
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    return res.json(notification);
  } catch (err) {
    if (isNotificationsSchemaError(err)) {
      return res.status(503).json({ error: NOTIFICATIONS_NOT_INITIALIZED_MESSAGE });
    }
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};

export const markAllMyNotificationsRead = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    await markAllNotificationsReadForUser(userId);
    return res.json({ success: true });
  } catch (err) {
    if (isNotificationsSchemaError(err)) {
      return res.status(503).json({ error: NOTIFICATIONS_NOT_INITIALIZED_MESSAGE });
    }
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
};
