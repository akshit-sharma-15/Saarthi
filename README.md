# AI Recruiter Copilot — Evidence-Driven Candidate Evaluation Agent

> An evidence-driven autonomous AI recruiter agent that verifies candidate claims, executes deterministic date arithmetic, refrains from inferring unexplained gaps, answers recruiter questions with line-level evidence citations, and autonomously orchestrates an HR evaluation workflow via LangGraph to generate executive corporate PDF artifacts and dispatch them via SMTP.

---

## 1. Key Differentiators & Anti-Hallucination Guarantees

1. **Deterministic Facts Engine (Python `datetime` math):**
   - `years_of_experience` is computed mathematically from parsed date ranges by merging overlapping intervals. The LLM **never** calculates or estimates this number.
   - `employment_gaps` (> 60 days) are detected deterministically and flagged as `status: "unexplained"` unless explicitly stated in the resume text. The agent strictly refuses to infer reasons.
2. **Evidence-Grounded Q&A:**
   - Every answer is traced directly to a resume excerpt.
   - If an attribute or past employer (e.g. Microsoft, Google) is absent from the resume, the system explicitly returns `"Not specified in the resume."` with `grounded: false`.
3. **LangGraph State Machine with Bounded Pydantic Validation Retry Loop:**
   - Multi-node pipeline: `parse_node` → `compute_facts_node` → `evaluate_node` → `validate_node` → `retry_node` (max 2 retries) → `document_node` → `dispatch_node`.
   - Structural schema validation using Pydantic v2. If schema validation fails, the error details are fed back to the LLM for self-correction.
4. **Real-time Server-Sent Events (SSE):**
   - The `/api/evaluate` endpoint streams real-time checklist events (`✓ Parsed resume`, `✓ Gap detected`, `✓ Validated`, etc.) directly to the UI.
5. **Corporate PDF Generation:**
   - Built using ReportLab, generating executive-grade reports with highlighted continuity gaps and evidence audit trails.

---

## 2. Architecture & Folder Structure

```
Saarthi Task/
├── backend/
│   ├── app/
│   │   ├── main.py                # FastAPI app, CORS, routes & seeding
│   │   ├── routes/
│   │   │   ├── resume.py          # /api/resume/upload, /api/resume/parse, /api/candidates
│   │   │   ├── chat.py            # /api/chat (Grounded Q&A)
│   │   │   └── evaluate.py        # /api/evaluate (SSE stream) & /api/evaluation/{id}/download
│   │   ├── graph/
│   │   │   ├── state.py           # GraphState TypedDict
│   │   │   ├── nodes.py           # parse, compute_facts, evaluate, validate, retry, document, dispatch
│   │   │   └── build_graph.py     # LangGraph StateGraph compilation
│   │   ├── llm/
│   │   │   ├── provider.py        # Provider-agnostic LLM switch (Gemini, OpenAI, LiteLLM, Mock fallback)
│   │   │   └── prompts.py         # Exact prompt templates from LLD Section 4
│   │   ├── schemas.py             # Canonical Pydantic v2 models (LLD Section 2)
│   │   ├── parsing/
│   │   │   ├── pdf_extract.py     # PyMuPDF raw text extraction
│   │   │   └── gap_detector.py    # Deterministic interval math & gap detector
│   │   ├── documents/
│   │   │   └── pdf_builder.py     # ReportLab corporate PDF report generator
│   │   ├── dispatch/
│   │   │   └── mailer.py          # Mock/Real SMTP dispatcher
│   │   └── db/
│   │       ├── models.py          # SQLAlchemy models (candidates, evaluations, agent_runs)
│   │       └── session.py         # SQLite database engine & sessionmaker
│   ├── sample_resumes/
│   │   ├── aarav_sharma.json      # Benchmark resume with deliberate unexplained gap (2023-02 to 2025-01)
│   │   └── aarav_sharma.pdf       # Compiled benchmark PDF
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── UploadPanel.jsx    # Drag-and-drop ingestion & sample loader
    │   │   ├── ProfileSummary.jsx # Candidate details with high-contrast gap alerts
    │   │   ├── ChatPanel.jsx      # Evidence-grounded Q&A with preset test queries
    │   │   └── AgentRunPanel.jsx  # Real-time SSE checklist & PDF download
    │   ├── api/client.js          # Axios API client
    │   └── App.jsx                # Responsive 3-panel recruiter dashboard
    ├── vite.config.js             # Vite configuration with API proxy
    ├── tailwind.config.js
    └── package.json
```

---

## 3. Quick Start Guide

### Step 1: Start Backend (FastAPI + LangGraph)

```bash
# From workspace root
python -m uvicorn backend.app.main:app --reload --port 8000
```
- API Swagger Docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

### Step 2: Start Frontend (React + Vite + Tailwind)

```bash
# In a new terminal
cd frontend
npm run dev
```
- Open `http://localhost:5173` in your browser.

---

## 4. Benchmark Testing Walkthrough (Aarav Sharma)

1. **Load Benchmark Candidate:**
   - In the left panel, click **"Load Benchmark Candidate (Aarav Sharma)"** (or drop `backend/sample_resumes/aarav_sharma.pdf`).
   - Notice the candidate profile renders with **5.3 yrs experience (Deterministic)** and a prominent **Red Alert Card**: `UNEXPLAINED GAP: 2023-02 to 2025-01`.
2. **Test Grounded Q&A:**
   - Click preset **"What are their primary programming languages?"** → Answer citing Python, Go, SQL with supporting evidence.
   - Click preset **"Did they work at Microsoft or Google?"** → Answer returns `"Not specified in the resume."` with `grounded: false`.
   - Click preset **"Why is there a gap between 2023 and 2025?"** → Answer states the interval exists but explicitly refuses to guess the reason.
3. **Execute Autonomous LangGraph Pipeline:**
   - In the right panel, click **"Generate HR Evaluation"**.
   - Watch the SSE checklist update step-by-step:
     - `✓ Parsed resume into structured profile`
     - `✓ Deterministic math: verified experience & employment gaps`
     - `✓ Generated structured HR evaluation draft`
     - `✓ Validated schema against Pydantic model`
     - `✓ Generated executive corporate PDF artifact`
     - `✓ Dispatched evaluation report to HR inbox`
   - Click **"Download Executive Evaluation PDF"** to view the generated corporate report.
