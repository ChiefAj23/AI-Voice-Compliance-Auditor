# 🎙️ AI Voice Compliance Auditor

<div align="center">

**AI-Powered Voice Conversation Analysis & Compliance Monitoring System**

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-green.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.2+-61DAFB.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2+-3178C6.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Developed with ❤️ by [Abhijeet Solanki](https://github.com/chiefaj)**

[Features](#-features) • [Installation](#-installation) • [Quick Start](#-quick-start) • [Documentation](#-documentation) • [Screenshots](#-screenshots)

</div>

---

## 📖 Overview

**AI Voice Compliance Auditor** is a comprehensive, enterprise-grade solution for analyzing voice conversations, monitoring compliance, and extracting actionable insights. Built with cutting-edge AI/ML technologies, it provides real-time analysis of audio recordings with features like sentiment analysis, toxicity detection, speaker diarization, multi-language support, and automated compliance reporting.

### Key Highlights

- 🎯 **Real-time Analysis**: Upload audio files or record directly in the browser
- 🌍 **Multi-Language Support**: Automatic language detection (including Hindi, English, and more)
- 🤖 **AI-Powered Insights**: Sentiment analysis, topic extraction, intent classification
- 📊 **Advanced Analytics**: Compliance scoring, conversation quality metrics, speaker analysis
- 🔔 **Automated Alerts**: Custom compliance rules, webhooks, and email notifications
- 👥 **Team Collaboration**: User authentication, comments, tags, and team management
- 📈 **Comprehensive Reports**: Automated scheduling, PDF generation, and historical tracking

---

## ✨ Features

### 🎯 Phase 1: Core Analysis Features

- ✅ **Audio Transcription** - High-quality speech-to-text using Whisper
- ✅ **Multi-Language Detection** - Automatic language detection with confidence scoring
- ✅ **Speaker Diarization** - Identify and separate different speakers
- ✅ **Sentiment Analysis** - Real-time sentiment tracking with timeline visualization
- ✅ **Toxicity Detection** - Identify inappropriate or toxic language
- ✅ **Compliance Scoring** - Overall compliance score (0-100) with detailed metrics
- ✅ **Conversation Analysis** - Turn-taking, interruptions, balance metrics
- ✅ **Audio Quality Analysis** - Technical quality metrics and recommendations
- ✅ **Keyword Detection** - Identify important keywords and phrases

### 🤖 Phase 2: Intelligence & Insights

- ✅ **AI-Powered Summarization** - Generate concise summaries using BART model
- ✅ **Topic Extraction & Clustering** - Identify main topics using LDA
- ✅ **Action Items Detection** - Extract tasks, deadlines, and commitments
- ✅ **Intent Classification** - Classify conversation intent (sales, support, etc.)

### 🔔 Phase 3: Automation & Integration

- ✅ **Custom Compliance Rules** - Create and manage custom rules (regex, keywords, sentiment)
- ✅ **Automated Report Scheduling** - Schedule daily/weekly/monthly reports
- ✅ **Webhook Integration** - Send alerts to external systems (Slack, Teams, etc.)
- ✅ **Email Notifications** - Automated email alerts for compliance violations

### 👥 Phase 4: Collaboration & Access Control

- ✅ **User Authentication** - JWT-based authentication with role-based access control
- ✅ **Team Management** - Organize users into teams and departments
- ✅ **Comments & Annotations** - Add comments and notes to analyses
- ✅ **Tagging System** - Tag analyses for better organization
- ✅ **User Management** - Role assignment and user administration

### 🎨 UI/UX Features

- ✅ **Modern React UI** - Beautiful, responsive interface with dark mode
- ✅ **Real-time Audio Recording** - Record audio directly in browser
- ✅ **Synchronized Playback** - Audio player with transcript highlighting
- ✅ **Interactive Charts** - Visual timeline and sentiment analysis
- ✅ **Export Options** - Export to JSON, CSV, or PDF

---

## 🔐 Security and configuration

Every setting lives in the environment; `.env.example` lists them all.

**Sign-in on every route.** Every API route except `POST /api/auth/login`, `GET /api/auth/config`, `GET /health`, `GET /supported_languages` and the registration endpoint needs a bearer token, and each one checks a permission:

| Permission | What it covers | admin | analyst | viewer |
| --- | --- | :-: | :-: | :-: |
| `analysis:read` | history, statistics, exports, comparisons, reports | ✓ | ✓ | ✓ |
| `analysis:write` | analyze a recording, batch analysis | ✓ | ✓ | |
| `analysis:delete` | delete a record | ✓ | | |
| `compliance:read` / `compliance:write` / `compliance:delete` | rules | ✓ | read | read |
| `integration:read` / `integration:write` | webhooks, notifications, scheduled reports (they hold URLs and credentials) | ✓ | | |
| `user:read` / `user:write` / `user:delete` | users, roles, teams | ✓ | | |
| `audit:read` | the audit log | ✓ | | |

Superusers hold every permission. A new account has none until an administrator gives it a role. Roles are editable in the database; the three above are seeded and kept up to date when new permissions are introduced. The web app follows the same table: pages a role cannot use are left out of the navigation, and opening one directly lands on History instead. Tokens are signed JWTs (PyJWT, HS256).

**Passwords.** At least `MIN_PASSWORD_LENGTH` (12) characters, hashed with bcrypt. `POST /api/auth/change-password` changes one; accounts flagged `must_change_password` (the first administrator, and every account an administrator creates) can call nothing else until they do.

**Rules cannot run code.** Custom rules are written in a small expression language (`api/safe_eval.py`) that is interpreted directly, never passed to `eval()`. It has names such as `text`, `sentiment`, `toxicity_score`, text and dictionary methods such as `.lower()` and `.get()`, and helpers such as `contains(text, "refund")` and `matches(text, r"\bguarantee(d|s)?\b")`. Anything outside the allow-list (imports, attributes, lambdas, comprehensions, `**`, repeating text with `*`, unknown names) is rejected when the rule is saved, and checked again whenever it runs. Regular expressions are compiled at save time too.

**Audit log.** Every request that changes something is recorded with the account, the path, the outcome and the client address (never the request body). Sign-ins, password changes and account creation get one explicit event each instead, successful or not, so refused attempts (a wrong password, a blocked registration) are in the log too. Read it at `GET /api/audit-logs` or on the Audit log page. Set `TRUST_PROXY_HEADERS=true` behind a reverse proxy so the address comes from `X-Forwarded-For`.

**Rate limits.** `RATE_LIMIT_LOGIN` (10/minute per address) on sign-in, `RATE_LIMIT_ANALYZE` (30/minute) on analysis, `RATE_LIMIT_DEFAULT` (300/minute) elsewhere; over the limit returns 429.

**Off by default.** Self-registration (`ALLOW_SELF_REGISTRATION`) and the database reset endpoint (`ALLOW_DB_RESET`).

**Dependencies and CI.** `requirements.txt` is pinned, and `pip-audit` finds no known vulnerabilities in it. `.github/workflows/ci.yml` lints, runs the tests and audits the dependencies on every push and pull request, and type-checks and builds the front end.

**Tests.** `pytest` runs the API and security suite against a throwaway database without loading any model. It also runs without the ML libraries installed: `tests/conftest.py` then stubs the model modules, so `pip install -r requirements-test.txt && pytest` is enough. After changing model code or upgrading torch, transformers, shap or detoxify, also run the model smoke tests, which download and exercise every model an analysis uses:

```bash
pip install -r requirements.txt -r requirements-dev.txt
pytest
RUN_MODEL_TESTS=1 pytest tests/test_models.py
```

---

## 🛠️ Tech Stack

### Backend
- **FastAPI** - Modern, fast web framework for building APIs
- **Python 3.11+** - Core programming language
- **Whisper** - OpenAI's speech recognition model
- **Transformers** - Hugging Face models (BART, BERT, etc.)
- **SQLAlchemy** - Database ORM
- **APScheduler** - Task scheduling for automated reports
- **Pydantic** - Data validation

### Frontend
- **React 18** - UI library
- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast build tool
- **Tailwind CSS** - Utility-first CSS framework
- **React Router** - Client-side routing
- **Axios** - HTTP client
- **Recharts** - Data visualization

### Database
- **SQLite** - Lightweight database (can be migrated to PostgreSQL)

### AI/ML Models
- **Whisper** - Speech-to-text transcription
- **BART** - Summarization and intent classification
- **LDA** - Topic modeling
- **Detoxify** - Toxicity detection
- **Custom NLP Models** - Sentiment analysis, emotion detection

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Python 3.11+** - [Download Python](https://www.python.org/downloads/)
- **Node.js 18+** - [Download Node.js](https://nodejs.org/)
- **npm** or **yarn** - Comes with Node.js
- **Git** - [Download Git](https://git-scm.com/downloads)

### Optional (for production)
- **PostgreSQL** - For production database (optional, SQLite works for development)
- **SMTP Server** - For email notifications (Gmail, SendGrid, etc.)

---

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/chiefaj/voice_audit.git
cd voice_audit
```

### 2. Backend Setup

#### Create a Virtual Environment (Recommended)

```bash
# On macOS/Linux
python3 -m venv venv
source venv/bin/activate

# On Windows
python -m venv venv
venv\Scripts\activate
```

#### Install Python Dependencies

```bash
pip install -r requirements.txt
```

**Note**: The first run will download ML models (Whisper, BART, etc.), which may take several minutes depending on your internet connection.

### 3. Frontend Setup

```bash
cd frontend
npm install
```

---

## 🏃 Quick Start

### Running the Backend

1. **Activate your virtual environment** (if not already active):
   ```bash
   source venv/bin/activate  # macOS/Linux
   # or
   venv\Scripts\activate  # Windows
   ```

2. **Start the FastAPI server**:
   ```bash
   uvicorn api.main:app --reload
   ```

   The API will be available at: `http://127.0.0.1:8000`

   - API Documentation: `http://127.0.0.1:8000/docs`
   - Alternative docs: `http://127.0.0.1:8000/redoc`

### Running the Frontend

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

2. **Start the development server**:
   ```bash
   npm run dev
   ```

   The frontend will be available at: `http://localhost:5173` (or another port if 5173 is busy)

### The first administrator

There is no default password. On first start the API creates one administrator:

- **Username**: `admin` (or `ADMIN_USERNAME`)
- **Password**: the value of `ADMIN_PASSWORD`, or, if that isn't set, a random password printed once in the API's console output

Either way the first sign-in goes straight to a "set a new password" screen, and nothing else works for that account until it is done. Self-registration is off by default: administrators add users from the Users page (or `POST /api/auth/register` with a `user:write` token), and every account they issue starts with a temporary password that its owner must replace. A new account has no access until an administrator gives it a role (viewer, analyst or admin), which also holds for self-registered accounts if `ALLOW_SELF_REGISTRATION` is turned on.

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the project root (optional, but recommended for production):

```env
# Signs sign-in tokens. Generate with: openssl rand -hex 32
# Required when APP_ENV=production. Left empty elsewhere, the API uses a random key for each run
# (everyone is signed out on restart). The example values from the docs are refused.
JWT_SECRET_KEY=

# The first admin account (optional; without ADMIN_PASSWORD a random one is printed on first start)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=

# Email Configuration (for scheduled reports and notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password  # Use App Password for Gmail

# Frontend API URL (optional - defaults to http://127.0.0.1:8000)
VITE_API_URL=http://127.0.0.1:8000
```

**Important Notes**:
- **JWT_SECRET_KEY**: required when `APP_ENV=production` (the API refuses to start without it); in development an unset key means a random per-process secret, so sessions end on restart. The example values in the docs are refused. Generate one with `openssl rand -hex 32`.
- **ADMIN_PASSWORD**: the first admin's password, to be replaced at the first sign-in. Without it, a random one is printed once in the API's console output.
- **Gmail**: You must use an [App Password](docs/EMAIL_SETUP_GUIDE.md) instead of your regular password
- Create a `.env` file from the `.env.example` template (copy and fill in your values)

### Database

The application uses SQLite by default. The database file is automatically created at `Data/analyses.db` on first run.

For production, you can migrate to PostgreSQL by updating the database URL in `api/database.py`.

---

## 📚 Documentation

### API Documentation

Once the backend is running, visit:
- **Swagger UI**: `http://127.0.0.1:8000/docs`
- **ReDoc**: `http://127.0.0.1:8000/redoc`

### Project Documentation

All detailed documentation is available in the [`docs/`](docs/) directory:

#### Getting Started
- **[Quick Start Guide](docs/QUICK_START.md)** - Get started in 5 minutes
- **[Setup Guide](docs/SETUP.md)** - Detailed setup instructions
- **[Email Setup Guide](docs/EMAIL_SETUP_GUIDE.md)** - Configure SMTP for email notifications

#### Feature Documentation
- **[Features Completed](docs/FEATURES_COMPLETED.md)** - Complete list of implemented features
- **[Feature Roadmap](docs/FEATURE_ROADMAP.md)** - Planned features and enhancements
- **[Implementation Details](docs/IMPLEMENTATION_SUMMARY.md)** - Implementation overview
- **[Phase Documentation](docs/)** - Phase-by-phase implementation details

#### Development
- **[Documentation Index](docs/README.md)** - All documentation files
- **[Contributing Guide](CONTRIBUTING.md)** - How to contribute
- **[Security Policy](SECURITY.md)** - Security reporting
- **[Changelog](CHANGELOG.md)** - Version history

---

## 🎬 Usage

### 1. Login

1. Navigate to `http://localhost:5173`
2. Sign in as `admin` with your `ADMIN_PASSWORD`, or the password the API printed on its first start
3. Choose a new password when asked; after that you can change it any time from the user menu

### 2. Upload Audio

1. Go to **New Analysis** page
2. Either:
   - **Upload a file**: Drag and drop or click to browse
   - **Record audio**: Click the microphone icon to record directly
3. Supported formats: `.wav`, `.mp3`, `.m4a`, and more

### 3. View Results

After analysis, you'll see:

- **Compliance Score** - Overall compliance rating
- **Transcription** - Full text of the conversation
- **Sentiment Timeline** - Visual sentiment analysis over time
- **Speaker Analysis** - Who said what and when
- **Action Items** - Detected tasks and commitments
- **Topics** - Main topics discussed
- **Intent** - Conversation intent classification
- **Summary** - AI-generated summary
- **Alerts** - Compliance violations and warnings

### 4. Add Comments & Tags

- Click on any analysis to add comments
- Tag analyses for better organization
- Collaborate with your team

### 5. Set Up Automation

- **Compliance Rules**: Create custom rules in Compliance Rules page
- **Scheduled Reports**: Set up automated reports in Scheduled Reports page
- **Webhooks**: Configure webhooks for external integrations
- **Notifications**: Set up email alerts

---

## 🗂️ Project Structure

```
voice_audit/
├── api/                      # Backend API (FastAPI)
│   ├── main.py              # FastAPI application & routes
│   ├── database.py          # Database models & setup
│   ├── auth.py              # Authentication & authorization
│   └── [20+ feature modules]
├── frontend/                 # React TypeScript frontend
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Page components (13 pages)
│   │   ├── contexts/        # React contexts
│   │   └── services/        # API service layer
│   └── package.json
├── docs/                     # Documentation
│   ├── README.md            # Documentation index
│   ├── QUICK_START.md       # Quick start guide
│   ├── SETUP.md             # Detailed setup
│   └── [12+ documentation files]
├── Data/                     # Database and sample files
├── dashboard/                # Legacy Streamlit dashboard
├── .github/                  # GitHub issue templates
├── README.md                 # Main documentation
├── LICENSE                   # MIT License
├── requirements.txt          # Python dependencies
└── [Configuration files]
```

**For detailed structure, see [STRUCTURE.md](STRUCTURE.md)**

---

## 🔧 Development

### Backend Development

```bash
# Run with auto-reload
uvicorn api.main:app --reload

# Run on different port
uvicorn api.main:app --reload --port 8001
```

### Security tests

The tests stub the ML models, so they need only the web stack and run in a few seconds:

```bash
pip install -r requirements-test.txt
pytest tests
```

They check that there is no default admin password or token secret, that every data route needs
a signed-in user with the right permission, that new accounts see nothing until an admin grants a
role, and that custom rules can't reach Python internals.

### Frontend Development

```bash
cd frontend

# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Database Migrations

The database schema is automatically created on first run. To reset the database:

```bash
rm Data/analyses.db
# Restart the server to recreate
```

---

## 🧪 Testing

### Backend API Testing

Use the interactive API documentation at `http://127.0.0.1:8000/docs` to test endpoints.

### Manual Testing

1. Upload a test audio file
2. Check the analysis results
3. Test authentication by logging in/out
4. Create compliance rules and test them
5. Set up a scheduled report
6. Test webhook/email notifications

---

## 🐛 Troubleshooting

### Backend Issues

**Issue**: `ModuleNotFoundError`
- **Solution**: Ensure virtual environment is activated and dependencies are installed

**Issue**: Models not downloading
- **Solution**: Check internet connection. First run downloads models which can take time.

**Issue**: Port already in use
- **Solution**: Change the port: `uvicorn api.main:app --reload --port 8001`

### Frontend Issues

**Issue**: `npm install` fails
- **Solution**: Clear npm cache: `npm cache clean --force` and try again

**Issue**: CORS errors
- **Solution**: Ensure backend CORS is configured correctly in `api/main.py`

### Database Issues

**Issue**: Migration errors
- **Solution**: Delete `Data/analyses.db` and restart the server

---

## 📸 Screenshots

Captured from a local run on ten synthetic support calls (scripted and voiced with text-to-speech), so every name and number in them is made up.

### Sign in
Split-screen sign-in with the product's highlights.

![Sign-in page: the form on the left, three product highlights on the right](docs/screenshots/sign-in.jpg)

### New analysis
Upload a recording or record one in the browser. The verdict, compliance score and signals appear below the upload card.

![New analysis page with a billing call uploaded, and its result: a critical finding on a call that scored 99.9](docs/screenshots/new-analysis.jpg)

### Findings and transcript
Each rule match shows the words that triggered it. The transcript follows playback, and clicking a line jumps to that moment.

![Findings for guarantee language and a missing recording disclosure, above the transcript and its audio player](docs/screenshots/findings-and-transcript.jpg)

### History
Every analyzed call, with search, score and date filters, and CSV export.

![History table of ten analyzed calls with their compliance scores and sentiment](docs/screenshots/history.jpg)

### Statistics
Volume, average compliance, the daily score trend against the review threshold, and sentiment across calls.

![Statistics page with summary tiles, the compliance trend chart and the sentiment breakdown](docs/screenshots/statistics.jpg)

### Compliance rules
Regex, keyword, threshold and custom rules, each with a severity and priority, that can be switched on and off.

![Compliance rules table with four active rules](docs/screenshots/compliance-rules.jpg)

---

## 🎯 Roadmap

See [docs/FEATURE_ROADMAP.md](docs/FEATURE_ROADMAP.md) for planned features and enhancements.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 👨‍💻 Developer

**Abhijeet Solanki**

- Developed with ❤️ and dedication
- Full-stack developer specializing in AI/ML applications
- Contact: [GitHub Profile](https://github.com/chiefaj)

---

## 🙏 Acknowledgments

- **OpenAI Whisper** - Speech recognition model
- **Hugging Face** - Transformers library and models
- **FastAPI** - Modern Python web framework
- **React Team** - Amazing UI library
- All open-source contributors

---

## 📞 Support

For issues, questions, or contributions:

- Open an issue on [GitHub](https://github.com/chiefaj/voice_audit/issues)
- Check the [documentation](docs/README.md) for guides and tutorials
- Review the API documentation at `http://127.0.0.1:8000/docs` when server is running

---

<div align="center">

**Made with ❤️ by Abhijeet Solanki**

⭐ Star this repo if you find it useful!

</div>

