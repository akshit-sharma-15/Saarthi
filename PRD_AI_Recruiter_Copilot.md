# PRD — AI Recruiter Copilot
### Evidence-Driven Candidate Evaluation Agent

**Version:** 1.0
**Owner:** (you)
**Status:** Draft for build (target: 3–5 hr implementation window)

---

## 1. Problem Statement

Recruiters manually re-read resumes to answer simple questions ("does this
person know AWS?", "how long have they worked?", "why is there a gap in
2023–2025?") and then manually retype the same facts into an HR evaluation
form. This is slow, inconsistent, and prone to the reviewer either missing
details or unconsciously inventing explanations for ambiguous facts (like
employment gaps).

## 2. Product Vision

> An evidence-driven AI HR agent that doesn't just understand a resume — it
> answers recruiter questions and autonomously converts verified candidate
> information into an actionable HR evaluation artifact.

The differentiator is **evidence-grounding**: every fact the AI states (a
skill, a gap, a years-of-experience number) is traceable to a specific line
in the resume. If it isn't in the resume, the system says so — it never
infers or invents.

## 3. Goals / Non-Goals

**Goals**
- Parse an uploaded resume (PDF or mock JSON) into a structured candidate
  profile.
- Let a recruiter ask free-text questions about the candidate and get
  answers grounded only in the resume, with an evidence citation.
- Detect and flag ambiguous facts (esp. employment gaps) without inventing
  a reason.
- On request, autonomously run a multi-step agent workflow that produces a
  structured HR evaluation, renders it as a PDF, and dispatches it (real or
  mocked email) to HR — visualized step-by-step in the UI.

**Non-Goals (out of scope for v1)**
- Multi-candidate ranking / bulk screening.
- Real ATS integration, SSO, authentication, multi-user roles.
- Vector database / semantic search across many resumes (single-resume
  context fits in a prompt; RAG is a "next iteration" item, see §9).
- Resume writing/optimization (this is an *evaluator*, not a resume coach).

## 4. Users & Use Case

**Primary user:** a recruiter/HR reviewer evaluating one candidate at a
time.

**Core flow (all three tasks from the assignment map onto one journey):**

```
Upload resume → Review structured profile → Ask questions →
Request evaluation → Watch agent execute → Download PDF / confirm HR dispatch
```

## 5. Functional Requirements

### FR1 — Upload & Parse
- Accept a PDF resume (primary) and a mock JSON resume (fallback / test
  fixture), see `docs/sample_resumes/`.
- Extract into the structured schema in §7 (Data Model).
- Detect **employment gaps**: any interval between `end_date` of one role
  and `start_date` of the next role beyond a configurable threshold
  (default 60 days) is flagged as `"status": "unexplained"` unless the
  resume text itself states a reason (e.g. "career break to study").
- Compute `years_of_experience` deterministically from parsed date ranges
  (not asked of the LLM as a number).

### FR2 — Natural-Language Q&A
- Recruiter submits a free-text question.
- System retrieves only the structured profile + raw resume text as
  context (no external knowledge, no other candidates).
- Answer must:
  - Be grounded only in supplied context.
  - Say **"Not specified in the resume"** for anything absent, rather than
    infer.
  - Include a short **evidence pointer** (which section/line supports the
    claim) shown in the UI under the answer.
  - Never explain *why* a gap exists unless the resume states it.

### FR3 — Agentic Evaluation & Dispatch
- Recruiter can type a natural-language instruction, e.g. *"Prepare the
  candidate evaluation and send it to HR."*
- This triggers an explicit, visualized multi-step agent run (§8, LLD has
  the graph): parse → extract → evaluate → validate → generate PDF →
  dispatch.
- Each step posts a status update to the UI (checklist style: `✓ Parsed
  resume`, `✓ Employment gap detected`, ...).
- Output: a structured evaluation object (§7) validated against a Pydantic
  schema before it's allowed to render as a PDF.
- Final actions offered: **Download PDF** and **Send to HR** (mocked SMTP
  by default, real SMTP optional).

## 6. Anti-Hallucination Requirements (explicitly graded by evaluators)

These are treated as first-class requirements, not just prompt style:

1. Never invent candidate information not present in the resume.
2. If information is absent → respond "Not specified in the resume."
3. Never infer a *reason* for an employment gap unless stated.
4. Every generated fact must be distinguishable as "documented" vs.
   "interpretation."
5. Cite the resume section/snippet backing each answer where possible.
6. No external/world knowledge about the named candidate.
7. Structured outputs (evaluation JSON) must pass Pydantic validation
   before being used to generate a document; failed validation triggers a
   bounded retry/correction loop, not silent pass-through.

## 7. Data Model (canonical candidate profile)

```json
{
  "candidate": {"name": "", "email": "", "phone": "", "location": ""},
  "education": [{"institution": "", "degree": "", "field": "", "year": ""}],
  "experience": [
    {
      "company": "", "title": "",
      "start_date": "YYYY-MM", "end_date": "YYYY-MM or 'present'",
      "responsibilities": [""]
    }
  ],
  "skills": {
    "programming": [], "frameworks": [], "cloud": [],
    "databases": [], "tools": []
  },
  "projects": [{"name": "", "description": "", "evidence": ""}],
  "certifications": [],
  "employment_gaps": [
    {"period": "2023-03 to 2025-01", "status": "unexplained", "reason": null}
  ],
  "years_of_experience": 3.2,
  "raw_text": ""
}
```

Evaluation output (agent's final artifact) extends this with
`recommended_role`, `evaluation_notes`, and an `evidence` map keyed per
field — see LLD §4 for the full schema.

## 8. Success Metrics (how a grader / demo will judge this)

| Area | Test | Pass condition |
|---|---|---|
| Parsing | Upload sample resume | All schema fields populated or explicitly null |
| Grounded Q&A | Ask about a skill present in resume | Correct answer + evidence snippet |
| Hallucination control | Ask about something absent (e.g. "Worked at Microsoft?") | "Not specified in the resume." — no invention |
| Grey-area handling | Ask "why did they leave ABC?" when unstated | States gap exists, refuses to invent reason |
| Agentic action | "Prepare evaluation and send to HR" | Visible step-by-step execution, valid JSON, PDF generated, dispatch logged |
| Validation | Malformed LLM field (e.g. non-numeric experience) | Caught by Pydantic, retried/corrected, not passed through |

## 9. Roadmap (explicitly "next iteration," not v1)

- Vector store (FAISS/Chroma) for multi-resume semantic search once volume
  grows past single-document context size.
- Real SMTP + HR inbox integration.
- Multi-candidate comparison/ranking view.
- Auth + multi-recruiter accounts + audit log persistence beyond SQLite.

## 10. Assumptions & Mocking

Per assignment allowance ("mock any missing APIs/UI/DB"):
- Email dispatch defaults to a **mock sender** that writes a structured log
  entry (`to`, `subject`, `attachment`, `status: SENT`) instead of hitting
  real SMTP, with a config flag to switch to real SMTP later.
- LLM provider is abstracted behind an env var (`LLM_PROVIDER`) so the demo
  isn't hard-coupled to one vendor.
- Storage is SQLite for `candidates`, `evaluations`, `agent_runs` — no
  external DB dependency required to run the demo.
