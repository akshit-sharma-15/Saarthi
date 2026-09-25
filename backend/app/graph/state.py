from typing import TypedDict, Optional, List, Dict, Any
from backend.app.schemas import CandidateProfile, Evaluation

class GraphState(TypedDict, total=False):
    resume_id: str
    raw_text: str
    profile: Optional[CandidateProfile]
    evaluation: Optional[Evaluation]
    validation_errors: List[str]
    retry_count: int
    pdf_path: Optional[str]
    dispatch_status: Optional[str]
    dispatch_to_hr: bool
    raw_evaluation_output: Optional[str]
    current_step: Optional[str]
    step_history: List[Dict[str, Any]]
