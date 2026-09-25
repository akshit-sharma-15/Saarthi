import os
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from datetime import datetime
from typing import Dict, Any

logger = logging.getLogger(__name__)

class Mailer:
    def __init__(self):
        self.mock_mode = os.getenv("MOCK_SMTP", "true").lower() in ["true", "1", "yes"]
        self.smtp_server = os.getenv("SMTP_SERVER", "smtp.example.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_username = os.getenv("SMTP_USERNAME", "")
        self.smtp_password = os.getenv("SMTP_PASSWORD", "")
        self.hr_email = os.getenv("HR_EMAIL", "hr-screening@company.com")

    def dispatch_evaluation(
        self,
        candidate_name: str,
        pdf_path: str,
        evaluation_summary: str,
        recipient: str = None
    ) -> Dict[str, Any]:
        """
        Dispatches candidate evaluation PDF to HR.
        Defaults to mock SMTP output to console and logging, with support for real SMTP.
        """
        to_email = recipient or self.hr_email
        subject = f"Candidate Evaluation Report: {candidate_name}"

        log_payload = {
            "to": to_email,
            "subject": subject,
            "attachment": pdf_path,
            "timestamp": datetime.utcnow().isoformat(),
            "status": "MOCKED" if self.mock_mode else "SENT"
        }

        if self.mock_mode or not self.smtp_username:
            print("\n" + "=" * 60)
            print("[MOCK SMTP DISPATCH]")
            print(f"To: {to_email}")
            print(f"Subject: {subject}")
            print(f"Attachment: {pdf_path}")
            print(f"Summary: {evaluation_summary[:120]}...")
            print(f"Status: DELIVERED (MOCK)")
            print("=" * 60 + "\n")
            logger.info(f"Mock email successfully dispatched: {log_payload}")
            return log_payload

        # Real SMTP delivery
        try:
            msg = MIMEMultipart()
            msg["From"] = self.smtp_username
            msg["To"] = to_email
            msg["Subject"] = subject

            body = f"Please find attached the automated AI Recruiter Copilot evaluation report for {candidate_name}.\n\nSummary:\n{evaluation_summary}"
            msg.attach(MIMEText(body, "plain"))

            if pdf_path and os.path.exists(pdf_path):
                with open(pdf_path, "rb") as f:
                    part = MIMEApplication(f.read(), Name=os.path.basename(pdf_path))
                part['Content-Disposition'] = f'attachment; filename="{os.path.basename(pdf_path)}"'
                msg.attach(part)

            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_username, self.smtp_password)
                server.send_message(msg)

            log_payload["status"] = "SENT"
            logger.info(f"Email successfully sent via real SMTP to {to_email}")
            return log_payload
        except Exception as e:
            logger.error(f"Failed to send email via SMTP: {e}")
            log_payload["status"] = "FAILED"
            log_payload["error"] = str(e)
            return log_payload

mailer = Mailer()
