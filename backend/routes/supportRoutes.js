import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  submitSupportTicket,
  submitContactForm,
  getMySupportTickets,
  getArchivedSupportTickets,
  getAdminSupportTickets,
  resolveSupportTicket,
  replyToSupportTicket,
  getSupportMessages,
  bulkArchiveSupportTickets,
  bulkDeleteSupportTickets,
  bulkRestoreSupportTickets,
} from '../controller/supportController.js';

const router = express.Router();

// Public: Guest contact / feedback form (no auth required)
router.post('/support/contact', submitContactForm);

// Add image upload route
import multer from 'multer';
const upload = multer({ storage: multer.memoryStorage() });
import { uploadSupportImage } from '../controller/supportController.js';
router.post('/support/upload', upload.single('image'), uploadSupportImage);

// Authenticated: Organizer support tickets
router.post('/support/ticket', authMiddleware, submitSupportTicket);
router.get('/support/my-tickets', authMiddleware, getMySupportTickets);
router.get('/support/my-tickets/archived', authMiddleware, getArchivedSupportTickets);
router.post('/support/tickets/bulk-archive', authMiddleware, bulkArchiveSupportTickets);
router.post('/support/tickets/bulk-delete', authMiddleware, bulkDeleteSupportTickets);
router.post('/support/tickets/bulk-restore', authMiddleware, bulkRestoreSupportTickets);
router.post('/support/tickets/:id/reply', authMiddleware, replyToSupportTicket);
router.get('/support/tickets/:id/messages', authMiddleware, getSupportMessages);

// Admin: View and manage all tickets
router.get('/support/admin/tickets', authMiddleware, getAdminSupportTickets);
router.patch('/support/tickets/:id/resolve', authMiddleware, resolveSupportTicket);

export default router;
