from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, JSON, Text, Boolean, ForeignKey, Table
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime as dt
import os
from pathlib import Path

# Database setup
Base = declarative_base()

# Association tables for many-to-many relationships (must be defined before models that use them)
analysis_tags = Table(
    'analysis_tags',
    Base.metadata,
    Column('analysis_id', Integer, ForeignKey('analysis_records.id'), primary_key=True),
    Column('tag_id', Integer, ForeignKey('tags.id'), primary_key=True)
)

user_roles = Table(
    'user_roles',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id'), primary_key=True),
    Column('role_id', Integer, ForeignKey('roles.id'), primary_key=True)
)

role_permissions = Table(
    'role_permissions',
    Base.metadata,
    Column('role_id', Integer, ForeignKey('roles.id'), primary_key=True),
    Column('permission_id', Integer, ForeignKey('permissions.id'), primary_key=True)
)

user_teams = Table(
    'user_teams',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id'), primary_key=True),
    Column('team_id', Integer, ForeignKey('teams.id'), primary_key=True)
)


class AnalysisRecord(Base):
    """Database model for storing analysis records"""
    __tablename__ = "analysis_records"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=True)
    transcription = Column(Text, nullable=False)

    # Analysis results
    sentiment = Column(String, nullable=True)
    sentiment_confidence = Column(Float, nullable=True)
    emotion = Column(String, nullable=True)
    emotion_confidence = Column(Float, nullable=True)
    toxicity_score = Column(Float, nullable=True)
    compliance_score = Column(Float, nullable=True)

    # Full analysis and explanation as JSON
    full_analysis = Column(JSON, nullable=True)
    explanation = Column(JSON, nullable=True)

    # Metadata
    created_at = Column(DateTime, default=dt.utcnow, nullable=False)
    file_duration = Column(Float, nullable=True)
    audio_format = Column(String, nullable=True)
    created_by_user_id = Column(Integer, ForeignKey('users.id'), nullable=True)

    # Relationships
    comments = relationship("Comment", back_populates="analysis", cascade="all, delete-orphan")
    tags = relationship("Tag", secondary=analysis_tags, back_populates="analyses")
    created_by_user = relationship("User", foreign_keys=[created_by_user_id])

    def to_dict(self):
        """Convert record to dictionary format"""
        return {
            "id": self.id,
            "filename": self.filename,
            "transcription": self.transcription,
            "analysis": self.full_analysis or {
                "sentiment": self.sentiment,
                "sentiment_confidence": self.sentiment_confidence,
                "emotion": self.emotion,
                "emotion_confidence": self.emotion_confidence,
                "toxicity_score": self.toxicity_score,
                "compliance_score": self.compliance_score
            },
            "explanation": self.explanation,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "file_duration": self.file_duration,
            "audio_format": self.audio_format
        }


class ComplianceRule(Base):
    """Database model for custom compliance rules"""
    __tablename__ = "compliance_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True)

    # Rule configuration
    rule_type = Column(String, nullable=False)  # "regex", "keyword", "sentiment", "toxicity", "custom"
    pattern = Column(Text, nullable=True)  # Regex pattern, keyword list, or custom logic
    condition = Column(String, nullable=False)  # "contains", "matches", "greater_than", "less_than", "equals"
    threshold = Column(Float, nullable=True)  # For numeric conditions

    # Rule metadata
    severity = Column(String, nullable=False, default="warning")  # "critical", "warning", "info"
    category = Column(String, nullable=True)  # "language", "sentiment", "toxicity", etc.
    is_active = Column(Boolean, default=True, nullable=False)
    priority = Column(Integer, default=0)  # Higher priority = evaluated first

    # Metadata
    created_at = Column(DateTime, default=dt.utcnow, nullable=False)
    updated_at = Column(DateTime, default=dt.utcnow, onupdate=dt.utcnow, nullable=False)
    created_by = Column(String, nullable=True)

    # Additional configuration as JSON
    config = Column(JSON, nullable=True)  # Store additional rule parameters

    def to_dict(self):
        """Convert rule to dictionary format"""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "rule_type": self.rule_type,
            "pattern": self.pattern,
            "condition": self.condition,
            "threshold": self.threshold,
            "severity": self.severity,
            "category": self.category,
            "is_active": self.is_active,
            "priority": self.priority,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by": self.created_by,
            "config": self.config
        }


class ScheduledReport(Base):
    """Database model for scheduled report generation"""
    __tablename__ = "scheduled_reports"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True)

    # Schedule configuration
    schedule_type = Column(String, nullable=False)  # "daily", "weekly", "monthly", "custom"
    schedule_config = Column(JSON, nullable=False)  # Store cron expression or schedule details
    timezone = Column(String, default="UTC", nullable=False)

    # Report configuration
    report_type = Column(String, nullable=False, default="summary")  # "summary", "detailed", "compliance"
    filters = Column(JSON, nullable=True)  # Filters for which records to include

    # Email configuration
    email_recipients = Column(JSON, nullable=False)  # List of email addresses
    email_subject = Column(String, nullable=True)
    email_body_template = Column(Text, nullable=True)

    # Status
    is_active = Column(Boolean, default=True, nullable=False)
    last_run = Column(DateTime, nullable=True)
    next_run = Column(DateTime, nullable=True)
    run_count = Column(Integer, default=0, nullable=False)

    # Metadata
    created_at = Column(DateTime, default=dt.utcnow, nullable=False)
    updated_at = Column(DateTime, default=dt.utcnow, onupdate=dt.utcnow, nullable=False)
    created_by = Column(String, nullable=True)

    def to_dict(self):
        """Convert scheduled report to dictionary format"""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "schedule_type": self.schedule_type,
            "schedule_config": self.schedule_config,
            "timezone": self.timezone,
            "report_type": self.report_type,
            "filters": self.filters,
            "email_recipients": self.email_recipients,
            "email_subject": self.email_subject,
            "email_body_template": self.email_body_template,
            "is_active": self.is_active,
            "last_run": self.last_run.isoformat() if self.last_run else None,
            "next_run": self.next_run.isoformat() if self.next_run else None,
            "run_count": self.run_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by": self.created_by
        }


class Webhook(Base):
    """Database model for webhook configurations"""
    __tablename__ = "webhooks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True)

    # Webhook configuration
    url = Column(String, nullable=False)  # Webhook URL
    method = Column(String, default="POST", nullable=False)  # HTTP method
    headers = Column(JSON, nullable=True)  # Custom headers
    auth_type = Column(String, default="none", nullable=False)  # "none", "bearer", "basic", "custom"
    auth_config = Column(JSON, nullable=True)  # Auth credentials (encrypted in production)

    # Event triggers
    trigger_on_critical = Column(Boolean, default=True, nullable=False)
    trigger_on_warning = Column(Boolean, default=False, nullable=False)
    trigger_on_compliance_low = Column(Boolean, default=True, nullable=False)
    trigger_on_custom_rule = Column(Boolean, default=True, nullable=False)
    min_compliance_score = Column(Float, nullable=True)  # Trigger if score below this

    # Payload configuration
    payload_template = Column(JSON, nullable=True)  # Custom payload template
    include_transcription = Column(Boolean, default=True, nullable=False)
    include_analysis = Column(Boolean, default=True, nullable=False)

    # Status
    is_active = Column(Boolean, default=True, nullable=False)
    last_triggered = Column(DateTime, nullable=True)
    success_count = Column(Integer, default=0, nullable=False)
    failure_count = Column(Integer, default=0, nullable=False)

    # Metadata
    created_at = Column(DateTime, default=dt.utcnow, nullable=False)
    updated_at = Column(DateTime, default=dt.utcnow, onupdate=dt.utcnow, nullable=False)
    created_by = Column(String, nullable=True)

    def to_dict(self):
        """Convert webhook to dictionary format"""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "url": self.url,
            "method": self.method,
            "headers": self.headers,
            "auth_type": self.auth_type,
            "auth_config": self.auth_config,
            "trigger_on_critical": self.trigger_on_critical,
            "trigger_on_warning": self.trigger_on_warning,
            "trigger_on_compliance_low": self.trigger_on_compliance_low,
            "trigger_on_custom_rule": self.trigger_on_custom_rule,
            "min_compliance_score": self.min_compliance_score,
            "payload_template": self.payload_template,
            "include_transcription": self.include_transcription,
            "include_analysis": self.include_analysis,
            "is_active": self.is_active,
            "last_triggered": self.last_triggered.isoformat() if self.last_triggered else None,
            "success_count": self.success_count,
            "failure_count": self.failure_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by": self.created_by
        }


class NotificationConfig(Base):
    """Database model for email notification configurations"""
    __tablename__ = "notification_configs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True)

    # Email recipients
    email_recipients = Column(JSON, nullable=False)  # List of email addresses

    # Alert triggers
    notify_on_critical = Column(Boolean, default=True, nullable=False)
    notify_on_warning = Column(Boolean, default=False, nullable=False)
    notify_on_compliance_low = Column(Boolean, default=True, nullable=False)
    notify_on_custom_rule = Column(Boolean, default=True, nullable=False)
    min_compliance_score = Column(Float, nullable=True)

    # Email configuration
    email_subject_template = Column(String, nullable=True)
    email_body_template = Column(Text, nullable=True)

    # Rate limiting
    rate_limit_minutes = Column(Integer, default=60, nullable=False)  # Max 1 email per N minutes

    # Status
    is_active = Column(Boolean, default=True, nullable=False)
    last_sent = Column(DateTime, nullable=True)
    sent_count = Column(Integer, default=0, nullable=False)

    # Metadata
    created_at = Column(DateTime, default=dt.utcnow, nullable=False)
    updated_at = Column(DateTime, default=dt.utcnow, onupdate=dt.utcnow, nullable=False)
    created_by = Column(String, nullable=True)

    def to_dict(self):
        """Convert notification config to dictionary format"""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "email_recipients": self.email_recipients,
            "notify_on_critical": self.notify_on_critical,
            "notify_on_warning": self.notify_on_warning,
            "notify_on_compliance_low": self.notify_on_compliance_low,
            "notify_on_custom_rule": self.notify_on_custom_rule,
            "min_compliance_score": self.min_compliance_score,
            "email_subject_template": self.email_subject_template,
            "email_body_template": self.email_body_template,
            "rate_limit_minutes": self.rate_limit_minutes,
            "is_active": self.is_active,
            "last_sent": self.last_sent.isoformat() if self.last_sent else None,
            "sent_count": self.sent_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by": self.created_by
        }


class User(Base):
    """Database model for users"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_superuser = Column(Boolean, default=False, nullable=False)

    # Metadata
    created_at = Column(DateTime, default=dt.utcnow, nullable=False)
    updated_at = Column(DateTime, default=dt.utcnow, onupdate=dt.utcnow, nullable=False)
    last_login = Column(DateTime, nullable=True)

    # Relationships
    roles = relationship("Role", secondary=user_roles, back_populates="users")
    teams = relationship("Team", secondary=user_teams, back_populates="members")
    comments = relationship("Comment", back_populates="author")
    created_analyses = relationship("AnalysisRecord", foreign_keys="[AnalysisRecord.created_by_user_id]", back_populates="created_by_user")

    def to_dict(self):
        """Convert user to dictionary format"""
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "full_name": self.full_name,
            "is_active": self.is_active,
            "is_superuser": self.is_superuser,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "last_login": self.last_login.isoformat() if self.last_login else None,
            "roles": [role.name for role in self.roles],
            "teams": [team.name for team in self.teams]
        }


class Role(Base):
    """Database model for roles"""
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    # Metadata
    created_at = Column(DateTime, default=dt.utcnow, nullable=False)
    updated_at = Column(DateTime, default=dt.utcnow, onupdate=dt.utcnow, nullable=False)

    # Relationships
    users = relationship("User", secondary=user_roles, back_populates="roles")
    permissions = relationship("Permission", secondary=role_permissions, back_populates="roles")

    def to_dict(self):
        """Convert role to dictionary format"""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "permissions": [perm.name for perm in self.permissions]
        }


class Permission(Base):
    """Database model for permissions"""
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    resource = Column(String, nullable=True)  # e.g., "analysis", "user", "compliance_rule"
    action = Column(String, nullable=True)  # e.g., "read", "write", "delete"

    # Metadata
    created_at = Column(DateTime, default=dt.utcnow, nullable=False)

    # Relationships
    roles = relationship("Role", secondary=role_permissions, back_populates="permissions")

    def to_dict(self):
        """Convert permission to dictionary format"""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "resource": self.resource,
            "action": self.action,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class Comment(Base):
    """Database model for comments/annotations on analyses"""
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey('analysis_records.id'), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    content = Column(Text, nullable=False)
    parent_comment_id = Column(Integer, ForeignKey('comments.id'), nullable=True)  # For threaded comments

    # Metadata
    created_at = Column(DateTime, default=dt.utcnow, nullable=False)
    updated_at = Column(DateTime, default=dt.utcnow, onupdate=dt.utcnow, nullable=False)
    is_edited = Column(Boolean, default=False, nullable=False)

    # Relationships
    author = relationship("User", back_populates="comments")
    analysis = relationship("AnalysisRecord", back_populates="comments")
    parent = relationship("Comment", remote_side=[id], backref="replies")

    def to_dict(self):
        """Convert comment to dictionary format"""
        return {
            "id": self.id,
            "analysis_id": self.analysis_id,
            "user_id": self.user_id,
            "author": self.author.username if self.author else None,
            "author_name": self.author.full_name if self.author else None,
            "content": self.content,
            "parent_comment_id": self.parent_comment_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "is_edited": self.is_edited,
            "reply_count": len(self.replies) if hasattr(self, 'replies') else 0
        }


class Tag(Base):
    """Database model for tags"""
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    color = Column(String, nullable=True)  # Hex color code for UI
    description = Column(Text, nullable=True)
    category = Column(String, nullable=True)  # e.g., "department", "project", "priority"

    # Metadata
    created_at = Column(DateTime, default=dt.utcnow, nullable=False)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)

    # Relationships
    analyses = relationship("AnalysisRecord", secondary=analysis_tags, back_populates="tags")

    def to_dict(self):
        """Convert tag to dictionary format"""
        return {
            "id": self.id,
            "name": self.name,
            "color": self.color,
            "description": self.description,
            "category": self.category,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "created_by": self.created_by,
            "usage_count": len(self.analyses) if hasattr(self, 'analyses') else 0
        }


class Team(Base):
    """Database model for teams/departments"""
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    department = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    # Metadata
    created_at = Column(DateTime, default=dt.utcnow, nullable=False)
    updated_at = Column(DateTime, default=dt.utcnow, onupdate=dt.utcnow, nullable=False)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)

    # Relationships
    members = relationship("User", secondary=user_teams, back_populates="teams")

    def to_dict(self):
        """Convert team to dictionary format"""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "department": self.department,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by": self.created_by,
            "member_count": len(self.members) if hasattr(self, 'members') else 0,
            "members": [{"id": m.id, "username": m.username, "full_name": m.full_name} for m in self.members] if hasattr(self, 'members') else []
        }


# Database file path
DB_DIR = Path(__file__).parent.parent / "data"
DB_DIR.mkdir(exist_ok=True)
DATABASE_URL = f"sqlite:///{DB_DIR / 'analyses.db'}"

# Create engine and session
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    """Initialize the database - create all tables and migrate schema"""
    Base.metadata.create_all(bind=engine)

    # Migrate existing database: add created_by_user_id column if it doesn't exist
    try:
        from sqlalchemy import inspect, text
        inspector = inspect(engine)
        columns = [col['name'] for col in inspector.get_columns('analysis_records')]

        if 'created_by_user_id' not in columns:
            with engine.connect() as conn:
                conn.execute(text('ALTER TABLE analysis_records ADD COLUMN created_by_user_id INTEGER'))
                conn.commit()
                print("✅ Added created_by_user_id column to analysis_records")
    except Exception as e:
        # Column might already exist or migration not needed
        print(f"Note: Migration check: {str(e)}")
        pass

def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def save_analysis(db, analysis_data: dict, filename: str = None, user_id: int = None):
    """Save analysis to database"""
    # Extract analysis results
    analysis = analysis_data.get("analysis", {})
    explanation = analysis_data.get("explanation", [])
    transcription = analysis_data.get("transcription", "")

    # Create record
    record = AnalysisRecord(
        filename=filename,
        transcription=transcription,
        sentiment=analysis.get("sentiment"),
        sentiment_confidence=analysis.get("sentiment_confidence"),
        emotion=analysis.get("emotion"),
        emotion_confidence=analysis.get("emotion_confidence"),
        toxicity_score=analysis.get("toxicity_score"),
        compliance_score=analysis.get("compliance_score"),
        full_analysis=analysis,
        explanation=explanation if explanation else None,
        created_by_user_id=user_id
    )

    db.add(record)
    db.commit()
    db.refresh(record)
    return record

