# ⚡ Quick Start Guide

Get the AI Voice Compliance Auditor up and running in 5 minutes!

## 🚀 Prerequisites

- Python 3.11+
- Node.js 18+
- Git

## 📦 Installation

### 1. Clone & Setup

```bash
# Clone repository
git clone https://github.com/chiefaj/voice_audit.git
cd voice_audit

# Backend setup
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Frontend setup
cd frontend
npm install
cd ..
```

### 2. Configure Environment (Optional but Recommended)

```bash
# Copy environment template
cp .env.example .env

# Edit .env and add your JWT secret (required for production)
# Generate secret: openssl rand -hex 32
```

### 3. Run the Application

**Terminal 1 - Backend:**
```bash
uvicorn api.main:app --reload
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### 4. Access

- **Frontend**: http://localhost:5173
- **API Docs**: http://127.0.0.1:8000/docs
- **Default Login**: `admin` / `admin123`

**⚠️ Change the default password immediately!**

---

## 📚 More Information

- Detailed setup: See [SETUP.md](SETUP.md)
- Full documentation: See [README.md](README.md)
- Email configuration: See [EMAIL_SETUP_GUIDE.md](EMAIL_SETUP_GUIDE.md)

---

**Need Help?** Open an issue on [GitHub](https://github.com/chiefaj/voice_audit/issues)

