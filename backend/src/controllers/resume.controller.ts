import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { parseResumePDF, analyzeResumeVsJD } from "../services/resume.service.js";
import { AppError } from "../types/index.js";

const analyzeSchema = z.object({
  jobDescription: z.string().min(10, "Job description must be at least 10 characters"),
});

export async function analyzeResume(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.file) {
      throw new AppError("Resume PDF file is required", 400);
    }

    const parsed = analyzeSchema.parse(req.body);

    // Parse the resume PDF
    const resumeText = await parseResumePDF(req.file.path);

    // Analyze resume against JD
    const analysis = await analyzeResumeVsJD(resumeText, parsed.jobDescription);

    res.json({
      success: true,
      message: "Resume analyzed successfully",
      data: {
        resumeText: resumeText.substring(0, 500) + (resumeText.length > 500 ? "..." : ""),
        analysis,
      },
    });
  } catch (error) {
    next(error);
  }
}
