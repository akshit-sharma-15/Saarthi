import os
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.app.db.session import init_db, SessionLocal
from backend.app.db.models import CandidateDB
from backend.app.routes.resume import router as resume_router
from backend.app.routes.chat import router as chat_router
from backend.app.routes.evaluate import router as evaluate_router

SAMPLE_CANDIDATES = [
    {"id": "sample-aarav-sharma", "file": "aarav_sharma.json"},
    {"id": "sample-priya-mehta", "file": "priya_mehta.json"},
    {"id": "sample-rohit-verma", "file": "rohit_verma.json"},
    {"id": "sample-sneha-iyer", "file": "sneha_iyer.json"},
    {"id": "sample-arjun-nair", "file": "arjun_nair.json"},
]

def seed_sample_candidates_if_needed():
    """Seeds all sample resumes into the database if they don't already exist."""
    try:
        db = SessionLocal()
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        samples_dir = os.path.join(base_dir, "sample_resumes")

        for sample in SAMPLE_CANDIDATES:
            existing = db.query(CandidateDB).filter(CandidateDB.id == sample["id"]).first()
            if not existing:
                sample_path = os.path.join(samples_dir, sample["file"])
                if os.path.exists(sample_path):
                    with open(sample_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    cand = CandidateDB(
                        id=sample["id"],
                        profile_json=json.dumps(data),
                        raw_text=data.get("raw_text", "")
                    )
                    db.add(cand)
                    db.commit()
                    name = data.get("candidate", {}).get("name", sample["id"])
                    print(f"Seeded sample candidate '{name}' ({sample['id']}) into database.")
        db.close()
    except Exception as e:
        print(f"Sample candidate seeding notice: {e}")

# Initialize tables on import
init_db()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize SQLite tables and seed fixtures
    init_db()
    seed_sample_candidates_if_needed()
    yield

app = FastAPI(
    title="AI Recruiter Copilot",
    description="Evidence-Driven Candidate Evaluation Agent with Deterministic Parsing and LangGraph Orchestration",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware for local frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(resume_router)
app.include_router(chat_router)
app.include_router(evaluate_router)

# Mount storage directory for static assets if needed
storage_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "storage")
os.makedirs(storage_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=storage_dir), name="static")

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "app": "AI Recruiter Copilot",
        "version": "1.0.0",
        "features": [
            "Deterministic Experience Math",
            "Unexplained Gap Detection",
            "LangGraph Agentic Evaluation",
            "Pydantic Validation Retry Loop",
            "Server-Sent Events (SSE) Progress",
            "ReportLab Corporate PDF Artifacts"
        ]
    }

@app.get("/")
def root():
    return {
        "message": "AI Recruiter Copilot API is running. Visit /docs for Swagger UI documentation."
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    reload = os.getenv("ENV", "development").lower() == "development"
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=port, reload=reload)
