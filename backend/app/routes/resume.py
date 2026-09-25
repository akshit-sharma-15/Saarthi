import os
import uuid
import json
import shutil
from typing import Optional
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.app.schemas import CandidateProfile, Candidate
from backend.app.parsing.pdf_extract import extract_text_from_pdf
from backend.app.parsing.gap_detector import calculate_years_of_experience, detect_employment_gaps
from backend.app.llm.provider import llm_provider, clean_json_string
from backend.app.llm.prompts import SYSTEM_PROMPT, PARSE_RESUME_PROMPT
from backend.app.db.session import get_db
from backend.app.db.models import CandidateDB

router = APIRouter(prefix="/api", tags=["resume"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "storage", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

class ParseRequest(BaseModel):
    resume_id: str

@router.post("/resume/upload")
async def upload_resume(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Accepts PDF or JSON resume, parses content, runs deterministic facts calculation,
    stores profile into SQLite, and returns resume_id and profile.
    """
    resume_id = str(uuid.uuid4())
    filename = file.filename or "resume.pdf"
    file_ext = os.path.splitext(filename)[1].lower()

    saved_path = os.path.join(UPLOAD_DIR, f"{resume_id}_{filename}")
    with open(saved_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    raw_text = ""
    profile: Optional[CandidateProfile] = None

    from backend.app.parsing.normalizer import normalize_profile_data

    if file_ext == ".json":
        try:
            with open(saved_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            raw_text = data.get("raw_text", "")
            if not raw_text:
                raw_text = json.dumps(data, indent=2)
            data["raw_text"] = raw_text
            normalized = normalize_profile_data(data, raw_text=raw_text, filename=filename)
            profile = CandidateProfile.model_validate(normalized)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid JSON resume format: {str(e)}")
    elif file_ext == ".pdf":
        try:
            raw_text = extract_text_from_pdf(saved_path)
            if not raw_text.strip():
                raise HTTPException(status_code=400, detail="Could not extract readable text from PDF.")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse PDF: {str(e)}")
    else:
        # Accept plain text as fallback
        try:
            with open(saved_path, "r", encoding="utf-8", errors="ignore") as f:
                raw_text = f.read()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {str(e)}")

    # If profile not yet built (e.g. from PDF or TXT), parse using structured LLM call
    if not profile:
        prompt = PARSE_RESUME_PROMPT.format(
            schema=json.dumps(CandidateProfile.model_json_schema(), indent=2),
            raw_text=raw_text
        )
        llm_resp = llm_provider.call_llm(SYSTEM_PROMPT, prompt, json_mode=True)
        try:
            p_data = json.loads(clean_json_string(llm_resp))
        except Exception:
            p_data = {}
        normalized = normalize_profile_data(p_data, raw_text=raw_text, filename=filename)
        profile = CandidateProfile.model_validate(normalized)

    # CRITICAL: Always run deterministic Python fact computation (never trust LLM for dates/gaps)
    years_exp = calculate_years_of_experience(profile.experience)
    gaps = detect_employment_gaps(profile.experience, raw_text=raw_text, threshold_days=60)
    profile.years_of_experience = years_exp
    profile.employment_gaps = gaps
    profile.raw_text = raw_text

    # Persist in SQLite
    cand_db = CandidateDB(
        id=resume_id,
        profile_json=profile.model_dump_json(),
        raw_text=raw_text
    )
    db.add(cand_db)
    db.commit()

    return {
        "resume_id": resume_id,
        "filename": filename,
        "profile": profile.model_dump()
    }

@router.post("/resume/parse", response_model=CandidateProfile)
async def parse_resume(
    payload: ParseRequest,
    db: Session = Depends(get_db)
):
    """Fetches or re-evaluates parsed CandidateProfile for a resume_id."""
    cand = db.query(CandidateDB).filter(CandidateDB.id == payload.resume_id).first()
    if not cand:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    return CandidateProfile.model_validate_json(cand.profile_json)

@router.get("/candidate/{resume_id}", response_model=CandidateProfile)
async def get_candidate(
    resume_id: str,
    db: Session = Depends(get_db)
):
    """Fetches candidate profile by resume_id."""
    cand = db.query(CandidateDB).filter(CandidateDB.id == resume_id).first()
    if not cand:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    return CandidateProfile.model_validate_json(cand.profile_json)

@router.get("/candidates")
async def list_candidates(db: Session = Depends(get_db)):
    """Lists all stored candidates."""
    records = db.query(CandidateDB).order_by(CandidateDB.created_at.desc()).all()
    results = []
    for r in records:
        try:
            p = json.loads(r.profile_json)
            name = p.get("candidate", {}).get("name", "Unknown")
            email = p.get("candidate", {}).get("email")
            years = p.get("years_of_experience", 0.0)
            gaps_count = len(p.get("employment_gaps", []))
            results.append({
                "id": r.id,
                "name": name,
                "email": email,
                "years_of_experience": years,
                "gaps_count": gaps_count,
                "created_at": str(r.created_at)
            })
        except Exception:
            results.append({"id": r.id, "name": "Candidate", "created_at": str(r.created_at)})
    return results
