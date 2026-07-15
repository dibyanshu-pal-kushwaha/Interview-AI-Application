import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller.js';

const router = Router();

// Get dashboard stats
router.get('/stats', dashboardController.getStats);

// Get interview history
router.get('/history', dashboardController.getHistory);

export default router;
