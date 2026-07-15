"""
Whisper Speech-to-Text Service.

Uses the Groq Whisper API for fast cloud-based transcription.
Sends audio files to Groq's OpenAI-compatible endpoint for processing.

Fallback note: For local/offline transcription, you can replace the Groq API
call with OpenAI's open-source Whisper model loaded via the `whisper` or
`faster-whisper` Python packages. This requires a GPU for acceptable latency.
"""

import os
import httpx
from io import BytesIO
from typing import Optional

GROQ_API_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
GROQ_WHISPER_MODEL = "whisper-large-v3-turbo"

SUPPORTED_AUDIO_FORMATS = {"wav", "mp3", "webm", "m4a", "ogg", "flac", "mp4", "mpeg", "mpga"}

# Map extensions to proper MIME types for the multipart upload
MIME_TYPES = {
    "wav": "audio/wav",
    "mp3": "audio/mpeg",
    "webm": "audio/webm",
    "m4a": "audio/mp4",
    "ogg": "audio/ogg",
    "flac": "audio/flac",
    "mp4": "audio/mp4",
    "mpeg": "audio/mpeg",
    "mpga": "audio/mpeg",
}


class WhisperService:
    """Handles speech-to-text transcription via the Groq Whisper API."""

    def __init__(self) -> None:
        self.api_key: str = os.getenv("GROQ_API_KEY", "")
        self.model: str = GROQ_WHISPER_MODEL
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Lazily create and return the async HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=60.0)
        return self._client

    async def transcribe(
        self,
        audio_bytes: bytes,
        filename: str,
        language: Optional[str] = None,
        prompt: Optional[str] = None,
    ) -> dict:
        """
        Transcribe audio using the Groq Whisper API.

        Args:
            audio_bytes: Raw audio file bytes.
            filename: Original filename (used to determine format).
            language: Optional ISO-639-1 language code (e.g. "en").
            prompt: Optional prompt to guide the transcription style.

        Returns:
            dict with keys: text, language, duration (if available).

        Raises:
            ValueError: If the audio format is unsupported or API key missing.
            RuntimeError: If the Groq API returns an error.
        """
        if not self.api_key:
            raise ValueError(
                "GROQ_API_KEY environment variable is not set. "
                "Please set it to use the Groq Whisper transcription service."
            )

        extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if extension not in SUPPORTED_AUDIO_FORMATS:
            raise ValueError(
                f"Unsupported audio format: '.{extension}'. "
                f"Supported formats: {', '.join(sorted(SUPPORTED_AUDIO_FORMATS))}"
            )

        mime_type = MIME_TYPES.get(extension, "application/octet-stream")

        # Build multipart form data
        files = {
            "file": (filename, BytesIO(audio_bytes), mime_type),
        }
        data: dict = {
            "model": self.model,
            "response_format": "verbose_json",
        }
        if language:
            data["language"] = language
        if prompt:
            data["prompt"] = prompt

        headers = {
            "Authorization": f"Bearer {self.api_key}",
        }

        client = await self._get_client()
        response = await client.post(
            GROQ_API_URL,
            headers=headers,
            files=files,
            data=data,
        )

        if response.status_code != 200:
            error_detail = response.text
            raise RuntimeError(
                f"Groq Whisper API error (HTTP {response.status_code}): {error_detail}"
            )

        result = response.json()

        return {
            "text": result.get("text", "").strip(),
            "language": result.get("language", language or "unknown"),
            "duration": result.get("duration"),
            "segments": result.get("segments"),
        }

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None


# Module-level singleton
whisper_service = WhisperService()
