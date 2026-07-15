"""
Transcription Router — Whisper Speech-to-Text endpoints.

Accepts audio file uploads and returns transcribed text using the
Groq Whisper API for fast cloud-based transcription.
"""

from typing import Optional

from fastapi import APIRouter, File, Form, UploadFile, HTTPException
from pydantic import BaseModel

from services.whisper_service import whisper_service

router = APIRouter(tags=["Transcription"])


# ── Response Schemas ──────────────────────────────────────────────────────────


class TranscriptionSegment(BaseModel):
    """A single transcription segment with timing."""
    id: int
    start: float
    end: float
    text: str


class TranscriptionResponse(BaseModel):
    """Response from the transcription endpoint."""
    success: bool
    text: str
    language: Optional[str] = None
    duration: Optional[float] = None
    segments: Optional[list[dict]] = None


class ErrorResponse(BaseModel):
    """Standard error response."""
    success: bool = False
    error: str
    detail: Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post(
    "/transcribe",
    response_model=TranscriptionResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid input"},
        500: {"model": ErrorResponse, "description": "Transcription failed"},
    },
    summary="Transcribe audio to text",
    description=(
        "Upload an audio file to transcribe using the Groq Whisper API. "
        "Supported formats: wav, mp3, webm, m4a, ogg, flac."
    ),
)
async def transcribe_audio(
    file: UploadFile = File(..., description="Audio file to transcribe"),
    language: Optional[str] = Form(None, description="ISO-639-1 language code (e.g. 'en')"),
    prompt: Optional[str] = Form(None, description="Optional prompt to guide transcription"),
):
    """
    Transcribe an uploaded audio file to text.

    - **file**: Audio file (wav, mp3, webm, m4a, ogg, flac)
    - **language**: Optional language hint (ISO-639-1 code)
    - **prompt**: Optional prompt to guide the transcription style/vocabulary
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided.")

    # Read the file content
    try:
        audio_bytes = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to read uploaded file: {str(e)}",
        )

    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # Size limit: 25MB (Groq API limit)
    max_size = 25 * 1024 * 1024
    if len(audio_bytes) > max_size:
        raise HTTPException(
            status_code=400,
            detail=f"File size ({len(audio_bytes)} bytes) exceeds the 25MB limit.",
        )

    try:
        result = await whisper_service.transcribe(
            audio_bytes=audio_bytes,
            filename=file.filename,
            language=language,
            prompt=prompt,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    return TranscriptionResponse(
        success=True,
        text=result["text"],
        language=result.get("language"),
        duration=result.get("duration"),
        segments=result.get("segments"),
    )
