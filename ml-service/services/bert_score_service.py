"""
BERTScore Computation Service.

Uses the bert-score library to compute precision, recall, and F1 scores
between candidate and reference texts. BERTScore leverages contextual
embeddings from pre-trained BERT models to evaluate text similarity at
a semantic level rather than simple n-gram overlap.
"""

import logging
from typing import Optional

import torch
from bert_score import BERTScorer

logger = logging.getLogger(__name__)


class BERTScoreService:
    """Service for computing BERTScore between candidate and reference texts."""

    def __init__(self) -> None:
        self._scorer: Optional[BERTScorer] = None
        self._model_type: str = "microsoft/deberta-xlarge-mnli"
        self._is_loaded: bool = False

    def load_model(self) -> None:
        """
        Initialize the BERTScorer at application startup.

        Loads the underlying model and caches it for repeated scoring calls.
        Uses rescale_with_baseline=True for more human-interpretable scores.
        """
        if self._is_loaded:
            logger.info("BERTScorer already loaded, skipping.")
            return

        logger.info("Loading BERTScorer with model: %s", self._model_type)

        device = "cuda" if torch.cuda.is_available() else "cpu"

        try:
            self._scorer = BERTScorer(
                model_type=self._model_type,
                lang="en",
                rescale_with_baseline=True,
                device=device,
            )
            self._is_loaded = True
            logger.info("BERTScorer loaded successfully on device: %s", device)
        except Exception:
            # Fallback to a lighter model if the default one fails
            logger.warning(
                "Failed to load %s, falling back to roberta-large",
                self._model_type,
            )
            self._model_type = "roberta-large"
            self._scorer = BERTScorer(
                model_type=self._model_type,
                lang="en",
                rescale_with_baseline=True,
                device=device,
            )
            self._is_loaded = True
            logger.info("BERTScorer loaded with fallback model on device: %s", device)

    def score(self, candidate: str, reference: str) -> dict:
        """
        Compute BERTScore between a candidate text and a reference text.

        Args:
            candidate: The generated / candidate answer text.
            reference: The reference / expected answer text.

        Returns:
            dict with keys: precision, recall, f1 (each a float 0-1).

        Raises:
            RuntimeError: If the scorer has not been loaded yet.
            ValueError: If inputs are empty.
        """
        if not self._is_loaded or self._scorer is None:
            logger.info("BERTScorer not loaded yet. Lazy-loading now...")
            self.load_model()

        if not candidate or not candidate.strip():
            raise ValueError("Candidate text cannot be empty.")
        if not reference or not reference.strip():
            raise ValueError("Reference text cannot be empty.")

        # BERTScorer expects lists
        candidates = [candidate.strip()]
        references = [reference.strip()]

        precision, recall, f1 = self._scorer.score(
            cands=candidates,
            refs=references,
        )

        return {
            "precision": round(float(precision[0].item()), 4),
            "recall": round(float(recall[0].item()), 4),
            "f1": round(float(f1[0].item()), 4),
        }

    def score_batch(
        self, candidates: list[str], references: list[str]
    ) -> list[dict]:
        """
        Compute BERTScore for multiple candidate-reference pairs.

        Args:
            candidates: List of candidate texts.
            references: List of reference texts (same length as candidates).

        Returns:
            List of dicts, each with precision, recall, f1.
        """
        if not self._is_loaded or self._scorer is None:
            logger.info("BERTScorer not loaded yet. Lazy-loading now...")
            self.load_model()

        if len(candidates) != len(references):
            raise ValueError(
                f"candidates ({len(candidates)}) and references ({len(references)}) "
                "must have the same length."
            )

        clean_cands = [c.strip() for c in candidates]
        clean_refs = [r.strip() for r in references]

        precision, recall, f1 = self._scorer.score(
            cands=clean_cands,
            refs=clean_refs,
        )

        results = []
        for i in range(len(clean_cands)):
            results.append(
                {
                    "precision": round(float(precision[i].item()), 4),
                    "recall": round(float(recall[i].item()), 4),
                    "f1": round(float(f1[i].item()), 4),
                }
            )

        return results

    @property
    def is_loaded(self) -> bool:
        return self._is_loaded


# Module-level singleton
bert_score_service = BERTScoreService()
