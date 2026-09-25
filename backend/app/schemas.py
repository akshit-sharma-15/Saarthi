from typing import Optional, Literal, List, Dict
from pydantic import BaseModel, Field

class Candidate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None

class Education(BaseModel):
    institution: str
    degree: Optional[str] = None
    field: Optional[str] = None
    year: Optional[str] = None

class Experience(BaseModel):
    company: str
    title: str
    start_date: str          # "YYYY-MM"
    end_date: str            # "YYYY-MM" or "present"
    responsibilities: List[str] = Field(default_factory=list)

class Skills(BaseModel):
    programming: List[str] = Field(default_factory=list)
    frameworks: List[str] = Field(default_factory=list)
    cloud: List[str] = Field(default_factory=list)
    databases: List[str] = Field(default_factory=list)
    tools: List[str] = Field(default_factory=list)

class Project(BaseModel):
    name: str
    description: str
    evidence: Optional[str] = None

class EmploymentGap(BaseModel):
    period: str                                  # "2023-03 to 2025-01"
    status: Literal["unexplained", "explained"]
    reason: Optional[str] = None                 # only if resume states one

class CandidateProfile(BaseModel):
    candidate: Candidate
    education: List[Education] = Field(default_factory=list)
    experience: List[Experience] = Field(default_factory=list)
    skills: Skills = Field(default_factory=Skills)
    projects: List[Project] = Field(default_factory=list)
    certifications: List[str] = Field(default_factory=list)
    employment_gaps: List[EmploymentGap] = Field(default_factory=list)
    years_of_experience: float
    raw_text: str

class QAAnswer(BaseModel):
    answer: str
    evidence: Optional[str] = None
    grounded: bool          # False if the model had to say "not specified"

class Evaluation(BaseModel):
    candidate_name: str
    email: Optional[str] = None
    primary_skillset: List[str]
    years_of_experience: float
    education: str
    employment_gaps: List[EmploymentGap] = Field(default_factory=list)
    recommended_role: str
    evaluation_notes: str
    evidence: Dict[str, str] = Field(default_factory=dict)   # field_name -> supporting resume snippet
