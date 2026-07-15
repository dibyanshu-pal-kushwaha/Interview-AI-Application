import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as interviewService from "../services/interview.service.js";
import { AppError } from "../types/index.js";

const createInterviewSchema = z.object({
  jobDescription: z.string().min(10, "Job description must be at least 10 characters"),
  jobRole: z.string().min(2, "Job role must be at least 2 characters"),
});

const submitAnswerSchema = z.object({
  interviewQuestionId: z.string().uuid("Invalid interview question ID"),
  answerText: z.string().min(1, "Answer text is required"),
  timeTakenSecs: z.number().int().positive().optional(),
});

export async function createInterview(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = createInterviewSchema.parse(req.body);

    if (!req.file) {
      throw new AppError("Resume PDF file is required", 400);
    }

    const result = await interviewService.createInterview(
      parsed.jobDescription,
      parsed.jobRole,
      req.file.path,
      req.file.originalname
    );

    res.status(201).json({
      success: true,
      message: "Interview created successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getInterview(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      throw new AppError("Interview ID is required", 400);
    }

    const interview = await interviewService.getInterview(id);

    res.json({
      success: true,
      data: interview,
    });
  } catch (error) {
    next(error);
  }
}

export async function submitAnswer(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      throw new AppError("Interview ID is required", 400);
    }

    const parsed = submitAnswerSchema.parse(req.body);

    const result = await interviewService.submitAnswer(
      id,
      parsed.interviewQuestionId,
      parsed.answerText,
      parsed.timeTakenSecs
    );

    res.json({
      success: true,
      message: result.interviewCompleted
        ? "Answer submitted. Interview completed!"
        : "Answer submitted and scored successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getReport(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      throw new AppError("Interview ID is required", 400);
    }

    const report = await interviewService.getReport(id);

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
}
