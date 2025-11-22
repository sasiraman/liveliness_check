# Liveliness Check Application

A containerized web application that uses your webcam to detect faces and verify "liveness" by detecting eye blinks.

## Prerequisites

- Docker
- Node.js (for local frontend development, optional if using Docker for everything)
- Webcam

## Quick Start

### 1. Backend (Docker)

Build and run the backend container:

```bash
docker build -t liveliness-backend .
docker run -p 8000:8000 liveliness-backend
```

The backend will start on `http://localhost:8000`.

### 2. Frontend (Local)

Install dependencies and run the frontend:

```bash
cd frontend
npm install
npm run dev
```

Open your browser to the URL shown (usually `http://localhost:5173`).

## Usage

1. Allow camera access when prompted.
2. Look at the camera. You should see "Face Detected".
3. Blink your eyes twice.
4. The status should change to "VERIFIED".

## Tech Stack

- **Backend**: Python, FastAPI, MediaPipe (Face Mesh), OpenCV, WebSockets.
- **Frontend**: React, Vite, Tailwind CSS, react-webcam.
