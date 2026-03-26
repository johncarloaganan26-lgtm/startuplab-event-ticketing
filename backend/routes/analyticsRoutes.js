import express from 'express';
import {
  getSummary,
  getRecentTransactions,
  getRecentOrders,
  getAuditLogs,
  getTransactionDetail,
  getOrderDetail,
  getAuditLogDetail,
  exportEventReport,
  exportAllReports,
  archiveTransaction,
  restoreTransaction,
  deleteTransaction,
  getArchivedTransactions,
  getPlanMetrics,
  getSubscriptionHealth
} from '../controller/analyticsController.js';
import {authMiddleware} from '../middleware/auth.js';
const router = express.Router();

router.get('/analytics/summary',authMiddleware, getSummary);
router.get('/analytics/transactions', authMiddleware, getRecentTransactions);
router.get('/analytics/transactions/archived', authMiddleware, getArchivedTransactions);
router.post('/analytics/transactions/:orderId/archive', authMiddleware, archiveTransaction);
router.post('/analytics/transactions/:orderId/restore', authMiddleware, restoreTransaction);
router.delete('/analytics/transactions/:orderId', authMiddleware, deleteTransaction);
router.get('/analytics/transactions/:orderId', authMiddleware, getTransactionDetail);
router.get('/analytics/orders', authMiddleware, getRecentOrders);
router.get('/analytics/orders/:orderId', authMiddleware, getOrderDetail);
router.get('/analytics/audit-logs', authMiddleware, getAuditLogs);
router.get('/analytics/audit-logs/:auditLogId', authMiddleware, getAuditLogDetail);
router.get('/analytics/events/:eventId/export', authMiddleware, exportEventReport);
router.get('/analytics/all-events/export', authMiddleware, exportAllReports);
router.get('/analytics/plan-metrics', authMiddleware, getPlanMetrics);
router.get('/analytics/subscription-health', authMiddleware, getSubscriptionHealth);

export default router;
