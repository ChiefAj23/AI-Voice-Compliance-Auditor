# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security
- No default admin password: the first admin comes from `ADMIN_PASSWORD`, or a random password printed once on first start (also after a full database reset)
- No default JWT secret: without `JWT_SECRET_KEY` (or with the documented example value) a random key is used for that run
- Every data route (analyses, history, exports, compliance rules, scheduled reports, webhooks, notification settings) now needs a signed-in user with the matching permission; webhooks, schedules and notification settings are admin-only
- New sign-ups start with no role (they used to get viewer, which could read every analysis); an admin assigns one on the Users page
- Custom compliance rules are evaluated by a small allow-list evaluator (`api/safe_eval.py`) instead of `eval()`
- The legacy Streamlit dashboard signs in before calling the API
- The first admin, and every account an admin creates, must choose a new password at the first sign-in; the API refuses everything else until then
- Self-registration is off by default (`ALLOW_SELF_REGISTRATION`); administrators add users from the Users page
- `JWT_SECRET_KEY` is required when `APP_ENV=production`; the API refuses to start without it
- Audit log of every change and every sign-in, password change and account creation, refused attempts included (`GET /api/audit-logs`, Audit log page)
- Rate limits on sign-in, analysis and everything else (429 when exceeded)
- Custom rules are checked when saved as well as when they run, and can use `contains()`, `matches()`, `count()` and `word_count()`
- Dependencies pinned and patched until `pip-audit` reports nothing: FastAPI 0.141 with Starlette 1.7, python-multipart 0.0.32, requests 2.34, torch 2.14, transformers 5.17, and PyJWT in place of python-jose (which pulled in the unmaintained ecdsa)
- Integration settings (webhooks, schedules, notifications) use named `integration:read` / `integration:write` permissions, held only by admins by default

### Added
- Audit log page, Add user dialog, and a change-password screen (forced on first sign-in, and in the user menu)
- Navigation and pages follow the signed-in user's permissions
- CI on every push and pull request: lint, tests and dependency audit for the API; type-check, build and npm audit for the web app
- Opt-in model smoke tests (`RUN_MODEL_TESTS=1 pytest tests/test_models.py`)
- Admin ability to delete users from UI
- Admin ability to reset database from UI
- Comprehensive `.gitignore` file
- `LICENSE` file (MIT License)
- `CONTRIBUTING.md` guide
- `SECURITY.md` policy
- `CHANGELOG.md` for tracking changes
- Environment variable support for JWT secret key
- Direct bcrypt implementation (removed passlib dependency)

### Changed
- Models load on first use and once per process: the API starts in about a second and holds one copy of each model
- Call summaries use BART directly (transformers 5 removed the summarization pipeline)
- Replaced passlib with direct bcrypt usage for better compatibility
- JWT secret key now reads from environment variable `JWT_SECRET_KEY`

### Fixed
- Fixed bcrypt/passlib version compatibility issues
- Fixed user deletion endpoint bug
- Fixed database reset functionality

## [1.0.0] - 2024-12-XX

### Added - Phase 4: Collaboration & Access Control
- User Authentication & Authorization (JWT-based)
- Role-Based Access Control (RBAC)
- Team/Department Management
- Comments & Annotations System
- Tagging System
- User Management UI

### Added - Phase 3: Automation & Integration
- Custom Compliance Rules Builder
- Automated Report Scheduling
- Webhook Integration
- Email/Notification System

### Added - Phase 2: Intelligence & Insights
- AI-Powered Summarization (BART model)
- Topic Extraction & Clustering (LDA)
- Intent Classification (Zero-shot)
- Action Items & Commitments Detection

### Added - Phase 1: Core Analysis Features
- Audio Transcription (Whisper)
- Multi-Language Detection
- Speaker Diarization
- Sentiment Analysis & Timeline
- Toxicity Detection
- Compliance Scoring
- Conversation Analysis
- Audio Quality Analysis
- Keyword Detection
- Alert System

## Future Plans

See [FEATURE_ROADMAP.md](FEATURE_ROADMAP.md) for planned features.

