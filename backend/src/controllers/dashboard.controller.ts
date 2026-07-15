import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma.js";
import { DashboardStats, InterviewHistoryItem } from "../types/index.js";

export async function getStats(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Total interviews
    const totalInterviews = await prisma.interview.count();

    // Completed interviews
    const completedInterviews = await prisma.interview.count({
      where: { status: "completed" },
    });

    // Average score from interview results
    const scoreAgg = await prisma.interviewResult.aggregate({
      _avg: { overallScore: true },
      _max: { overallScore: true },
    });

    const averageScore = Math.round((scoreAgg._avg.overallScore || 0) * 100) / 100;
    const topScore = Math.round((scoreAgg._max.overallScore || 0) * 100) / 100;

    // Total questions answered
    const totalQuestionsAnswered = await prisma.answer.count();

    // Score distribution
    const allResults = await prisma.interviewResult.findMany({
      select: { overallScore: true },
    });

    const scoreDistribution = {
      excellent: 0, // 80-100
      good: 0, // 60-79
      average: 0, // 40-59
      belowAverage: 0, // 0-39
    };

    for (const result of allResults) {
      if (result.overallScore >= 80) scoreDistribution.excellent++;
      else if (result.overallScore >= 60) scoreDistribution.good++;
      else if (result.overallScore >= 40) scoreDistribution.average++;
      else scoreDistribution.belowAverage++;
    }

    const stats: DashboardStats = {
      totalInterviews,
      completedInterviews,
      averageScore,
      topScore,
      totalQuestionsAnswered,
      scoreDistribution,
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
}

export async function getHistory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const offset = (page - 1) * limit;

    const [interviews, total] = await Promise.all([
      prisma.interview.findMany({
        skip: offset,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          result: {
            select: { overallScore: true },
          },
          interviewQuestions: {
            select: {
              id: true,
              answer: {
                select: { id: true },
              },
            },
          },
        },
      }),
      prisma.interview.count(),
    ]);

    const history: InterviewHistoryItem[] = interviews.map((interview) => ({
      id: interview.id,
      title: interview.title,
      jobRole: interview.jobRole,
      status: interview.status,
      overallScore: interview.result?.overallScore || null,
      questionsCount: interview.interviewQuestions.length,
      answeredCount: interview.interviewQuestions.filter((iq) => iq.answer).length,
      createdAt: interview.createdAt,
      completedAt: interview.completedAt,
    }));

    res.json({
      success: true,
      data: {
        history,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}
