# coffee-shop-management-system

## Desktop POS (Electron)

This project can now run as a single desktop POS app with Electron while keeping the existing folders:

- `backend/`
- `frontend/`
- `electron/`

### One-time setup

Install dependencies in each app plus Electron at the repo root:

```powershell
npm install
npm run setup
```

### Build and run the desktop app

Build the React frontend and open the Electron POS window:

```powershell
npm run electron
```

This flow:

1. builds `frontend/dist`
2. starts the Express backend automatically inside Electron
3. tries to start XAMPP MySQL automatically if the database is offline
4. serves the built frontend through Express
5. opens the POS window at `http://localhost:5000`

### Important local requirement

MySQL still needs to be available locally for Prisma. For café-style desktop use, prefer:

- MySQL installed as a Windows service with auto-start
- or XAMPP MySQL configured to start automatically with Windows

The Electron app now removes the need to run the frontend dev server or `npm run dev` manually, but it cannot replace the database service itself.

### XAMPP auto-start

The Electron launcher will try to start XAMPP MySQL automatically before the POS opens.

Optional backend env settings:

```env
AUTO_START_XAMPP_MYSQL="true"
XAMPP_PATH="C:\\xampp"
```

If your XAMPP is installed somewhere else, set `XAMPP_PATH` in [backend/.env.example](C:/Users/blert/OneDrive/Documents/GitHub/coffee-shop-management-system/backend/.env.example) style inside your real `backend/.env`.

## Tablet Access

For tablet/phone testing on the same Wi-Fi:

1. Start the backend on port `5000`.
2. Start the frontend normally.
3. Open the frontend from the laptop IP, for example:
   `http://192.168.0.12:5173`

The frontend is configured to resolve the API automatically to:
`http://<current-device-hostname>:5000/api`

So if the tablet opens `http://192.168.0.12:5173`, API calls will go to:
`http://192.168.0.12:5000/api`
