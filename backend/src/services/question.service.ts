import groq from "../lib/groq.js";
import { GeneratedQuestion, AppError } from "../types/index.js";

export async function generateQuestions(
  resumeText: string,
  jobDescription: string,
  jobRole: string
): Promise<GeneratedQuestion[]> {
  const prompt = `You are an expert technical interviewer. Generate a comprehensive set of interview questions for a candidate applying for the role of "${jobRole}".

## Candidate's Resume:
${resumeText.substring(0, 4000)}

## Job Description:
${jobDescription.substring(0, 3000)}

Generate exactly 25 diverse interview questions covering all of the following categories:

1. **Technical Questions (8 questions)**: Deep technical questions related to the skills mentioned in both the resume and JD. Include questions about specific technologies, frameworks, algorithms, and system concepts. Vary difficulty from easy to hard.

2. **Behavioral Questions (7 questions)**: Questions about past experiences, teamwork, conflict resolution, leadership, and problem-solving approaches. Use the STAR method framework. Include questions that probe soft skills relevant to the role.

3. **Coding Questions (5 questions)**: Practical coding challenges or algorithm problems relevant to the role. Include data structures, algorithms, and real-world coding scenarios. Provide clear problem statements.

4. **System Design Questions (5 questions)**: Questions about designing scalable systems, architecture decisions, trade-offs, and infrastructure planning relevant to the role level and JD.

For each question, provide a detailed expected answer that covers key points a strong candidate should mention.

Return your response as a JSON object with this exact structure:
{
  "questions": [
    {
      "title": "<short descriptive title>",
      "description": "<full question text with context>",
      "type": "<technical|behavioral|coding|system_design>",
      "difficulty": "<easy|medium|hard>",
      "tags": ["<tag1>", "<tag2>", "<tag3>"],
      "expectedAnswer": "<comprehensive expected answer covering key points>",
      "timeLimitSecs": <number: 60 for easy, 120 for medium, 180 for hard>
    }
  ]
}

Ensure questions are:
- Directly relevant to the candidate's background and the job requirements
- Progressively challenging within each category
- Specific enough to assess real competency, not generic
- Include expected answers that are detailed enough to evaluate responses

Return ONLY the JSON object.`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 8000,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new AppError("Failed to generate questions from AI", 500);
    }

    const parsed = JSON.parse(content);
    const questions: GeneratedQuestion[] = parsed.questions || parsed;

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new AppError("AI returned invalid question format", 500);
    }

    const validatedQuestions: GeneratedQuestion[] = questions.map((q: any, index) => ({
      title: q.title || `Question ${index + 1}`,
      description: q.description || q.question || "",
      type: validateQuestionType(q.type),
      difficulty: validateDifficulty(q.difficulty),
      tags: Array.isArray(q.tags) ? q.tags.slice(0, 5) : [],
      expectedAnswer: q.expectedAnswer || q.expected_answer || "",
      timeLimitSecs: validateTimeLimit(q.timeLimitSecs || q.time_limit_secs, q.difficulty),
    }));

    return validatedQuestions;
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error("Question generation error:", error);
    throw new AppError("Failed to generate interview questions", 500);
  }
}

function validateQuestionType(type: string): GeneratedQuestion["type"] {
  const validTypes = ["technical", "behavioral", "coding", "system_design"];
  if (validTypes.includes(type)) {
    return type as GeneratedQuestion["type"];
  }
  return "technical";
}

function validateDifficulty(difficulty: string): GeneratedQuestion["difficulty"] {
  const validDifficulties = ["easy", "medium", "hard"];
  if (validDifficulties.includes(difficulty)) {
    return difficulty as GeneratedQuestion["difficulty"];
  }
  return "medium";
}

function validateTimeLimit(timeLimit: number | undefined, difficulty: string): number {
  if (timeLimit && timeLimit > 0 && timeLimit <= 600) {
    return timeLimit;
  }
  switch (difficulty) {
    case "easy":
      return 60;
    case "hard":
      return 180;
    default:
      return 120;
  }
}
