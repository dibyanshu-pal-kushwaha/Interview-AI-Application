import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import fs from "fs";
import { mlClient } from "../services/ml-client.service.js";
import { AppError } from "../types/index.js";

const synthesizeSchema = z.object({
  text: z.string().min(1, "Text is required for synthesis"),
  voice: z.string().optional().default("default"),
});

export async function transcribeAudio(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.file) {
      throw new AppError("Audio file is required", 400);
    }

    const audioBuffer = fs.readFileSync(req.file.path);
    const result = await mlClient.transcribeAudio(audioBuffer, req.file.mimetype);

    // Clean up the uploaded file after transcription
    fs.unlink(req.file.path, (err) => {
      if (err) console.error("Error cleaning up audio file:", err);
    });

    if (!result.text) {
      throw new AppError("Failed to transcribe audio. The ML service may be unavailable.", 503);
    }

    res.json({
      success: true,
      message: "Audio transcribed successfully",
      data: {
        text: result.text,
        confidence: result.confidence,
        duration: result.duration,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function synthesizeSpeech(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = synthesizeSchema.parse(req.body);

    const result = await mlClient.synthesizeSpeech(parsed.text, parsed.voice);

    if (!result.audio_url) {
      throw new AppError("Failed to synthesize speech. The ML service may be unavailable.", 503);
    }

    res.json({
      success: true,
      message: "Speech synthesized successfully",
      data: {
        audioUrl: result.audio_url,
        duration: result.duration,
      },
    });
  } catch (error) {
    next(error);
  }
}
