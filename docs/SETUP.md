# Quick Setup Guide

This guide will help you get the AI Voice Compliance Auditor up and running quickly.

## Prerequisites

- Python 3.11 or higher
- Node.js 18 or higher
- npm or yarn
- Git

## Step 1: Clone the Repository

```bash
git clone https://github.com/chiefaj/voice_audit.git
cd voice_audit
```

## Step 2: Backend Setup

### Create Virtual Environment

```bash
# On macOS/Linux
python3 -m venv venv
source venv/bin/activate

# On Windows
python -m venv venv
venv\Scripts\activate
```

### Install Dependencies

```bash
pip install -r requirements.txt
```

**Note**: First installation may take several minutes as ML models (Whisper, BART, etc.) are downloaded.

### Configure Environment Variables

Create a `.env` file in the project root:

```bash
# Copy the example file (if it exists)
cp .env.example .env

# Or create manually
touch .env
```

Add your configuration:

```env
JWT_SECRET_KEY=$(openssl rand -hex 32)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### Initialize Database

The database is automatically created on first run. The default admin user will be created:
- Username: `admin`
- Password: `admin123`

**⚠️ Change this password immediately after first login!**

## Step 3: Frontend Setup

```bash
cd frontend
npm install
```

## Step 4: Run the Application

### Terminal 1: Backend

```bash
# From project root
uvicorn api.main:app --reload
```

Backend will run on: `http://127.0.0.1:8000`
API docs: `http://127.0.0.1:8000/docs`

### Terminal 2: Frontend

```bash
# From frontend directory
cd frontend
npm run dev
```

Frontend will run on: `http://localhost:5173`

## Step 5: Access the Application

1. Open your browser to `http://localhost:5173`
2. Login with default credentials:
   - Username: `admin`
   - Password: `admin123`
3. **Change your password immediately** in Settings

## Troubleshooting

### Port Already in Use

If port 8000 is in use, change it:
```bash
uvicorn api.main:app --reload --port 8001
```

Update frontend `.env`:
```env
VITE_API_URL=http://127.0.0.1:8001
```

### Module Not Found Errors

Make sure your virtual environment is activated:
```bash
which python  # Should show venv path
pip list      # Should show installed packages
```

### Database Errors

If you encounter database errors, reset the database:
```bash
rm Data/analyses.db
# Restart the server to recreate
```

### Frontend Build Errors

Clear npm cache and reinstall:
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

## Next Steps

- Read the [README.md](README.md) for detailed documentation
- Check [EMAIL_SETUP_GUIDE.md](EMAIL_SETUP_GUIDE.md) for email configuration
- Review [FEATURES_COMPLETED.md](FEATURES_COMPLETED.md) for feature list
- See [CONTRIBUTING.md](CONTRIBUTING.md) if you want to contribute

## Production Deployment

For production deployment:

1. **Change JWT_SECRET_KEY** in `.env` to a secure random string
2. **Change default admin password** immediately
3. **Use PostgreSQL** instead of SQLite (update database connection)
4. **Configure HTTPS** with proper SSL certificates
5. **Set up proper backups** for the database
6. **Use environment variables** for all sensitive configuration
7. **Configure email** for notifications and reports

See [README.md](README.md) for more production considerations.

