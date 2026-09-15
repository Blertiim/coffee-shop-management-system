const fs = require("fs");
const path = require("path");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const authRoutes = require("./modules/auth/auth.routes");
const categoryRoutes = require("./modules/categories/category.routes");
const dashboardRoutes = require("./modules/dashboard/dashboard.routes");
const employeeRoutes = require("./modules/employees/employee.routes");
const expenseRoutes = require("./modules/expenses/expense.routes");
const inventoryRoutes = require("./modules/inventory/inventory.routes");
const inventoryLedgerRoutes = require("./modules/inventoryLedger/inventory-ledger.routes");
const orderRoutes = require("./modules/orders/order.routes");
const productRoutes = require("./modules/products/product.routes");
const reservationRoutes = require("./modules/reservations/reservation.routes");
const shiftRoutes = require("./modules/shifts/shift.routes");
const staffRoutes = require("./modules/staff/staff.routes");
const supplierOrderRoutes = require("./modules/supplierOrders/supplier-order.routes");
const supplierRoutes = require("./modules/suppliers/supplier.routes");
const systemRoutes = require("./modules/system/system.routes");
const tableRoutes = require("./modules/tables/table.routes");
const guestRoutes = require("./modules/guest/guest.routes");
const authMiddleware = require("./middlewares/auth.middleware");
const requestActivityMiddleware = require("./middlewares/request-activity.middleware");
const {
  globalErrorHandler,
  notFoundHandler,
} = require("./middlewares/error.middleware");
const { sendSuccess } = require("./utils/response");
const { buildCorsOriginChecker } = require("./config/security");

const app = express();
const corsOriginChecker = buildCorsOriginChecker();

app.use(
  cors({
    origin: (origin, callback) => {
      if (corsOriginChecker.isOriginAllowed(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "upgrade-insecure-requests": null,
      },
    },
  }),
);
app.use(morgan("dev"));
app.use(express.json());
app.use(requestActivityMiddleware);

// On a single-machine install (a PC behind the bar, waiters on tablets over
// the wifi) the built frontend is served by this same server, so there is one
// process to start, one port to open in the firewall, one address for the
// tablets - and no CORS, because the page and the API share an origin.
//
// Build it with `npm run build` in frontend/ (with VITE_API_URL="/api"), and
// this picks it up automatically. When there is no build - the usual setup in
// development, where Vite serves the frontend on its own port - everything
// below is skipped and the server stays API-only.
const frontendDistPath = process.env.FRONTEND_DIST_PATH
  ? path.resolve(process.env.FRONTEND_DIST_PATH)
  : path.join(__dirname, "..", "..", "frontend", "dist");
const frontendIndexPath = path.join(frontendDistPath, "index.html");
const hasFrontendBuild = fs.existsSync(frontendIndexPath);

if (hasFrontendBuild) {
  app.use(express.static(frontendDistPath));
}

app.get("/", (req, res) => {
  if (hasFrontendBuild) {
    return res.sendFile(frontendIndexPath);
  }

  return sendSuccess(res, 200, "API is running", null);
});

app.get("/api/health", (req, res) => {
  return sendSuccess(res, 200, "POS backend is healthy", {
    service: "coffee-shop-pos-backend",
    status: "ok",
    mode: "api",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/guest", guestRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/inventory-ledger", inventoryLedgerRoutes);
app.use("/api", orderRoutes);
app.use("/api/products", productRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/shifts", shiftRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/supplier-orders", supplierOrderRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/system", systemRoutes);
app.use("/api/tables", tableRoutes);

app.get("/api/test", authMiddleware, (req, res) => {
  return sendSuccess(res, 200, "Protected route works", {
    user: req.user,
  });
});

// The app keeps its own routes in the address bar (/tables, /table/3), so a
// refresh or a bookmark on one of those has to be answered with the page
// itself. Written as a plain middleware rather than a wildcard route, because
// route patterns are the one thing that changed between Express 4 and 5 and
// this must not be the reason the bar's POS fails to start. Registered after
// every API route, and only for page requests outside /api, so a wrong API
// path still returns a proper JSON 404 instead of a page full of HTML.
if (hasFrontendBuild) {
  app.use((req, res, next) => {
    if (
      (req.method !== "GET" && req.method !== "HEAD") ||
      req.path === "/api" ||
      req.path.startsWith("/api/")
    ) {
      return next();
    }

    return res.sendFile(frontendIndexPath);
  });
}

app.use(notFoundHandler);
app.use(globalErrorHandler);

module.exports = app;
