# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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

