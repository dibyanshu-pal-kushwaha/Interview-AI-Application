"""
Text-to-Speech Service using gTTS (Google Text-to-Speech).

Generates MP3 audio from text input using Google's TTS API via the gTTS library.
Returns audio as a BytesIO buffer ready for streaming responses.
"""

from io import BytesIO
from gtts import gTTS

# Supported languages — subset of gTTS supported languages
SUPPORTED_LANGUAGES = {
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "pt": "Portuguese",
    "ja": "Japanese",
    "ko": "Korean",
    "zh": "Chinese",
    "hi": "Hindi",
    "ar": "Arabic",
    "ru": "Russian",
    "nl": "Dutch",
    "pl": "Polish",
    "sv": "Swedish",
    "tr": "Turkish",
}


class TTSService:
    """Text-to-Speech service using gTTS."""

    def synthesize(
        self,
        text: str,
        language: str = "en",
        slow: bool = False,
    ) -> BytesIO:
        """
        Convert text to speech and return MP3 audio as a BytesIO buffer.

        Args:
            text: The text to convert to speech.
            language: ISO-639-1 language code (default: "en").
            slow: If True, use slower speech speed.

        Returns:
            BytesIO buffer containing the MP3 audio data.

        Raises:
            ValueError: If text is empty or language is unsupported.
        """
        if not text or not text.strip():
            raise ValueError("Text input cannot be empty.")

        lang_code = language.lower().strip()
        if lang_code not in SUPPORTED_LANGUAGES:
            raise ValueError(
                f"Unsupported language: '{lang_code}'. "
                f"Supported languages: {', '.join(sorted(SUPPORTED_LANGUAGES.keys()))}"
            )

        tts = gTTS(text=text.strip(), lang=lang_code, slow=slow)

        audio_buffer = BytesIO()
        tts.write_to_fp(audio_buffer)
        audio_buffer.seek(0)

        return audio_buffer

    def get_supported_languages(self) -> dict:
        """Return a mapping of supported language codes to names."""
        return SUPPORTED_LANGUAGES.copy()


# Module-level singleton
tts_service = TTSService()
