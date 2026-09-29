from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from backend.app.db.session import Base

# Indian Standard Time (IST, UTC+05:30)
IST = timezone(timedelta(hours=5, minutes=30))

def get_ist_now():
    """Returns current datetime in Indian Standard Time."""
    return datetime.now(IST)

class CandidateDB(Base):
    __tablename__ = "candidates"

    id = Column(String, primary_key=True, index=True)
    profile_json = Column(Text, nullable=False)
    raw_text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=get_ist_now)

class EvaluationDB(Base):
    __tablename__ = "evaluations"

    id = Column(String, primary_key=True, index=True)
    candidate_id = Column(String, ForeignKey("candidates.id"), nullable=True)
    evaluation_json = Column(Text, nullable=False)
    pdf_path = Column(String, nullable=True)
    dispatch_status = Column(String, nullable=True)
    created_at = Column(DateTime, default=get_ist_now)

class AgentRunDB(Base):
    __tablename__ = "agent_runs"

    id = Column(String, primary_key=True, index=True)
    candidate_id = Column(String, ForeignKey("candidates.id"), nullable=True)
    step = Column(String, nullable=False)
    status = Column(String, nullable=False)
    detail = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=get_ist_now)
