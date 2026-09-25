import os
import uuid
import json
import logging
from typing import Dict, Any
from pydantic import ValidationError

from backend.app.schemas import CandidateProfile, Evaluation, QAAnswer, Candidate, EmploymentGap
from backend.app.parsing.pdf_extract import extract_text_from_pdf
from backend.app.parsing.gap_detector import calculate_years_of_experience, detect_employment_gaps
from backend.app.documents.pdf_builder import generate_evaluation_pdf
from backend.app.dispatch.mailer import mailer
from backend.app.llm.provider import llm_provider, clean_json_string
from backend.app.llm.prompts import (
    SYSTEM_PROMPT,
    PARSE_RESUME_PROMPT,
    EVALUATE_PROMPT_TEMPLATE,
    RETRY_PROMPT_TEMPLATE
)
from backend.app.db.session import SessionLocal
from backend.app.db.models import CandidateDB, EvaluationDB, AgentRunDB

logger = logging.getLogger(__name__)

def log_agent_run(candidate_id: str, step: str, status: str, detail: str = ""):
    """Logs an agent execution step to the SQLite agent_runs table."""
    try:
        db = SessionLocal()
        run_record = AgentRunDB(
            id=str(uuid.uuid4()),
            candidate_id=candidate_id,
            step=step,
            status=status,
            detail=detail
        )
        db.add(run_record)
        db.commit()
        db.close()
    except Exception as e:
        logger.error(f"Failed to log agent run: {e}")

def parse_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extracts raw text from PDF (if not already extracted) and uses LLM
    structured extraction to build the initial CandidateProfile.
    """
    resume_id = state.get("resume_id", str(uuid.uuid4()))
    raw_text = state.get("raw_text", "")
    profile = state.get("profile")

    # If raw_text is missing but pdf path is in state or resume_id file exists
    if not raw_text and state.get("pdf_path") and os.path.exists(state["pdf_path"]):
        raw_text = extract_text_from_pdf(state["pdf_path"])

    if not profile:
        # Prompt LLM to extract structured data from raw_text
        prompt = PARSE_RESUME_PROMPT.format(
            schema=json.dumps(CandidateProfile.model_json_schema(), indent=2),
            raw_text=raw_text
        )
        raw_output = llm_provider.call_llm(SYSTEM_PROMPT, prompt, json_mode=True)
        try:
            profile_data = json.loads(clean_json_string(raw_output))
            profile_data["raw_text"] = raw_text
            profile = CandidateProfile.model_validate(profile_data)
        except Exception as e:
            logger.warning(f"Error parsing profile from LLM output: {e}. Fallback minimal profile.")
            # Graceful fallback: extract what we can
            profile = CandidateProfile(
                candidate=Candidate(name="Candidate"),
                years_of_experience=0.0,
                raw_text=raw_text
            )

    detail = f"Extracted candidate '{profile.candidate.name}' with {len(profile.experience)} work roles and {len(profile.education)} education items."
    log_agent_run(resume_id, "parse", "ok", detail)

    return {
        "resume_id": resume_id,
        "raw_text": raw_text,
        "profile": profile,
        "current_step": "parse"
    }

def compute_facts_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    CRITICAL ANTI-HALLUCINATION NODE:
    Deterministically computes years_of_experience and detects employment_gaps
    using pure Python datetime arithmetic. Never delegated to an LLM.
    """
    resume_id = state["resume_id"]
    profile: CandidateProfile = state["profile"]
    raw_text = state.get("raw_text", profile.raw_text if profile else "")

    # Deterministic calculations
    years_exp = calculate_years_of_experience(profile.experience)
    gaps = detect_employment_gaps(profile.experience, raw_text=raw_text, threshold_days=60)

    # Set as absolute ground truth in the profile
    profile.years_of_experience = years_exp
    profile.employment_gaps = gaps
    profile.raw_text = raw_text

    # Persist or update Candidate in SQLite
    try:
        db = SessionLocal()
        existing = db.query(CandidateDB).filter(CandidateDB.id == resume_id).first()
        if existing:
            existing.profile_json = profile.model_dump_json()
            existing.raw_text = raw_text
        else:
            new_cand = CandidateDB(
                id=resume_id,
                profile_json=profile.model_dump_json(),
                raw_text=raw_text
            )
            db.add(new_cand)
        db.commit()
        db.close()
    except Exception as e:
        logger.error(f"Failed to persist candidate in db: {e}")

    detail = f"Computed {years_exp} yrs exp. Detected {len(gaps)} gap(s): {[g.period for g in gaps]}."
    log_agent_run(resume_id, "compute_facts", "ok", detail)

    return {
        "profile": profile,
        "current_step": "compute_facts"
    }

def evaluate_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Invokes LLM to produce candidate evaluation JSON with evidence citations.
    """
    resume_id = state["resume_id"]
    profile: CandidateProfile = state["profile"]

    prompt = EVALUATE_PROMPT_TEMPLATE.format(
        profile_json=profile.model_dump_json(indent=2),
        evaluation_json_schema=json.dumps(Evaluation.model_json_schema(), indent=2)
    )

    raw_eval_json = llm_provider.call_llm(SYSTEM_PROMPT, prompt, json_mode=True)
    
    log_agent_run(resume_id, "evaluate", "ok", "LLM evaluation draft generated.")
    return {
        "raw_evaluation_output": raw_eval_json,
        "current_step": "evaluate"
    }

def validate_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    CRITICAL VALIDATION NODE:
    Validates LLM output against Pydantic schema.
    If fails, records validation errors and allows routing to retry_node (max 2 retries).
    """
    resume_id = state["resume_id"]
    raw_output = state.get("raw_evaluation_output", "")
    retry_count = state.get("retry_count", 0)

    try:
        cleaned = clean_json_string(raw_output)
        evaluation = Evaluation.model_validate_json(cleaned)

        # Also enforce that deterministic facts match profile ground truth
        profile: CandidateProfile = state.get("profile")
        if profile:
            evaluation.years_of_experience = profile.years_of_experience
            evaluation.employment_gaps = profile.employment_gaps
            if not evaluation.email and profile.candidate.email:
                evaluation.email = profile.candidate.email

        log_agent_run(resume_id, "validate", "ok", "Successfully validated against Evaluation schema.")
        return {
            "evaluation": evaluation,
            "validation_errors": [],
            "current_step": "validate"
        }
    except (ValidationError, Exception) as e:
        error_msgs = []
        if isinstance(e, ValidationError):
            error_msgs = [f"{err['loc']}: {err['msg']}" for err in e.errors()]
        else:
            error_msgs = [f"JSON Parse Error: {str(e)}"]

        new_retry = retry_count + 1
        log_agent_run(resume_id, "validate", "error" if new_retry > 2 else "retry", f"Validation failed (Attempt {new_retry}): {'; '.join(error_msgs)}")
        logger.warning(f"Evaluation validation failed (retry {new_retry}/2): {error_msgs}")

        return {
            "validation_errors": error_msgs,
            "retry_count": new_retry,
            "current_step": "validate"
        }

def retry_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Re-prompts the LLM with the exact validation errors and schema.
    """
    resume_id = state["resume_id"]
    profile: CandidateProfile = state["profile"]
    errors = state.get("validation_errors", [])
    retry_count = state.get("retry_count", 1)

    prompt = RETRY_PROMPT_TEMPLATE.format(
        pydantic_error_list="\n".join(f"- {err}" for err in errors),
        profile_json=profile.model_dump_json(indent=2)
    )

    corrected_output = llm_provider.call_llm(SYSTEM_PROMPT, prompt, json_mode=True)
    log_agent_run(resume_id, "retry", "ok", f"Re-prompted LLM with schema errors (attempt {retry_count}).")

    return {
        "raw_evaluation_output": corrected_output,
        "current_step": "retry"
    }

def document_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Uses ReportLab to generate a corporate executive PDF report.
    """
    resume_id = state["resume_id"]
    evaluation: Evaluation = state.get("evaluation")
    profile: CandidateProfile = state.get("profile")

    # If evaluation was missing due to max retry failure, construct a safe verified fallback
    if not evaluation and profile:
        primary_skills = []
        for val in profile.skills.model_dump().values():
            if isinstance(val, list):
                primary_skills.extend(val)
        evaluation = Evaluation(
            candidate_name=profile.candidate.name,
            email=profile.candidate.email,
            primary_skillset=primary_skills[:6] if primary_skills else ["Not specified"],
            years_of_experience=profile.years_of_experience,
            education=profile.education[0].institution if profile.education else "Not specified",
            employment_gaps=profile.employment_gaps,
            recommended_role="Candidate Review Required",
            evaluation_notes="Automated evaluation generated from verified profile facts after validation correction.",
            evidence={"years_of_experience": "Calculated from documented start and end dates."}
        )

    # Output path for PDF
    output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "storage", "evaluations")
    os.makedirs(output_dir, exist_ok=True)
    pdf_filename = f"evaluation_{resume_id}_{uuid.uuid4().hex[:6]}.pdf"
    pdf_path = os.path.join(output_dir, pdf_filename)

    generate_evaluation_pdf(evaluation, pdf_path, profile=profile)

    log_agent_run(resume_id, "document", "ok", f"PDF report generated: {pdf_filename}")
    return {
        "evaluation": evaluation,
        "pdf_path": pdf_path,
        "current_step": "document"
    }

def dispatch_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Dispatches evaluation report via mock/real SMTP and records status in SQLite.
    """
    resume_id = state["resume_id"]
    evaluation: Evaluation = state.get("evaluation")
    pdf_path = state.get("pdf_path")
    dispatch_to_hr = state.get("dispatch_to_hr", True)

    dispatch_status = "SKIPPED"
    if dispatch_to_hr and evaluation and pdf_path:
        res = mailer.dispatch_evaluation(
            candidate_name=evaluation.candidate_name,
            pdf_path=pdf_path,
            evaluation_summary=evaluation.evaluation_notes,
            recipient=None
        )
        dispatch_status = res.get("status", "MOCKED")

    # Save to evaluations table in SQLite
    eval_id = str(uuid.uuid4())
    try:
        db = SessionLocal()
        eval_record = EvaluationDB(
            id=eval_id,
            candidate_id=resume_id,
            evaluation_json=evaluation.model_dump_json() if evaluation else "{}",
            pdf_path=pdf_path,
            dispatch_status=dispatch_status
        )
        db.add(eval_record)
        db.commit()
        db.close()
    except Exception as e:
        logger.error(f"Failed to save evaluation to SQLite: {e}")

    log_agent_run(resume_id, "dispatch", "ok", f"Evaluation dispatched with status: {dispatch_status}")
    return {
        "evaluation_id": eval_id,
        "dispatch_status": dispatch_status,
        "current_step": "dispatch"
    }
