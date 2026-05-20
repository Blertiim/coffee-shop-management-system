# coffee-shop-management-system

Coffee shop POS and management system running as a standard web application.

## Project structure

- `backend/` - Express API, Prisma, MySQL integration
- `frontend/` - React/Vite browser application

## One-time setup

Install dependencies for the backend and frontend:

```powershell
npm run setup
```

MySQL must be running and reachable through `backend/.env`.
Use `backend/.env.example` for local development and `backend/.env.production.example`
for publishing.

## Development

Run the backend API:

```powershell
npm run dev:backend
```

Run the frontend in a separate terminal:

```powershell
npm run dev:frontend
```

Open the app in your browser at:

```text
http://127.0.0.1:5173
```

The frontend uses `/api` by default. In development, Vite proxies `/api` to the backend.
You can override the backend target with:

```env
VITE_API_PROXY_TARGET="http://127.0.0.1:5000"
```

## Production build

Build the frontend:

```powershell
npm run build
```

Start the backend API:

```powershell
npm start
```

Serve `frontend/dist` with any static web host, or use `npm --prefix frontend run preview`
to preview the built browser app locally.

For production frontend configuration, copy:

```text
frontend/.env.production.example -> frontend/.env.production
```

Use:

```env
VITE_API_URL="/api"
```

when frontend and backend are on the same domain through a reverse proxy. Use:

```env
VITE_API_URL="https://api.your-domain.com/api"
```

when the backend is published on a separate domain.

Run the full pre-publish check:

```powershell
npm run publish:check
```

See [DEPLOYMENT.md](C:/Users/blert/OneDrive/Documents/GitHub/coffee-shop-management-system/DEPLOYMENT.md) for the production checklist.

## Tablet access

For tablet or phone testing on the same Wi-Fi:

1. Start the backend on port `5000`.
2. Start the frontend with Vite.
3. Open the frontend from the laptop IP, for example:
   `http://192.168.0.12:5173`

The frontend will call:

```text
http://192.168.0.12:5000/api
```
