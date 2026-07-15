"""
Analysis Router — Resume analysis and ATS scoring endpoints.

Provides endpoints for extracting skills, experience, and keywords from
resume text, and matching against job descriptions for ATS compatibility.
"""

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.resume_analyzer import resume_analyzer

router = APIRouter(prefix="/analyze", tags=["Analysis"])


# ── Request Schemas ───────────────────────────────────────────────────────────


class ResumeAnalysisRequest(BaseModel):
    """Request for full resume analysis against a job description."""
    resume_text: str = Field(
        ..., min_length=10, description="The full resume text content."
    )
    job_description: str = Field(
        ..., min_length=10, description="The target job description text."
    )


class SkillExtractionRequest(BaseModel):
    """Request for skill extraction from text."""
    text: str = Field(
        ..., min_length=10, description="Text to extract skills from."
    )


class ExperienceExtractionRequest(BaseModel):
    """Request for experience extraction from resume text."""
    text: str = Field(
        ..., min_length=10, description="Resume text to extract experience from."
    )


# ── Response Schemas ──────────────────────────────────────────────────────────


class SkillsResponse(BaseModel):
    """Extracted skills result."""
    success: bool = True
    technical_skills: list[str]
    soft_skills: list[str]
    all_skills: list[str]
    total_count: int


class ExperienceResponse(BaseModel):
    """Extracted experience result."""
    success: bool = True
    years_of_experience: Optional[int]
    education: list[str]
    job_titles: list[str]


class ATSScoreResponse(BaseModel):
    """ATS compatibility score result."""
    success: bool = True
    score: float = Field(description="ATS compatibility percentage (0-100)")
    content_similarity: float = Field(description="TF-IDF cosine similarity (0-1)")
    skill_match_rate: float = Field(description="Skill match rate (0-1)")
    matched_skills: list[str]
    missing_skills: list[str]
    total_jd_skills: int
    total_resume_skills: int
    recommendations: list[str]


class ResumeAnalysisResponse(BaseModel):
    """Full resume analysis result combining skills, experience, and ATS score."""
    success: bool = True
    skills: SkillsResponse
    experience: ExperienceResponse
    ats: ATSScoreResponse


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post(
    "/resume",
    response_model=ResumeAnalysisResponse,
    summary="Full resume analysis",
    description=(
        "Analyze a resume against a job description. Extracts skills, "
        "experience, and computes an ATS compatibility score with recommendations."
    ),
)
async def analyze_resume(request: ResumeAnalysisRequest):
    """
    Perform a comprehensive resume analysis.

    Extracts:
    - Technical and soft skills
    - Years of experience, education, job titles
    - ATS compatibility score with matched/missing skills
    - Actionable improvement recommendations
    """
    try:
        skills_data = resume_analyzer.extract_skills(request.resume_text)
        experience_data = resume_analyzer.extract_experience(request.resume_text)
        ats_data = resume_analyzer.compute_ats_score(
            resume_text=request.resume_text,
            jd_text=request.job_description,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Resume analysis failed: {str(e)}",
        )

    skills_response = SkillsResponse(
        technical_skills=skills_data["technical_skills"],
        soft_skills=skills_data["soft_skills"],
        all_skills=skills_data["all_skills"],
        total_count=len(skills_data["all_skills"]),
    )

    experience_response = ExperienceResponse(
        years_of_experience=experience_data["years_of_experience"],
        education=experience_data["education"],
        job_titles=experience_data["job_titles"],
    )

    ats_response = ATSScoreResponse(
        score=ats_data["score"],
        content_similarity=ats_data["content_similarity"],
        skill_match_rate=ats_data["skill_match_rate"],
        matched_skills=ats_data["matched_skills"],
        missing_skills=ats_data["missing_skills"],
        total_jd_skills=ats_data["total_jd_skills"],
        total_resume_skills=ats_data["total_resume_skills"],
        recommendations=ats_data["recommendations"],
    )

    return ResumeAnalysisResponse(
        skills=skills_response,
        experience=experience_response,
        ats=ats_response,
    )


@router.post(
    "/skills",
    response_model=SkillsResponse,
    summary="Extract skills from text",
    description="Identify technical and soft skills mentioned in the text.",
)
async def extract_skills(request: SkillExtractionRequest):
    """Extract technical and soft skills from the provided text."""
    try:
        skills_data = resume_analyzer.extract_skills(request.text)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return SkillsResponse(
        technical_skills=skills_data["technical_skills"],
        soft_skills=skills_data["soft_skills"],
        all_skills=skills_data["all_skills"],
        total_count=len(skills_data["all_skills"]),
    )


@router.post(
    "/experience",
    response_model=ExperienceResponse,
    summary="Extract experience from resume",
    description="Extract years of experience, education, and job titles from resume text.",
)
async def extract_experience(request: ExperienceExtractionRequest):
    """Extract structured experience data from resume text."""
    try:
        experience_data = resume_analyzer.extract_experience(request.text)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return ExperienceResponse(
        years_of_experience=experience_data["years_of_experience"],
        education=experience_data["education"],
        job_titles=experience_data["job_titles"],
    )
