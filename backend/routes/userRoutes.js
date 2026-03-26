import express from 'express';
import multer from 'multer';
import { getUser, getAllUsers, getRole, getRoleByEmail, whoAmI, updatePermissions, updateUserName, updateUserAvatar } from "../controller/userController.js"
import { authMiddleware } from "../middleware/auth.js";
import {
  listUserEvents,
  createUserEvent,
  updateUserEvent,
  uploadUserEventImage,
  deleteEvent,
  restoreEvent,
  listArchivedEvents
} from "../controller/adminEventController.js";
import { 
  submitSupportTicket, 
  getAdminSupportTickets, 
  getMySupportTickets,
  getArchivedSupportTickets,
  resolveSupportTicket,
  replyToSupportTicket,
  getSupportMessages,
  getAllSupportMessages,
  submitContactForm,
  bulkArchiveSupportTickets,
  bulkDeleteSupportTickets,
  bulkRestoreSupportTickets
} from "../controller/supportController.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/user', authMiddleware, getUser);
router.get('/users/all', authMiddleware, getAllUsers);
router.get('/whoAmI', authMiddleware, whoAmI);
router.get('/user/role', authMiddleware, getRole);
router.get('/role-by-email', getRoleByEmail);
// Alias to match frontend path /api/user/role-by-email
router.get('/user/role-by-email', getRoleByEmail);
router.put('/users/:id/permissions', authMiddleware, updatePermissions);
router.patch('/user/name', authMiddleware, updateUserName);
router.post('/user/avatar', authMiddleware, upload.single('image'), updateUserAvatar);

// ─── User events (only events created by this user) ───
router.post('/user/events', authMiddleware, createUserEvent);
router.get('/user/events', authMiddleware, listUserEvents);
router.put('/user/events/:id', authMiddleware, updateUserEvent);
router.post('/user/events/image', authMiddleware, upload.single('image'), uploadUserEventImage);
router.post('/user/events/:id/image', authMiddleware, upload.single('image'), (req, _res, next) => {
  req.body.eventId = req.params.id;
  next();
}, uploadUserEventImage);

// ─── Archive system for organizers ───
// DELETE /user/events/:id - Archive (soft delete) event
router.delete('/user/events/:id', authMiddleware, deleteEvent);

// GET /user/events/archived - List archived events
router.get('/user/events/archived', authMiddleware, listArchivedEvents);

// POST /user/events/:id/restore - Restore archived event
router.post('/user/events/:id/restore', authMiddleware, restoreEvent);

// ─── Support System ───
router.post('/user/support', authMiddleware, submitSupportTicket);
router.get('/user/support/history', authMiddleware, getMySupportTickets);
router.get('/admin/support/messages', authMiddleware, getAdminSupportTickets);
router.get('/admin/support/all-messages', authMiddleware, getAllSupportMessages);
router.post('/admin/support/:id/resolve', authMiddleware, resolveSupportTicket);
router.post('/admin/support/:id/reply', authMiddleware, replyToSupportTicket);
router.get('/support/:id/messages', authMiddleware, getSupportMessages);
router.post('/contact', submitContactForm);
router.post('/user/support/bulk-archive', authMiddleware, bulkArchiveSupportTickets);
router.post('/user/support/bulk-delete', authMiddleware, bulkDeleteSupportTickets);
router.get('/user/support/archived', authMiddleware, getArchivedSupportTickets);
router.post('/user/support/bulk-restore', authMiddleware, bulkRestoreSupportTickets);

export default router;
