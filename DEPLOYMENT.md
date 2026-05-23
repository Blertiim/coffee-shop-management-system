# Deployment Guide

This project is now a standard web app:

- `frontend/` builds to static files with Vite.
- `backend/` runs an Express API with Prisma/MySQL.

## Free Hosting Path

Recommended zero-cost setup:

- Frontend: Netlify Free plan
- Backend API: Render Free web service
- Database: Aiven for MySQL free tier

Important free-tier limits:

- Render Free web services can sleep after inactivity, so the first request can be slow.
- Aiven free MySQL is limited to 1 GB storage and can be powered off if unused.
- Netlify Free has monthly usage credits. Keep auto-recharge disabled if you want no surprise charges.

## 1. Create the Free MySQL Database

1. Create an Aiven account.
2. Create an Aiven for MySQL service on the free tier.
3. Copy the MySQL connection string.
4. Make sure the connection string uses this shape:

```env
mysql://USER:PASSWORD@HOST:PORT/DATABASE
```

Use that as `DATABASE_URL` in Render.

## 2. Publish the Backend on Render

This repo includes `render.yaml`, so Render can detect the backend service.

1. Push the repository to GitHub.
2. In Render, choose Blueprint or New Web Service from this repository.
3. Use the free instance type if asked.
4. Enter these environment values when prompted:

```env
DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/DATABASE"
CORS_ORIGINS="https://your-netlify-site.netlify.app"
GUEST_ORDER_PUBLIC_BASE_URL="https://your-netlify-site.netlify.app"
```

Render will run:

```powershell
npm install && npm run build
npm run db:push
npm start
```

After deploy, check:

```text
https://your-render-service.onrender.com/api/health
```

## 3. Publish the Frontend on Netlify

This repo includes `netlify.toml`, so Netlify builds from `frontend/`.

Build settings:

```text
Base directory: frontend
Build command: npm run build
Publish directory: dist
```

Set this Netlify environment variable before deploy:

```env
VITE_API_URL="https://your-render-service.onrender.com/api"
```

After Netlify gives you the final site URL, update Render:

```env
CORS_ORIGINS="https://your-netlify-site.netlify.app"
GUEST_ORDER_PUBLIC_BASE_URL="https://your-netlify-site.netlify.app"
```

Then redeploy the backend once.

## Production Environment Reference

### Backend Environment

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

### Frontend Environment

Create `frontend/.env.production` from `frontend/.env.production.example`.

Same-domain deployment behind a reverse proxy:

```env
VITE_API_URL="/api"
```

Separate frontend/backend domains:

```env
VITE_API_URL="https://api.your-domain.com/api"
```

### Build

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

### Run Backend

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

### Publish Frontend

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

### Pre-Publish Check

Run:

```powershell
npm run publish:check
```

This builds the frontend and runs backend critical-flow tests.
