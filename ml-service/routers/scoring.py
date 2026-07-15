"""
Scoring Router — BERTScore, Semantic, Keyword, and Hybrid scoring endpoints.

Provides multiple NLP-based evaluation endpoints for comparing candidate
answers against reference answers in the mock interview context.
"""

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.bert_score_service import bert_score_service
from services.semantic_service import semantic_service
from services.keyword_service import keyword_service
from services.hybrid_scorer import hybrid_scorer

router = APIRouter(prefix="/score", tags=["Scoring"])


# ── Request Schemas ───────────────────────────────────────────────────────────


class TextPairRequest(BaseModel):
    """Request containing a candidate-reference text pair for scoring."""
    candidate: str = Field(
        ..., min_length=1, description="The candidate / user's answer text."
    )
    reference: str = Field(
        ..., min_length=1, description="The reference / ideal answer text."
    )


class KeywordExtractionRequest(BaseModel):
    """Request for keyword extraction from a single text."""
    text: str = Field(..., min_length=1, description="Text to extract keywords from.")
    top_n: int = Field(default=20, ge=1, le=100, description="Number of keywords to extract.")


class KeywordOverlapRequest(BaseModel):
    """Request for keyword overlap computation."""
    candidate_keywords: list[str] = Field(
        ..., description="Keywords from the candidate answer."
    )
    reference_keywords: list[str] = Field(
        ..., description="Keywords from the reference answer."
    )


class HybridScoreRequest(BaseModel):
    """Request for hybrid scoring with optional custom weights."""
    candidate: str = Field(
        ..., min_length=1, description="The candidate / user's answer text."
    )
    reference: str = Field(
        ..., min_length=1, description="The reference / ideal answer text."
    )
    weights: Optional[dict] = Field(
        default=None,
        description=(
            "Custom weights for scoring components. "
            "Keys: bert, semantic, keywords, llm. Values should sum to 1.0."
        ),
    )
    llm_score: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description=(
            "Optional LLM-generated score (0-1). If not provided, "
            "the LLM weight is redistributed among other components."
        ),
    )


class EmbeddingRequest(BaseModel):
    """Request for extracting text embeddings."""
    text: str = Field(..., min_length=1, description="Text to embed.")


# ── Response Schemas ──────────────────────────────────────────────────────────


class BERTScoreResponse(BaseModel):
    """BERTScore evaluation result."""
    success: bool = True
    precision: float
    recall: float
    f1: float


class SemanticScoreResponse(BaseModel):
    """Semantic similarity evaluation result."""
    success: bool = True
    similarity: float
    description: str


class KeywordExtractionResponse(BaseModel):
    """Keyword extraction result."""
    success: bool = True
    keywords: list[dict]
    count: int


class KeywordOverlapResponse(BaseModel):
    """Keyword overlap evaluation result."""
    success: bool = True
    score: float
    matched: list[str]
    missing: list[str]
    extra: list[str]


class HybridScoreResponse(BaseModel):
    """Hybrid scoring result with full breakdown."""
    success: bool = True
    total_score: float
    breakdown: dict
    weights_used: dict
    feedback: list[str]


class EmbeddingResponse(BaseModel):
    """Text embedding result."""
    success: bool = True
    embedding: list[float]
    dimensions: int


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post(
    "/bert",
    response_model=BERTScoreResponse,
    summary="Compute BERTScore",
    description=(
        "Evaluate text similarity using BERTScore. Returns precision, recall, "
        "and F1 scores based on contextual BERT embeddings."
    ),
)
async def compute_bert_score(request: TextPairRequest):
    """
    Compute BERTScore between candidate and reference texts.

    BERTScore uses contextual embeddings from pre-trained language models
    to evaluate text at a semantic level rather than simple n-gram overlap.
    """
    try:
        result = bert_score_service.score(
            candidate=request.candidate,
            reference=request.reference,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return BERTScoreResponse(
        precision=result["precision"],
        recall=result["recall"],
        f1=result["f1"],
    )


@router.post(
    "/semantic",
    response_model=SemanticScoreResponse,
    summary="Compute semantic similarity",
    description=(
        "Compute cosine similarity between two texts using "
        "sentence-transformer embeddings (all-MiniLM-L6-v2)."
    ),
)
async def compute_semantic_similarity(request: TextPairRequest):
    """
    Compute cosine similarity between candidate and reference texts
    using sentence-transformer embeddings.
    """
    try:
        similarity = semantic_service.compute_similarity(
            text1=request.candidate,
            text2=request.reference,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Human-readable description of the similarity level
    if similarity >= 0.8:
        desc = "Very high similarity — answers are closely aligned."
    elif similarity >= 0.6:
        desc = "High similarity — answers share core meaning."
    elif similarity >= 0.4:
        desc = "Moderate similarity — some overlap in concepts."
    elif similarity >= 0.2:
        desc = "Low similarity — limited conceptual overlap."
    else:
        desc = "Very low similarity — answers appear unrelated."

    return SemanticScoreResponse(
        similarity=similarity,
        description=desc,
    )


@router.post(
    "/keywords",
    response_model=KeywordOverlapResponse,
    summary="Compute keyword overlap",
    description=(
        "Extract keywords from candidate and reference texts using TF-IDF, "
        "then compute their overlap score."
    ),
)
async def compute_keyword_score(request: TextPairRequest):
    """
    Extract keywords from both texts and compute overlap.

    Uses TF-IDF to identify important terms, then computes a
    Jaccard-like overlap with partial matching support.
    """
    try:
        cand_keywords = keyword_service.extract_keyword_strings(
            request.candidate, top_n=20
        )
        ref_keywords = keyword_service.extract_keyword_strings(
            request.reference, top_n=20
        )
        result = keyword_service.compute_keyword_overlap(cand_keywords, ref_keywords)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return KeywordOverlapResponse(
        score=result["score"],
        matched=result["matched"],
        missing=result["missing"],
        extra=result["extra"],
    )


@router.post(
    "/keywords/extract",
    response_model=KeywordExtractionResponse,
    summary="Extract keywords from text",
    description="Extract top-N keywords from a text using TF-IDF scoring.",
)
async def extract_keywords(request: KeywordExtractionRequest):
    """Extract keywords from the provided text using TF-IDF."""
    try:
        keywords = keyword_service.extract_keywords(
            text=request.text,
            top_n=request.top_n,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return KeywordExtractionResponse(
        keywords=keywords,
        count=len(keywords),
    )


@router.post(
    "/hybrid",
    response_model=HybridScoreResponse,
    summary="Compute hybrid score",
    description=(
        "Combined scoring using BERTScore (30%), semantic similarity (25%), "
        "keyword overlap (20%), and LLM score (25%). The LLM score can be "
        "provided or omitted (its weight is then redistributed)."
    ),
)
async def compute_hybrid_score(request: HybridScoreRequest):
    """
    Compute a hybrid score combining multiple evaluation methods.

    Default weights:
    - BERTScore F1: 30%
    - Semantic Similarity: 25%
    - Keyword Overlap: 20%
    - LLM Score: 25% (placeholder if not provided)
    """
    try:
        result = hybrid_scorer.score(
            candidate=request.candidate,
            reference=request.reference,
            weights=request.weights,
            llm_score=request.llm_score,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return HybridScoreResponse(
        total_score=result["total_score"],
        breakdown=result["breakdown"],
        weights_used=result["weights_used"],
        feedback=result["feedback"],
    )


@router.post(
    "/embeddings",
    response_model=EmbeddingResponse,
    summary="Extract text embedding",
    description="Extract the dense vector embedding for a text using sentence-transformers.",
)
async def extract_embedding(request: EmbeddingRequest):
    """Extract the sentence-transformer embedding for a given text."""
    try:
        embedding = semantic_service.extract_embeddings(request.text)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return EmbeddingResponse(
        embedding=embedding,
        dimensions=len(embedding),
    )
