import { Router } from 'express';
import * as voiceController from '../controllers/voice.controller.js';
import { uploadAudio } from '../middleware/upload.middleware.js';

const router = Router();

// Transcribe audio
router.post('/transcribe', uploadAudio, voiceController.transcribeAudio);

// Synthesize speech
router.post('/synthesize', voiceController.synthesizeSpeech);

export default router;
