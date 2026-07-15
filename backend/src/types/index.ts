export interface CreateInterviewRequest {
  jobDescription: string;
  jobRole: string;
  resumeFile?: Express.Multer.File;
}

export interface SubmitAnswerRequest {
  interviewQuestionId: string;
  answerText?: string;
  timeTakenSecs?: number;
  answerAudioFile?: Express.Multer.File;
}

export interface GeneratedQuestion {
  title: string;
  description: string;
  type: "technical" | "behavioral" | "coding" | "system_design";
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
  expectedAnswer: string;
  timeLimitSecs: number;
}

export interface ScoreResult {
  bertScore: number | null;
  semanticScore: number | null;
  keywordScore: number | null;
  llmScore: number | null;
  overallScore: number;
  feedback: string;
  criteria: Record<string, unknown>;
}

export interface MLHybridScoreResponse {
  bert_score: number;
  semantic_score: number;
  keyword_score: number;
  overall_score: number;
}

export interface MLTranscriptionResponse {
  text: string;
  confidence: number;
  duration: number;
}

export interface MLSynthesisResponse {
  audio_url: string;
  duration: number;
}

export interface ResumeAnalysis {
  overallScore: number;
  matchPercentage: number;
  strengths: string[];
  weaknesses: string[];
  missingKeywords: string[];
  suggestions: string[];
  categoryScores: {
    skills: number;
    experience: number;
    education: number;
    formatting: number;
  };
}

export interface InterviewReport {
  interviewId: string;
  title: string;
  jobRole: string;
  status: string;
  overallScore: number;
  recommendation: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  scoreBreakdown: Record<string, unknown>;
  questionResults: QuestionResult[];
  startedAt: Date | null;
  completedAt: Date | null;
}

export interface QuestionResult {
  questionId: string;
  title: string;
  description: string;
  type: string;
  difficulty: string;
  orderIndex: number;
  answerText: string | null;
  timeTakenSecs: number | null;
  score: {
    bertScore: number | null;
    semanticScore: number | null;
    keywordScore: number | null;
    llmScore: number | null;
    overallScore: number;
    feedback: string | null;
  } | null;
}

export interface DashboardStats {
  totalInterviews: number;
  completedInterviews: number;
  averageScore: number;
  topScore: number;
  totalQuestionsAnswered: number;
  scoreDistribution: {
    excellent: number;
    good: number;
    average: number;
    belowAverage: number;
  };
}

export interface InterviewHistoryItem {
  id: string;
  title: string;
  jobRole: string;
  status: string;
  overallScore: number | null;
  questionsCount: number;
  answeredCount: number;
  createdAt: Date;
  completedAt: Date | null;
}

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
