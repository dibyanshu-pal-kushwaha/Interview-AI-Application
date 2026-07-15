"""
Keyword Analysis Service.

Uses scikit-learn's TfidfVectorizer to extract keywords from text and
compute keyword overlap scores between candidate and reference texts.
"""

import re
import logging
from typing import Optional

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

logger = logging.getLogger(__name__)

# Common technical stop words to filter out on top of sklearn's built-in list
CUSTOM_STOP_WORDS = [
    "use", "using", "used", "also", "would", "could", "like", "just",
    "make", "need", "want", "know", "thing", "things", "way", "ways",
    "good", "better", "best", "well", "really", "actually", "basically",
    "example", "etc", "answer", "question", "interview",
]


class KeywordService:
    """Service for TF-IDF based keyword extraction and overlap computation."""

    def __init__(self) -> None:
        self._vectorizer: Optional[TfidfVectorizer] = None

    def _build_vectorizer(self, ngram_range: tuple = (1, 2)) -> TfidfVectorizer:
        """Create a TfidfVectorizer with sensible defaults for keyword extraction."""
        return TfidfVectorizer(
            stop_words="english",
            ngram_range=ngram_range,
            max_features=5000,
            sublinear_tf=True,
            min_df=1,
            max_df=0.95,
            token_pattern=r"(?u)\b[a-zA-Z][a-zA-Z0-9_\-\.]+\b",
        )

    def _clean_text(self, text: str) -> str:
        """Normalize and clean text for keyword extraction."""
        text = text.lower().strip()
        # Remove URLs
        text = re.sub(r"https?://\S+", "", text)
        # Remove email addresses
        text = re.sub(r"\S+@\S+", "", text)
        # Remove excessive whitespace
        text = re.sub(r"\s+", " ", text)
        return text

    def extract_keywords(self, text: str, top_n: int = 20) -> list[dict]:
        """
        Extract the top-N keywords from a text using TF-IDF scoring.

        Args:
            text: Input text to extract keywords from.
            top_n: Number of top keywords to return (default: 20).

        Returns:
            List of dicts with 'keyword' and 'score' keys, sorted by score descending.

        Raises:
            ValueError: If text is empty.
        """
        if not text or not text.strip():
            raise ValueError("Input text cannot be empty.")

        cleaned = self._clean_text(text)

        # We need at least 2 documents for TF-IDF to be meaningful,
        # so we split the text into sentences and treat each as a "document"
        sentences = re.split(r"[.!?\n]+", cleaned)
        sentences = [s.strip() for s in sentences if len(s.strip()) > 10]

        if not sentences:
            sentences = [cleaned]

        vectorizer = self._build_vectorizer()

        try:
            tfidf_matrix = vectorizer.fit_transform(sentences)
        except ValueError:
            # If vectorizer fails (e.g., all stop words), return empty list
            return []

        feature_names = vectorizer.get_feature_names_out()

        # Aggregate TF-IDF scores across all sentences
        aggregated_scores = np.asarray(tfidf_matrix.sum(axis=0)).flatten()

        # Filter out custom stop words
        filtered_indices = []
        for i, name in enumerate(feature_names):
            tokens = name.split()
            if not any(token in CUSTOM_STOP_WORDS for token in tokens):
                filtered_indices.append(i)

        if not filtered_indices:
            filtered_indices = list(range(len(feature_names)))

        # Sort by aggregated TF-IDF score
        filtered_scores = [(feature_names[i], aggregated_scores[i]) for i in filtered_indices]
        filtered_scores.sort(key=lambda x: x[1], reverse=True)

        top_keywords = filtered_scores[:top_n]

        # Normalize scores to 0-1 range
        max_score = top_keywords[0][1] if top_keywords else 1.0
        if max_score == 0:
            max_score = 1.0

        return [
            {
                "keyword": kw,
                "score": round(float(score / max_score), 4),
            }
            for kw, score in top_keywords
        ]

    def compute_keyword_overlap(
        self,
        candidate_keywords: list[str],
        reference_keywords: list[str],
    ) -> dict:
        """
        Compute keyword overlap between candidate and reference keyword lists.

        Uses set-based Jaccard-like overlap, with additional weighting for
        partial matches (e.g., "machine learning" partially matches "learning").

        Args:
            candidate_keywords: List of keywords from the candidate answer.
            reference_keywords: List of keywords from the reference answer.

        Returns:
            dict with keys:
                - score: float overlap score (0-1)
                - matched: list of matched keywords
                - missing: list of reference keywords not in candidate
                - extra: list of candidate keywords not in reference
        """
        if not reference_keywords:
            return {
                "score": 0.0,
                "matched": [],
                "missing": [],
                "extra": list(candidate_keywords),
            }

        cand_set = {kw.lower().strip() for kw in candidate_keywords if kw.strip()}
        ref_set = {kw.lower().strip() for kw in reference_keywords if kw.strip()}

        # Exact matches
        exact_matches = cand_set & ref_set

        # Partial matches: a reference keyword is "partially matched" if any
        # candidate keyword contains it or vice versa
        partial_matches = set()
        unmatched_ref = ref_set - exact_matches
        unmatched_cand = cand_set - exact_matches

        for ref_kw in list(unmatched_ref):
            ref_tokens = set(ref_kw.split())
            for cand_kw in list(unmatched_cand):
                cand_tokens = set(cand_kw.split())
                # If they share at least one meaningful token
                overlap_tokens = ref_tokens & cand_tokens
                if overlap_tokens and len(overlap_tokens) >= min(len(ref_tokens), len(cand_tokens)) * 0.5:
                    partial_matches.add(ref_kw)
                    unmatched_cand.discard(cand_kw)
                    break

        # Score: exact matches count full, partial matches count half
        total_ref = len(ref_set)
        match_score = len(exact_matches) + 0.5 * len(partial_matches)
        score = min(match_score / total_ref, 1.0)

        missing = list(ref_set - exact_matches - partial_matches)
        extra = list(cand_set - exact_matches)

        return {
            "score": round(score, 4),
            "matched": sorted(exact_matches | partial_matches),
            "missing": sorted(missing),
            "extra": sorted(extra),
        }

    def extract_keyword_strings(self, text: str, top_n: int = 20) -> list[str]:
        """
        Convenience method: extract keywords and return only the keyword strings.

        Args:
            text: Input text.
            top_n: Number of keywords to extract.

        Returns:
            List of keyword strings.
        """
        keywords = self.extract_keywords(text, top_n=top_n)
        return [kw["keyword"] for kw in keywords]


# Module-level singleton
keyword_service = KeywordService()
