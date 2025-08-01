# Production Deployment Guide

This guide covers deploying both the Edge-OG worker and dashboard to Cloudflare's platform.

## Prerequisites

1. **Cloudflare Account**: Sign up at [cloudflare.com](https://cloudflare.com)
2. **Wrangler CLI**: Already included in the project dependencies
3. **Domain** (optional): For custom domain setup

## 🚀 Quick Deploy

Deploy both services with one command:

```bash
# Build and deploy everything
pnpm run deploy
```

## 📦 Individual Deployments

### 1. Deploy Worker (API)

```bash
# From project root
pnpm run deploy:worker

# Or directly from worker directory
cd packages/worker
pnpm run deploy
```

This will:
- Build the TypeScript worker
- Deploy to Cloudflare Workers
- Set up KV namespaces for templates, usage, and API keys
- Provide you with a worker URL like: `https://edge-og-worker.your-subdomain.workers.dev`

### 2. Deploy Dashboard (Frontend)

```bash
# From project root  
pnpm run deploy:dashboard

# Or directly from dashboard directory
cd apps/dashboard
pnpm run build
pnpm run deploy
```

This will:
- Build the Next.js app as static files
- Deploy to Cloudflare Pages
- Provide you with a dashboard URL like: `https://edge-og-dashboard.pages.dev`

## 🔧 Configuration Setup

### Step 1: Update Worker URL

After deploying the worker, update the dashboard's production environment:

```bash
# Edit apps/dashboard/.env.production
NEXT_PUBLIC_API_URL=https://edge-og-worker.YOUR-SUBDOMAIN.workers.dev
NEXT_PUBLIC_WORKER_URL=https://edge-og-worker.YOUR-SUBDOMAIN.workers.dev
```

### Step 2: Update CORS Settings

Update the worker's wrangler.jsonc with your dashboard URL:

```jsonc
{
  "vars": { 
    "DASHBOARD_URL": "https://edge-og-dashboard.pages.dev",
    "ENVIRONMENT": "production"
  }
}
```

### Step 3: Redeploy with Correct URLs

```bash
# Redeploy dashboard with correct worker URL
cd apps/dashboard
pnpm run build
pnpm run deploy

# Redeploy worker with correct dashboard URL
cd packages/worker  
pnpm run deploy
```

## 🌐 Custom Domains (Optional)

### Worker Custom Domain

1. Go to Cloudflare Dashboard → Workers & Pages
2. Select your worker → Settings → Triggers
3. Add custom domain: `api.yourdomain.com`

### Dashboard Custom Domain

1. Go to Cloudflare Dashboard → Workers & Pages  
2. Select your Pages project → Custom domains
3. Add custom domain: `dashboard.yourdomain.com`

Update environment variables accordingly:

```bash
# Production environment
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_WORKER_URL=https://api.yourdomain.com
NEXT_PUBLIC_DASHBOARD_URL=https://dashboard.yourdomain.com
```

## 🔐 KV Namespace Setup

The worker requires three KV namespaces. Update your `wrangler.jsonc` with actual KV namespace IDs:

```jsonc
"kv_namespaces": [
  {
    "binding": "TEMPLATES",
    "id": "your-templates-kv-id",
    "preview_id": "your-templates-preview-kv-id"
  },
  {
    "binding": "USAGE", 
    "id": "your-usage-kv-id",
    "preview_id": "your-usage-preview-kv-id"
  },
  {
    "binding": "API_KEYS",
    "id": "your-api-keys-kv-id", 
    "preview_id": "your-api-keys-preview-kv-id"
  }
]
```

Create KV namespaces:

```bash
# Create production namespaces
wrangler kv:namespace create "TEMPLATES"
wrangler kv:namespace create "USAGE" 
wrangler kv:namespace create "API_KEYS"

# Create preview namespaces
wrangler kv:namespace create "TEMPLATES" --preview
wrangler kv:namespace create "USAGE" --preview
wrangler kv:namespace create "API_KEYS" --preview
```

## 📊 Environment Variables Summary

### Development (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:8787
NEXT_PUBLIC_WORKER_URL=http://localhost:8787
NEXT_PUBLIC_DASHBOARD_URL=http://localhost:3000
```

### Production (.env.production)
```bash
NEXT_PUBLIC_API_URL=https://edge-og-worker.your-subdomain.workers.dev
NEXT_PUBLIC_WORKER_URL=https://edge-og-worker.your-subdomain.workers.dev
NEXT_PUBLIC_DASHBOARD_URL=https://edge-og-dashboard.pages.dev
```

## 🔍 Verification

After deployment, verify everything works:

### 1. Test Worker API
```bash
curl "https://edge-og-worker.your-subdomain.workers.dev/health"
```

### 2. Test Image Generation
```bash
curl "https://edge-og-worker.your-subdomain.workers.dev/og?template=default&title=Hello%20World"
```

### 3. Test Dashboard
Visit: `https://edge-og-dashboard.pages.dev`

## 🚨 Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure `DASHBOARD_URL` in worker matches your dashboard URL
2. **404 on Dashboard**: Check Next.js static export configuration
3. **KV Errors**: Verify KV namespace IDs in wrangler.jsonc
4. **Build Errors**: Run `pnpm install` in both `/packages/worker` and `/apps/dashboard`

### Logs and Debugging

```bash
# View worker logs
wrangler tail edge-og-worker

# View Pages deployment logs  
wrangler pages deployment list --project-name=edge-og-dashboard
```

## 🔄 CI/CD Setup (Optional)

Create `.github/workflows/deploy.yml` for automatic deployments:

```yaml
name: Deploy Edge-OG
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'
      
      - run: pnpm install
      - run: pnpm run deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

## 📈 Monitoring

Monitor your deployed services:

1. **Worker Analytics**: Cloudflare Dashboard → Workers & Pages → Analytics
2. **Pages Analytics**: Cloudflare Dashboard → Workers & Pages → Analytics  
3. **Custom Logs**: Use worker's structured logging for detailed monitoring

## 🎯 Architecture Overview

```
Internet
    ↓
┌─────────────────────┐     ┌─────────────────────┐
│   Dashboard         │────→│   Worker API        │
│   (Cloudflare       │     │   (Cloudflare       │
│    Pages)           │     │    Workers)         │
│                     │     │                     │
│ dashboard.pages.dev │     │ worker.workers.dev  │
└─────────────────────┘     └─────────────────────┘
    ↓                           ↓
┌─────────────────────┐     ┌─────────────────────┐
│   Static Files      │     │   KV Storage        │
│   (HTML/CSS/JS)     │     │   (Templates,       │
│                     │     │    Usage, API Keys) │
└─────────────────────┘     └─────────────────────┘
```

Both services are deployed on Cloudflare's global edge network for maximum performance and reliability.
