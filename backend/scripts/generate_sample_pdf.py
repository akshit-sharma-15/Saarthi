import json
import os
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

def generate():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    json_path = os.path.join(base_dir, "sample_resumes", "aarav_sharma.json")
    pdf_path = os.path.join(base_dir, "sample_resumes", "aarav_sharma.pdf")

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        leftMargin=40,
        rightMargin=40,
        topMargin=40,
        bottomMargin=40
    )
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle('Title', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=18, leading=22, textColor=colors.HexColor('#0F172A'))
    sub_style = ParagraphStyle('Sub', parent=styles['Normal'], fontName='Helvetica', fontSize=9, leading=13, textColor=colors.HexColor('#475569'))
    h2_style = ParagraphStyle('H2', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=12, leading=16, textColor=colors.HexColor('#1E3A8A'), spaceBefore=8, spaceAfter=4)
    body_style = ParagraphStyle('Body', parent=styles['Normal'], fontName='Helvetica', fontSize=9, leading=13, textColor=colors.HexColor('#1E293B'))
    bold_style = ParagraphStyle('BodyBold', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9, leading=13, textColor=colors.HexColor('#0F172A'))

    story = []
    c = data['candidate']
    story.append(Paragraph(f"<b>{c['name']}</b>", title_style))
    story.append(Paragraph(f"{c.get('location', '')} | {c.get('email', '')} | {c.get('phone', '')}", sub_style))
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width='100%', thickness=1, color=colors.HexColor('#3B82F6'), spaceBefore=2, spaceAfter=8))

    story.append(Paragraph('EDUCATION', h2_style))
    for edu in data.get('education', []):
        story.append(Paragraph(f"<b>{edu['institution']}</b> — {edu['degree']} in {edu['field']} ({edu['year']})", body_style))
    story.append(Spacer(1, 6))

    story.append(Paragraph('PROFESSIONAL EXPERIENCE', h2_style))
    for exp in data.get('experience', []):
        story.append(Paragraph(f"<b>{exp['title']}</b> at <b>{exp['company']}</b> ({exp['start_date']} to {exp['end_date']})", bold_style))
        for resp in exp.get('responsibilities', []):
            story.append(Paragraph(f"• {resp}", body_style))
        story.append(Spacer(1, 4))

    story.append(Paragraph('TECHNICAL SKILLS', h2_style))
    for cat, skills in data.get('skills', {}).items():
        story.append(Paragraph(f"<b>{cat.capitalize()}:</b> {', '.join(skills)}", body_style))
    story.append(Spacer(1, 6))

    story.append(Paragraph('PROJECTS', h2_style))
    for p in data.get('projects', []):
        story.append(Paragraph(f"<b>{p['name']}:</b> {p['description']}", body_style))
    story.append(Spacer(1, 6))

    story.append(Paragraph('CERTIFICATIONS', h2_style))
    for cert in data.get('certifications', []):
        story.append(Paragraph(f"• {cert}", body_style))

    doc.build(story)
    print(f"Generated {pdf_path} successfully!")

if __name__ == "__main__":
    generate()
