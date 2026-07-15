# AI Mock Interview Agent

> Multi-Modal Interview Simulation System — AI-powered interview platform with voice interviews, hybrid assessment scoring, and performance reporting.

![AI Interview](https://img.shields.io/badge/AI-Interview_Agent-blue?style=for-the-badge&logo=openai)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)
![Express](https://img.shields.io/badge/Express.js-4-green?style=for-the-badge&logo=express)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue?style=for-the-badge&logo=postgresql)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker)
![Python](https://img.shields.io/badge/Python-FastAPI-009688?style=for-the-badge&logo=fastapi)

## 🏗 Architecture

```
┌──────────────┐    ┌──────────────────┐    ┌───────────────┐
│   Frontend   │───▶│    Backend API    │───▶│  ML Service   │
│   Next.js    │    │  Express + Prisma │    │  FastAPI/Py   │
│   Port 3000  │    │    Port 4000      │    │  Port 8000    │
└──────────────┘    └────────┬─────────┘    └───────┬───────┘
                             │                       │
                             ▼                       ▼
                      ┌──────────────┐
                      │  PostgreSQL   │
                      │  Port 5432   │
                      └──────────────┘
```

## ✨ Features

- **AI Question Generation** — Generates 25+ role-specific questions from resumes and job descriptions using Groq LLMs
- **Voice Interviews** — Real-time speech-to-text (Whisper) and text-to-speech (gTTS) for natural interview experience
- **Hybrid Scoring Engine** — BERTScore + Semantic Similarity + Keyword Matching + LLM-based scoring
- **ATS Resume Analysis** — AI-powered resume vs. job description matching and scoring
- **Performance Reports** — Detailed radar charts, score breakdowns, and actionable feedback
- **8 REST APIs** — Full CRUD for interviews, answers, scoring, voice, and analytics

## 🚀 Quick Start

### Prerequisites
- Docker Desktop installed and running
- Groq API Key (free at [console.groq.com](https://console.groq.com))

### 1. Clone & Configure
```bash
cd "AI Interview app"
cp .env.example .env
# Edit .env and add your GROQ_API_KEY
```

### 2. Start with Docker
```bash
# Development mode (with hot-reloading)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# Production mode
docker compose up --build -d
```

### 3. Access the App
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **ML Service**: http://localhost:8000/docs
- **PostgreSQL**: localhost:5432

## 📁 Project Structure

```
AI Interview app/
├── frontend/          # Next.js 14 (App Router, TypeScript, Vanilla CSS)
├── backend/           # Express.js + Prisma ORM + Groq SDK
├── ml-service/        # Python FastAPI (Whisper, gTTS, BERTScore, Semantic)
├── db/                # PostgreSQL initialization scripts
├── docker-compose.yml # Production Docker config
├── docker-compose.dev.yml # Dev overrides
└── .env.example       # Environment variables template
```

## 🔌 API Endpoints

### Backend (Express.js — Port 4000)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/interviews` | Create new interview (resume + JD) |
| GET | `/api/interviews/:id` | Get interview with questions |
| POST | `/api/interviews/:id/answer` | Submit answer (text/audio) |
| GET | `/api/interviews/:id/report` | Get performance report |
| POST | `/api/resume/analyze` | ATS resume vs JD scoring |
| POST | `/api/voice/transcribe` | Speech-to-text |
| POST | `/api/voice/synthesize` | Text-to-speech |
| GET | `/api/dashboard/stats` | User statistics |

### ML Service (FastAPI — Port 8000)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/transcribe` | Whisper STT |
| POST | `/synthesize` | gTTS audio generation |
| POST | `/score/bert` | BERTScore evaluation |
| POST | `/score/semantic` | Semantic similarity |
| POST | `/score/keywords` | Keyword matching |
| POST | `/score/hybrid` | Combined hybrid scoring |
| POST | `/analyze/resume` | Resume NLP analysis |
| GET | `/health` | Health check |

## 🧠 Scoring Engine

The hybrid assessment engine combines four methods:

| Method | Weight | Technology |
|--------|--------|------------|
| BERTScore | 30% | `bert-score` library |
| Semantic Similarity | 25% | `sentence-transformers` |
| Keyword Matching | 20% | TF-IDF + cosine similarity |
| LLM Scoring | 25% | Groq Llama 3.3 70B |

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, TypeScript, Vanilla CSS, Chart.js |
| Backend | Express.js, Prisma ORM, Groq SDK, Multer |
| ML Service | FastAPI, Whisper, gTTS, BERTScore, sentence-transformers |
| Database | PostgreSQL 16 |
| Infrastructure | Docker Compose |

## 📄 License

MIT
