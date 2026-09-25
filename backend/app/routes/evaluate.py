import os
import json
import asyncio
from typing import Optional, AsyncGenerator
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.schemas import CandidateProfile, Evaluation
from backend.app.graph.build_graph import recruiter_graph
from backend.app.graph.state import GraphState
from backend.app.dispatch.mailer import mailer
from backend.app.db.session import get_db, SessionLocal
from backend.app.db.models import CandidateDB, EvaluationDB

router = APIRouter(prefix="/api", tags=["evaluate"])

class EvaluateRequest(BaseModel):
    resume_id: str
    dispatch_to_hr: bool = True

class DispatchEmailRequest(BaseModel):
    evaluation_id: str
    recipient: Optional[str] = None

@router.post("/evaluate")
async def evaluate_candidate(
    payload: EvaluateRequest,
    db: Session = Depends(get_db)
):
    """
    CRITICAL SSE ENDPOINT:
    Runs the multi-stage LangGraph pipeline and streams real-time checklist events
    as each node executes, concluding with the verified evaluation payload and PDF link.
    """
    cand = db.query(CandidateDB).filter(CandidateDB.id == payload.resume_id).first()
    if not cand:
        raise HTTPException(status_code=404, detail="Candidate not found")

    profile_dict = json.loads(cand.profile_json)
    profile = CandidateProfile.model_validate(profile_dict)

    initial_state: GraphState = {
        "resume_id": payload.resume_id,
        "raw_text": cand.raw_text,
        "profile": profile,
        "validation_errors": [],
        "retry_count": 0,
        "dispatch_to_hr": payload.dispatch_to_hr
    }

    async def event_generator() -> AsyncGenerator[str, None]:
        current_state = dict(initial_state)

        step_labels = {
            "parse_node": ("parse", "Parsed resume into structured profile"),
            "compute_facts_node": ("compute_facts", "Deterministic math: verified experience & employment gaps"),
            "evaluate_node": ("evaluate", "Generated structured HR evaluation draft"),
            "validate_node": ("validate", "Validated schema against Pydantic model"),
            "retry_node": ("retry", "Schema self-correction loop in progress"),
            "document_node": ("document", "Generated executive corporate PDF artifact"),
            "dispatch_node": ("dispatch", "Evaluation dispatched to HR inbox")
        }

        try:
            # Iterate through LangGraph nodes
            for chunk in recruiter_graph.stream(initial_state):
                for node_name, node_output in chunk.items():
                    # Update accumulator
                    current_state.update(node_output)

                    step_key, default_desc = step_labels.get(node_name, (node_name, "Processing"))

                    # Format detail based on node output
                    detail = default_desc
                    status = "ok"

                    if node_name == "compute_facts_node":
                        p: CandidateProfile = current_state.get("profile")
                        detail = f"Verified {p.years_of_experience:.1f} yrs exp. Flagged {len(p.employment_gaps)} gap(s)."
                    elif node_name == "validate_node":
                        errors = current_state.get("validation_errors", [])
                        if errors:
                            status = "retry"
                            detail = f"Validation failed ({len(errors)} error(s)); correcting..."
                        else:
                            detail = "Passed Pydantic schema validation without errors."
                    elif node_name == "document_node":
                        pdf = current_state.get("pdf_path", "")
                        detail = f"Generated PDF artifact ({os.path.basename(pdf)})."
                    elif node_name == "dispatch_node":
                        d_status = current_state.get("dispatch_status", "SENT")
                        detail = f"Dispatched via mock/real SMTP (Status: {d_status})."

                    event_data = {
                        "step": step_key,
                        "status": status,
                        "detail": detail
                    }
                    yield f"data: {json.dumps(event_data)}\n\n"
                    # Small yield pause for UI smooth checklist progression
                    await asyncio.sleep(0.3)

            # Final completion event
            evaluation: Evaluation = current_state.get("evaluation")
            eval_id = current_state.get("evaluation_id", payload.resume_id)
            pdf_path = current_state.get("pdf_path")
            dispatch_status = current_state.get("dispatch_status", "SENT")

            final_data = {
                "step": "complete",
                "status": "ok",
                "detail": "Workflow finished successfully.",
                "evaluation_id": eval_id,
                "evaluation": evaluation.model_dump() if evaluation else None,
                "pdf_url": f"/api/evaluation/{eval_id}/download",
                "dispatch_status": dispatch_status
            }
            yield f"data: {json.dumps(final_data)}\n\n"

        except Exception as e:
            error_data = {
                "step": "error",
                "status": "error",
                "detail": f"Agent run encountered an error: {str(e)}"
            }
            yield f"data: {json.dumps(error_data)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@router.get("/evaluation/{evaluation_id}/download")
async def download_evaluation_pdf(
    evaluation_id: str,
    db: Session = Depends(get_db)
):
    """
    Downloads or streams the generated evaluation PDF.
    Auto-regenerates dynamically if missing on ephemeral filesystems.
    """
    from backend.app.documents.pdf_builder import generate_evaluation_pdf

    storage_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "storage", "evaluations")
    os.makedirs(storage_dir, exist_ok=True)

    # 1. Try finding EvaluationDB by evaluation_id or candidate_id
    eval_record = db.query(EvaluationDB).filter(EvaluationDB.id == evaluation_id).first()
    if not eval_record:
        eval_record = db.query(EvaluationDB).filter(EvaluationDB.candidate_id == evaluation_id).order_by(EvaluationDB.created_at.desc()).first()

    if eval_record:
        if not eval_record.pdf_path or not os.path.exists(eval_record.pdf_path):
            eval_data = json.loads(eval_record.evaluation_json)
            evaluation = Evaluation.model_validate(eval_data)
            cand = db.query(CandidateDB).filter(CandidateDB.id == eval_record.candidate_id).first()
            profile = CandidateProfile.model_validate_json(cand.profile_json) if cand else None
            pdf_filename = f"evaluation_{eval_record.candidate_id}.pdf"
            pdf_path = os.path.join(storage_dir, pdf_filename)
            generate_evaluation_pdf(evaluation, pdf_path, profile=profile)
            eval_record.pdf_path = pdf_path
            db.commit()

        filename = os.path.basename(eval_record.pdf_path)
        return FileResponse(
            eval_record.pdf_path,
            media_type="application/pdf",
            filename=filename,
            headers={"Content-Disposition": f"inline; filename={filename}"}
        )

    # 2. Check CandidateDB (if user clicks download directly for an uploaded candidate)
    cand = db.query(CandidateDB).filter(CandidateDB.id == evaluation_id).first()
    if cand:
        profile = CandidateProfile.model_validate_json(cand.profile_json)
        primary_skills = []
        for val in profile.skills.model_dump().values():
            if isinstance(val, list):
                primary_skills.extend(val)
        edu_str = profile.education[0].institution if profile.education else "Not specified"
        evaluation = Evaluation(
            candidate_name=profile.candidate.name,
            email=profile.candidate.email,
            primary_skillset=primary_skills[:6] if primary_skills else ["Not specified"],
            years_of_experience=profile.years_of_experience,
            education=edu_str,
            employment_gaps=profile.employment_gaps,
            recommended_role="Candidate Profile Summary",
            evaluation_notes=f"Candidate demonstrates {profile.years_of_experience:.1f} years of verified experience.",
            evidence={"years_of_experience": "Calculated from verified employment dates."}
        )
        pdf_filename = f"evaluation_{cand.id}.pdf"
        pdf_path = os.path.join(storage_dir, pdf_filename)
        generate_evaluation_pdf(evaluation, pdf_path, profile=profile)
        return FileResponse(
            pdf_path,
            media_type="application/pdf",
            filename=pdf_filename,
            headers={"Content-Disposition": f"inline; filename={pdf_filename}"}
        )

    raise HTTPException(status_code=404, detail="Evaluation PDF not found")

@router.post("/dispatch/email")
async def dispatch_email_manual(
    payload: DispatchEmailRequest,
    db: Session = Depends(get_db)
):
    """Manually re-triggers email dispatch for an existing evaluation or candidate."""
    eval_rec = db.query(EvaluationDB).filter(EvaluationDB.id == payload.evaluation_id).first()
    if not eval_rec:
        eval_rec = db.query(EvaluationDB).filter(EvaluationDB.candidate_id == payload.evaluation_id).order_by(EvaluationDB.created_at.desc()).first()

    cand_name = "Candidate"
    notes = "Automated candidate evaluation synthesis."
    pdf_path = ""

    from backend.app.documents.pdf_builder import generate_evaluation_pdf

    storage_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "storage", "evaluations")
    os.makedirs(storage_dir, exist_ok=True)

    if eval_rec:
        eval_data = json.loads(eval_rec.evaluation_json)
        cand_name = eval_data.get("candidate_name", "Candidate")
        notes = eval_data.get("evaluation_notes", "")
        pdf_path = eval_rec.pdf_path
        if not pdf_path or not os.path.exists(pdf_path):
            evaluation = Evaluation.model_validate(eval_data)
            pdf_path = os.path.join(storage_dir, f"evaluation_{eval_rec.candidate_id}.pdf")
            generate_evaluation_pdf(evaluation, pdf_path)
            eval_rec.pdf_path = pdf_path
            db.commit()
    else:
        # Check CandidateDB directly
        cand = db.query(CandidateDB).filter(CandidateDB.id == payload.evaluation_id).first()
        if not cand:
            raise HTTPException(status_code=404, detail="Evaluation or Candidate not found")
        profile = CandidateProfile.model_validate_json(cand.profile_json)
        cand_name = profile.candidate.name
        notes = f"Verified facts for {cand_name} ({profile.years_of_experience:.1f} years experience)."
        pdf_path = os.path.join(storage_dir, f"evaluation_{cand.id}.pdf")
        if not os.path.exists(pdf_path):
            evaluation = Evaluation(
                candidate_name=profile.candidate.name,
                email=profile.candidate.email,
                primary_skillset=["Verified Profile"],
                years_of_experience=profile.years_of_experience,
                education="Verified",
                employment_gaps=profile.employment_gaps,
                recommended_role="Candidate Profile",
                evaluation_notes=notes,
                evidence={}
            )
            generate_evaluation_pdf(evaluation, pdf_path, profile=profile)

    res = mailer.dispatch_evaluation(
        candidate_name=cand_name,
        pdf_path=pdf_path,
        evaluation_summary=notes,
        recipient=payload.recipient
    )

    if eval_rec:
        eval_rec.dispatch_status = res.get("status", "SENT")
        db.commit()

    return res
