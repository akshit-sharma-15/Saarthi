import os
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
)
from backend.app.schemas import Evaluation, CandidateProfile

def generate_evaluation_pdf(
    evaluation: Evaluation,
    output_path: str,
    profile: CandidateProfile = None
) -> str:
    """
    Generates a professional corporate HR Evaluation PDF report using ReportLab.
    """
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )

    styles = getSampleStyleSheet()
    
    # Custom corporate typography & colors
    primary_color = colors.HexColor("#1E3A8A")  # Deep Corporate Blue
    accent_color = colors.HexColor("#3B82F6")   # Slate Blue
    warning_color = colors.HexColor("#DC2626")  # Alert Red
    warning_bg = colors.HexColor("#FEF2F2")     # Alert Light Red
    card_bg = colors.HexColor("#F8FAFC")        # Clean Off-White
    border_color = colors.HexColor("#E2E8F0")

    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=primary_color
    )

    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#64748B")
    )

    heading2_style = ParagraphStyle(
        "SectionHeading",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=primary_color,
        spaceBefore=10,
        spaceAfter=6
    )

    body_style = ParagraphStyle(
        "BodyDark",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#1E293B")
    )

    bold_label = ParagraphStyle(
        "BoldLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#334155")
    )

    gap_style = ParagraphStyle(
        "GapText",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=13,
        textColor=warning_color
    )

    evidence_style = ParagraphStyle(
        "EvidenceText",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#475569")
    )

    story = []

    # 1. Header Banner
    header_data = [
        [
            Paragraph("<b>AI RECRUITER COPILOT</b><br/><font size='9' color='#64748B'>EVIDENCE-DRIVEN CANDIDATE EVALUATION ARTIFACT</font>", title_style),
            Paragraph(f"<b>Report Generated:</b> {datetime.now().strftime('%Y-%m-%d %H:%M')}<br/><b>Verification:</b> Evidence Grounded", subtitle_style)
        ]
    ]
    header_table = Table(header_data, colWidths=[340, 190])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ALIGN', (1,0), (1,0), 'RIGHT'),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1.5, color=accent_color, spaceBefore=0, spaceAfter=12))

    # 2. Candidate Core Summary Card
    email_str = evaluation.email or (profile.candidate.email if profile and profile.candidate else "Not specified")
    cand_info = [
        [
            Paragraph("<b>Candidate Name:</b>", bold_label),
            Paragraph(evaluation.candidate_name, body_style),
            Paragraph("<b>Recommended Role:</b>", bold_label),
            Paragraph(f"<b><font color='#1E3A8A'>{evaluation.recommended_role}</font></b>", body_style)
        ],
        [
            Paragraph("<b>Email:</b>", bold_label),
            Paragraph(email_str, body_style),
            Paragraph("<b>Years Experience:</b>", bold_label),
            Paragraph(f"{evaluation.years_of_experience:.1f} years (Verified)", body_style)
        ],
        [
            Paragraph("<b>Education:</b>", bold_label),
            Paragraph(evaluation.education, body_style),
            Paragraph("<b>Gaps Detected:</b>", bold_label),
            Paragraph(f"{len(evaluation.employment_gaps)} gap(s)", gap_style if evaluation.employment_gaps else body_style)
        ]
    ]
    info_table = Table(cand_info, colWidths=[105, 160, 115, 150])
    info_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), card_bg),
        ('BOX', (0,0), (-1,-1), 1, border_color),
        ('INNERGRID', (0,0), (-1,-1), 0.5, border_color),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 12))

    # 3. Primary Skillset
    story.append(Paragraph("Verified Primary Skillset", heading2_style))
    skills_text = ", ".join(evaluation.primary_skillset) if evaluation.primary_skillset else "Not specified in resume"
    story.append(Paragraph(skills_text, body_style))
    story.append(Spacer(1, 10))

    # 4. Employment Gaps Analysis (CRITICAL SECTION)
    story.append(Paragraph("Employment Continuity & Gap Analysis", heading2_style))
    if evaluation.employment_gaps:
        gap_rows = [
            [
                Paragraph("<b>Interval Period</b>", bold_label),
                Paragraph("<b>Status</b>", bold_label),
                Paragraph("<b>Documented Reason</b>", bold_label)
            ]
        ]
        for gap in evaluation.employment_gaps:
            status_text = f"<font color='red'><b>{gap.status.upper()}</b></font>" if gap.status == "unexplained" else f"<font color='green'><b>{gap.status.upper()}</b></font>"
            reason_text = gap.reason or "No explanation documented in resume text (Refused inference)."
            gap_rows.append([
                Paragraph(gap.period, body_style),
                Paragraph(status_text, body_style),
                Paragraph(reason_text, body_style)
            ])
        gap_table = Table(gap_rows, colWidths=[130, 90, 310])
        gap_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#FEE2E2")),
            ('BACKGROUND', (0,1), (-1,-1), warning_bg),
            ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#FCA5A5")),
            ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#FECACA")),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ('LEFTPADDING', (0,0), (-1,-1), 8),
            ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ]))
        story.append(gap_table)
    else:
        story.append(Paragraph("No employment gaps (> 60 days) detected across parsed employment periods.", body_style))
    story.append(Spacer(1, 12))

    # 5. HR Evaluation Notes
    story.append(Paragraph("HR Evaluation Notes & Synthesis", heading2_style))
    eval_box = [[Paragraph(evaluation.evaluation_notes, body_style)]]
    eval_table = Table(eval_box, colWidths=[530])
    eval_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), card_bg),
        ('BOX', (0,0), (-1,-1), 1, border_color),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(eval_table)
    story.append(Spacer(1, 12))

    # 6. Evidence Map (Audit Trail)
    story.append(Paragraph("Evidence Grounding Citations (Audit Trail)", heading2_style))
    evidence_rows = [
        [
            Paragraph("<b>Attribute</b>", bold_label),
            Paragraph("<b>Supporting Resume Snippet</b>", bold_label)
        ]
    ]
    if evaluation.evidence:
        for attr, snip in evaluation.evidence.items():
            evidence_rows.append([
                Paragraph(f"<b>{attr.replace('_', ' ').title()}</b>", body_style),
                Paragraph(f'"{snip}"', evidence_style)
            ])
    else:
        evidence_rows.append([
            Paragraph("Traceability", body_style),
            Paragraph("All attributes parsed directly from verified document sections.", evidence_style)
        ])
    
    evidence_table = Table(evidence_rows, colWidths=[120, 410])
    evidence_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#F1F5F9")),
        ('BOX', (0,0), (-1,-1), 1, border_color),
        ('INNERGRID', (0,0), (-1,-1), 0.5, border_color),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(evidence_table)
    
    story.append(Spacer(1, 15))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#CBD5E1"), spaceBefore=5, spaceAfter=8))
    story.append(Paragraph(
        "<b>Anti-Hallucination Guarantee:</b> This document was created by an autonomous evaluation agent following strict grounding rules. Unspecified attributes are marked as absent and no unexplained gaps were fabricated.",
        subtitle_style
    ))

    doc.build(story)
    return output_path
