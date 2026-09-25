import json
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.schemas import QAAnswer
from backend.app.llm.provider import llm_provider, clean_json_string
from backend.app.llm.prompts import SYSTEM_PROMPT, QA_PROMPT_TEMPLATE
from backend.app.db.session import get_db
from backend.app.db.models import CandidateDB

router = APIRouter(prefix="/api", tags=["chat"])

class ChatRequest(BaseModel):
    resume_id: Optional[str] = None
    candidate_id: Optional[str] = None
    question: str

@router.post("/chat", response_model=QAAnswer)
@router.post("/chat/ask", response_model=QAAnswer)
async def chat_with_resume(
    payload: ChatRequest,
    db: Session = Depends(get_db)
):
    """
    Evidence-grounded Q&A endpoint.
    Strictly forbids hallucination or guessing.
    If information is not present or an employment gap has no documented reason,
    returns grounded=False and 'Not specified in the resume.'
    """
    target_id = payload.resume_id or payload.candidate_id
    if not target_id:
        raise HTTPException(status_code=400, detail="candidate_id or resume_id required")

    cand = db.query(CandidateDB).filter(CandidateDB.id == target_id).first()
    if not cand:
        raise HTTPException(status_code=404, detail="Candidate not found")

    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    prompt = QA_PROMPT_TEMPLATE.format(
        profile_json=cand.profile_json,
        raw_text=cand.raw_text,
        question=question
    )

    llm_resp = llm_provider.call_llm(SYSTEM_PROMPT, prompt, json_mode=True)
    
    try:
        data = json.loads(clean_json_string(llm_resp))
        answer = data.get("answer", "Not specified in the resume.")
        evidence = data.get("evidence")
        grounded = data.get("grounded", True)

        # Enforce anti-hallucination rules on response text
        lower_ans = answer.lower()
        if "not specified" in lower_ans or not evidence:
            if "not specified" in lower_ans:
                grounded = False

        q_lower = question.lower()
        cand_text_lower = (cand.raw_text + " " + cand.profile_json).lower()

        # Check for company or entity inquiries not present in candidate's document
        common_entities = ["microsoft", "google", "apple", "meta", "netflix", "amazon", "uber", "salesforce"]
        for entity in common_entities:
            if entity in q_lower and entity not in cand_text_lower:
                answer = "Not specified in the resume."
                evidence = None
                grounded = False
                break
        
        # Check gap inquiry heuristics: if user asks 'why' about a gap and resume has no reason
        if any(w in q_lower for w in ["why", "reason"]) and any(w in q_lower for w in ["gap", "break", "leave", "left"]):
            p_data = json.loads(cand.profile_json)
            gaps = p_data.get("employment_gaps", [])
            has_explained = any(g.get("status") == "explained" for g in gaps)
            if not has_explained:
                answer = "Not specified in the resume. The resume documents an employment interval but does not state a reason for it."
                evidence = None
                grounded = False

        return QAAnswer(
            answer=answer,
            evidence=evidence,
            grounded=grounded
        )
    except Exception as e:
        # Fallback safe response adhering to anti-hallucination standards
        return QAAnswer(
            answer="Not specified in the resume.",
            evidence=None,
            grounded=False
        )
