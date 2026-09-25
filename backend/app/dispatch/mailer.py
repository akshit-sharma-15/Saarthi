import os
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from datetime import datetime
from typing import Dict, Any
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

def reload_env_variables():
    """Finds and loads .env from multiple possible root or backend locations."""
    curr = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.abspath(os.path.join(curr, "..", "..", ".env")),        # backend/.env
        os.path.abspath(os.path.join(curr, "..", "..", "..", ".env")),   # root/.env
        os.path.abspath(os.path.join(os.getcwd(), "backend", ".env")),
        os.path.abspath(os.path.join(os.getcwd(), ".env")),
    ]
    for c in candidates:
        if os.path.exists(c):
            load_dotenv(c, override=True)

# Initial load
reload_env_variables()

class Mailer:
    def get_config(self):
        """Reads latest configuration dynamically from environment."""
        reload_env_variables()
        
        mock_str = os.getenv("MOCK_SMTP", "false").strip().lower()
        mock_mode = mock_str in ["true", "1", "yes"]
        smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com").strip()
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        smtp_username = os.getenv("SMTP_USERNAME", "").strip()
        smtp_password = os.getenv("SMTP_PASSWORD", "").strip()
        hr_email = os.getenv("HR_EMAIL", "asharma8892@gmail.com").strip()

        return {
            "mock_mode": mock_mode,
            "smtp_server": smtp_server,
            "smtp_port": smtp_port,
            "smtp_username": smtp_username,
            "smtp_password": smtp_password,
            "hr_email": hr_email,
        }

    def dispatch_evaluation(
        self,
        candidate_name: str,
        pdf_path: str,
        evaluation_summary: str,
        recipient: str = None
    ) -> Dict[str, Any]:
        """
        Dispatches candidate evaluation PDF to HR.
        Uses real SMTP if credentials are configured and MOCK_SMTP is false.
        """
        cfg = self.get_config()
        to_email = recipient or cfg["hr_email"]
        subject = f"Candidate Evaluation Report: {candidate_name}"

        # If mock mode is explicitly true or credentials are missing
        if cfg["mock_mode"] or not cfg["smtp_username"] or not cfg["smtp_password"]:
            log_payload = {
                "to": to_email,
                "subject": subject,
                "attachment": pdf_path,
                "timestamp": datetime.utcnow().isoformat(),
                "status": "MOCKED"
            }
            print("\n" + "=" * 60)
            print("[MOCK SMTP DISPATCH]")
            print(f"To: {to_email}")
            print(f"Subject: {subject}")
            print(f"Attachment: {pdf_path}")
            print(f"Summary: {evaluation_summary[:120]}...")
            print(f"Status: DELIVERED (MOCK)")
            print("=" * 60 + "\n")
            logger.info(f"Mock email dispatched: {log_payload}")
            return log_payload

        # Real SMTP delivery
        try:
            msg = MIMEMultipart()
            msg["From"] = cfg["smtp_username"]
            msg["To"] = to_email
            msg["Subject"] = subject

            body = (
                f"Hello,\n\n"
                f"Please find attached the automated AI Recruiter Copilot evaluation report for {candidate_name}.\n\n"
                f"Candidate Summary:\n{evaluation_summary}\n\n"
                f"Dispatched by: AI Recruiter Copilot Screening Engine\n"
                f"Timestamp: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}\n"
            )
            msg.attach(MIMEText(body, "plain"))

            if pdf_path and os.path.exists(pdf_path):
                with open(pdf_path, "rb") as f:
                    part = MIMEApplication(f.read(), Name=os.path.basename(pdf_path))
                part['Content-Disposition'] = f'attachment; filename="{os.path.basename(pdf_path)}"'
                msg.attach(part)

            with smtplib.SMTP(cfg["smtp_server"], cfg["smtp_port"], timeout=20) as server:
                server.starttls()
                server.login(cfg["smtp_username"], cfg["smtp_password"])
                server.send_message(msg)

            logger.info(f"Email successfully sent via real SMTP to {to_email}")
            print(f"\n[REAL SMTP DISPATCH] Successfully delivered email to {to_email} via {cfg['smtp_server']}\n")
            return {
                "to": to_email,
                "subject": subject,
                "attachment": pdf_path,
                "timestamp": datetime.utcnow().isoformat(),
                "status": "SENT",
                "message": f"Email successfully delivered to {to_email} via {cfg['smtp_server']}"
            }
        except Exception as e:
            logger.error(f"Failed to send email via SMTP: {e}")
            return {
                "to": to_email,
                "subject": subject,
                "attachment": pdf_path,
                "timestamp": datetime.utcnow().isoformat(),
                "status": "FAILED",
                "error": str(e)
            }

mailer = Mailer()
