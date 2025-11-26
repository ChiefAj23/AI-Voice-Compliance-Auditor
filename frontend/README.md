# Voice Compliance Auditor - React Frontend

Modern React frontend for the Voice Compliance Auditor application.

## Tech Stack

- **React 18** with TypeScript
- **Vite** - Fast build tool
- **Tailwind CSS** - Utility-first CSS framework
- **React Router** - Client-side routing
- **Recharts** - Chart library
- **Axios** - HTTP client
- **Lucide React** - Icon library

## Getting Started

### Install Dependencies

```bash
npm install
```

### Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
frontend/
├── src/
│   ├── components/      # Reusable React components
│   ├── pages/           # Page components
│   ├── services/        # API service layer
│   ├── hooks/           # Custom React hooks
│   ├── utils/           # Utility functions
│   ├── App.tsx          # Main app component
│   └── main.tsx         # Entry point
├── public/              # Static assets
└── package.json         # Dependencies
```

## Features

- 🎙️ Audio upload and recording
- 📊 Real-time compliance analysis
- 📈 Sentiment timeline visualization
- 🚨 Alert system for violations
- 📜 Analysis history
- 📦 Batch processing
- ⚖️ Comparison tool
- ⚙️ Settings and customization

## API Integration

The frontend communicates with the FastAPI backend running on `http://127.0.0.1:8000`. Make sure the backend is running before starting the frontend.

## Environment Variables

Create a `.env` file in the frontend directory:

```
VITE_API_URL=http://127.0.0.1:8000
```
