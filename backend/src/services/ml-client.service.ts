import axios, { AxiosInstance } from "axios";
import { MLHybridScoreResponse, MLTranscriptionResponse, MLSynthesisResponse } from "../types/index.js";

class MLClientService {
  private client: AxiosInstance;

  constructor() {
    const baseURL = process.env.ML_SERVICE_URL || "http://localhost:5000";
    this.client = axios.create({
      baseURL,
      timeout: 60000, // 60 second timeout for ML operations
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  async transcribeAudio(audioBuffer: Buffer, mimeType: string = "audio/wav"): Promise<MLTranscriptionResponse> {
    try {
      const formData = new FormData();
      const blob = new Blob([audioBuffer], { type: mimeType });
      formData.append("file", blob, "audio.wav");

      const response = await this.client.post<MLTranscriptionResponse>(
        "/transcribe",
        formData,
        {
          timeout: 120000,
        }
      );

      return response.data;
    } catch (error) {
      console.error("ML Service transcription error:", error);
      return {
        text: "",
        confidence: 0,
        duration: 0,
      };
    }
  }

  async synthesizeSpeech(text: string, voice: string = "default"): Promise<MLSynthesisResponse> {
    try {
      const response = await this.client.post<MLSynthesisResponse>(
        "/synthesize",
        { text, voice }
      );

      return response.data;
    } catch (error) {
      console.error("ML Service synthesis error:", error);
      return {
        audio_url: "",
        duration: 0,
      };
    }
  }

  async getBertScore(candidate: string, reference: string): Promise<number> {
    try {
      const response = await this.client.post<any>(
        "/score/bert",
        { candidate, reference }
      );
      return response.data.f1 || 0;
    } catch (error) {
      console.error("ML Service BERTScore error:", error);
      return 0;
    }
  }

  async getSemanticSimilarity(candidate: string, reference: string): Promise<number> {
    try {
      const response = await this.client.post<any>(
        "/score/semantic",
        { candidate, reference }
      );
      return response.data.similarity || 0;
    } catch (error) {
      console.error("ML Service semantic similarity error:", error);
      return 0;
    }
  }

  async getKeywordScore(candidate: string, reference: string): Promise<number> {
    try {
      const response = await this.client.post<any>(
        "/score/keywords",
        { candidate, reference }
      );
      return response.data.score || 0;
    } catch (error) {
      console.error("ML Service keyword score error:", error);
      return 0;
    }
  }

  async getHybridScore(candidate: string, reference: string): Promise<MLHybridScoreResponse> {
    try {
      // The Python ML service returns:
      // { total_score, breakdown: { bert, semantic, keywords, llm }, weights_used, feedback }
      const response = await this.client.post<any>(
        "/score/hybrid",
        { candidate, reference }
      );
      const data = response.data;
      return {
        bert_score: data.breakdown?.bert?.f1 || 0,
        semantic_score: data.breakdown?.semantic_similarity || 0,
        keyword_score: data.breakdown?.keyword_overlap?.score || 0,
        overall_score: data.total_score || 0,
      };
    } catch (error) {
      console.error("ML Service hybrid score error:", error);
      return {
        bert_score: 0,
        semantic_score: 0,
        keyword_score: 0,
        overall_score: 0,
      };
    }
  }
}

export const mlClient = new MLClientService();
