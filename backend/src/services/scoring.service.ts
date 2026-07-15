import groq from "../lib/groq.js";
import { mlClient } from "./ml-client.service.js";
import { ScoreResult, AppError } from "../types/index.js";

const WEIGHTS = {
  bert: 0.30,
  semantic: 0.25,
  keyword: 0.20,
  llm: 0.25,
};

export async function scoreAnswer(
  answerText: string,
  expectedAnswer: string,
  questionTitle: string,
  questionDescription: string
): Promise<ScoreResult> {
  if (!answerText || answerText.trim().length === 0) {
    return {
      bertScore: 0,
      semanticScore: 0,
      keywordScore: 0,
      llmScore: 0,
      overallScore: 0,
      feedback: "No answer was provided.",
      criteria: { answered: false },
    };
  }

  // Run ML scoring and LLM scoring in parallel
  const [mlScores, llmResult] = await Promise.all([
    getMLScores(answerText, expectedAnswer),
    getLLMScore(answerText, expectedAnswer, questionTitle, questionDescription),
  ]);

  // Calculate weighted overall score
  const overallScore = calculateWeightedScore(
    mlScores.bertScore,
    mlScores.semanticScore,
    mlScores.keywordScore,
    llmResult.score
  );

  return {
    bertScore: mlScores.bertScore,
    semanticScore: mlScores.semanticScore,
    keywordScore: mlScores.keywordScore,
    llmScore: llmResult.score,
    overallScore: Math.round(overallScore * 100) / 100,
    feedback: llmResult.feedback,
    criteria: {
      bertScore: { value: mlScores.bertScore, weight: WEIGHTS.bert },
      semanticScore: { value: mlScores.semanticScore, weight: WEIGHTS.semantic },
      keywordScore: { value: mlScores.keywordScore, weight: WEIGHTS.keyword },
      llmScore: { value: llmResult.score, weight: WEIGHTS.llm },
      mlServiceAvailable: mlScores.available,
    },
  };
}

async function getMLScores(
  candidate: string,
  reference: string
): Promise<{
  bertScore: number;
  semanticScore: number;
  keywordScore: number;
  available: boolean;
}> {
  try {
    const hybridResult = await mlClient.getHybridScore(candidate, reference);

    if (
      hybridResult.bert_score === 0 &&
      hybridResult.semantic_score === 0 &&
      hybridResult.keyword_score === 0
    ) {
      // ML service is likely unavailable; fall back to basic scoring
      return {
        bertScore: computeBasicSimilarity(candidate, reference),
        semanticScore: computeBasicSimilarity(candidate, reference),
        keywordScore: computeKeywordOverlap(candidate, reference),
        available: false,
      };
    }

    return {
      bertScore: normalizeScore(hybridResult.bert_score),
      semanticScore: normalizeScore(hybridResult.semantic_score),
      keywordScore: normalizeScore(hybridResult.keyword_score),
      available: true,
    };
  } catch (error) {
    console.warn("ML service unavailable, using fallback scoring:", error);
    return {
      bertScore: computeBasicSimilarity(candidate, reference),
      semanticScore: computeBasicSimilarity(candidate, reference),
      keywordScore: computeKeywordOverlap(candidate, reference),
      available: false,
    };
  }
}

async function getLLMScore(
  answerText: string,
  expectedAnswer: string,
  questionTitle: string,
  questionDescription: string
): Promise<{ score: number; feedback: string }> {
  const prompt = `You are an expert interviewer evaluating a candidate's answer. Score the answer and provide constructive feedback.

## Question:
Title: ${questionTitle}
Description: ${questionDescription}

## Expected Answer (Key Points):
${expectedAnswer}

## Candidate's Answer:
${answerText}

Evaluate the answer on these criteria:
1. **Correctness** (0-100): Is the answer factually correct?
2. **Completeness** (0-100): Does it cover all key points from the expected answer?
3. **Clarity** (0-100): Is the answer well-structured and clear?
4. **Depth** (0-100): Does it show deep understanding beyond surface level?
5. **Relevance** (0-100): Does it directly address the question asked?

Provide your evaluation as a JSON object:
{
  "score": <overall score 0-100, weighted average of criteria>,
  "feedback": "<2-4 sentences of constructive feedback highlighting strengths and areas for improvement>",
  "criteria": {
    "correctness": <0-100>,
    "completeness": <0-100>,
    "clarity": <0-100>,
    "depth": <0-100>,
    "relevance": <0-100>
  }
}

Return ONLY the JSON object.`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
      max_tokens: 800,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content in LLM response");
    }

    const result = JSON.parse(content);
    return {
      score: Math.min(100, Math.max(0, result.score || 0)),
      feedback: result.feedback || "Unable to generate detailed feedback.",
    };
  } catch (error) {
    console.error("LLM scoring error:", error);
    // Fallback: give a neutral score with generic feedback
    return {
      score: 50,
      feedback: "Automated scoring encountered an issue. Your answer has been recorded for manual review.",
    };
  }
}

function calculateWeightedScore(
  bertScore: number,
  semanticScore: number,
  keywordScore: number,
  llmScore: number
): number {
  return (
    bertScore * WEIGHTS.bert +
    semanticScore * WEIGHTS.semantic +
    keywordScore * WEIGHTS.keyword +
    llmScore * WEIGHTS.llm
  );
}

function normalizeScore(score: number): number {
  // Ensure score is between 0 and 100
  return Math.min(100, Math.max(0, score * 100));
}

function computeBasicSimilarity(candidate: string, reference: string): number {
  const candidateWords = new Set(candidate.toLowerCase().split(/\s+/));
  const referenceWords = new Set(reference.toLowerCase().split(/\s+/));

  let intersection = 0;
  for (const word of candidateWords) {
    if (referenceWords.has(word)) {
      intersection++;
    }
  }

  const union = new Set([...candidateWords, ...referenceWords]).size;
  if (union === 0) return 0;

  // Jaccard similarity scaled to 0-100
  return Math.round((intersection / union) * 100);
}

function computeKeywordOverlap(candidate: string, reference: string): number {
  // Extract meaningful keywords (filter out common stop words)
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "dare", "ought",
    "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
    "as", "into", "through", "during", "before", "after", "above", "below",
    "between", "out", "off", "over", "under", "again", "further", "then",
    "once", "and", "but", "or", "nor", "not", "so", "yet", "both",
    "either", "neither", "each", "every", "all", "any", "few", "more",
    "most", "other", "some", "such", "no", "only", "own", "same", "than",
    "too", "very", "just", "because", "if", "when", "where", "how",
    "what", "which", "who", "whom", "this", "that", "these", "those",
    "i", "me", "my", "we", "our", "you", "your", "he", "him", "his",
    "she", "her", "it", "its", "they", "them", "their",
  ]);

  const extractKeywords = (text: string): Set<string> => {
    return new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 2 && !stopWords.has(word))
    );
  };

  const candidateKeywords = extractKeywords(candidate);
  const referenceKeywords = extractKeywords(reference);

  if (referenceKeywords.size === 0) return 0;

  let matches = 0;
  for (const keyword of referenceKeywords) {
    if (candidateKeywords.has(keyword)) {
      matches++;
    }
  }

  return Math.round((matches / referenceKeywords.size) * 100);
}
