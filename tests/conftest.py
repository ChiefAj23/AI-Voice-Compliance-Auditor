"""
Test setup: run the API without the ML models (they need torch, Whisper and several GB of
weights) and against a throwaway database, so the security tests run anywhere in seconds.
"""
import os
import sys
import tempfile
import types
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ["JWT_SECRET_KEY"] = "test-secret-" + "0" * 40
os.environ["ADMIN_USERNAME"] = "admin"
os.environ["ADMIN_PASSWORD"] = "test-admin-password"


def _stub(name, **attrs):
    module = types.ModuleType(name)
    module.__dict__.update(attrs)
    sys.modules[name] = module


def _none(*args, **kwargs):
    return {}


_stub("whisper", load_model=lambda *a, **k: None)
_stub("api.model", analyze_text=_none)
_stub("api.explain", explain_toxicity=_none)
_stub("api.explain_enhanced", comprehensive_explanation=_none)
_stub("api.multilanguage", transcribe_with_language=_none, detect_language_from_text=_none,
      get_supported_languages=lambda: {"en": "English"})
_stub("api.speaker_diarization", simple_speaker_segmentation=_none, analyze_speaker_turns=_none,
      create_speaker_timeline=_none)
_stub("api.audio_quality", analyze_audio_quality=_none)
_stub("api.summarization", summarize_conversation=_none)
_stub("api.topic_extraction", extract_topics=_none)
_stub("api.intent_classification", classify_intent=_none)
_stub("api.sentiment_timeline", create_sentiment_timeline=_none)

# A throwaway database instead of data/analyses.db.
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
import api.database as database  # noqa: E402

_db_file = Path(tempfile.mkdtemp()) / "test.db"
database.engine = create_engine(f"sqlite:///{_db_file}", connect_args={"check_same_thread": False})
database.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=database.engine)
