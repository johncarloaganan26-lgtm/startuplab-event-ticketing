import express from 'express';
import {
  getSummary,
  getRecentTransactions,
  getRecentOrders,
  getAuditLogs,
  getTransactionDetail,
  getOrderDetail,
  getAuditLogDetail
} from '../controller/analyticsController.js';
import {authMiddleware} from '../middleware/auth.js';
const router = express.Router();

router.get('/analytics/summary',authMiddleware, getSummary);
router.get('/analytics/transactions', authMiddleware, getRecentTransactions);
router.get('/analytics/transactions/:orderId', authMiddleware, getTransactionDetail);
router.get('/analytics/orders', authMiddleware, getRecentOrders);
router.get('/analytics/orders/:orderId', authMiddleware, getOrderDetail);
router.get('/analytics/audit-logs', authMiddleware, getAuditLogs);
router.get('/analytics/audit-logs/:auditLogId', authMiddleware, getAuditLogDetail);

export default router;
