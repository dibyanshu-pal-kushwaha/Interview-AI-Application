from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os

from routers import transcription, synthesis, scoring, analysis
from services.semantic_service import semantic_service
from services.bert_score_service import bert_score_service

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load ML models on startup
    print("Loading ML models...")
    try:
        print("ML models will be lazy-loaded on first request.")
    except Exception as e:
        print(f"Error loading models: {e}")
    yield
    print("Shutting down ML models...")

app = FastAPI(title="ML Microservice for AI Interview App", lifespan=lifespan)

# Allow CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:4000", os.getenv("FRONTEND_URL", "*")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(transcription.router, tags=["Transcription"])
app.include_router(synthesis.router, tags=["Synthesis"])
app.include_router(scoring.router, tags=["Scoring"])
app.include_router(analysis.router, tags=["Analysis"])

@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "ml-service"}
