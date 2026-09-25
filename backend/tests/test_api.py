import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "features" in data

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200

def test_get_candidates():
    response = client.get("/api/candidates")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 5

def test_get_candidate_by_id():
    response = client.get("/api/candidate/sample-aarav-sharma")
    assert response.status_code == 200
    data = response.json()
    # CandidateProfile schema structure
    assert "candidate" in data
    assert data["candidate"]["name"] == "Aarav Sharma"
    assert "years_of_experience" in data
    assert "employment_gaps" in data

def test_chat_grounded_qa():
    payload = {
        "candidate_id": "sample-aarav-sharma",
        "question": "What is Aarav's educational background?"
    }
    response = client.post("/api/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert "grounded" in data

def test_evaluate_streaming_endpoint():
    payload = {"resume_id": "sample-aarav-sharma", "dispatch_to_hr": False}
    response = client.post("/api/evaluate", json=payload)
    assert response.status_code == 200
    assert "text/event-stream" in response.headers.get("content-type", "")

