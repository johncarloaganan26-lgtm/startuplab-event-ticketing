
import express from 'express';
import { updateSmtpSettings, getSmtpSettings, testSmtpSettings } from '../controller/settingsController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// All settings routes require authentication
router.use(authMiddleware);

router.get('/smtp', getSmtpSettings);
router.post('/smtp', updateSmtpSettings);
router.post('/smtp/test', testSmtpSettings);

export default router;
