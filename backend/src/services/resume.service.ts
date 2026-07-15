import fs from "fs";
import pdfParse from "pdf-parse";
import groq from "../lib/groq.js";
import { ResumeAnalysis, AppError } from "../types/index.js";

export async function parseResumePDF(filePath: string): Promise<string> {
  try {
    const buffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(buffer);

    if (!pdfData.text || pdfData.text.trim().length === 0) {
      throw new AppError("Could not extract text from the PDF. The file may be image-based or corrupted.", 400);
    }

    return pdfData.text.trim();
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error("PDF parsing error:", error);
    throw new AppError("Failed to parse resume PDF", 500);
  }
}

export async function parseResumeFromBuffer(buffer: Buffer): Promise<string> {
  try {
    const pdfData = await pdfParse(buffer);

    if (!pdfData.text || pdfData.text.trim().length === 0) {
      throw new AppError("Could not extract text from the PDF.", 400);
    }

    return pdfData.text.trim();
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error("PDF parsing error:", error);
    throw new AppError("Failed to parse resume PDF", 500);
  }
}

export async function analyzeResumeVsJD(
  resumeText: string,
  jdText: string
): Promise<ResumeAnalysis> {
  const prompt = `You are an expert ATS (Applicant Tracking System) analyzer and career consultant. Analyze the following resume against the job description and provide a detailed compatibility assessment.

## Resume:
${resumeText}

## Job Description:
${jdText}

Provide your analysis as a JSON object with exactly this structure:
{
  "overallScore": <number 0-100>,
  "matchPercentage": <number 0-100>,
  "strengths": ["<strength 1>", "<strength 2>", ...],
  "weaknesses": ["<weakness 1>", "<weakness 2>", ...],
  "missingKeywords": ["<keyword 1>", "<keyword 2>", ...],
  "suggestions": ["<suggestion 1>", "<suggestion 2>", ...],
  "categoryScores": {
    "skills": <number 0-100>,
    "experience": <number 0-100>,
    "education": <number 0-100>,
    "formatting": <number 0-100>
  }
}

Scoring criteria:
- Skills match: How well the candidate's skills match the requirements
- Experience relevance: How relevant the candidate's experience is
- Education fit: How well education aligns with requirements
- Formatting: How ATS-friendly the resume format is
- Missing keywords: Important JD keywords not found in resume

Be thorough and specific. Return ONLY the JSON object, no markdown formatting or explanation.`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new AppError("Failed to get analysis from AI", 500);
    }

    const analysis: ResumeAnalysis = JSON.parse(content);

    // Validate and clamp scores
    analysis.overallScore = Math.min(100, Math.max(0, analysis.overallScore || 0));
    analysis.matchPercentage = Math.min(100, Math.max(0, analysis.matchPercentage || 0));
    analysis.strengths = analysis.strengths || [];
    analysis.weaknesses = analysis.weaknesses || [];
    analysis.missingKeywords = analysis.missingKeywords || [];
    analysis.suggestions = analysis.suggestions || [];
    analysis.categoryScores = {
      skills: Math.min(100, Math.max(0, analysis.categoryScores?.skills || 0)),
      experience: Math.min(100, Math.max(0, analysis.categoryScores?.experience || 0)),
      education: Math.min(100, Math.max(0, analysis.categoryScores?.education || 0)),
      formatting: Math.min(100, Math.max(0, analysis.categoryScores?.formatting || 0)),
    };

    return analysis;
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error("Resume analysis error:", error);
    throw new AppError("Failed to analyze resume against job description", 500);
  }
}
