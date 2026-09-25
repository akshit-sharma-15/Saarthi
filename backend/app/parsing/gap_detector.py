import re
from datetime import datetime, date
from typing import List, Tuple, Optional
try:
    from dateutil import parser as date_parser
except ImportError:
    date_parser = None

from backend.app.schemas import Experience, EmploymentGap

THRESHOLD_DAYS = 60

MONTH_MAP = {
    "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
    "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6, "jul": 7, "july": 7,
    "aug": 8, "august": 8, "sep": 9, "september": 9, "oct": 10, "october": 10,
    "nov": 11, "november": 11, "dec": 12, "december": 12
}

def parse_date_str(date_str: str, is_end_date: bool = False) -> Optional[date]:
    """
    Parses date strings into a datetime.date object.
    Handles 'present', 'current', 'YYYY-MM', 'YYYY', 'Month YYYY', etc.
    """
    if not date_str:
        return None
    
    clean_str = str(date_str).strip().lower()
    
    if clean_str in ["present", "current", "now", "ongoing", "today"]:
        return date.today()
    
    # Try YYYY-MM
    m_ym = re.match(r"^(\d{4})[-/.](\d{1,2})$", clean_str)
    if m_ym:
        year = int(m_ym.group(1))
        month = int(m_ym.group(2))
        return date(year, month, 28 if is_end_date and month == 2 else (30 if is_end_date and month in [4, 6, 9, 11] else (31 if is_end_date else 1)))

    # Try YYYY
    m_y = re.match(r"^(\d{4})$", clean_str)
    if m_y:
        year = int(m_y.group(1))
        return date(year, 12, 31) if is_end_date else date(year, 1, 1)

    # Try generic dateutil parsing if available
    if date_parser:
        try:
            dt = date_parser.parse(clean_str, fuzzy=True, default=datetime(2000, 1, 1))
            d = dt.date()
            # If it was just year and month or only year, adjust end date to end of month
            if is_end_date and d.day == 1:
                month = d.month
                return date(d.year, month, 28 if month == 2 else (30 if month in [4, 6, 9, 11] else 31))
            return d
        except Exception:
            return None
    return None

def merge_intervals(intervals: List[Tuple[date, date]]) -> List[Tuple[date, date]]:
    """
    Merges overlapping or touching date intervals.
    """
    if not intervals:
        return []
    
    sorted_intervals = sorted(intervals, key=lambda x: x[0])
    merged = [sorted_intervals[0]]

    for current in sorted_intervals[1:]:
        prev_start, prev_end = merged[-1]
        curr_start, curr_end = current

        if curr_start <= prev_end:
            # Overlapping or adjacent interval
            merged[-1] = (prev_start, max(prev_end, curr_end))
        else:
            merged.append(current)

    return merged

def calculate_years_of_experience(experiences: List[Experience]) -> float:
    """
    Deterministically computes total years of experience using datetime arithmetic.
    Merges overlapping roles to prevent double counting.
    Returns float rounded to 1 decimal place.
    """
    intervals: List[Tuple[date, date]] = []
    
    for exp in experiences:
        s_date = parse_date_str(exp.start_date, is_end_date=False)
        e_date = parse_date_str(exp.end_date, is_end_date=True)
        if s_date and e_date and s_date <= e_date:
            intervals.append((s_date, e_date))
    
    if not intervals:
        return 0.0

    merged = merge_intervals(intervals)
    total_days = sum((end - start).days for start, end in merged)
    years = round(total_days / 365.25, 1)
    return max(years, 0.0)

def check_for_explained_gap_reason(raw_text: str, start_dt: date, end_dt: date) -> Optional[str]:
    """
    Checks raw text for explicit mentions of reasons for career breaks or gaps
    such as 'sabbatical', 'maternity leave', 'caregiver', 'higher studies', etc.
    Never hallucinates or guesses.
    """
    if not raw_text:
        return None
    
    text_lower = raw_text.lower()
    
    # Check for explicit phrases
    gap_phrases = [
        ("sabbatical", "Sabbatical"),
        ("career break", "Career break mentioned in resume"),
        ("study break", "Study break mentioned in resume"),
        ("higher education", "Higher education during gap"),
        ("parental leave", "Parental leave mentioned in resume"),
        ("maternity leave", "Maternity leave mentioned in resume"),
        ("medical leave", "Medical leave mentioned in resume"),
        ("freelance", "Freelance work during transition"),
        ("travel", "Travel sabbatical mentioned in resume")
    ]
    
    # Check if any phrase appears with year or in close proximity
    start_year = str(start_dt.year)
    end_year = str(end_dt.year)
    
    for phrase, label in gap_phrases:
        if phrase in text_lower:
            # Check if this phrase appears near the gap years or in an explicit section
            lines = text_lower.split("\n")
            for line in lines:
                if phrase in line:
                    if start_year in line or end_year in line or "break" in line or "gap" in line:
                        return f"{label}: '{line.strip()}'"
    
    return None

def detect_employment_gaps(
    experiences: List[Experience],
    raw_text: str = "",
    threshold_days: int = THRESHOLD_DAYS
) -> List[EmploymentGap]:
    """
    Deterministically computes gaps between consecutive roles (> threshold_days, default 60).
    Flags gap as 'unexplained' unless raw resume explicitly explains it.
    """
    valid_experiences = []
    for exp in experiences:
        s_date = parse_date_str(exp.start_date, is_end_date=False)
        e_date = parse_date_str(exp.end_date, is_end_date=True)
        if s_date and e_date and s_date <= e_date:
            valid_experiences.append((s_date, e_date, exp))

    if len(valid_experiences) < 2:
        return []

    # Merge overlapping intervals so internal transitions aren't false-positive gaps
    raw_intervals = [(s, e) for s, e, _ in valid_experiences]
    merged_intervals = merge_intervals(raw_intervals)

    gaps: List[EmploymentGap] = []

    for i in range(len(merged_intervals) - 1):
        prev_end = merged_intervals[i][1]
        next_start = merged_intervals[i + 1][0]

        gap_days = (next_start - prev_end).days
        if gap_days > threshold_days:
            period_str = f"{prev_end.strftime('%Y-%m')} to {next_start.strftime('%Y-%m')}"
            
            # Check if raw text states an explicit explanation
            reason = check_for_explained_gap_reason(raw_text, prev_end, next_start)
            status = "explained" if reason else "unexplained"

            gaps.append(EmploymentGap(
                period=period_str,
                status=status,
                reason=reason
            ))

    return gaps
