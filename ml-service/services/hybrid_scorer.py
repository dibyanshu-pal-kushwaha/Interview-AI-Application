"""
Hybrid Scoring Service.

Combines multiple scoring signals — BERTScore, semantic similarity,
keyword overlap, and an LLM placeholder — into a single weighted score.
The LLM component's weight is reserved for the Node.js backend to fill in
via its own LLM API call; this service returns a placeholder for it.
"""

import logging
from typing import Optional

from services.bert_score_service import bert_score_service
from services.semantic_service import semantic_service
from services.keyword_service import keyword_service

logger = logging.getLogger(__name__)

DEFAULT_WEIGHTS = {
    "bert": 0.30,
    "semantic": 0.25,
    "keywords": 0.20,
    "llm": 0.25,
}


class HybridScorer:
    """
    Combined scoring engine that merges multiple evaluation signals.

    Default weight distribution:
        - BERTScore F1:         30%
        - Semantic Similarity:  25%
        - Keyword Overlap:      20%
        - LLM Score:            25% (placeholder — filled by Node.js backend)
    """

    def score(
        self,
        candidate: str,
        reference: str,
        weights: Optional[dict] = None,
        llm_score: Optional[float] = None,
    ) -> dict:
        """
        Compute a hybrid score by combining multiple evaluation methods.

        Args:
            candidate: The candidate / user's answer text.
            reference: The reference / ideal answer text.
            weights: Optional custom weight dict. Keys: bert, semantic, keywords, llm.
                     Values should sum to 1.0.
            llm_score: Optional LLM-generated score (0-1). If None, the LLM
                       component is excluded from the final score and its weight
                       is redistributed proportionally.

        Returns:
            dict with:
                - total_score: float (0-1), the weighted combined score
                - breakdown: dict with individual component scores
                - weights_used: dict of weights that were applied
                - feedback: list of textual feedback strings
        """
        active_weights = dict(DEFAULT_WEIGHTS)
        if weights:
            for key in ["bert", "semantic", "keywords", "llm"]:
                if key in weights:
                    active_weights[key] = float(weights[key])

        # --- Compute BERTScore ---
        bert_result = {"precision": 0.0, "recall": 0.0, "f1": 0.0}
        try:
            if bert_score_service.is_loaded:
                bert_result = bert_score_service.score(candidate, reference)
            else:
                logger.warning("BERTScore model not loaded, using 0.0")
        except Exception as e:
            logger.error("BERTScore computation failed: %s", e)

        bert_f1 = bert_result["f1"]

        # --- Compute Semantic Similarity ---
        semantic_score = 0.0
        try:
            if semantic_service.is_loaded:
                semantic_score = semantic_service.compute_similarity(candidate, reference)
            else:
                logger.warning("Semantic model not loaded, using 0.0")
        except Exception as e:
            logger.error("Semantic similarity computation failed: %s", e)

        # --- Compute Keyword Overlap ---
        keyword_result = {"score": 0.0, "matched": [], "missing": [], "extra": []}
        try:
            cand_keywords = keyword_service.extract_keyword_strings(candidate, top_n=20)
            ref_keywords = keyword_service.extract_keyword_strings(reference, top_n=20)
            keyword_result = keyword_service.compute_keyword_overlap(cand_keywords, ref_keywords)
        except Exception as e:
            logger.error("Keyword overlap computation failed: %s", e)

        keyword_score = keyword_result["score"]

        # --- LLM Score ---
        llm_component = llm_score if llm_score is not None else None

        # --- Compute weighted total ---
        if llm_component is not None:
            # All four components present
            total = (
                active_weights["bert"] * bert_f1
                + active_weights["semantic"] * semantic_score
                + active_weights["keywords"] * keyword_score
                + active_weights["llm"] * llm_component
            )
            weights_used = dict(active_weights)
        else:
            # Redistribute LLM weight proportionally among the other three
            non_llm_total = (
                active_weights["bert"]
                + active_weights["semantic"]
                + active_weights["keywords"]
            )
            if non_llm_total > 0:
                w_bert = active_weights["bert"] / non_llm_total
                w_semantic = active_weights["semantic"] / non_llm_total
                w_keywords = active_weights["keywords"] / non_llm_total
            else:
                w_bert = w_semantic = w_keywords = 1.0 / 3.0

            total = (
                w_bert * bert_f1
                + w_semantic * semantic_score
                + w_keywords * keyword_score
            )
            weights_used = {
                "bert": round(w_bert, 4),
                "semantic": round(w_semantic, 4),
                "keywords": round(w_keywords, 4),
                "llm": 0.0,
            }

        total = round(min(max(total, 0.0), 1.0), 4)

        # --- Generate feedback ---
        feedback = self._generate_feedback(
            bert_f1, semantic_score, keyword_score, keyword_result
        )

        return {
            "total_score": total,
            "breakdown": {
                "bert": {
                    "precision": bert_result["precision"],
                    "recall": bert_result["recall"],
                    "f1": bert_f1,
                },
                "semantic_similarity": semantic_score,
                "keyword_overlap": {
                    "score": keyword_score,
                    "matched_keywords": keyword_result["matched"],
                    "missing_keywords": keyword_result["missing"],
                },
                "llm_score": llm_component,
            },
            "weights_used": weights_used,
            "feedback": feedback,
        }

    def _generate_feedback(
        self,
        bert_f1: float,
        semantic_score: float,
        keyword_score: float,
        keyword_result: dict,
    ) -> list[str]:
        """Generate human-readable feedback based on individual scores."""
        feedback = []

        # Overall semantic quality
        if semantic_score >= 0.8:
            feedback.append(
                "Excellent semantic alignment — your answer captures the core meaning very well."
            )
        elif semantic_score >= 0.6:
            feedback.append(
                "Good semantic alignment — your answer covers the main concepts but could be more precise."
            )
        elif semantic_score >= 0.4:
            feedback.append(
                "Moderate semantic alignment — consider revisiting the key concepts in the expected answer."
            )
        else:
            feedback.append(
                "Low semantic alignment — your answer may be off-topic or missing critical points."
            )

        # BERTScore feedback
        if bert_f1 >= 0.7:
            feedback.append(
                "Strong language quality — your phrasing closely mirrors the expected answer."
            )
        elif bert_f1 >= 0.4:
            feedback.append(
                "Adequate language quality — try to use more precise technical terminology."
            )
        else:
            feedback.append(
                "Language quality needs improvement — review the expected answer for better phrasing."
            )

        # Keyword feedback
        missing = keyword_result.get("missing", [])
        if keyword_score >= 0.7:
            feedback.append("Great keyword coverage — you've hit most of the important terms.")
        elif missing:
            sample_missing = missing[:5]
            feedback.append(
                f"Missing key terms: {', '.join(sample_missing)}. "
                "Try to incorporate these into your answer."
            )
        else:
            feedback.append(
                "Keyword coverage is low — make sure to mention the critical technical terms."
            )

        return feedback


# Module-level singleton
hybrid_scorer = HybridScorer()
