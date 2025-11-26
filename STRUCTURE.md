# 📁 Project Structure

This document provides a detailed overview of the project structure and organization.

---

## 📂 Directory Structure

```
voice_audit/
│
├── 📄 README.md                 # Main project documentation
├── 📄 LICENSE                   # MIT License
├── 📄 CONTRIBUTING.md           # Contribution guidelines
├── 📄 SECURITY.md               # Security policy
├── 📄 CHANGELOG.md              # Version history
├── 📄 requirements.txt          # Python dependencies
├── 📄 .gitignore                # Git ignore rules
├── 📄 .env.example              # Environment variables template
├── 📄 STRUCTURE.md              # This file - project structure
│
├── 📁 api/                      # Backend API (FastAPI)
│   ├── main.py                  # FastAPI app, routes, endpoints
│   ├── database.py              # SQLAlchemy models, DB setup
│   ├── auth.py                  # Authentication & authorization
│   │
│   ├── Core Analysis Modules:
│   ├── model.py                 # ML models for sentiment/toxicity
│   ├── multilanguage.py         # Language detection
│   ├── speaker_diarization.py   # Speaker separation
│   ├── conversation_analysis.py # Conversation metrics
│   ├── sentiment_timeline.py    # Sentiment timeline
│   ├── audio_quality.py         # Audio quality analysis
│   ├── keyword_detection.py     # Keyword detection
│   ├── alert_system.py          # Alert generation
│   │
│   ├── Explanation Modules:
│   ├── explain.py               # Basic explanations
│   ├── explain_enhanced.py      # Enhanced explanations
│   │
│   ├── AI & Intelligence Modules:
│   ├── summarization.py         # AI summarization (BART)
│   ├── topic_extraction.py      # Topic modeling (LDA)
│   ├── intent_classification.py # Intent classification
│   ├── action_items.py          # Action items detection
│   │
│   ├── Compliance & Rules:
│   ├── compliance_rules.py      # Compliance rule engine
│   │
│   ├── Reporting & Scheduling:
│   ├── report.py                # PDF report generation
│   ├── report_scheduler.py      # Automated report scheduling
│   │
│   └── Integration Modules:
│       ├── webhook_service.py   # Webhook integration
│       └── email_notification.py # Email notifications
│
├── 📁 frontend/                 # React TypeScript Frontend
│   ├── package.json             # Dependencies & scripts
│   ├── vite.config.ts           # Vite configuration
│   ├── tailwind.config.js       # Tailwind CSS config
│   ├── tsconfig.json            # TypeScript config
│   │
│   ├── 📁 src/
│   │   ├── main.tsx             # Application entry point
│   │   ├── App.tsx              # Main app component
│   │   ├── App.css              # Global styles
│   │   ├── index.css            # Base styles
│   │   │
│   │   ├── 📁 pages/            # Page components
│   │   │   ├── HomePage.tsx
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   ├── HistoryPage.tsx
│   │   │   ├── StatisticsPage.tsx
│   │   │   ├── BatchPage.tsx
│   │   │   ├── ComparePage.tsx
│   │   │   ├── SettingsPage.tsx
│   │   │   ├── ComplianceRulesPage.tsx
│   │   │   ├── ScheduledReportsPage.tsx
│   │   │   ├── WebhooksPage.tsx
│   │   │   ├── NotificationsPage.tsx
│   │   │   ├── TeamsPage.tsx
│   │   │   └── UsersPage.tsx
│   │   │
│   │   ├── 📁 components/       # Reusable components
│   │   │   ├── Layout.tsx       # Main layout (sidebar, nav)
│   │   │   ├── AnalysisResults.tsx
│   │   │   ├── AudioPlayer.tsx
│   │   │   ├── ComplianceGauge.tsx
│   │   │   ├── SentimentTimeline.tsx
│   │   │   ├── Comments.tsx
│   │   │   ├── Tags.tsx
│   │   │   └── ProtectedRoute.tsx
│   │   │
│   │   ├── 📁 contexts/         # React contexts
│   │   │   ├── AuthContext.tsx  # Authentication state
│   │   │   └── ThemeContext.tsx # Dark/light theme
│   │   │
│   │   ├── 📁 services/         # API service layer
│   │   │   └── api.ts           # API client & interfaces
│   │   │
│   │   ├── 📁 hooks/            # Custom React hooks (empty for now)
│   │   ├── 📁 utils/            # Utility functions (empty for now)
│   │   └── 📁 assets/           # Static assets
│   │
│   └── 📁 public/               # Public static files
│       └── vite.svg
│
├── 📁 docs/                     # Documentation
│   ├── README.md                # Documentation index
│   │
│   ├── Getting Started:
│   ├── QUICK_START.md           # Quick start guide
│   ├── SETUP.md                 # Detailed setup
│   ├── EMAIL_SETUP_GUIDE.md     # Email configuration
│   │
│   ├── Feature Documentation:
│   ├── FEATURES_COMPLETED.md    # Implemented features
│   ├── FEATURE_ROADMAP.md       # Planned features
│   ├── IMPLEMENTATION_SUMMARY.md # Overview
│   ├── PHASE2_IMPLEMENTATION.md # Phase 2 details
│   ├── PHASE3_IMPLEMENTATION.md # Phase 3 details
│   └── PHASE4_IMPLEMENTATION.md # Phase 4 details
│   │
│   ├── Development:
│   ├── PROJECT_SUMMARY.md       # Project overview
│   ├── CLEANUP_CHECKLIST.md     # Pre-upload checklist
│   ├── CLEANUP_SUMMARY.md       # Cleanup summary
│   └── GITHUB_UPLOAD_GUIDE.md   # GitHub upload guide
│
├── 📁 Data/                     # Data & Samples
│   ├── analyses.db              # SQLite database (excluded from git)
│   ├── harvard.wav              # Sample audio file
│   └── jackhammer.wav           # Sample audio file
│
├── 📁 dashboard/                # Legacy Streamlit Dashboard
│   └── streamlit_app.py
│
├── 📁 .github/                  # GitHub Templates
│   └── ISSUE_TEMPLATE/
│       ├── bug_report.md
│       └── feature_request.md
│
└── 📁 assets/                   # General assets (currently empty)
```

---

## 📋 File Organization Principles

### Root Directory
**Purpose**: Essential files only for quick access

**Contains**:
- `README.md` - Main documentation (first thing users see)
- `LICENSE` - License file
- `CONTRIBUTING.md` - How to contribute
- `SECURITY.md` - Security policy
- `CHANGELOG.md` - Version history
- `requirements.txt` - Python dependencies
- `.gitignore` - Git ignore rules
- `.env.example` - Environment template
- `STRUCTURE.md` - This file

### `api/` Directory
**Purpose**: Backend FastAPI application

**Organization**:
- Core functionality modules
- Feature-specific modules grouped by purpose
- Clear naming conventions
- Single responsibility per module

### `frontend/` Directory
**Purpose**: React TypeScript frontend

**Organization**:
- Standard React project structure
- Pages in `pages/` directory
- Reusable components in `components/`
- Contexts for global state
- Services for API communication

### `docs/` Directory
**Purpose**: All detailed documentation

**Organization**:
- Organized by category (Getting Started, Features, Development)
- Clear naming conventions
- Index file (`docs/README.md`) for navigation

### `Data/` Directory
**Purpose**: Database and sample files

**Note**: Database files are excluded from git via `.gitignore`

---

## 🔍 Finding Files

### Backend Files
- **Main API**: `api/main.py`
- **Database Models**: `api/database.py`
- **Authentication**: `api/auth.py`
- **Feature Modules**: `api/*.py` (organized by feature)

### Frontend Files
- **Main App**: `frontend/src/App.tsx`
- **Pages**: `frontend/src/pages/*.tsx`
- **Components**: `frontend/src/components/*.tsx`
- **API Service**: `frontend/src/services/api.ts`

### Documentation
- **Main README**: `README.md`
- **Documentation Index**: `docs/README.md`
- **Quick Start**: `docs/QUICK_START.md`
- **Setup Guide**: `docs/SETUP.md`

---

## 📊 Module Count

- **Backend Modules**: 22 Python files
- **Frontend Pages**: 13 page components
- **Frontend Components**: 8 reusable components
- **Documentation Files**: 13+ markdown files

---

## 🎯 Key Entry Points

1. **Start Here**: `README.md`
2. **Quick Setup**: `docs/QUICK_START.md`
3. **Backend API**: `api/main.py`
4. **Frontend App**: `frontend/src/App.tsx`
5. **Database**: `api/database.py`
6. **Documentation**: `docs/README.md`

---

## 📝 Notes

- All documentation files moved to `docs/` for better organization
- Root directory kept clean with only essential files
- Clear separation between backend, frontend, and documentation
- Logical grouping of related files

