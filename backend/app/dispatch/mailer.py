import os
import socket
import ssl
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

def create_ipv4_connection(address, timeout=12, source_address=None):
    """
    Connects to a host strictly using IPv4 (AF_INET).
    Prevents '[Errno 101] Network is unreachable' errors on cloud hosting (Render, Docker, Linux)
    where DNS returns IPv6 addresses but no IPv6 route exists.
    """
    host, port = address
    err = None
    for res in socket.getaddrinfo(host, port, socket.AF_INET, socket.SOCK_STREAM):
        af, socktype, proto, canonname, sa = res
        sock = None
        try:
            sock = socket.socket(af, socktype, proto)
            if timeout is not None:
                sock.settimeout(timeout)
            if source_address:
                sock.bind(source_address)
            sock.connect(sa)
            return sock
        except OSError as _err:
            err = _err
            if sock is not None:
                sock.close()
    if err is not None:
        raise err
    raise OSError(f"Could not resolve IPv4 address for {host}")

class IPv4SMTP(smtplib.SMTP):
    """SMTP client strictly enforcing IPv4 connection."""
    def _get_socket(self, host, port, timeout):
        return create_ipv4_connection((host, port), timeout, self.source_address)

class IPv4SMTP_SSL(smtplib.SMTP_SSL):
    """SMTP_SSL client strictly enforcing IPv4 connection."""
    def _get_socket(self, host, port, timeout):
        new_socket = create_ipv4_connection((host, port), timeout, self.source_address)
        new_socket = self.context.wrap_socket(new_socket, server_hostname=self._host)
        return new_socket

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

            # Determine port sequence: Port 587 (STARTTLS) is recommended for cloud/Render deployments
            configured_port = int(cfg.get("smtp_port") or 587)
            server_host = cfg["smtp_server"]

            if configured_port == 465:
                port_sequence = [(465, True), (587, False)]
            else:
                port_sequence = [(587, False), (465, True)]

            for port, use_ssl in port_sequence:
                for attempt in range(2):
                    try:
                        logger.info(f"Attempting SMTP delivery to {to_email} via {server_host}:{port} (SSL={use_ssl}, attempt {attempt+1}/2)...")
                        if use_ssl:
                            ctx = ssl.create_default_context()
                            with IPv4SMTP_SSL(server_host, port, context=ctx, timeout=12) as s:
                                s.login(cfg["smtp_username"], cfg["smtp_password"])
                                s.send_message(msg)
                        else:
                            with IPv4SMTP(server_host, port, timeout=12) as s:
                                s.starttls()
                                s.login(cfg["smtp_username"], cfg["smtp_password"])
                                s.send_message(msg)
                        delivered = True
                        break
                    except Exception as conn_err:
                        last_err = conn_err
                        logger.warning(f"SMTP attempt {attempt+1}/2 on port {port} failed: {conn_err}")
                if delivered:
                    break

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
