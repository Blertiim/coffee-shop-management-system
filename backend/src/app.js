const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const fs = require("fs");
const path = require("path");

const authRoutes = require("./modules/auth/auth.routes");
const categoryRoutes = require("./modules/categories/category.routes");
const dashboardRoutes = require("./modules/dashboard/dashboard.routes");
const employeeRoutes = require("./modules/employees/employee.routes");
const expenseRoutes = require("./modules/expenses/expense.routes");
const inventoryRoutes = require("./modules/inventory/inventory.routes");
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
const frontendDistPath = path.resolve(
  process.env.FRONTEND_DIST_PATH || path.resolve(__dirname, "../../frontend/dist")
);
const frontendIndexPath = path.join(frontendDistPath, "index.html");
const shouldServeFrontendDist =
  process.env.SERVE_FRONTEND_DIST === "true" || fs.existsSync(frontendIndexPath);

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
  })
);
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());
app.use(requestActivityMiddleware);

if (shouldServeFrontendDist) {
  app.use(express.static(frontendDistPath));
}

app.get("/", (req, res) => {
  if (shouldServeFrontendDist) {
    return res.sendFile(frontendIndexPath);
  }

  return sendSuccess(res, 200, "API is running", null);
});

app.get("/api/health", (req, res) => {
  return sendSuccess(res, 200, "POS backend is healthy", {
    service: "coffee-shop-pos-backend",
    status: "ok",
    mode: shouldServeFrontendDist ? "desktop" : "api",
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

if (shouldServeFrontendDist) {
  app.get(/^\/(?!api(?:\/|$)).*/, (req, res) => {
    return res.sendFile(frontendIndexPath);
  });
}

app.use(notFoundHandler);
app.use(globalErrorHandler);

module.exports = app;
