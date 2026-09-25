import os
from dotenv import load_dotenv

# Load environment variables from .env if present
load_dotenv()
backend_env = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env")
if os.path.exists(backend_env):
    load_dotenv(backend_env)

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Database file location in the backend folder
DB_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(DB_DIR, "recruiter_copilot.db")
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DB_PATH}")

# Fix Render/Heroku postgres:// URI convention for SQLAlchemy 2.0+
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

def create_resilient_engine(url: str):
    """Creates database engine, falling back to SQLite if driver or cloud DB fails."""
    if url.startswith("sqlite"):
        return create_engine(
            url,
            connect_args={"check_same_thread": False}
        )
    try:
        eng = create_engine(
            url,
            pool_pre_ping=True,
            pool_recycle=300
        )
        # Verify driver is present
        with eng.connect() as conn:
            pass
        return eng
    except Exception as e:
        print(f"Warning: Primary database connection to '{url}' failed: {e}. Falling back to SQLite.")
        sqlite_url = f"sqlite:///{DB_PATH}"
        return create_engine(
            sqlite_url,
            connect_args={"check_same_thread": False}
        )

engine = create_resilient_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    import backend.app.db.models  # noqa
    Base.metadata.create_all(bind=engine)
