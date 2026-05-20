# Deployment Guide

This project is now a standard web app:

- `frontend/` builds to static files with Vite.
- `backend/` runs an Express API with Prisma/MySQL.

## 1. Backend Production Environment

Create `backend/.env` from `backend/.env.production.example`.

Required values:

```env
NODE_ENV="production"
DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/coffee_shop_management"
JWT_SECRET="use-a-long-random-secret"
CORS_ORIGINS="https://your-frontend-domain.com"
```

Notes:

- `JWT_SECRET` must not be a placeholder.
- `CORS_ORIGINS` must be explicit in production.
- API docs are disabled in production unless `API_DOCS_ENABLED="true"` and docs credentials are configured.

## 2. Frontend Production Environment

Create `frontend/.env.production` from `frontend/.env.production.example`.

Same-domain deployment behind a reverse proxy:

```env
VITE_API_URL="/api"
```

Separate frontend/backend domains:

```env
VITE_API_URL="https://api.your-domain.com/api"
```

## 3. Build

Install dependencies:

```powershell
npm run setup
```

Build the frontend:

```powershell
npm run build
```

The static output is:

```text
frontend/dist
```

## 4. Run Backend

From the repository root:

```powershell
npm start
```

Or from `backend/`:

```powershell
npm start
```

The backend health check is:

```text
GET /api/health
```

## 5. Publish Frontend

Publish the contents of `frontend/dist` to any static host.

Examples:

- Nginx/Apache static site
- Netlify/Vercel static output
- S3/CloudFront style static hosting

If using same-domain deployment, configure your reverse proxy so:

```text
/api/* -> backend server
/*     -> frontend/dist
```

## 6. Pre-Publish Check

Run:

```powershell
npm run publish:check
```

This builds the frontend and runs backend critical-flow tests.
