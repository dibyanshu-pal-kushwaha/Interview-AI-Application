"""
Resume Analysis Service.

Extracts skills, experience, and keywords from resume text, and computes
ATS (Applicant Tracking System) compatibility scores against job descriptions
using TF-IDF and cosine similarity.
"""

import re
import logging
from typing import Optional

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger(__name__)

# Comprehensive skill categories for extraction
TECHNICAL_SKILLS = {
    # Programming Languages
    "python", "javascript", "typescript", "java", "c++", "c#", "go", "golang",
    "rust", "ruby", "php", "swift", "kotlin", "scala", "r", "matlab", "perl",
    "dart", "elixir", "haskell", "lua", "shell", "bash", "powershell", "sql",
    # Web Frameworks & Libraries
    "react", "reactjs", "react.js", "angular", "vue", "vuejs", "vue.js",
    "next.js", "nextjs", "nuxt.js", "nuxtjs", "svelte", "express", "expressjs",
    "fastapi", "flask", "django", "spring", "spring boot", "springboot",
    "rails", "ruby on rails", "laravel", "asp.net", ".net", "node.js", "nodejs",
    # Data & ML
    "tensorflow", "pytorch", "keras", "scikit-learn", "sklearn", "pandas",
    "numpy", "scipy", "matplotlib", "seaborn", "plotly", "jupyter",
    "machine learning", "deep learning", "neural networks", "nlp",
    "natural language processing", "computer vision", "data science",
    "data analysis", "data engineering", "data visualization",
    "reinforcement learning", "generative ai", "llm", "large language models",
    "transformers", "bert", "gpt", "langchain", "hugging face",
    # Cloud & DevOps
    "aws", "amazon web services", "azure", "gcp", "google cloud",
    "docker", "kubernetes", "k8s", "terraform", "ansible", "jenkins",
    "ci/cd", "github actions", "gitlab ci", "circleci", "travis ci",
    "linux", "unix", "nginx", "apache",
    # Databases
    "mysql", "postgresql", "postgres", "mongodb", "redis", "elasticsearch",
    "dynamodb", "cassandra", "sqlite", "oracle", "sql server", "neo4j",
    "firebase", "supabase", "prisma",
    # Tools & Platforms
    "git", "github", "gitlab", "bitbucket", "jira", "confluence",
    "figma", "sketch", "adobe xd", "postman", "swagger",
    "graphql", "rest", "restful", "api", "microservices", "grpc",
    "websocket", "oauth", "jwt",
    # Mobile
    "react native", "flutter", "ios", "android", "swiftui",
    "kotlin multiplatform",
    # Other
    "agile", "scrum", "kanban", "tdd", "bdd", "unit testing",
    "integration testing", "system design", "design patterns",
    "object oriented programming", "oop", "functional programming",
    "html", "css", "sass", "less", "tailwind", "tailwindcss",
    "bootstrap", "webpack", "vite", "babel", "eslint",
}

SOFT_SKILLS = {
    "leadership", "communication", "teamwork", "problem solving",
    "problem-solving", "critical thinking", "time management",
    "project management", "collaboration", "mentoring", "presentation",
    "negotiation", "analytical", "strategic thinking", "creativity",
    "adaptability", "attention to detail", "decision making",
    "conflict resolution", "stakeholder management",
}

# Patterns for experience extraction
EXPERIENCE_PATTERNS = [
    # "X years of experience"
    r"(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s+)?(?:experience|exp)",
    # "experience of X years"
    r"experience\s+(?:of\s+)?(\d+)\+?\s*(?:years?|yrs?)",
]

EDUCATION_KEYWORDS = {
    "bachelor", "bachelors", "b.s.", "b.sc", "b.tech", "btech",
    "master", "masters", "m.s.", "m.sc", "m.tech", "mtech", "mba",
    "phd", "ph.d", "doctorate", "associate", "diploma", "certification",
    "certified", "degree",
}

JOB_TITLE_PATTERNS = [
    r"(?:senior|sr\.?|junior|jr\.?|lead|principal|staff|chief)?\s*"
    r"(?:software|frontend|backend|full[\s-]?stack|devops|data|ml|ai|cloud|mobile|web|qa|test|security|network|system|database|platform)?\s*"
    r"(?:engineer|developer|architect|analyst|scientist|manager|designer|consultant|administrator|specialist|intern)",
]


class ResumeAnalyzer:
    """Service for analyzing resumes and computing ATS compatibility scores."""

    def extract_skills(self, text: str) -> dict:
        """
        Extract technical and soft skills from resume text.

        Args:
            text: Resume text content.

        Returns:
            dict with:
                - technical_skills: list of identified technical skills
                - soft_skills: list of identified soft skills
                - all_skills: combined list
        """
        if not text or not text.strip():
            raise ValueError("Resume text cannot be empty.")

        text_lower = text.lower()

        found_technical = []
        for skill in sorted(TECHNICAL_SKILLS, key=len, reverse=True):
            # Use word boundary matching for short skills, substring for longer ones
            if len(skill) <= 3:
                pattern = r"\b" + re.escape(skill) + r"\b"
                if re.search(pattern, text_lower):
                    found_technical.append(skill)
            else:
                if skill in text_lower:
                    found_technical.append(skill)

        # Remove duplicates while preserving order
        found_technical = list(dict.fromkeys(found_technical))

        found_soft = []
        for skill in SOFT_SKILLS:
            if skill in text_lower:
                found_soft.append(skill)
        found_soft = list(dict.fromkeys(found_soft))

        return {
            "technical_skills": sorted(found_technical),
            "soft_skills": sorted(found_soft),
            "all_skills": sorted(found_technical + found_soft),
        }

    def extract_experience(self, text: str) -> dict:
        """
        Extract structured experience data from resume text.

        Args:
            text: Resume text content.

        Returns:
            dict with:
                - years_of_experience: int or None
                - education: list of education mentions
                - job_titles: list of identified job titles
                - companies: list (best-effort extraction)
        """
        if not text or not text.strip():
            raise ValueError("Resume text cannot be empty.")

        text_lower = text.lower()

        # Extract years of experience
        years = None
        for pattern in EXPERIENCE_PATTERNS:
            match = re.search(pattern, text_lower)
            if match:
                years = int(match.group(1))
                break

        # Extract education
        education = []
        for edu_kw in EDUCATION_KEYWORDS:
            pattern = r"(?i)\b" + re.escape(edu_kw) + r"\b[^.\n]{0,100}"
            matches = re.findall(pattern, text, re.IGNORECASE)
            for m in matches:
                cleaned = m.strip().rstrip(",;:")
                if cleaned and len(cleaned) > 5 and cleaned not in education:
                    education.append(cleaned)

        # Extract job titles
        job_titles = []
        for pattern in JOB_TITLE_PATTERNS:
            matches = re.findall(pattern, text_lower)
            for m in matches:
                title = m.strip()
                if title and len(title) > 3:
                    title = title.title()
                    if title not in job_titles:
                        job_titles.append(title)

        return {
            "years_of_experience": years,
            "education": education[:10],  # Cap at 10
            "job_titles": job_titles[:10],
        }

    def compute_ats_score(self, resume_text: str, jd_text: str) -> dict:
        """
        Compute ATS (Applicant Tracking System) compatibility score.

        Compares resume text against a job description using:
        1. TF-IDF cosine similarity for overall content match
        2. Skill keyword matching for specific requirements
        3. Experience alignment

        Args:
            resume_text: The resume text content.
            jd_text: The job description text.

        Returns:
            dict with:
                - score: float (0-100) ATS compatibility percentage
                - content_similarity: float (0-1) TF-IDF cosine similarity
                - matched_skills: list of skills found in both resume and JD
                - missing_skills: list of JD skills not found in resume
                - skill_match_rate: float (0-1)
                - recommendations: list of actionable improvement suggestions
        """
        if not resume_text or not resume_text.strip():
            raise ValueError("Resume text cannot be empty.")
        if not jd_text or not jd_text.strip():
            raise ValueError("Job description text cannot be empty.")

        # --- 1. TF-IDF Cosine Similarity ---
        vectorizer = TfidfVectorizer(
            stop_words="english",
            ngram_range=(1, 2),
            max_features=5000,
            sublinear_tf=True,
        )

        try:
            tfidf_matrix = vectorizer.fit_transform([resume_text, jd_text])
            content_sim = float(
                cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
            )
        except ValueError:
            content_sim = 0.0

        content_sim = round(content_sim, 4)

        # --- 2. Skill Matching ---
        resume_skills_data = self.extract_skills(resume_text)
        jd_skills_data = self.extract_skills(jd_text)

        resume_skills = set(resume_skills_data["all_skills"])
        jd_skills = set(jd_skills_data["all_skills"])

        matched_skills = sorted(resume_skills & jd_skills)
        missing_skills = sorted(jd_skills - resume_skills)

        skill_match_rate = (
            len(matched_skills) / len(jd_skills) if jd_skills else 1.0
        )
        skill_match_rate = round(skill_match_rate, 4)

        # --- 3. Composite ATS Score ---
        # Weight: 40% content similarity, 50% skill match, 10% formatting bonus
        formatting_score = self._assess_formatting(resume_text)

        ats_score = (
            0.40 * content_sim
            + 0.50 * skill_match_rate
            + 0.10 * formatting_score
        )
        ats_percentage = round(min(ats_score * 100, 100.0), 1)

        # --- 4. Recommendations ---
        recommendations = self._generate_recommendations(
            content_sim, skill_match_rate, missing_skills, formatting_score, resume_text
        )

        return {
            "score": ats_percentage,
            "content_similarity": content_sim,
            "skill_match_rate": skill_match_rate,
            "matched_skills": matched_skills,
            "missing_skills": missing_skills,
            "total_jd_skills": len(jd_skills),
            "total_resume_skills": len(resume_skills),
            "recommendations": recommendations,
        }

    def _assess_formatting(self, resume_text: str) -> float:
        """
        Assess basic resume formatting quality.

        Returns a score from 0 to 1 based on formatting heuristics.
        """
        score = 0.0
        text_lower = resume_text.lower()

        # Check for section headers
        section_keywords = [
            "experience", "education", "skills", "projects",
            "summary", "objective", "certifications", "awards",
        ]
        sections_found = sum(1 for kw in section_keywords if kw in text_lower)
        score += min(sections_found / 4.0, 0.4)  # Up to 0.4

        # Check reasonable length (300-5000 words is ideal)
        word_count = len(resume_text.split())
        if 300 <= word_count <= 5000:
            score += 0.3
        elif 100 <= word_count < 300 or 5000 < word_count <= 8000:
            score += 0.15

        # Check for contact information patterns
        has_email = bool(re.search(r"\S+@\S+\.\S+", resume_text))
        has_phone = bool(re.search(r"[\+]?[\d\-\(\)\s]{7,15}", resume_text))
        has_linkedin = "linkedin" in text_lower
        contact_score = sum([has_email, has_phone, has_linkedin]) / 3.0
        score += contact_score * 0.3  # Up to 0.3

        return min(score, 1.0)

    def _generate_recommendations(
        self,
        content_sim: float,
        skill_match_rate: float,
        missing_skills: list[str],
        formatting_score: float,
        resume_text: str,
    ) -> list[str]:
        """Generate actionable recommendations for improving ATS compatibility."""
        recommendations = []

        if skill_match_rate < 0.5:
            recommendations.append(
                "Your resume is missing many skills listed in the job description. "
                "Add relevant skills you possess to improve your match rate."
            )

        if missing_skills:
            top_missing = missing_skills[:7]
            recommendations.append(
                f"Consider adding these skills if applicable: {', '.join(top_missing)}"
            )

        if content_sim < 0.3:
            recommendations.append(
                "Your resume content doesn't closely match the job description. "
                "Tailor your experience descriptions to use similar terminology."
            )

        if formatting_score < 0.5:
            recommendations.append(
                "Improve your resume formatting: ensure you have clear section headers "
                "(Experience, Education, Skills), contact information, and appropriate length."
            )

        word_count = len(resume_text.split())
        if word_count < 200:
            recommendations.append(
                "Your resume appears too short. Add more detail about your experience, "
                "projects, and accomplishments."
            )
        elif word_count > 5000:
            recommendations.append(
                "Your resume is quite long. Consider condensing to highlight the most "
                "relevant experience for this role."
            )

        if skill_match_rate >= 0.7 and content_sim >= 0.4:
            recommendations.append(
                "Good overall match! To further improve, quantify your accomplishments "
                "with metrics and specific outcomes."
            )

        if not recommendations:
            recommendations.append(
                "Your resume is well-aligned with this job description. "
                "Keep it updated and tailored for each application."
            )

        return recommendations


# Module-level singleton
resume_analyzer = ResumeAnalyzer()
