import { Router } from 'express';
import * as interviewController from '../controllers/interview.controller.js';
import { uploadResume, uploadAudio } from '../middleware/upload.middleware.js';

const router = Router();

// Create interview with resume and job description
router.post('/', uploadResume, interviewController.createInterview);

// Get interview by ID
router.get('/:id', interviewController.getInterview);

// Submit answer (text or audio file)
router.post('/:id/answer', uploadAudio, interviewController.submitAnswer);

// Get interview report
router.get('/:id/report', interviewController.getReport);

export default router;
