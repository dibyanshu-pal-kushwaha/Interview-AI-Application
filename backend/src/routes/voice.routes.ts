import { Router } from 'express';
import * as voiceController from '../controllers/voice.controller';
import { uploadAudio } from '../middleware/upload.middleware';

const router = Router();

// Transcribe audio
router.post('/transcribe', uploadAudio, voiceController.transcribeAudio);

// Synthesize speech
router.post('/synthesize', voiceController.synthesizeSpeech);

export default router;
