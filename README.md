# Coffee Shop Management System

A full-stack point-of-sale and back-office system for a coffee shop: a touch-friendly POS for
waiters, a manager dashboard for inventory/staff/suppliers, and a QR-code guest ordering flow for
customers — all backed by a single Express + Prisma (MySQL) API.

**Live demo:** [coffee-shop-pos-blertim.netlify.app](https://coffee-shop-pos-blertim.netlify.app)
(frontend on Netlify, API on Render — see [Live deployment](#live-deployment) below).

## Key features

- **POS terminal** — PIN-based staff login, table/floor-plan layout, cart and order building,
  split payments and discounts, receipt generation.
- **Manager dashboard** — products, categories, suppliers and incoming stock invoices, an
  ingredient/recipe-based inventory ledger, staff and shift management, sales/expense reporting,
  and an audit trail of account activity.
- **Guest ordering** — customers scan a per-table QR code to browse the live menu and place an
  order from their own phone, with the order appearing on the assigned waiter's POS in real time.
- **Reservations & tables** — table assignment to waiters, capacity checks, and reservation
  conflict detection.
- **Security & reliability** — JWT auth with role-based access, rate-limited/lockout-protected
  POS PIN login, CORS allow-listing, security headers via Helmet, and defensive handling of a
  temporarily unavailable database.
- **Self-documenting API** — an interactive API catalog and OpenAPI spec served by the backend
  itself (see [API documentation](#api-documentation)).

## Tech stack

| Layer    | Technology                                         |
| -------- | -------------------------------------------------- |
| Frontend | React 18, Vite, Tailwind CSS                       |
| Backend  | Node.js, Express 5, Prisma ORM                     |
| Database | MySQL                                              |
| Auth     | JSON Web Tokens (JWT), bcrypt password/PIN hashing |
| Tooling  | ESLint (flat config), Prettier, EditorConfig       |

## Project structure

```text
coffee-shop-management-system/
├── backend/            Express API, Prisma schema/migrations, scripts, tests
│   └── src/
│       ├── modules/    One folder per domain (orders, products, inventoryLedger, staff, ...)
│       ├── middlewares/  Auth, role checks, rate limiting, error handling
│       ├── services/   Cross-cutting logic (audit log, alerts, realtime, caching)
│       └── config/     Security config, Prisma client, OpenAPI spec
├── frontend/            React/Vite browser application
│   └── src/
│       ├── features/   One folder per screen (pos, manager, auth, guest)
│       ├── components/ Small shared UI pieces (toasts, loaders, QR codes)
│       ├── context/     Global POS app state (session, active table, notifications)
│       └── lib/         Fetch wrapper, auth token storage
├── docs/                 Design notes (e.g. the inventory ledger model)
├── DEPLOYMENT.md        Production deployment guide
├── netlify.toml          Netlify build/redirect config for the frontend
└── render.yaml           Render blueprint for the backend
```

Each backend module follows the same shape: `*.routes.js` (Express router) →
`*.controller.js` (request handling, calls into Prisma/services) → `*.validation.js`
(input validation, where the module has one). Every controller responds with the same
JSON envelope: `{ success, message, data }`, via the shared helpers in
`backend/src/utils/response.js`.

## One-time setup

Install dependencies for the backend and frontend:

```powershell
npm run setup
```

MySQL must be running and reachable through `backend/.env`. Copy `backend/.env.example` to
`backend/.env` (and `frontend/.env.example` to `frontend/.env` if you need to override the
defaults) and fill in real values — `JWT_SECRET` in particular must be a real random secret,
not the placeholder.

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

## Code quality tooling

Run these from the repository root — each fans out to both `backend/` and `frontend/`:

```powershell
npm run lint           # ESLint (flat config) on both packages
npm run format          # Prettier --write on the whole repo
npm run format:check    # Prettier --check, useful in CI
```

Shared formatting rules live in the root `.prettierrc.json`/`.editorconfig`; each package has
its own `eslint.config.js` (backend: Node/CommonJS; frontend: React + hooks rules).

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

For production configuration, copy:

```text
backend/.env.production.example  -> backend/.env
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

Run the full pre-publish check (builds the frontend, runs backend critical-flow tests):

```powershell
npm run publish:check
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full production checklist, including the free
Netlify/Render/Aiven hosting path this project is set up for.

## Live deployment

This repository is wired for a zero-cost hosting path (see `netlify.toml` and `render.yaml`):

- Frontend: [Netlify](https://coffee-shop-pos-blertim.netlify.app)
- Backend API: Render (free web service — the first request after inactivity can be slow
  while the instance wakes up)
- Database: MySQL (Aiven free tier, or any MySQL-compatible host)

## API documentation

With the backend running, the API is self-documenting:

- `GET /api/health` — health check
- `GET /api/system/docs` — interactive API docs (open by default outside production; in
  production requires `API_DOCS_ENABLED="true"` plus Basic Auth credentials — see
  `backend/.env.example`)
- `GET /api/system/docs/openapi.json` — the raw OpenAPI spec

## Tablet / phone access on the same Wi-Fi

1. Start the backend on port `5000`.
2. Start the frontend with Vite.
3. Open the frontend from the laptop's LAN IP, for example:
   `http://192.168.0.12:5173`

The frontend will call `http://192.168.0.12:5000/api` automatically (see `VITE_API_URL=auto`
in `frontend/.env.example`).
