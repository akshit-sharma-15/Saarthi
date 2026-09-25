import os
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from datetime import datetime, timezone, timedelta
from typing import Dict, Any
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Indian Standard Time (IST, UTC+05:30)
IST = timezone(timedelta(hours=5, minutes=30))

def get_ist_now() -> datetime:
    """Returns current datetime in Indian Standard Time (IST)."""
    return datetime.now(IST)

def get_ist_str() -> str:
    """Returns formatted timestamp string in IST."""
    return get_ist_now().strftime("%Y-%m-%d %I:%M:%S %p IST")

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
        smtp_port = int(os.getenv("SMTP_PORT", "465"))
        smtp_username = os.getenv("SMTP_USERNAME", "").strip()
        smtp_password = os.getenv("SMTP_PASSWORD", "").strip()
        hr_email = os.getenv("HR_EMAIL", "asharma889452@gmail.com").strip()

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
                "timestamp": get_ist_now().isoformat(),
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
                f"Timestamp: {get_ist_str()}\n"
            )
            msg.attach(MIMEText(body, "plain"))

            if pdf_path and os.path.exists(pdf_path) and os.path.getsize(pdf_path) > 0:
                with open(pdf_path, "rb") as f:
                    part = MIMEApplication(f.read(), _subtype="pdf")
                filename = os.path.basename(pdf_path)
                part.add_header('Content-Disposition', 'attachment', filename=filename)
                msg.attach(part)
                logger.info(f"Attached PDF report: {filename} ({os.path.getsize(pdf_path)} bytes)")
            else:
                logger.warning(f"No PDF attachment attached (path: {pdf_path})")

            delivered = False
            last_err = None

            # Determine primary port: Gmail works reliably and instantly via 465 (direct SSL)
            is_gmail = "gmail.com" in cfg["smtp_server"].lower()
            configured_port = cfg.get("smtp_port", 465)
            server_host = cfg["smtp_server"]

            if is_gmail or configured_port == 465:
                primary_port = 465
                alt_port = 587
            else:
                primary_port = configured_port
                alt_port = 465 if configured_port != 465 else 587

            def try_send(port, use_ssl=False):
                if use_ssl or port == 465:
                    import ssl
                    ctx = ssl.create_default_context()
                    with smtplib.SMTP_SSL(server_host, port, context=ctx, timeout=8) as s:
                        s.login(cfg["smtp_username"], cfg["smtp_password"])
                        s.send_message(msg)
                else:
                    with smtplib.SMTP(server_host, port, timeout=8) as s:
                        s.starttls()
                        s.login(cfg["smtp_username"], cfg["smtp_password"])
                        s.send_message(msg)

            try:
                try_send(primary_port, use_ssl=(primary_port == 465))
                delivered = True
            except Exception as primary_err:
                last_err = primary_err
                logger.warning(f"SMTP delivery failed on primary port {primary_port}: {primary_err}. Attempting alternative port {alt_port}...")
                try:
                    try_send(alt_port, use_ssl=(alt_port == 465))
                    delivered = True
                except Exception as alt_err:
                    last_err = alt_err

            if not delivered:
                raise last_err or Exception("Failed to deliver email through all configured SMTP ports")

            logger.info(f"Email successfully sent via real SMTP to {to_email}")
            print(f"\n[REAL SMTP DISPATCH] Successfully delivered email to {to_email} via {cfg['smtp_server']}\n")
            return {
                "to": to_email,
                "subject": subject,
                "attachment": pdf_path,
                "timestamp": get_ist_now().isoformat(),
                "status": "SENT",
                "message": f"Email successfully delivered to {to_email} via {cfg['smtp_server']}"
            }
        except Exception as e:
            logger.error(f"Failed to send email via SMTP: {e}")
            return {
                "to": to_email,
                "subject": subject,
                "attachment": pdf_path,
                "timestamp": get_ist_now().isoformat(),
                "status": "FAILED",
                "error": str(e)
            }

mailer = Mailer()
