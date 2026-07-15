"""
Semantic Similarity Service.

Uses sentence-transformers (all-MiniLM-L6-v2) to compute cosine similarity
between texts via dense vector embeddings. The model is loaded once at
application startup and reused for all subsequent requests.
"""

import logging
from typing import Optional

import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger(__name__)

DEFAULT_MODEL_NAME = "all-MiniLM-L6-v2"


class SemanticService:
    """Service for computing semantic similarity using sentence-transformers."""

    def __init__(self) -> None:
        self._model: Optional[SentenceTransformer] = None
        self._model_name: str = DEFAULT_MODEL_NAME
        self._is_loaded: bool = False

    def load_model(self) -> None:
        """
        Load the sentence-transformers model at application startup.

        Downloads and caches the model on first run; subsequent loads
        use the cached version from disk.
        """
        if self._is_loaded:
            logger.info("Semantic model already loaded, skipping.")
            return

        logger.info("Loading sentence-transformer model: %s", self._model_name)
        self._model = SentenceTransformer(self._model_name)
        self._is_loaded = True
        logger.info("Sentence-transformer model loaded successfully.")

    def compute_similarity(self, text1: str, text2: str) -> float:
        """
        Compute cosine similarity between two texts.

        Args:
            text1: First text string.
            text2: Second text string.

        Returns:
            Cosine similarity score between 0 and 1.

        Raises:
            RuntimeError: If the model has not been loaded.
            ValueError: If inputs are empty.
        """
        if not self._is_loaded or self._model is None:
            logger.info("Semantic model not loaded yet. Lazy-loading now...")
            self.load_model()

        if not text1 or not text1.strip():
            raise ValueError("text1 cannot be empty.")
        if not text2 or not text2.strip():
            raise ValueError("text2 cannot be empty.")

        embeddings = self._model.encode(
            [text1.strip(), text2.strip()],
            convert_to_numpy=True,
            normalize_embeddings=True,
        )

        similarity = cosine_similarity(
            embeddings[0].reshape(1, -1),
            embeddings[1].reshape(1, -1),
        )

        score = float(np.clip(similarity[0][0], 0.0, 1.0))
        return round(score, 4)

    def extract_embeddings(self, text: str) -> list[float]:
        """
        Extract the embedding vector for a given text.

        Args:
            text: Input text to embed.

        Returns:
            List of floats representing the embedding vector.

        Raises:
            RuntimeError: If the model has not been loaded.
            ValueError: If text is empty.
        """
        if not self._is_loaded or self._model is None:
            logger.info("Semantic model not loaded yet. Lazy-loading now...")
            self.load_model()

        if not text or not text.strip():
            raise ValueError("Text cannot be empty.")

        embedding = self._model.encode(
            text.strip(),
            convert_to_numpy=True,
            normalize_embeddings=True,
        )

        return embedding.tolist()

    def compute_similarity_batch(
        self, texts1: list[str], texts2: list[str]
    ) -> list[float]:
        """
        Compute pairwise cosine similarity for lists of text pairs.

        Args:
            texts1: List of first texts.
            texts2: List of second texts (same length as texts1).

        Returns:
            List of cosine similarity scores.
        """
        if not self._is_loaded or self._model is None:
            logger.info("Semantic model not loaded yet. Lazy-loading now...")
            self.load_model()

        if len(texts1) != len(texts2):
            raise ValueError("Input lists must have the same length.")

        embeddings1 = self._model.encode(
            [t.strip() for t in texts1],
            convert_to_numpy=True,
            normalize_embeddings=True,
        )
        embeddings2 = self._model.encode(
            [t.strip() for t in texts2],
            convert_to_numpy=True,
            normalize_embeddings=True,
        )

        scores = []
        for e1, e2 in zip(embeddings1, embeddings2):
            sim = cosine_similarity(e1.reshape(1, -1), e2.reshape(1, -1))
            scores.append(round(float(np.clip(sim[0][0], 0.0, 1.0)), 4))

        return scores

    @property
    def is_loaded(self) -> bool:
        return self._is_loaded


# Module-level singleton
semantic_service = SemanticService()
