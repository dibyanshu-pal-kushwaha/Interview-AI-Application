import { Router } from 'express';
import * as resumeController from '../controllers/resume.controller.js';
import { uploadResumeForAnalysis } from '../middleware/upload.middleware.js';

const router = Router();

// Analyze resume against JD
router.post('/analyze', uploadResumeForAnalysis, resumeController.analyzeResume);

export default router;
