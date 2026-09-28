from fastapi import FastAPI, UploadFile, File, Request, HTTPException, Depends, Query, status
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.middleware.cors import CORSMiddleware
import csv
import io
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, and_
import tempfile
import whisper
import os
from datetime import datetime, timedelta
from datetime import datetime as dt
from typing import Optional, List, Any
import asyncio
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from .model import analyze_text
from .explain import explain_toxicity
from .explain_enhanced import comprehensive_explanation
from .report import generate_compliance_pdf
from .database import init_db, get_db, save_analysis, AnalysisRecord
from .keyword_detection import detect_keywords, highlight_keywords, get_keyword_statistics
from .audio_quality import analyze_audio_quality
from .sentiment_timeline import create_sentiment_timeline
from .alert_system import check_compliance_alerts, AlertThresholds, generate_alert_summary
from .multilanguage import transcribe_with_language, detect_language_from_text, get_supported_languages
from .speaker_diarization import simple_speaker_segmentation, analyze_speaker_turns, create_speaker_timeline
from .conversation_analysis import calculate_conversation_metrics
from .compliance_rules import RULE_VARIABLES, ComplianceRuleEngine
from .database import ComplianceRule, ScheduledReport, Webhook, NotificationConfig
from .action_items import detect_action_items
from .report_scheduler import get_scheduler
from .summarization import summarize_conversation
from .topic_extraction import extract_topics
from .intent_classification import classify_intent
from .webhook_service import WebhookService
from .email_notification import get_email_service
from .auth import (
    authenticate_user, create_access_token, get_current_user, get_current_active_user,
    get_password_hash, get_user_permissions, require_permission, require_role,
    init_default_roles_and_permissions, ACCESS_TOKEN_EXPIRE_MINUTES, get_optional_user,
    ensure_admin_user
)
from .database import (
    User, Role, Permission, Comment, Tag, Team,
    user_roles, role_permissions, user_teams, analysis_tags
)
from pydantic import BaseModel, EmailStr
from typing import Optional as Opt
import json
import re
import traceback
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from . import settings
from .audit import AuditMiddleware, client_ip, record as audit_record
from .auth import validate_password
from .database import AuditLog
from .safe_eval import UnsafeExpression, validate as validate_expression


def _convert_numpy_types(obj: Any) -> Any:
    """Recursively convert numpy types to native Python types for JSON serialization"""
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.bool_):
        return bool(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, dict):
        return {key: _convert_numpy_types(value) for key, value in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [_convert_numpy_types(item) for item in obj]
    else:
        return obj

app = FastAPI(title="Voice Compliance Auditor", version=settings.APP_VERSION)

# Origins allowed to call the API from a browser (CORS_ORIGINS).
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limits: a default for every route, stricter ones on sign-in and analysis (settings.RATE_LIMIT_*).
limiter = Limiter(
    key_func=lambda request: client_ip(request) or "unknown",
    default_limits=[settings.RATE_LIMIT_DEFAULT],
    enabled=settings.RATE_LIMITING_ENABLED,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
# The audit trail of every request that changes something.
app.add_middleware(AuditMiddleware)


def _validate_rule_pattern(rule_type, pattern) -> None:
    """Reject a rule whose pattern would fail or is not allowed, at save time rather than at analysis time."""
    if pattern is None:
        return
    if rule_type == "regex":
        try:
            re.compile(pattern)
        except re.error as e:
            raise HTTPException(status_code=400, detail=f"Invalid regular expression: {e}")
    if rule_type == "custom":
        try:
            validate_expression(pattern, RULE_VARIABLES)
        except UnsafeExpression as e:
            raise HTTPException(status_code=400, detail=f"Rule expression not allowed: {e}")

# Initialize database and scheduler on startup
@app.on_event("startup")
async def startup_event():
    init_db()
    # Initialize default roles and permissions
    from .database import SessionLocal
    db = SessionLocal()
    try:
        init_default_roles_and_permissions(db)

        # The first admin account: ADMIN_PASSWORD, or a generated password printed once.
        ensure_admin_user(db)

        # Initialize scheduler and load all active schedules
        scheduler = get_scheduler()
        scheduler.reload_all_schedules(db)
    except Exception as e:
        print(f"Error during startup: {str(e)}")
        traceback.print_exc()
    finally:
        db.close()

@app.on_event("shutdown")
async def shutdown_event():
    # Shutdown scheduler
    scheduler = get_scheduler()
    scheduler.shutdown()

@app.post("/analyze_audio")
@limiter.limit(settings.RATE_LIMIT_ANALYZE)
async def analyze_audio(
    request: Request,
    file: UploadFile=File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("analysis:write"))
):
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            tmp.write(await file.read())
        tmp_path = tmp.name

        # Multi-language transcription with auto-detection
        try:
            transcription_result = transcribe_with_language(tmp_path, language=None, auto_detect=True)
            result = transcription_result.get("transcription", {})
            text = transcription_result.get("text", "")
            language_info = transcription_result.get("language", {})
        except Exception as e:
            print(f"Warning: Multi-language transcription failed, using default: {str(e)}")
            model = whisper.load_model("tiny")
            result = model.transcribe(tmp_path)
            text = result["text"]
            language_info = {"whisper_detected": "en", "whisper_language_name": "English", "confidence": 0.5}

        analysis = analyze_text(text)
        token_explanations = explain_toxicity(text)

        # Speaker diarization
        try:
            speaker_diarization = simple_speaker_segmentation(tmp_path, num_speakers=None)
            speaker_segments = speaker_diarization.get("segments", [])

            # Create speaker timeline with transcription
            speaker_timeline = create_speaker_timeline(speaker_segments, result.get("segments", []))

            # Analyze speaker turns
            speaker_turns = analyze_speaker_turns(speaker_segments, result.get("segments", []))

            # Advanced conversation analysis
            conversation_metrics = calculate_conversation_metrics(speaker_segments, result.get("segments", []))
        except Exception as e:
            print(f"Warning: Speaker diarization failed: {str(e)}")
            speaker_diarization = None
            speaker_timeline = []
            speaker_turns = {}
            conversation_metrics = None

        # Sentiment timeline analysis (time-based sentiment tracking)
        try:
            sentiment_timeline = create_sentiment_timeline(result, segment_duration=10.0)
        except Exception as e:
            print(f"Warning: Sentiment timeline analysis failed: {str(e)}")
            sentiment_timeline = None

        # Alert system (check for compliance violations)
        try:
            thresholds = AlertThresholds()
            alerts = check_compliance_alerts(analysis, thresholds)
            alert_summary = generate_alert_summary(alerts)
        except Exception as e:
            print(f"Warning: Alert system failed: {str(e)}")
            alerts = []
            alert_summary = {"total": 0, "has_alerts": False}

        # Enhanced comprehensive explanation (optional - can be slow for large texts)
        try:
            enhanced_explanation = comprehensive_explanation(text, analysis)
        except Exception as e:
            print(f"Warning: Enhanced explanation failed: {str(e)}")
            enhanced_explanation = None

        # Keyword detection
        try:
            keyword_results = detect_keywords(text)
            keyword_stats = get_keyword_statistics(keyword_results["matches"])
            keyword_results["statistics"] = keyword_stats
        except Exception as e:
            print(f"Warning: Keyword detection failed: {str(e)}")
            keyword_results = None

        # Audio quality analysis
        try:
            audio_quality = analyze_audio_quality(tmp_path)
        except Exception as e:
            print(f"Warning: Audio quality analysis failed: {str(e)}")
            audio_quality = None

        # Custom compliance rules evaluation
        custom_rules_results = []
        try:
            rule_engine = ComplianceRuleEngine(db)
            custom_rules_results = rule_engine.evaluate_rules(text, analysis)
            custom_rules_results = [r.to_dict() for r in custom_rules_results]
        except Exception as e:
            print(f"Warning: Custom compliance rules evaluation failed: {str(e)}")
            custom_rules_results = []

        # Action items and commitments detection
        action_items_result = None
        try:
            speaker_segments_list = speaker_segments if speaker_segments else None
            action_items_result = detect_action_items(text, speaker_segments_list)
        except Exception as e:
            print(f"Warning: Action items detection failed: {str(e)}")
            action_items_result = None

        # AI-Powered Summarization
        summary_result = None
        try:
            summary_result = summarize_conversation(text, summary_type="concise")
        except Exception as e:
            print(f"Warning: Summarization failed: {str(e)}")
            summary_result = None

        # Topic Extraction & Clustering
        topics_result = None
        try:
            topics_result = extract_topics(text, num_topics=5)
        except Exception as e:
            print(f"Warning: Topic extraction failed: {str(e)}")
            topics_result = None

        # Intent Classification
        intent_result = None
        try:
            intent_result = classify_intent(text, use_ml=True)
        except Exception as e:
            print(f"Warning: Intent classification failed: {str(e)}")
            intent_result = None

        # Prepare response data - ensure all values are JSON serializable
        response_data = {
            "transcription": text,
            "analysis": analysis,
            "explanation": token_explanations,
            "enhanced_explanation": enhanced_explanation,
            "keyword_detection": keyword_results,
            "audio_quality": audio_quality,
            "sentiment_timeline": sentiment_timeline,
            "alerts": alert_summary,
            "language": language_info,
            "speaker_diarization": {
                "segments": speaker_diarization.get("segments", []) if speaker_diarization else [],
                "speaker_stats": speaker_diarization.get("speaker_stats", {}) if speaker_diarization else {},
                "num_speakers_detected": speaker_diarization.get("num_speakers_detected", 0) if speaker_diarization else 0
            } if speaker_diarization else None,
            "speaker_timeline": speaker_timeline,
            "speaker_turns": speaker_turns,
            "conversation_analysis": conversation_metrics,
            "custom_compliance_rules": custom_rules_results,
            "action_items": action_items_result,
            "summary": summary_result,
            "topics": topics_result,
            "intent": intent_result
        }

        # Convert numpy types to native Python types for JSON serialization
        response_data = _convert_numpy_types(response_data)

        # Trigger webhooks and email notifications based on alerts (after data is prepared)
        webhook_results = []
        email_results = []
        try:
            webhook_service = WebhookService()
            email_service = get_email_service()

            # Prepare alert summary for triggers
            trigger_alert_data = {
                "alerts": alert_summary
            }

            # Trigger webhooks
            webhook_results = webhook_service.trigger_webhooks(
                trigger_alert_data,
                response_data,
                db
            )

            # Send email notifications
            email_results = email_service.send_notifications(
                trigger_alert_data,
                response_data,
                db
            )
        except Exception as e:
            print(f"Warning: Webhook/email notification failed: {str(e)}")
            webhook_results = []
            email_results = []

        # Add notification results to response
        response_data["webhook_triggers"] = webhook_results
        response_data["email_notifications"] = email_results

        # Save to database
        try:
            # Get file duration if available
            duration = result.get("segments", [{}])[-1].get("end", None) if result.get("segments") else None
            record = save_analysis(
                db=db,
                analysis_data=response_data,
                filename=file.filename,
                user_id=getattr(current_user, 'id', None) if current_user else None
            )
            response_data["record_id"] = record.id
        except Exception as e:
            print(f"Warning: Failed to save analysis to database: {str(e)}")
            # Continue even if database save fails

        # Clean up temp file
        try:
            os.unlink(tmp_path)
        except:
            pass

        return response_data
    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"Analysis error: {error_trace}")
        raise HTTPException(status_code=500, detail=f"Failed to analyze audio: {str(e)}")


@app.get("/supported_languages")
async def get_supported_languages_endpoint():
    """Get list of supported languages (public: the sign-in screen may need it)"""
    try:
        languages = get_supported_languages()
        return languages
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get supported languages: {str(e)}")


@app.post("/analyze_batch")
async def analyze_batch(files: List[UploadFile] = File(...), db: Session = Depends(get_db), _actor: User = Depends(require_permission("analysis:write"))):
    """Process multiple audio files in batch"""
    if not files or len(files) == 0:
        raise HTTPException(status_code=400, detail="No files provided")

    if len(files) > 50:  # Limit to 50 files per batch
        raise HTTPException(status_code=400, detail="Maximum 50 files allowed per batch")

    results = []
    errors = []

    # Load Whisper model once for all files
    model = whisper.load_model("tiny")

    # Process files
    for idx, file in enumerate(files):
        try:
            # Save file temporarily
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
                tmp.write(await file.read())
                tmp_path = tmp.name

            # Transcribe
            result = model.transcribe(tmp_path)
            text = result["text"]

            # Analyze
            analysis = analyze_text(text)
            token_explanations = explain_toxicity(text)

            # Prepare response data
            response_data = {
                "filename": file.filename,
                "transcription": text,
                "analysis": analysis,
                "explanation": token_explanations
            }

            # Save to database
            try:
                record = save_analysis(
                    db=db,
                    analysis_data=response_data,
                    filename=file.filename
                )
                response_data["record_id"] = record.id
            except Exception as e:
                print(f"Warning: Failed to save {file.filename} to database: {str(e)}")

            results.append(response_data)

            # Clean up temp file
            try:
                os.unlink(tmp_path)
            except:
                pass

        except Exception as e:
            error_msg = f"Error processing {file.filename}: {str(e)}"
            print(f"Batch processing error: {error_msg}")
            errors.append({
                "filename": file.filename,
                "error": error_msg
            })

    return {
        "total_files": len(files),
        "successful": len(results),
        "failed": len(errors),
        "results": results,
        "errors": errors
    }


@app.post("/generate_report")
async def generate_report(request: Request, _actor: User = Depends(require_permission("analysis:read"))):
    try:
        data = await request.json()
        if not data:
            raise HTTPException(status_code=400, detail="No data provided for report generation")

        # Validate required fields
        if "analysis" not in data:
            raise HTTPException(status_code=400, detail="Missing 'analysis' field in request data")

        output_file = "compliance_report.pdf"
        pdf_path = generate_compliance_pdf(data, output_path=output_file)

        if not os.path.exists(pdf_path):
            raise HTTPException(status_code=500, detail="PDF file was not created successfully")

        return FileResponse(pdf_path, filename=output_file, media_type="application/pdf")
    except HTTPException:
        raise
    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"Report generation error: {error_trace}")
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")


@app.get("/history")
async def get_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    min_score: Optional[float] = Query(None, ge=0, le=100),
    max_score: Optional[float] = Query(None, ge=0, le=100),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    filename: Optional[str] = None,
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission("analysis:read")),
):
    """Get analysis history with filtering"""
    try:
        query = db.query(AnalysisRecord)

        # Apply filters
        if min_score is not None:
            query = query.filter(AnalysisRecord.compliance_score >= min_score)
        if max_score is not None:
            query = query.filter(AnalysisRecord.compliance_score <= max_score)
        if filename:
            query = query.filter(AnalysisRecord.filename.contains(filename))
        if start_date:
            try:
                start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                query = query.filter(AnalysisRecord.created_at >= start)
            except:
                pass
        if end_date:
            try:
                end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                query = query.filter(AnalysisRecord.created_at <= end)
            except:
                pass

        # Get total count before pagination
        total = query.count()

        # Apply pagination and ordering
        records = query.order_by(desc(AnalysisRecord.created_at)).offset(skip).limit(limit).all()

        return {
            "total": total,
            "skip": skip,
            "limit": limit,
            "records": [record.to_dict() for record in records]
        }
    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"History retrieval error: {error_trace}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve history: {str(e)}")


@app.get("/history/{record_id}")
async def get_record(record_id: int, db: Session = Depends(get_db), _actor: User = Depends(require_permission("analysis:read"))):
    """Get a specific analysis record by ID"""
    try:
        record = db.query(AnalysisRecord).filter(AnalysisRecord.id == record_id).first()
        if not record:
            raise HTTPException(status_code=404, detail=f"Record {record_id} not found")
        return record.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve record: {str(e)}")


@app.delete("/history/{record_id}")
async def delete_record(record_id: int, db: Session = Depends(get_db), _actor: User = Depends(require_permission("analysis:delete"))):
    """Delete a specific analysis record"""
    try:
        record = db.query(AnalysisRecord).filter(AnalysisRecord.id == record_id).first()
        if not record:
            raise HTTPException(status_code=404, detail=f"Record {record_id} not found")
        db.delete(record)
        db.commit()
        return {"message": f"Record {record_id} deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete record: {str(e)}")


@app.get("/statistics")
async def get_statistics(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission("analysis:read")),
):
    """Get statistics and trends"""
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=days)

        # Get records in date range
        records = db.query(AnalysisRecord).filter(
            AnalysisRecord.created_at >= cutoff_date
        ).all()

        if not records:
            return {
                "total_analyses": 0,
                "average_compliance": 0,
                "min_compliance": 0,
                "max_compliance": 0,
                "by_sentiment": {},
                "by_emotion": {},
                "trends": []
            }

        # Calculate statistics
        compliance_scores = [r.compliance_score for r in records if r.compliance_score is not None]

        # Group by sentiment
        sentiment_counts = {}
        for record in records:
            if record.sentiment:
                sentiment_counts[record.sentiment] = sentiment_counts.get(record.sentiment, 0) + 1

        # Group by emotion
        emotion_counts = {}
        for record in records:
            if record.emotion:
                emotion_counts[record.emotion] = emotion_counts.get(record.emotion, 0) + 1

        # Daily trends
        daily_stats = {}
        for record in records:
            date_key = record.created_at.date().isoformat()
            if date_key not in daily_stats:
                daily_stats[date_key] = {"count": 0, "total_score": 0, "scores": []}
            daily_stats[date_key]["count"] += 1
            if record.compliance_score is not None:
                daily_stats[date_key]["total_score"] += record.compliance_score
                daily_stats[date_key]["scores"].append(record.compliance_score)

        # Calculate averages
        trends = []
        for date in sorted(daily_stats.keys()):
            stats = daily_stats[date]
            avg_score = stats["total_score"] / len(stats["scores"]) if stats["scores"] else 0
            trends.append({
                "date": date,
                "count": stats["count"],
                "average_compliance": round(avg_score, 2),
                "min_compliance": round(min(stats["scores"]), 2) if stats["scores"] else 0,
                "max_compliance": round(max(stats["scores"]), 2) if stats["scores"] else 0
            })

        return {
            "total_analyses": len(records),
            "average_compliance": round(sum(compliance_scores) / len(compliance_scores), 2) if compliance_scores else 0,
            "min_compliance": round(min(compliance_scores), 2) if compliance_scores else 0,
            "max_compliance": round(max(compliance_scores), 2) if compliance_scores else 0,
            "by_sentiment": sentiment_counts,
            "by_emotion": emotion_counts,
            "trends": trends
        }
    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"Statistics error: {error_trace}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve statistics: {str(e)}")


@app.get("/export/json/{record_id}")
async def export_json(record_id: int, db: Session = Depends(get_db), _actor: User = Depends(require_permission("analysis:read"))):
    """Export a specific analysis record as JSON"""
    try:
        record = db.query(AnalysisRecord).filter(AnalysisRecord.id == record_id).first()
        if not record:
            raise HTTPException(status_code=404, detail=f"Record {record_id} not found")

        data = record.to_dict()
        return JSONResponse(
            content=data,
            headers={"Content-Disposition": f"attachment; filename=analysis_{record_id}.json"}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export JSON: {str(e)}")


@app.get("/export/csv")
async def export_csv(
    min_score: Optional[float] = Query(None, ge=0, le=100),
    max_score: Optional[float] = Query(None, ge=0, le=100),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    filename: Optional[str] = None,
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission("analysis:read")),
):
    """Export analysis history as CSV"""
    try:
        # Build query with same filters as history endpoint
        query = db.query(AnalysisRecord)

        if min_score is not None:
            query = query.filter(AnalysisRecord.compliance_score >= min_score)
        if max_score is not None:
            query = query.filter(AnalysisRecord.compliance_score <= max_score)
        if filename:
            query = query.filter(AnalysisRecord.filename.contains(filename))
        if start_date:
            try:
                start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                query = query.filter(AnalysisRecord.created_at >= start)
            except:
                pass
        if end_date:
            try:
                end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                query = query.filter(AnalysisRecord.created_at <= end)
            except:
                pass

        records = query.order_by(desc(AnalysisRecord.created_at)).all()

        # Create CSV in memory
        output = io.StringIO()
        writer = csv.writer(output)

        # Write header
        writer.writerow([
            "ID", "Filename", "Date", "Compliance Score", "Sentiment", "Sentiment Confidence",
            "Emotion", "Emotion Confidence", "Toxicity Score", "Transcription"
        ])

        # Write data rows
        for record in records:
            writer.writerow([
                record.id,
                record.filename or "N/A",
                record.created_at.strftime("%Y-%m-%d %H:%M:%S") if record.created_at else "N/A",
                record.compliance_score or 0,
                record.sentiment or "N/A",
                record.sentiment_confidence or 0,
                record.emotion or "N/A",
                record.emotion_confidence or 0,
                record.toxicity_score or 0,
                (record.transcription[:500] + "...") if record.transcription and len(record.transcription) > 500 else (record.transcription or "N/A")
            ])

        # Prepare response
        output.seek(0)
        csv_content = output.getvalue()
        output.close()

        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=analysis_history.csv"}
        )
    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"CSV export error: {error_trace}")
        raise HTTPException(status_code=500, detail=f"Failed to export CSV: {str(e)}")


@app.get("/export/json/all")
async def export_json_all(
    min_score: Optional[float] = Query(None, ge=0, le=100),
    max_score: Optional[float] = Query(None, ge=0, le=100),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    filename: Optional[str] = None,
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission("analysis:read")),
):
    """Export all analysis records as JSON array"""
    try:
        # Build query with same filters as history endpoint
        query = db.query(AnalysisRecord)

        if min_score is not None:
            query = query.filter(AnalysisRecord.compliance_score >= min_score)
        if max_score is not None:
            query = query.filter(AnalysisRecord.compliance_score <= max_score)
        if filename:
            query = query.filter(AnalysisRecord.filename.contains(filename))
        if start_date:
            try:
                start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                query = query.filter(AnalysisRecord.created_at >= start)
            except:
                pass
        if end_date:
            try:
                end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                query = query.filter(AnalysisRecord.created_at <= end)
            except:
                pass

        records = query.order_by(desc(AnalysisRecord.created_at)).all()

        # Convert to list of dicts
        data = [record.to_dict() for record in records]

        return JSONResponse(
            content=data,
            headers={"Content-Disposition": "attachment; filename=analysis_history.json"}
        )
    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"JSON export error: {error_trace}")
        raise HTTPException(status_code=500, detail=f"Failed to export JSON: {str(e)}")


@app.post("/compare")
async def compare_analyses(request: Request, db: Session = Depends(get_db), _actor: User = Depends(require_permission("analysis:read"))):
    """Compare two or more analysis records"""
    try:
        data = await request.json()
        record_ids = data.get("record_ids", [])

        if not record_ids or len(record_ids) < 2:
            raise HTTPException(status_code=400, detail="At least 2 record IDs required for comparison")

        if len(record_ids) > 10:
            raise HTTPException(status_code=400, detail="Maximum 10 records can be compared at once")

        # Fetch records
        records = []
        for record_id in record_ids:
            record = db.query(AnalysisRecord).filter(AnalysisRecord.id == record_id).first()
            if not record:
                raise HTTPException(status_code=404, detail=f"Record {record_id} not found")
            records.append(record.to_dict())

        # Prepare comparison data
        comparison = {
            "records": records,
            "summary": {
                "count": len(records),
                "date_range": {
                    "earliest": min(r.get("created_at", "") for r in records),
                    "latest": max(r.get("created_at", "") for r in records)
                }
            },
            "metrics": {}
        }

        # Calculate comparison metrics
        compliance_scores = [r.get("analysis", {}).get("compliance_score", 0) for r in records]
        toxicity_scores = [r.get("analysis", {}).get("toxicity_score", 0) for r in records]

        comparison["metrics"] = {
            "compliance": {
                "values": compliance_scores,
                "average": round(sum(compliance_scores) / len(compliance_scores), 2),
                "min": round(min(compliance_scores), 2),
                "max": round(max(compliance_scores), 2),
                "range": round(max(compliance_scores) - min(compliance_scores), 2),
                "improvement": round(compliance_scores[-1] - compliance_scores[0], 2) if len(compliance_scores) >= 2 else 0
            },
            "toxicity": {
                "values": toxicity_scores,
                "average": round(sum(toxicity_scores) / len(toxicity_scores), 2),
                "min": round(min(toxicity_scores), 2),
                "max": round(max(toxicity_scores), 2)
            }
        }

        # Sentiment distribution
        sentiment_counts = {}
        for record in records:
            sentiment = record.get("analysis", {}).get("sentiment", "UNKNOWN")
            sentiment_counts[sentiment] = sentiment_counts.get(sentiment, 0) + 1

        comparison["metrics"]["sentiment_distribution"] = sentiment_counts

        # Emotion distribution
        emotion_counts = {}
        for record in records:
            emotion = record.get("analysis", {}).get("emotion", "unknown")
            emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1

        comparison["metrics"]["emotion_distribution"] = emotion_counts

        return comparison

    except HTTPException:
        raise
    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"Comparison error: {error_trace}")
        raise HTTPException(status_code=500, detail=f"Failed to compare analyses: {str(e)}")


# Pydantic models for compliance rules
class ComplianceRuleCreate(BaseModel):
    name: str
    description: Opt[str] = None
    rule_type: str  # "regex", "keyword", "sentiment", "toxicity", "emotion", "compliance_score", "custom"
    pattern: Opt[str] = None
    condition: str  # "contains", "matches", "greater_than", "less_than", "equals", etc.
    threshold: Opt[float] = None
    severity: str = "warning"  # "critical", "warning", "info"
    category: Opt[str] = None
    is_active: bool = True
    priority: int = 0
    created_by: Opt[str] = None
    config: Opt[dict] = None


class ComplianceRuleUpdate(BaseModel):
    name: Opt[str] = None
    description: Opt[str] = None
    rule_type: Opt[str] = None
    pattern: Opt[str] = None
    condition: Opt[str] = None
    threshold: Opt[float] = None
    severity: Opt[str] = None
    category: Opt[str] = None
    is_active: Opt[bool] = None
    priority: Opt[int] = None
    config: Opt[dict] = None


# Compliance Rules API Endpoints
@app.get("/compliance_rules")
async def get_compliance_rules(
    category: Opt[str] = None,
    is_active: Opt[bool] = None,
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission("compliance:read")),
):
    """Get all compliance rules with optional filters"""
    try:
        query = db.query(ComplianceRule)

        if category is not None:
            query = query.filter(ComplianceRule.category == category)
        if is_active is not None:
            query = query.filter(ComplianceRule.is_active == is_active)

        rules = query.order_by(ComplianceRule.priority.desc(), ComplianceRule.created_at).all()
        return {"rules": [rule.to_dict() for rule in rules], "count": len(rules)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get compliance rules: {str(e)}")


@app.get("/compliance_rules/{rule_id}")
async def get_compliance_rule(rule_id: int, db: Session = Depends(get_db), _actor: User = Depends(require_permission("compliance:read"))):
    """Get a specific compliance rule by ID"""
    try:
        rule = db.query(ComplianceRule).filter(ComplianceRule.id == rule_id).first()
        if not rule:
            raise HTTPException(status_code=404, detail=f"Compliance rule {rule_id} not found")
        return rule.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get compliance rule: {str(e)}")


@app.post("/compliance_rules")
async def create_compliance_rule(rule_data: ComplianceRuleCreate, db: Session = Depends(get_db), _actor: User = Depends(require_permission("compliance:write"))):
    # create_compliance_rule: validated before anything is written
    _validate_rule_pattern(getattr(rule_data, 'rule_type', None), getattr(rule_data, 'pattern', None))
    """Create a new compliance rule"""
    try:
        # Validate rule type
        valid_types = ["regex", "keyword", "sentiment", "toxicity", "emotion", "compliance_score", "custom"]
        if rule_data.rule_type not in valid_types:
            raise HTTPException(status_code=400, detail=f"Invalid rule_type. Must be one of: {valid_types}")

        # Validate severity
        valid_severities = ["critical", "warning", "info"]
        if rule_data.severity not in valid_severities:
            raise HTTPException(status_code=400, detail=f"Invalid severity. Must be one of: {valid_severities}")

        # Create rule
        rule = ComplianceRule(
            name=rule_data.name,
            description=rule_data.description,
            rule_type=rule_data.rule_type,
            pattern=rule_data.pattern,
            condition=rule_data.condition,
            threshold=rule_data.threshold,
            severity=rule_data.severity,
            category=rule_data.category,
            is_active=rule_data.is_active,
            priority=rule_data.priority,
            created_by=rule_data.created_by,
            config=rule_data.config
        )

        db.add(rule)
        db.commit()
        db.refresh(rule)

        return rule.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create compliance rule: {str(e)}")


@app.put("/compliance_rules/{rule_id}")
async def update_compliance_rule(rule_id: int, rule_data: ComplianceRuleUpdate, db: Session = Depends(get_db), _actor: User = Depends(require_permission("compliance:write"))):
    # update_compliance_rule: validated before anything is written
    _validate_rule_pattern(getattr(rule_data, 'rule_type', None), getattr(rule_data, 'pattern', None))
    """Update an existing compliance rule"""
    try:
        rule = db.query(ComplianceRule).filter(ComplianceRule.id == rule_id).first()
        if not rule:
            raise HTTPException(status_code=404, detail=f"Compliance rule {rule_id} not found")

        # Update fields
        update_data = rule_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            if hasattr(rule, field):
                setattr(rule, field, value)

        rule.updated_at = dt.utcnow()

        db.commit()
        db.refresh(rule)

        return rule.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update compliance rule: {str(e)}")


@app.delete("/compliance_rules/{rule_id}")
async def delete_compliance_rule(rule_id: int, db: Session = Depends(get_db), _actor: User = Depends(require_permission("compliance:delete"))):
    """Delete a compliance rule"""
    try:
        rule = db.query(ComplianceRule).filter(ComplianceRule.id == rule_id).first()
        if not rule:
            raise HTTPException(status_code=404, detail=f"Compliance rule {rule_id} not found")

        db.delete(rule)
        db.commit()

        return {"message": f"Compliance rule {rule_id} deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete compliance rule: {str(e)}")


@app.post("/compliance_rules/{rule_id}/test")
async def test_compliance_rule(
    rule_id: int,
    text: str = Query(..., description="Text to test the rule against"),
    analysis: Opt[dict] = None,
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission("compliance:write")),
):
    """Test a compliance rule against sample text"""
    try:
        rule = db.query(ComplianceRule).filter(ComplianceRule.id == rule_id).first()
        if not rule:
            raise HTTPException(status_code=404, detail=f"Compliance rule {rule_id} not found")

        # Use provided analysis or create default
        if analysis is None:
            analysis = {"sentiment": "NEUTRAL", "toxicity_score": 0.0, "compliance_score": 100.0, "emotion": "neutral"}

        # Evaluate rule
        rule_engine = ComplianceRuleEngine(db)
        result = rule_engine.evaluate_rule(rule, text, analysis)

        return result.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to test compliance rule: {str(e)}")


# Pydantic models for scheduled reports
class ScheduledReportCreate(BaseModel):
    name: str
    description: Opt[str] = None
    schedule_type: str  # "daily", "weekly", "monthly", "custom"
    schedule_config: dict
    timezone: str = "UTC"
    report_type: str = "summary"  # "summary", "detailed"
    filters: Opt[dict] = None
    email_recipients: List[str]
    email_subject: Opt[str] = None
    email_body_template: Opt[str] = None
    is_active: bool = True
    created_by: Opt[str] = None


class ScheduledReportUpdate(BaseModel):
    name: Opt[str] = None
    description: Opt[str] = None
    schedule_type: Opt[str] = None
    schedule_config: Opt[dict] = None
    timezone: Opt[str] = None
    report_type: Opt[str] = None
    filters: Opt[dict] = None
    email_recipients: Opt[List[str]] = None
    email_subject: Opt[str] = None
    email_body_template: Opt[str] = None
    is_active: Opt[bool] = None


# Scheduled Reports API Endpoints
@app.get("/scheduled_reports")
async def get_scheduled_reports(
    is_active: Opt[bool] = None,
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission("integration:read")),
):
    """Get all scheduled reports with optional filters"""
    try:
        query = db.query(ScheduledReport)
        if is_active is not None:
            query = query.filter(ScheduledReport.is_active == is_active)
        reports = query.order_by(ScheduledReport.created_at.desc()).all()
        return {"reports": [r.to_dict() for r in reports], "count": len(reports)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get scheduled reports: {str(e)}")


@app.get("/scheduled_reports/{report_id}")
async def get_scheduled_report(report_id: int, db: Session = Depends(get_db), _actor: User = Depends(require_permission("integration:read"))):
    """Get a specific scheduled report by ID"""
    try:
        report = db.query(ScheduledReport).filter(ScheduledReport.id == report_id).first()
        if not report:
            raise HTTPException(status_code=404, detail=f"Scheduled report {report_id} not found")
        return report.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get scheduled report: {str(e)}")


@app.post("/scheduled_reports")
async def create_scheduled_report(report_data: ScheduledReportCreate, db: Session = Depends(get_db), _actor: User = Depends(require_permission("integration:write"))):
    """Create a new scheduled report"""
    try:
        # Validate schedule type
        valid_types = ["daily", "weekly", "monthly", "custom"]
        if report_data.schedule_type not in valid_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid schedule_type. Must be one of: {valid_types}"
            )

        # Validate email recipients
        if not report_data.email_recipients or len(report_data.email_recipients) == 0:
            raise HTTPException(status_code=400, detail="At least one email recipient is required")

        # Create scheduled report
        report = ScheduledReport(
            name=report_data.name,
            description=report_data.description,
            schedule_type=report_data.schedule_type,
            schedule_config=report_data.schedule_config,
            timezone=report_data.timezone,
            report_type=report_data.report_type,
            filters=report_data.filters,
            email_recipients=report_data.email_recipients,
            email_subject=report_data.email_subject,
            email_body_template=report_data.email_body_template,
            is_active=report_data.is_active,
            created_by=report_data.created_by
        )

        db.add(report)
        db.commit()
        db.refresh(report)

        # Add to scheduler
        scheduler = get_scheduler()
        scheduler.add_schedule(report, db)

        return report.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create scheduled report: {str(e)}")


@app.put("/scheduled_reports/{report_id}")
async def update_scheduled_report(
    report_id: int,
    report_data: ScheduledReportUpdate,
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission("integration:write")),
):
    """Update an existing scheduled report"""
    try:
        report = db.query(ScheduledReport).filter(ScheduledReport.id == report_id).first()
        if not report:
            raise HTTPException(status_code=404, detail=f"Scheduled report {report_id} not found")

        # Update fields
        update_data = report_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            if hasattr(report, field):
                setattr(report, field, value)

        report.updated_at = dt.utcnow()
        db.commit()
        db.refresh(report)

        # Update scheduler
        scheduler = get_scheduler()
        if report.is_active:
            scheduler.add_schedule(report, db)
        else:
            scheduler.remove_schedule(report.id)

        return report.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update scheduled report: {str(e)}")


@app.delete("/scheduled_reports/{report_id}")
async def delete_scheduled_report(report_id: int, db: Session = Depends(get_db), _actor: User = Depends(require_permission("integration:write"))):
    """Delete a scheduled report"""
    try:
        report = db.query(ScheduledReport).filter(ScheduledReport.id == report_id).first()
        if not report:
            raise HTTPException(status_code=404, detail=f"Scheduled report {report_id} not found")

        # Remove from scheduler
        scheduler = get_scheduler()
        scheduler.remove_schedule(report.id)

        db.delete(report)
        db.commit()

        return {"message": f"Scheduled report {report_id} deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete scheduled report: {str(e)}")


@app.post("/scheduled_reports/{report_id}/run_now")
async def run_scheduled_report_now(report_id: int, db: Session = Depends(get_db), _actor: User = Depends(require_permission("integration:write"))):
    """Manually trigger a scheduled report to run immediately"""
    try:
        report = db.query(ScheduledReport).filter(ScheduledReport.id == report_id).first()
        if not report:
            raise HTTPException(status_code=404, detail=f"Scheduled report {report_id} not found")

        # Run report immediately
        scheduler = get_scheduler()
        scheduler._generate_and_send_report(report_id)

        return {"message": f"Scheduled report {report_id} executed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to run scheduled report: {str(e)}")


# Pydantic models for Webhooks
class WebhookCreate(BaseModel):
    name: str
    description: Opt[str] = None
    url: str
    method: str = "POST"
    headers: Opt[dict] = None
    auth_type: str = "none"  # "none", "bearer", "basic", "custom"
    auth_config: Opt[dict] = None
    trigger_on_critical: bool = True
    trigger_on_warning: bool = False
    trigger_on_compliance_low: bool = True
    trigger_on_custom_rule: bool = True
    min_compliance_score: Opt[float] = None
    payload_template: Opt[dict] = None
    include_transcription: bool = True
    include_analysis: bool = True
    is_active: bool = True
    created_by: Opt[str] = None


class WebhookUpdate(BaseModel):
    name: Opt[str] = None
    description: Opt[str] = None
    url: Opt[str] = None
    method: Opt[str] = None
    headers: Opt[dict] = None
    auth_type: Opt[str] = None
    auth_config: Opt[dict] = None
    trigger_on_critical: Opt[bool] = None
    trigger_on_warning: Opt[bool] = None
    trigger_on_compliance_low: Opt[bool] = None
    trigger_on_custom_rule: Opt[bool] = None
    min_compliance_score: Opt[float] = None
    payload_template: Opt[dict] = None
    include_transcription: Opt[bool] = None
    include_analysis: Opt[bool] = None
    is_active: Opt[bool] = None


# Webhook API Endpoints
@app.get("/webhooks")
async def get_webhooks(
    is_active: Opt[bool] = None,
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission("integration:read")),
):
    """Get all webhooks with optional filters"""
    try:
        query = db.query(Webhook)
        if is_active is not None:
            query = query.filter(Webhook.is_active == is_active)
        webhooks = query.order_by(Webhook.created_at.desc()).all()
        return {"webhooks": [w.to_dict() for w in webhooks], "count": len(webhooks)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get webhooks: {str(e)}")


@app.get("/webhooks/{webhook_id}")
async def get_webhook(webhook_id: int, db: Session = Depends(get_db), _actor: User = Depends(require_permission("integration:read"))):
    """Get a specific webhook by ID"""
    try:
        webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
        if not webhook:
            raise HTTPException(status_code=404, detail=f"Webhook {webhook_id} not found")
        return webhook.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get webhook: {str(e)}")


@app.post("/webhooks")
async def create_webhook(webhook_data: WebhookCreate, db: Session = Depends(get_db), _actor: User = Depends(require_permission("integration:write"))):
    """Create a new webhook"""
    try:
        # Validate method
        valid_methods = ["GET", "POST", "PUT"]
        if webhook_data.method.upper() not in valid_methods:
            raise HTTPException(status_code=400, detail=f"Invalid method. Must be one of: {valid_methods}")

        # Validate auth type
        valid_auth_types = ["none", "bearer", "basic", "custom"]
        if webhook_data.auth_type not in valid_auth_types:
            raise HTTPException(status_code=400, detail=f"Invalid auth_type. Must be one of: {valid_auth_types}")

        # Create webhook
        webhook = Webhook(
            name=webhook_data.name,
            description=webhook_data.description,
            url=webhook_data.url,
            method=webhook_data.method.upper(),
            headers=webhook_data.headers,
            auth_type=webhook_data.auth_type,
            auth_config=webhook_data.auth_config,
            trigger_on_critical=webhook_data.trigger_on_critical,
            trigger_on_warning=webhook_data.trigger_on_warning,
            trigger_on_compliance_low=webhook_data.trigger_on_compliance_low,
            trigger_on_custom_rule=webhook_data.trigger_on_custom_rule,
            min_compliance_score=webhook_data.min_compliance_score,
            payload_template=webhook_data.payload_template,
            include_transcription=webhook_data.include_transcription,
            include_analysis=webhook_data.include_analysis,
            is_active=webhook_data.is_active,
            created_by=webhook_data.created_by
        )

        db.add(webhook)
        db.commit()
        db.refresh(webhook)

        return webhook.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create webhook: {str(e)}")


@app.put("/webhooks/{webhook_id}")
async def update_webhook(
    webhook_id: int,
    webhook_data: WebhookUpdate,
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission("integration:write")),
):
    """Update an existing webhook"""
    try:
        webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
        if not webhook:
            raise HTTPException(status_code=404, detail=f"Webhook {webhook_id} not found")

        update_data = webhook_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            if hasattr(webhook, field):
                setattr(webhook, field, value)

        webhook.updated_at = dt.utcnow()
        db.commit()
        db.refresh(webhook)

        return webhook.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update webhook: {str(e)}")


@app.delete("/webhooks/{webhook_id}")
async def delete_webhook(webhook_id: int, db: Session = Depends(get_db), _actor: User = Depends(require_permission("integration:write"))):
    """Delete a webhook"""
    try:
        webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
        if not webhook:
            raise HTTPException(status_code=404, detail=f"Webhook {webhook_id} not found")

        db.delete(webhook)
        db.commit()

        return {"message": f"Webhook {webhook_id} deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete webhook: {str(e)}")


@app.post("/webhooks/{webhook_id}/test")
async def test_webhook(webhook_id: int, db: Session = Depends(get_db), _actor: User = Depends(require_permission("integration:write"))):
    """Test a webhook with sample data"""
    try:
        webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
        if not webhook:
            raise HTTPException(status_code=404, detail=f"Webhook {webhook_id} not found")

        webhook_service = WebhookService()
        result = webhook_service.test_webhook(webhook)

        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to test webhook: {str(e)}")


# Pydantic models for Notification Configs
class NotificationConfigCreate(BaseModel):
    name: str
    description: Opt[str] = None
    email_recipients: List[str]
    notify_on_critical: bool = True
    notify_on_warning: bool = False
    notify_on_compliance_low: bool = True
    notify_on_custom_rule: bool = True
    min_compliance_score: Opt[float] = None
    email_subject_template: Opt[str] = None
    email_body_template: Opt[str] = None
    rate_limit_minutes: int = 60
    is_active: bool = True
    created_by: Opt[str] = None


class NotificationConfigUpdate(BaseModel):
    name: Opt[str] = None
    description: Opt[str] = None
    email_recipients: Opt[List[str]] = None
    notify_on_critical: Opt[bool] = None
    notify_on_warning: Opt[bool] = None
    notify_on_compliance_low: Opt[bool] = None
    notify_on_custom_rule: Opt[bool] = None
    min_compliance_score: Opt[float] = None
    email_subject_template: Opt[str] = None
    email_body_template: Opt[str] = None
    rate_limit_minutes: Opt[int] = None
    is_active: Opt[bool] = None


# Notification Config API Endpoints
@app.get("/notification_configs")
async def get_notification_configs(
    is_active: Opt[bool] = None,
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission("integration:read")),
):
    """Get all notification configs"""
    try:
        query = db.query(NotificationConfig)
        if is_active is not None:
            query = query.filter(NotificationConfig.is_active == is_active)
        configs = query.order_by(NotificationConfig.created_at.desc()).all()
        return {"configs": [c.to_dict() for c in configs], "count": len(configs)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get notification configs: {str(e)}")


@app.get("/notification_configs/{config_id}")
async def get_notification_config(config_id: int, db: Session = Depends(get_db), _actor: User = Depends(require_permission("integration:read"))):
    """Get a specific notification config by ID"""
    try:
        config = db.query(NotificationConfig).filter(NotificationConfig.id == config_id).first()
        if not config:
            raise HTTPException(status_code=404, detail=f"Notification config {config_id} not found")
        return config.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get notification config: {str(e)}")


@app.post("/notification_configs")
async def create_notification_config(
    config_data: NotificationConfigCreate,
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission("integration:write")),
):
    """Create a new notification config"""
    try:
        if not config_data.email_recipients or len(config_data.email_recipients) == 0:
            raise HTTPException(status_code=400, detail="At least one email recipient is required")

        config = NotificationConfig(
            name=config_data.name,
            description=config_data.description,
            email_recipients=config_data.email_recipients,
            notify_on_critical=config_data.notify_on_critical,
            notify_on_warning=config_data.notify_on_warning,
            notify_on_compliance_low=config_data.notify_on_compliance_low,
            notify_on_custom_rule=config_data.notify_on_custom_rule,
            min_compliance_score=config_data.min_compliance_score,
            email_subject_template=config_data.email_subject_template,
            email_body_template=config_data.email_body_template,
            rate_limit_minutes=config_data.rate_limit_minutes,
            is_active=config_data.is_active,
            created_by=config_data.created_by
        )

        db.add(config)
        db.commit()
        db.refresh(config)

        return config.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create notification config: {str(e)}")


@app.put("/notification_configs/{config_id}")
async def update_notification_config(
    config_id: int,
    config_data: NotificationConfigUpdate,
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission("integration:write")),
):
    """Update an existing notification config"""
    try:
        config = db.query(NotificationConfig).filter(NotificationConfig.id == config_id).first()
        if not config:
            raise HTTPException(status_code=404, detail=f"Notification config {config_id} not found")

        update_data = config_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            if hasattr(config, field):
                setattr(config, field, value)

        config.updated_at = dt.utcnow()
        db.commit()
        db.refresh(config)

        return config.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update notification config: {str(e)}")


@app.delete("/notification_configs/{config_id}")
async def delete_notification_config(config_id: int, db: Session = Depends(get_db), _actor: User = Depends(require_permission("integration:write"))):
    """Delete a notification config"""
    try:
        config = db.query(NotificationConfig).filter(NotificationConfig.id == config_id).first()
        if not config:
            raise HTTPException(status_code=404, detail=f"Notification config {config_id} not found")

        db.delete(config)
        db.commit()

        return {"message": f"Notification config {config_id} deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete notification config: {str(e)}")


@app.post("/notification_configs/{config_id}/test")
async def test_notification_config(config_id: int, db: Session = Depends(get_db), _actor: User = Depends(require_permission("integration:write"))):
    """Test a notification config with sample data"""
    try:
        config = db.query(NotificationConfig).filter(NotificationConfig.id == config_id).first()
        if not config:
            raise HTTPException(status_code=404, detail=f"Notification config {config_id} not found")

        email_service = get_email_service()
        result = email_service.test_notification(config)

        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to test notification config: {str(e)}")


# ============================================================================
# Phase 4: Authentication & Authorization
# ============================================================================

class UserLogin(BaseModel):
    username: str
    password: str

class UserRegister(BaseModel):
    username: str
    email: EmailStr
    password: str
    full_name: Optional[str] = None

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: Optional[str]
    is_active: bool
    is_superuser: bool
    roles: List[str]
    teams: List[str]
    must_change_password: bool = False
    permissions: List[str] = []

class Token(BaseModel):
    access_token: str
    token_type: str
    must_change_password: bool = False

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

@app.post("/api/auth/login", response_model=Token)
@limiter.limit(settings.RATE_LIMIT_LOGIN)
async def login(request: Request, user_credentials: UserLogin, db: Session = Depends(get_db)):
    """Authenticate user and return JWT token"""
    user = authenticate_user(db, user_credentials.username, user_credentials.password)
    if not user:
        audit_record(db, action="auth.login", request=request, username=user_credentials.username, status="failure")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    audit_record(db, action="auth.login", request=request, user=user)
    return {"access_token": access_token, "token_type": "bearer", "must_change_password": bool(user.must_change_password)}

@app.post("/api/auth/change-password")
async def change_password(
    body: PasswordChange,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change the signed-in user's password; clears the must-change flag."""
    from .auth import verify_password
    if not verify_password(body.current_password, current_user.hashed_password):
        audit_record(db, action="auth.change_password", request=request, user=current_user, status="failure")
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if body.new_password == body.current_password:
        raise HTTPException(status_code=400, detail="The new password must differ from the current one")
    problem = validate_password(body.new_password)
    if problem:
        raise HTTPException(status_code=400, detail=problem)
    current_user.hashed_password = get_password_hash(body.new_password)
    current_user.must_change_password = False
    current_user.password_changed_at = dt.utcnow()
    db.commit()
    audit_record(db, action="auth.change_password", request=request, user=current_user)
    return {"status": "ok"}

@app.get("/api/auth/config")
async def auth_config():
    """What the sign-in screen needs to know before anyone is signed in."""
    return {"allow_self_registration": settings.ALLOW_SELF_REGISTRATION, "min_password_length": settings.MIN_PASSWORD_LENGTH}

@app.post("/api/auth/register", response_model=UserResponse)
async def register(
    user_data: UserRegister,
    request: Request,
    db: Session = Depends(get_db),
    actor: Optional[User] = Depends(get_optional_user),
):
    """
    Create a user. Self-registration is off unless ALLOW_SELF_REGISTRATION is set; otherwise user:write
    is needed. The account starts with no role, so it can't see or change anything until an
    administrator assigns one on the Users page.
    """
    def refuse(status_code: int, detail: str):
        audit_record(db, action="user.create", request=request, user=actor, resource_type="users", status="failure",
                     details={"username": user_data.username, "reason": detail})
        raise HTTPException(status_code=status_code, detail=detail)

    if not settings.ALLOW_SELF_REGISTRATION:
        allowed = actor is not None and (actor.is_superuser or "user:write" in get_user_permissions(actor, db))
        if not allowed:
            refuse(403, "Self-registration is disabled; ask an administrator for an account")
    problem = validate_password(user_data.password)
    if problem:
        refuse(400, problem)
    # Check if username exists
    if db.query(User).filter(User.username == user_data.username).first():
        refuse(400, "Username already registered")

    # Check if email exists
    if db.query(User).filter(User.email == user_data.email).first():
        refuse(400, "Email already registered")

    # Create user
    hashed_password = get_password_hash(user_data.password)
    user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password,
        full_name=user_data.full_name,
        is_active=True,
        is_superuser=False
    )

    # No role yet: an administrator grants access (viewer, analyst or admin) on the Users page.
    # Handing every sign-up the viewer role let anyone on the internet read every call.
    # An account made by an administrator starts with a password its owner must replace.
    user.must_change_password = actor is not None and actor.username != user.username

    db.add(user)
    db.commit()
    db.refresh(user)
    audit_record(db, action="user.create", request=request, user=actor, resource_type="users", resource_id=user.id, details={"username": user.username})

    return user.to_dict()

@app.get("/api/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Get current authenticated user information"""
    data = current_user.to_dict()
    data["permissions"] = sorted(get_user_permissions(current_user, db))
    return data

@app.get("/api/users", response_model=List[UserResponse])
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    current_user: User = Depends(require_permission("user:read")),
    db: Session = Depends(get_db)
):
    """List all users (requires user:read permission)"""
    users = db.query(User).offset(skip).limit(limit).all()
    return [user.to_dict() for user in users]

@app.get("/api/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    current_user: User = Depends(require_permission("user:read")),
    db: Session = Depends(get_db)
):
    """Get user by ID"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user.to_dict()

@app.put("/api/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    current_user: User = Depends(require_permission("user:write")),
    db: Session = Depends(get_db)
):
    """Update user (requires user:write permission)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = user_data.dict(exclude_unset=True)
    if "password" in update_data:
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))
        update_data["hashed_password"] = update_data.pop("hashed_password")

    for field, value in update_data.items():
        if hasattr(user, field):
            setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user.to_dict()

@app.get("/api/roles")
async def list_roles(
    current_user: User = Depends(require_permission("user:read")),
    db: Session = Depends(get_db)
):
    """List all roles"""
    roles = db.query(Role).filter(Role.is_active == True).all()
    return [role.to_dict() for role in roles]

class RoleAssignment(BaseModel):
    role_id: int

@app.post("/api/users/{user_id}/roles")
async def assign_role_to_user(
    user_id: int,
    role_data: RoleAssignment,
    current_user: User = Depends(require_permission("user:write")),
    db: Session = Depends(get_db)
):
    """Assign a role to a user"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    role = db.query(Role).filter(Role.id == role_data.role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    if role not in user.roles:
        user.roles.append(role)
        db.commit()

    return {"message": f"Role '{role.name}' assigned to user '{user.username}'"}

@app.delete("/api/users/{user_id}/roles/{role_id}")
async def remove_role_from_user(
    user_id: int,
    role_id: int,
    current_user: User = Depends(require_permission("user:write")),
    db: Session = Depends(get_db)
):
    """Remove a role from a user"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    if role in user.roles:
        user.roles.remove(role)
        db.commit()

    return {"message": f"Role '{role.name}' removed from user '{user.username}'"}

@app.delete("/api/users/{user_id}")
async def delete_user(
    user_id: int,
    current_user: User = Depends(require_permission("user:delete")),
    db: Session = Depends(get_db)
):
    """Delete a user (requires user:delete permission, cannot delete yourself)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent self-deletion
    if user.id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot delete your own account"
        )

    # Prevent deleting the last superuser/admin (optional safety check)
    if user.is_superuser:
        superuser_count = db.query(User).filter(User.is_superuser == True).count()
        if superuser_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete the last superuser account"
            )

    # Delete user (cascade will handle related records)
    db.delete(user)
    db.commit()

    return {"message": f"User '{user.username}' has been deleted successfully"}

class DatabaseResetRequest(BaseModel):
    confirm: bool = False
    reset_analyses: bool = True
    reset_users: bool = False  # Default False - preserves users unless explicitly requested
    reset_rules: bool = False
    reset_schedules: bool = False

@app.post("/api/admin/reset-database")
async def reset_database(
    reset_request: DatabaseResetRequest,
    current_user: User = Depends(require_role("admin")),  # Requires admin role
    db: Session = Depends(get_db)
):
    """Reset database - drop and recreate tables (admin only, dangerous operation)"""
    if not settings.ALLOW_DB_RESET:
        raise HTTPException(status_code=403, detail="Database reset is disabled on this server (ALLOW_DB_RESET)")
    # Double check - must be superuser or admin
    if not current_user.is_superuser and "admin" not in [r.name for r in current_user.roles if r.is_active]:
        raise HTTPException(
            status_code=403,
            detail="Only administrators can reset the database"
        )

    if not reset_request.confirm:
        raise HTTPException(
            status_code=400,
            detail="Database reset requires explicit confirmation. Set 'confirm: true' in the request body."
        )

    try:
        from .database import Base, engine, SessionLocal
        from sqlalchemy import text

        # Prevent resetting users if current user would be affected and there's no admin user left
        if reset_request.reset_users:
            # Get all admin users (superusers or users with admin role)
            superusers = db.query(User).filter(User.is_superuser == True).all()
            admin_role = db.query(Role).filter(Role.name == "admin").first()
            admin_users_with_role = []
            if admin_role:
                admin_users_with_role = [user for user in admin_role.users if user.is_active]

            # Combine unique admin user IDs
            admin_user_ids = {user.id for user in superusers}
            admin_user_ids.update(user.id for user in admin_users_with_role)
            admin_count = len(admin_user_ids)

            if admin_count <= 1:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot reset users - you are the last admin. Reset other tables instead."
                )

        # Close all active connections
        db.close()

        # Drop and recreate tables based on what's being reset
        if reset_request.reset_users:
            # Full reset - drop all tables and recreate
            Base.metadata.drop_all(bind=engine)
            Base.metadata.create_all(bind=engine)

            # Re-initialize roles, permissions, and default admin
            new_db = SessionLocal()
            try:
                init_default_roles_and_permissions(new_db)

                # Re-create the admin account (ADMIN_PASSWORD, or a generated one in the log)
                ensure_admin_user(new_db)
            finally:
                new_db.close()
        else:
            # Selective reset - only drop specific tables
            if reset_request.reset_analyses:
                with engine.connect() as conn:
                    conn.execute(text("DROP TABLE IF EXISTS analysis_tags"))
                    conn.execute(text("DROP TABLE IF EXISTS comments"))
                    conn.execute(text("DROP TABLE IF EXISTS analysis_records"))
                    conn.commit()

            if reset_request.reset_rules:
                with engine.connect() as conn:
                    conn.execute(text("DROP TABLE IF EXISTS compliance_rules"))
                    conn.commit()

            if reset_request.reset_schedules:
                with engine.connect() as conn:
                    conn.execute(text("DROP TABLE IF EXISTS scheduled_reports"))
                    conn.execute(text("DROP TABLE IF EXISTS webhooks"))
                    conn.execute(text("DROP TABLE IF EXISTS notification_configs"))
                    conn.commit()

            # Recreate all tables (this will only create missing ones)
            Base.metadata.create_all(bind=engine)

        # Reload scheduler schedules
        from .database import SessionLocal
        new_db = SessionLocal()
        try:
            scheduler = get_scheduler()
            scheduler.reload_all_schedules(new_db)
        finally:
            new_db.close()

        return {
            "message": "Database reset successfully",
            "reset_analyses": reset_request.reset_analyses,
            "reset_users": reset_request.reset_users,
            "reset_rules": reset_request.reset_rules,
            "reset_schedules": reset_request.reset_schedules
        }

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error resetting database: {str(e)}"
        )


# ============================================================================
# Phase 4: Comments & Annotations
# ============================================================================

class CommentCreate(BaseModel):
    analysis_id: int
    content: str
    parent_comment_id: Optional[int] = None

class CommentUpdate(BaseModel):
    content: str

@app.get("/api/comments/analysis/{analysis_id}")
async def get_comments_for_analysis(
    analysis_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all comments for an analysis"""
    analysis = db.query(AnalysisRecord).filter(AnalysisRecord.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    comments = db.query(Comment).filter(Comment.analysis_id == analysis_id).order_by(Comment.created_at).all()
    return [comment.to_dict() for comment in comments]

@app.post("/api/comments")
async def create_comment(
    comment_data: CommentCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new comment"""
    analysis = db.query(AnalysisRecord).filter(AnalysisRecord.id == comment_data.analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if comment_data.parent_comment_id:
        parent = db.query(Comment).filter(Comment.id == comment_data.parent_comment_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent comment not found")

    comment = Comment(
        analysis_id=comment_data.analysis_id,
        user_id=current_user.id,
        content=comment_data.content,
        parent_comment_id=comment_data.parent_comment_id
    )

    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment.to_dict()

@app.put("/api/comments/{comment_id}")
async def update_comment(
    comment_id: int,
    comment_data: CommentUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a comment (only by author)"""
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    if comment.user_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized to edit this comment")

    comment.content = comment_data.content
    comment.is_edited = True
    comment.updated_at = dt.utcnow()

    db.commit()
    db.refresh(comment)
    return comment.to_dict()

@app.delete("/api/comments/{comment_id}")
async def delete_comment(
    comment_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a comment (only by author or admin)"""
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    if comment.user_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized to delete this comment")

    db.delete(comment)
    db.commit()
    return {"message": "Comment deleted successfully"}


# ============================================================================
# Phase 4: Tags
# ============================================================================

class TagCreate(BaseModel):
    name: str
    color: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None

class TagUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None

@app.get("/api/tags")
async def list_tags(
    category: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all tags, optionally filtered by category"""
    query = db.query(Tag)
    if category:
        query = query.filter(Tag.category == category)
    tags = query.order_by(Tag.name).all()
    return [tag.to_dict() for tag in tags]

@app.post("/api/tags")
async def create_tag(
    tag_data: TagCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new tag"""
    # Check if tag name already exists
    existing = db.query(Tag).filter(Tag.name == tag_data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Tag with this name already exists")

    tag = Tag(
        name=tag_data.name,
        color=tag_data.color,
        description=tag_data.description,
        category=tag_data.category,
        created_by=current_user.id
    )

    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag.to_dict()

@app.put("/api/tags/{tag_id}")
async def update_tag(
    tag_id: int,
    tag_data: TagUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a tag"""
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    update_data = tag_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(tag, field):
            setattr(tag, field, value)

    db.commit()
    db.refresh(tag)
    return tag.to_dict()

@app.delete("/api/tags/{tag_id}")
async def delete_tag(
    tag_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a tag"""
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    db.delete(tag)
    db.commit()
    return {"message": "Tag deleted successfully"}

@app.post("/api/analyses/{analysis_id}/tags/{tag_id}")
async def add_tag_to_analysis(
    analysis_id: int,
    tag_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Add a tag to an analysis"""
    analysis = db.query(AnalysisRecord).filter(AnalysisRecord.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    if tag not in analysis.tags:
        analysis.tags.append(tag)
        db.commit()

    return {"message": f"Tag '{tag.name}' added to analysis"}

@app.delete("/api/analyses/{analysis_id}/tags/{tag_id}")
async def remove_tag_from_analysis(
    analysis_id: int,
    tag_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Remove a tag from an analysis"""
    analysis = db.query(AnalysisRecord).filter(AnalysisRecord.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    if tag in analysis.tags:
        analysis.tags.remove(tag)
        db.commit()

    return {"message": f"Tag '{tag.name}' removed from analysis"}


# ============================================================================
# Phase 4: Teams & Departments
# ============================================================================

class TeamCreate(BaseModel):
    name: str
    description: Optional[str] = None
    department: Optional[str] = None

class TeamUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    department: Optional[str] = None
    is_active: Optional[bool] = None

@app.get("/api/teams")
async def list_teams(
    department: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all teams, optionally filtered by department"""
    query = db.query(Team)
    if department:
        query = query.filter(Team.department == department)
    teams = query.filter(Team.is_active == True).order_by(Team.name).all()
    return [team.to_dict() for team in teams]

@app.post("/api/teams")
async def create_team(
    team_data: TeamCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new team"""
    # Check if team name already exists
    existing = db.query(Team).filter(Team.name == team_data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Team with this name already exists")

    team = Team(
        name=team_data.name,
        description=team_data.description,
        department=team_data.department,
        created_by=current_user.id
    )

    db.add(team)
    db.commit()
    db.refresh(team)
    return team.to_dict()

@app.get("/api/teams/{team_id}")
async def get_team(
    team_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get team by ID"""
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return team.to_dict()

@app.put("/api/teams/{team_id}")
async def update_team(
    team_id: int,
    team_data: TeamUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a team"""
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    update_data = team_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(team, field):
            setattr(team, field, value)

    team.updated_at = dt.utcnow()
    db.commit()
    db.refresh(team)
    return team.to_dict()

@app.delete("/api/teams/{team_id}")
async def delete_team(
    team_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a team (soft delete by setting is_active=False)"""
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    team.is_active = False
    team.updated_at = dt.utcnow()
    db.commit()
    return {"message": "Team deactivated successfully"}

@app.post("/api/teams/{team_id}/members/{user_id}")
async def add_member_to_team(
    team_id: int,
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Add a user to a team"""
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user not in team.members:
        team.members.append(user)
        db.commit()

    return {"message": f"User '{user.username}' added to team '{team.name}'"}

@app.delete("/api/teams/{team_id}/members/{user_id}")
async def remove_member_from_team(
    team_id: int,
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Remove a user from a team"""
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user in team.members:
        team.members.remove(user)
        db.commit()

    return {"message": f"User '{user.username}' removed from team '{team.name}'"}


# ============================================================================
# Health and audit
# ============================================================================

@app.get("/health")
async def health():
    """Liveness for load balancers and monitors; needs no sign-in and says nothing sensitive."""
    return {"status": "ok", "version": settings.APP_VERSION}


@app.get("/api/audit-logs")
async def list_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    username: Optional[str] = Query(None),
    action: Optional[str] = Query(None, description="Prefix match, e.g. 'auth.' or 'DELETE'"),
    status_filter: Optional[str] = Query(None, alias="status"),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    _actor: User = Depends(require_permission("audit:read")),
    db: Session = Depends(get_db),
):
    """The audit trail, newest first, with filters (audit:read)."""
    query = db.query(AuditLog)
    if username:
        query = query.filter(AuditLog.username == username)
    if action:
        query = query.filter(AuditLog.action.like(f"{action}%"))
    if status_filter:
        query = query.filter(AuditLog.status == status_filter)
    if date_from:
        query = query.filter(AuditLog.timestamp >= date_from)
    if date_to:
        query = query.filter(AuditLog.timestamp <= date_to)
    total = query.count()
    rows = query.order_by(desc(AuditLog.timestamp), desc(AuditLog.id)).offset(skip).limit(limit).all()
    return {"total": total, "skip": skip, "limit": limit, "records": [row.to_dict() for row in rows]}
