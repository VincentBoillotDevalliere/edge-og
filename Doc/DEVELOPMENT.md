# Development Setup

## Quick Start

To run both the Edge-OG worker and dashboard simultaneously:

```bash
pnpm run dev
```

This single command will start:
- **Worker API**: `http://localhost:8787`
- **Dashboard UI**: `http://localhost:3000`

## Individual Services

If you need to run services separately:

```bash
# Worker only
pnpm run dev:worker

# Dashboard only  
pnpm run dev:dashboard
```

## Port Configuration

The development setup uses fixed ports for reliable communication:

| Service | Port | URL | Purpose |
|---------|------|-----|---------|
| Worker | 8787 | http://localhost:8787 | API endpoints & image generation |
| Dashboard | 3000 | http://localhost:3000 | Web interface |

## Environment Variables

The dashboard automatically detects the worker URL via environment variables in `/apps/dashboard/.env.local`:

```bash
# Worker API URL
NEXT_PUBLIC_API_URL=http://localhost:8787
NEXT_PUBLIC_WORKER_URL=http://localhost:8787

# Dashboard URL
NEXT_PUBLIC_DASHBOARD_URL=http://localhost:3000
```

## Production Deployment

For production, update the environment variables to point to your deployed worker:

```bash
NEXT_PUBLIC_API_URL=https://your-worker.your-subdomain.workers.dev
NEXT_PUBLIC_WORKER_URL=https://your-worker.your-subdomain.workers.dev
```

## Architecture

```
┌─────────────────┐       ┌─────────────────┐
│   Dashboard     │────→  │   Worker API    │
│   (Next.js)     │       │ (Cloudflare)    │
│  localhost:3000 │       │ localhost:8787  │
└─────────────────┘       └─────────────────┘
        │                         │
        ├─ API Key Management     ├─ Image Generation (/og)
        ├─ Usage Analytics        ├─ API Key Auth (/dashboard)
        └─ Image Testing          └─ Health Check (/health)
```

## Features

### Dashboard (localhost:3000)
- 🏠 **Homepage**: Interactive builder, templates showcase, API docs
- 🔑 **API Keys**: Create, manage, and monitor API keys
- 🧪 **Image Tester**: Test API keys and preview images

### Worker API (localhost:8787)
- 🖼️ **Image Generation**: `/og?template=...&title=...`
- 🔑 **Key Management**: `/dashboard/api-keys`
- 📊 **Usage Tracking**: `/dashboard/user/{userId}`
- 🔍 **Health Check**: `/health`

## Notes

- **PNG vs SVG**: In development, images are generated as SVG due to WASM limitations. Production on Cloudflare Workers generates PNG images.
- **Hot Reload**: Both services support hot reload for efficient development.
- **Concurrency**: Uses `concurrently` package to run both services with colored output.
