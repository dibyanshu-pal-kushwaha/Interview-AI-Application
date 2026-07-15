"""
Synthesis Router — Text-to-Speech endpoints.

Accepts text input and returns synthesized MP3 audio using gTTS.
"""

from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from services.tts_service import tts_service

router = APIRouter(tags=["Text-to-Speech"])


# ── Request / Response Schemas ────────────────────────────────────────────────


class SynthesizeRequest(BaseModel):
    """Request body for text-to-speech synthesis."""
    text: str = Field(
        ...,
        min_length=1,
        max_length=5000,
        description="Text to convert to speech (max 5000 characters).",
    )
    language: str = Field(
        default="en",
        description="ISO-639-1 language code.",
    )
    slow: bool = Field(
        default=False,
        description="If true, use slower speech speed.",
    )


class SupportedLanguagesResponse(BaseModel):
    """Response listing supported TTS languages."""
    languages: dict


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post(
    "/synthesize",
    summary="Synthesize speech from text",
    description="Convert text to speech and return an MP3 audio stream.",
    responses={
        200: {
            "content": {"audio/mpeg": {}},
            "description": "MP3 audio stream",
        },
        400: {"description": "Invalid input"},
    },
)
async def synthesize_speech(request: SynthesizeRequest):
    """
    Convert text to speech and stream the result as an MP3 file.

    - **text**: The text to convert (1-5000 characters)
    - **language**: Language code (default: "en")
    - **slow**: Slower speech speed (default: false)
    """
    try:
        audio_buffer = tts_service.synthesize(
            text=request.text,
            language=request.language,
            slow=request.slow,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return StreamingResponse(
        audio_buffer,
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": "attachment; filename=speech.mp3",
            "Cache-Control": "no-cache",
        },
    )


@router.get(
    "/synthesize/languages",
    response_model=SupportedLanguagesResponse,
    summary="List supported TTS languages",
)
async def list_supported_languages():
    """Return a mapping of supported language codes to language names."""
    return SupportedLanguagesResponse(
        languages=tts_service.get_supported_languages()
    )
