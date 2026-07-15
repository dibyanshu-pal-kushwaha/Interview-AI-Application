import prisma from "../lib/prisma.js";
import { parseResumePDF } from "./resume.service.js";
import { generateQuestions } from "./question.service.js";
import { scoreAnswer } from "./scoring.service.js";
import { AppError, InterviewReport, QuestionResult } from "../types/index.js";
import groq from "../lib/groq.js";

export async function createInterview(
  jobDescription: string,
  jobRole: string,
  resumeFilePath: string,
  resumeFileName: string
): Promise<{
  interview: Record<string, unknown>;
  questionsCount: number;
}> {
  // Step 1: Parse resume PDF
  const parsedText = await parseResumePDF(resumeFilePath);

  // Ensure a default user exists since Resume requires a userId
  const defaultUser = await prisma.user.upsert({
    where: { email: 'guest@example.com' },
    update: {},
    create: {
      email: 'guest@example.com',
      passwordHash: 'guest_hash',
      fullName: 'Guest User',
    }
  });

  // Step 2: Store resume
  const resume = await prisma.resume.create({
    data: {
      fileName: resumeFileName,
      fileUrl: resumeFilePath,
      parsedText,
      isPrimary: true,
      userId: defaultUser.id,
    },
  });

  // Step 3: Generate questions using AI
  const generatedQuestions = await generateQuestions(parsedText, jobDescription, jobRole);

  // Step 4: Create interview and store questions in a transaction
  const interview = await prisma.$transaction(async (tx) => {
    // Create the interview
    const newInterview = await tx.interview.create({
      data: {
        title: `${jobRole} Interview`,
        jobDescription,
        jobRole,
        status: "created",
        metadata: {
          resumeId: resume.id,
          resumeFileName: resumeFileName,
          questionsGenerated: generatedQuestions.length,
        },
      },
    });

    // Create questions and link them to the interview
    for (let i = 0; i < generatedQuestions.length; i++) {
      const q = generatedQuestions[i];

      const question = await tx.question.create({
        data: {
          title: q.title,
          description: q.description,
          type: q.type,
          difficulty: q.difficulty,
          tags: q.tags,
          expectedAnswer: q.expectedAnswer,
          timeLimitSecs: q.timeLimitSecs,
          isActive: true,
        },
      });

      await tx.interviewQuestion.create({
        data: {
          interviewId: newInterview.id,
          questionId: question.id,
          orderIndex: i + 1,
        },
      });
    }

    return newInterview;
  });

  // Fetch the complete interview with questions
  const fullInterview = await prisma.interview.findUnique({
    where: { id: interview.id },
    include: {
      interviewQuestions: {
        include: {
          question: true,
        },
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  return {
    interview: fullInterview as unknown as Record<string, unknown>,
    questionsCount: generatedQuestions.length,
  };
}

export async function getInterview(interviewId: string) {
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: {
      interviewQuestions: {
        include: {
          question: true,
          answer: {
            include: {
              score: true,
            },
          },
        },
        orderBy: { orderIndex: "asc" },
      },
      result: true,
    },
  });

  if (!interview) {
    throw new AppError("Interview not found", 404);
  }

  return interview;
}

export async function submitAnswer(
  interviewId: string,
  interviewQuestionId: string,
  answerText: string,
  timeTakenSecs?: number
) {
  // Verify the interview question exists and belongs to this interview
  const interviewQuestion = await prisma.interviewQuestion.findFirst({
    where: {
      id: interviewQuestionId,
      interviewId,
    },
    include: {
      question: true,
      answer: true,
    },
  });

  if (!interviewQuestion) {
    throw new AppError("Interview question not found or does not belong to this interview", 404);
  }

  if (interviewQuestion.answer) {
    throw new AppError("This question has already been answered", 400);
  }

  // Update interview status to in_progress if it's still created
  await prisma.interview.update({
    where: { id: interviewId },
    data: {
      status: "in_progress",
      startedAt: new Date(),
    },
  });

  // Store the answer
  const answer = await prisma.answer.create({
    data: {
      interviewQuestionId,
      answerText,
      timeTakenSecs: timeTakenSecs || null,
      submittedAt: new Date(),
    },
  });

  // Score the answer asynchronously
  const scoreResult = await scoreAnswer(
    answerText,
    interviewQuestion.question.expectedAnswer || "",
    interviewQuestion.question.title,
    interviewQuestion.question.description
  );

  // Store the score
  const score = await prisma.score.create({
    data: {
      answerId: answer.id,
      bertScore: scoreResult.bertScore,
      semanticScore: scoreResult.semanticScore,
      keywordScore: scoreResult.keywordScore,
      llmScore: scoreResult.llmScore,
      overallScore: scoreResult.overallScore,
      feedback: scoreResult.feedback,
      criteria: scoreResult.criteria as Record<string, unknown>,
    },
  });

  // Check if all questions have been answered
  const totalQuestions = await prisma.interviewQuestion.count({
    where: { interviewId },
  });
  const answeredQuestions = await prisma.answer.count({
    where: {
      interviewQuestion: { interviewId },
    },
  });

  let interviewCompleted = false;
  if (answeredQuestions >= totalQuestions) {
    // Auto-complete interview and generate report
    await prisma.interview.update({
      where: { id: interviewId },
      data: {
        status: "completed",
        completedAt: new Date(),
      },
    });
    interviewCompleted = true;

    // Generate report in background (non-blocking)
    generateAndStoreReport(interviewId).catch((err) =>
      console.error("Error generating report:", err)
    );
  }

  return {
    answer: {
      ...answer,
      score,
    },
    interviewCompleted,
    progress: {
      answered: answeredQuestions,
      total: totalQuestions,
    },
  };
}

export async function getReport(interviewId: string): Promise<InterviewReport> {
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: {
      interviewQuestions: {
        include: {
          question: true,
          answer: {
            include: { score: true },
          },
        },
        orderBy: { orderIndex: "asc" },
      },
      result: true,
    },
  });

  if (!interview) {
    throw new AppError("Interview not found", 404);
  }

  // If result already exists, return it
  if (interview.result) {
    const questionResults: QuestionResult[] = interview.interviewQuestions.map((iq) => ({
      questionId: iq.question.id,
      title: iq.question.title,
      description: iq.question.description,
      type: iq.question.type,
      difficulty: iq.question.difficulty,
      orderIndex: iq.orderIndex,
      answerText: iq.answer?.answerText || null,
      timeTakenSecs: iq.answer?.timeTakenSecs || null,
      score: iq.answer?.score
        ? {
            bertScore: iq.answer.score.bertScore,
            semanticScore: iq.answer.score.semanticScore,
            keywordScore: iq.answer.score.keywordScore,
            llmScore: iq.answer.score.llmScore,
            overallScore: iq.answer.score.overallScore,
            feedback: iq.answer.score.feedback,
          }
        : null,
    }));

    return {
      interviewId: interview.id,
      title: interview.title,
      jobRole: interview.jobRole,
      status: interview.status,
      overallScore: interview.result.overallScore,
      recommendation: interview.result.recommendation || "",
      summary: interview.result.summary || "",
      strengths: (interview.result.strengths as string[]) || [],
      weaknesses: (interview.result.weaknesses as string[]) || [],
      scoreBreakdown: (interview.result.scoreBreakdown as Record<string, unknown>) || {},
      questionResults,
      startedAt: interview.startedAt,
      completedAt: interview.completedAt,
    };
  }

  // Generate report on the fly if not yet generated
  return await generateAndStoreReport(interviewId);
}

async function generateAndStoreReport(interviewId: string): Promise<InterviewReport> {
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: {
      interviewQuestions: {
        include: {
          question: true,
          answer: {
            include: { score: true },
          },
        },
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  if (!interview) {
    throw new AppError("Interview not found", 404);
  }

  // Calculate aggregate scores
  const scores = interview.interviewQuestions
    .filter((iq) => iq.answer?.score)
    .map((iq) => iq.answer!.score!);

  const overallScore =
    scores.length > 0
      ? Math.round(
          (scores.reduce((sum, s) => sum + s.overallScore, 0) / scores.length) * 100
        ) / 100
      : 0;

  const avgBertScore =
    scores.length > 0
      ? scores.reduce((sum, s) => sum + (s.bertScore || 0), 0) / scores.length
      : 0;
  const avgSemanticScore =
    scores.length > 0
      ? scores.reduce((sum, s) => sum + (s.semanticScore || 0), 0) / scores.length
      : 0;
  const avgKeywordScore =
    scores.length > 0
      ? scores.reduce((sum, s) => sum + (s.keywordScore || 0), 0) / scores.length
      : 0;
  const avgLlmScore =
    scores.length > 0
      ? scores.reduce((sum, s) => sum + (s.llmScore || 0), 0) / scores.length
      : 0;

  const scoreBreakdown = {
    averageBertScore: Math.round(avgBertScore * 100) / 100,
    averageSemanticScore: Math.round(avgSemanticScore * 100) / 100,
    averageKeywordScore: Math.round(avgKeywordScore * 100) / 100,
    averageLlmScore: Math.round(avgLlmScore * 100) / 100,
    totalQuestionsAnswered: scores.length,
    totalQuestions: interview.interviewQuestions.length,
    byType: calculateScoresByType(interview.interviewQuestions),
    byDifficulty: calculateScoresByDifficulty(interview.interviewQuestions),
  };

  // Generate AI summary
  const aiSummary = await generateAISummary(interview, overallScore, scoreBreakdown);

  // Store the result
  const result = await prisma.interviewResult.upsert({
    where: { interviewId },
    create: {
      interviewId,
      overallScore,
      recommendation: aiSummary.recommendation,
      summary: aiSummary.summary,
      strengths: aiSummary.strengths,
      weaknesses: aiSummary.weaknesses,
      scoreBreakdown: {
        ...scoreBreakdown,
        missedAreas: aiSummary.missedAreas,
        tips: aiSummary.tips,
        speakingFlaws: aiSummary.speakingFlaws,
      },
    },
    update: {
      overallScore,
      recommendation: aiSummary.recommendation,
      summary: aiSummary.summary,
      strengths: aiSummary.strengths,
      weaknesses: aiSummary.weaknesses,
      scoreBreakdown: {
        ...scoreBreakdown,
        missedAreas: aiSummary.missedAreas,
        tips: aiSummary.tips,
        speakingFlaws: aiSummary.speakingFlaws,
      },
    },
  });

  const questionResults: QuestionResult[] = interview.interviewQuestions.map((iq) => ({
    questionId: iq.question.id,
    title: iq.question.title,
    description: iq.question.description,
    type: iq.question.type,
    difficulty: iq.question.difficulty,
    orderIndex: iq.orderIndex,
    answerText: iq.answer?.answerText || null,
    timeTakenSecs: iq.answer?.timeTakenSecs || null,
    score: iq.answer?.score
      ? {
          bertScore: iq.answer.score.bertScore,
          semanticScore: iq.answer.score.semanticScore,
          keywordScore: iq.answer.score.keywordScore,
          llmScore: iq.answer.score.llmScore,
          overallScore: iq.answer.score.overallScore,
          feedback: iq.answer.score.feedback,
        }
      : null,
  }));

  return {
    interviewId: interview.id,
    title: interview.title,
    jobRole: interview.jobRole,
    status: interview.status,
    overallScore: result.overallScore,
    recommendation: result.recommendation || "",
    summary: result.summary || "",
    strengths: (result.strengths as string[]) || [],
    weaknesses: (result.weaknesses as string[]) || [],
    scoreBreakdown: result.scoreBreakdown as Record<string, unknown>,
    questionResults,
    startedAt: interview.startedAt,
    completedAt: interview.completedAt,
  };
}

function calculateScoresByType(
  interviewQuestions: Array<{
    question: { type: string };
    answer: { score: { overallScore: number } | null } | null;
  }>
): Record<string, { average: number; count: number }> {
  const byType: Record<string, { total: number; count: number }> = {};

  for (const iq of interviewQuestions) {
    if (!iq.answer?.score) continue;
    const type = iq.question.type;
    if (!byType[type]) {
      byType[type] = { total: 0, count: 0 };
    }
    byType[type].total += iq.answer.score.overallScore;
    byType[type].count++;
  }

  const result: Record<string, { average: number; count: number }> = {};
  for (const [type, data] of Object.entries(byType)) {
    result[type] = {
      average: Math.round((data.total / data.count) * 100) / 100,
      count: data.count,
    };
  }
  return result;
}

function calculateScoresByDifficulty(
  interviewQuestions: Array<{
    question: { difficulty: string };
    answer: { score: { overallScore: number } | null } | null;
  }>
): Record<string, { average: number; count: number }> {
  const byDifficulty: Record<string, { total: number; count: number }> = {};

  for (const iq of interviewQuestions) {
    if (!iq.answer?.score) continue;
    const diff = iq.question.difficulty;
    if (!byDifficulty[diff]) {
      byDifficulty[diff] = { total: 0, count: 0 };
    }
    byDifficulty[diff].total += iq.answer.score.overallScore;
    byDifficulty[diff].count++;
  }

  const result: Record<string, { average: number; count: number }> = {};
  for (const [diff, data] of Object.entries(byDifficulty)) {
    result[diff] = {
      average: Math.round((data.total / data.count) * 100) / 100,
      count: data.count,
    };
  }
  return result;
}

async function generateAISummary(
  interview: {
    jobRole: string;
    interviewQuestions: Array<{
      question: { title: string; type: string; difficulty: string };
      answer: {
        answerText: string | null;
        score: { overallScore: number; feedback: string | null } | null;
      } | null;
    }>;
  },
  overallScore: number,
  scoreBreakdown: Record<string, unknown>
): Promise<{
  recommendation: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  missedAreas: string[];
  tips: string[];
  speakingFlaws: string[];
}> {
  const questionsAndScores = interview.interviewQuestions
    .filter((iq) => iq.answer?.score)
    .map((iq) => ({
      question: iq.question.title,
      type: iq.question.type,
      difficulty: iq.question.difficulty,
      score: iq.answer!.score!.overallScore,
      feedback: iq.answer!.score!.feedback,
      transcribedAnswer: iq.answer!.answerText,
    }));

  const prompt = `You are a senior hiring manager. Based on the following interview performance data, provide a comprehensive evaluation.

## Role: ${interview.jobRole}
## Overall Score: ${overallScore}/100
## Score Breakdown: ${JSON.stringify(scoreBreakdown)}

## Question Performance & Transcripts:
${questionsAndScores
  .map(
    (q, i) =>
      `${i + 1}. [${q.type}/${q.difficulty}] ${q.question} - Score: ${q.score}/100\nCandidate Answer: "${q.transcribedAnswer}"`
  )
  .join("\n\n")}

Provide your evaluation as a JSON object:
{
  "recommendation": "<one of: Strong Hire, Hire, Lean Hire, Lean No Hire, No Hire>",
  "summary": "<3-5 sentence comprehensive summary of the candidate's performance>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "weaknesses": ["<weakness 1>", "<weakness 2>", "<weakness 3>"],
  "missedAreas": ["<topic 1 completely missed>", "<topic 2 lagged>"],
  "tips": ["<actionable tip 1 for next interview>", "<tip 2>"],
  "speakingFlaws": ["<analysis of communication style, e.g. rambling, hesitation, filler words based on transcript>"]
}

Base the recommendation on:
- 80-100: Strong Hire
- 65-79: Hire
- 50-64: Lean Hire
- 35-49: Lean No Hire
- 0-34: No Hire

Return ONLY the JSON object.`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      max_tokens: 1500,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("No response from AI");

    return JSON.parse(content);
  } catch (error) {
    console.error("AI summary generation error:", error);
    // Fallback summary
    let recommendation = "Lean No Hire";
    if (overallScore >= 80) recommendation = "Strong Hire";
    else if (overallScore >= 65) recommendation = "Hire";
    else if (overallScore >= 50) recommendation = "Lean Hire";
    else if (overallScore >= 35) recommendation = "Lean No Hire";
    else recommendation = "No Hire";

    return {
      recommendation,
      summary: `The candidate scored ${overallScore}/100 overall for the ${interview.jobRole} position.`,
      strengths: ["Completed the interview"],
      weaknesses: ["Detailed analysis unavailable"],
      missedAreas: [],
      tips: ["Practice answering technical questions more clearly."],
      speakingFlaws: [],
    };
  }
}
