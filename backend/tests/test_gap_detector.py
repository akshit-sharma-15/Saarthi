import pytest
from backend.app.schemas import Experience
from backend.app.parsing.gap_detector import calculate_years_of_experience, detect_employment_gaps

def test_single_job_experience():
    exp = [
        Experience(
            company="Acme Corp",
            title="Software Engineer",
            start_date="2020-01",
            end_date="2021-01"
        )
    ]
    years = calculate_years_of_experience(exp)
    gaps = detect_employment_gaps(exp)
    assert 0.9 <= years <= 1.1
    assert len(gaps) == 0

def test_gap_detection_between_jobs():
    exp = [
        Experience(
            company="Company A",
            title="Developer",
            start_date="2018-01",
            end_date="2019-01"
        ),
        Experience(
            company="Company B",
            title="Senior Developer",
            start_date="2020-01",
            end_date="2021-01"
        )
    ]
    years = calculate_years_of_experience(exp)
    gaps = detect_employment_gaps(exp)
    # Total experience should be approx 2 years
    assert 1.9 <= years <= 2.2
    # Gap between 2019-01 and 2020-01
    assert len(gaps) == 1
    assert gaps[0].status == "unexplained"
    assert "2019" in gaps[0].period and "2020" in gaps[0].period

def test_overlapping_jobs_no_double_count():
    exp = [
        Experience(
            company="Full-time Job",
            title="Lead Engineer",
            start_date="2020-01",
            end_date="2022-01"
        ),
        Experience(
            company="Consulting Gig",
            title="Advisor",
            start_date="2020-06",
            end_date="2021-06"
        )
    ]
    years = calculate_years_of_experience(exp)
    gaps = detect_employment_gaps(exp)
    # Merged interval is 2020-01 to 2022-01 -> ~2.0 years, not 3.0
    assert 1.9 <= years <= 2.2
    assert len(gaps) == 0
