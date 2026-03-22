# 🎥 Web2Gif — High-Quality Website to GIF Converter

Web2Gif is a modern, high-performance web application that captures any website URL and converts it into a smooth, optimized GIF. Built with **Next.js 15**, **Playwright**, and **Prisma**, it provides a seamless experience for capturing website interactions, animations, or portfolio showcases.

## ✨ Features

- **High-Quality Captures**: Uses Playwright (Chromium) to capture pixel-perfect frames of any URL.
- **Optimized GIFs**: Advanced encoding using `gifski` and `gifsicle` for the best quality-to-size ratio.
- **Job Polling Architecture**: Lightweight, reliable background processing using SQLite polling.
- **Flexible Storage**: Support for both local filesystem storage and AWS S3/Cloudflare R2.
- **Responsive UI**: Modern interface with smooth animations (Framer Motion) and Tailwind CSS v4.
- **Secure**: Built-in SSRF protection and rate limiting.

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, Framer Motion, Tailwind CSS v4
- **Database**: Prisma + SQLite (Primary store for jobs and workers)
- **Engine**: Playwright (Headless Chromium)
- **Encoding**: FFmpeg, gifski, and gifsicle
- **Storage**: Local Filesystem or S3-compatible (S3, R2, Minio)

---

## 🚀 Getting Started

### 📦 PC Prerequisites

Before running the project locally, ensure you have the following installed on your machine:

1.  **Node.js**: version 20.0.0 or higher.
2.  **npm** or **yarn** or **pnpm**.
3.  **System Binaries** (for GIF encoding):
    - **macOS (Homebrew)**:
      ```bash
      brew install ffmpeg gifski gifsicle
      ```
    - **Ubuntu/Debian**:
      ```bash
      sudo apt-get update
      sudo apt-get install -y ffmpeg gifski gifsicle
      ```

---

### 🔧 Local Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/your-username/web2gif.git
    cd web2gif
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Install Playwright Browsers**:
    This ensures the worker has the necessary browser binaries to capture screenshots.
    ```bash
    npx playwright install --with-deps chromium
    ```

4.  **Environment Setup**:
    Copy the example environment file and update your configuration.
    ```bash
    cp .env.example .env.local
    ```
    *(For SQLite, the default `DATABASE_URL="file:./prisma/dev.db"` is already configured.)*

5.  **Initialize Database (Prisma)**:
    Create the SQLite database and apply migrations.
    ```bash
    npx prisma migrate dev --name init
    ```

---

### 🏃 Running the Application

You need at least two terminals running simultaneously for the project to work:

#### Terminal 1: Web Interface
Starts the Next.js development server on `http://localhost:3000`.
```bash
npm run dev
```

#### Terminal 2: Job Worker
Starts the background process that polls the database and processes the GIF generation.
```bash
npm run worker:dev
```

---

## 🐳 Running with Docker

If you prefer to run the application using Docker, a `docker-compose.yml` is provided. While development focuses on SQLite, you can containerize the application as follows:

### 1. Build & Run
First, ensure you have a `Dockerfile` in the root. Then run:
```bash
docker-compose up --build
```

### 2. Configuration for Docker
When running in Docker, ensure your `DATABASE_URL` in `.env` points to a path that is persistent (e.g., inside a volume).

---

## 📁 Project Structure

```text
.
├── prisma/             # Database schema and migrations
├── src/
│   ├── app/            # Next.js App Router (API and UI)
│   ├── components/     # UI components
│   └── lib/            # Shared utilities (DB, Storage, Queue)
├── worker/             # Background job processor (Playwright + FFmpeg)
├── public/             # Static assets and local GIF outputs
└── package.json        # Project scripts and dependencies
```

---

## 📖 API Usage

### Create a Job
`POST /api/generate`
```json
{
  "url": "https://remix.run",
  "options": {
    "preset": "standard"
  }
}
```

### Check Status
`GET /api/status/:jobId`
```json
{
  "status": "PROCESSING",
  "progress": "Capturing frame 8/15"
}
```

---

## 🛡️ License

This project is licensed under the MIT License.
