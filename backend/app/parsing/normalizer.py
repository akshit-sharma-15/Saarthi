import re
from typing import Dict, Any, List

TECH_SKILLS_KEYWORDS = {
    "programming": [
        "python", "javascript", "typescript", "golang", "go", "java", "c++", "c#", "ruby", "rust",
        "scala", "php", "swift", "kotlin", "r", "perl", "bash", "shell", "sql"
    ],
    "frameworks": [
        "fastapi", "flask", "django", "react", "next.js", "nextjs", "vue", "angular", "node.js",
        "nodejs", "express", "spring boot", "springboot", "svelte", "graphql", "tailwind", "bootstrap"
    ],
    "cloud": [
        "aws", "amazon web services", "azure", "gcp", "google cloud", "docker", "kubernetes", "k8s",
        "terraform", "ansible", "jenkins", "github actions", "gitlab ci", "argocd", "helm", "serverless"
    ],
    "databases": [
        "postgresql", "postgres", "mysql", "mongodb", "redis", "elasticsearch", "sqlite",
        "dynamodb", "cassandra", "snowflake", "bigquery", "oracle"
    ],
    "tools": [
        "git", "kafka", "rabbitmq", "linux", "prometheus", "grafana", "jira", "postman", "nginx"
    ]
}

def extract_skills_from_text(text: str) -> Dict[str, List[str]]:
    """Deterministically extracts technical skills from raw resume text."""
    lower_text = " " + text.lower() + " "
    found_skills: Dict[str, List[str]] = {
        "programming": [],
        "frameworks": [],
        "cloud": [],
        "databases": [],
        "tools": []
    }

    for category, skill_list in TECH_SKILLS_KEYWORDS.items():
        for skill in skill_list:
            # Match whole word
            pattern = r"(?:^|[\s,;./\(\)\[\]])" + re.escape(skill) + r"(?:$|[\s,;./\(\)\[\]])"
            if re.search(pattern, lower_text):
                # Standardize display name
                display_name = skill.title()
                if skill in ["aws", "gcp", "k8s", "sql", "ci/cd"]:
                    display_name = skill.upper()
                elif skill in ["fastapi", "next.js", "vue", "react", "docker", "kubernetes", "postgresql", "redis", "mongodb"]:
                    display_name = skill.capitalize()
                    if skill == "postgresql":
                        display_name = "PostgreSQL"
                    elif skill == "mongodb":
                        display_name = "MongoDB"
                    elif skill == "fastapi":
                        display_name = "FastAPI"
                found_skills[category].append(display_name)

    return found_skills

def normalize_profile_data(data: Any, raw_text: str = "", filename: str = "resume.pdf") -> Dict[str, Any]:
    """
    Guarantees that candidate profile dictionary strictly adheres to CandidateProfile schema,
    preventing any Pydantic validation crashes regardless of LLM output variations.
    """
    if not isinstance(data, dict):
        data = {}

    # 1. Candidate Info
    cand = data.get("candidate")
    if isinstance(cand, str):
        cand = {"name": cand.strip() or "Candidate"}
    elif not isinstance(cand, dict):
        cand = {"name": "Candidate"}

    if not cand.get("name") or cand["name"].lower() in ["candidate", "unknown", "none", ""]:
        # Try extracting name from top lines of raw_text
        extracted_name = None
        if raw_text:
            lines = [ln.strip() for ln in raw_text.split("\n") if ln.strip()]
            for line in lines[:5]:
                # Skip lines that look like emails, urls, or headers
                if "@" in line or "http" in line or len(line) > 40:
                    continue
                if re.match(r"^[A-Za-z\s\.\-']{2,35}$", line):
                    words = line.split()
                    if 1 <= len(words) <= 4:
                        extracted_name = line.title()
                        break
        if not extracted_name:
            # Fallback to filename without extension
            base = re.sub(r"^[0-9a-fA-F\-]{10,}_", "", filename)
            extracted_name = re.sub(r"\.[^.]+$", "", base).replace("_", " ").replace("-", " ").title()
        cand["name"] = extracted_name or "Candidate"

    # Extract email & phone from text if missing
    if not cand.get("email") and raw_text:
        em = re.search(r"[\w\.-]+@[\w\.-]+\.\w+", raw_text)
        if em:
            cand["email"] = em.group(0)

    if not cand.get("phone") and raw_text:
        ph = re.search(r"(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+?\d[\d\s-]{9,13}\d", raw_text)
        if ph:
            cand["phone"] = ph.group(0).strip()

    data["candidate"] = cand

    # 2. Skills Normalization
    raw_skills = data.get("skills", {})
    norm_skills = {"programming": [], "frameworks": [], "cloud": [], "databases": [], "tools": []}

    if isinstance(raw_skills, list):
        for s in raw_skills:
            if isinstance(s, str) and s.strip():
                norm_skills["programming"].append(s.strip())
    elif isinstance(raw_skills, dict):
        for k, v in raw_skills.items():
            k_clean = k.lower().strip()
            if isinstance(v, list):
                val_list = [str(x).strip() for x in v if str(x).strip()]
            elif isinstance(v, str):
                val_list = [x.strip() for x in v.split(",") if x.strip()]
            else:
                val_list = []

            if k_clean in norm_skills:
                norm_skills[k_clean].extend(val_list)
            else:
                norm_skills["tools"].extend(val_list)

    # If skills are empty or very sparse, scan raw_text
    total_skills = sum(len(v) for v in norm_skills.values())
    if total_skills == 0 and raw_text:
        norm_skills = extract_skills_from_text(raw_text)

    # Deduplicate within categories
    for cat in norm_skills:
        seen = set()
        deduped = []
        for sk in norm_skills[cat]:
            if sk.lower() not in seen:
                seen.add(sk.lower())
                deduped.append(sk)
        norm_skills[cat] = deduped

    data["skills"] = norm_skills

    # 3. Experience Normalization
    raw_exp = data.get("experience", [])
    if isinstance(raw_exp, dict):
        raw_exp = [raw_exp]
    elif not isinstance(raw_exp, list):
        raw_exp = []

    norm_exp = []
    for exp in raw_exp:
        if not isinstance(exp, dict):
            continue
        c = str(exp.get("company") or "Organization").strip()
        t = str(exp.get("title") or "Professional").strip()
        sd = str(exp.get("start_date") or "2020-01").strip()
        ed = str(exp.get("end_date") or "present").strip()

        resp = exp.get("responsibilities", [])
        if isinstance(resp, str):
            resp = [r.strip() for r in resp.split("\n") if r.strip()]
        elif isinstance(resp, list):
            resp = [str(r).strip() for r in resp if str(r).strip()]
        else:
            resp = []

        norm_exp.append({
            "company": c,
            "title": t,
            "start_date": sd,
            "end_date": ed,
            "responsibilities": resp
        })
    data["experience"] = norm_exp

    # 4. Education Normalization
    raw_edu = data.get("education", [])
    if isinstance(raw_edu, dict):
        raw_edu = [raw_edu]
    elif not isinstance(raw_edu, list):
        raw_edu = []

    norm_edu = []
    for edu in raw_edu:
        if not isinstance(edu, dict):
            continue
        inst = str(edu.get("institution") or "University").strip()
        norm_edu.append({
            "institution": inst,
            "degree": str(edu.get("degree")).strip() if edu.get("degree") else None,
            "field": str(edu.get("field")).strip() if edu.get("field") else None,
            "year": str(edu.get("year")).strip() if edu.get("year") else None,
        })
    data["education"] = norm_edu

    # 5. Projects Normalization
    raw_proj = data.get("projects", [])
    if not isinstance(raw_proj, list):
        raw_proj = [raw_proj] if isinstance(raw_proj, dict) else []
    norm_proj = []
    for p in raw_proj:
        if isinstance(p, dict) and p.get("name"):
            norm_proj.append({
                "name": str(p["name"]).strip(),
                "description": str(p.get("description") or "").strip(),
                "evidence": str(p.get("evidence") or "").strip() if p.get("evidence") else None
            })
    data["projects"] = norm_proj

    # 6. Certifications Normalization
    raw_certs = data.get("certifications", [])
    if isinstance(raw_certs, str):
        raw_certs = [c.strip() for c in raw_certs.split(",") if c.strip()]
    elif not isinstance(raw_certs, list):
        raw_certs = []
    data["certifications"] = [str(c).strip() for c in raw_certs if str(c).strip()]

    data["years_of_experience"] = float(data.get("years_of_experience") or 0.0)
    data["employment_gaps"] = data.get("employment_gaps") or []
    data["raw_text"] = raw_text or data.get("raw_text", "")

    return data
