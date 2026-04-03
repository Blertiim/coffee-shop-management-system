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
const orderRoutes = require("./modules/orders/order.routes");
const productRoutes = require("./modules/products/product.routes");
const reservationRoutes = require("./modules/reservations/reservation.routes");
const shiftRoutes = require("./modules/shifts/shift.routes");
const staffRoutes = require("./modules/staff/staff.routes");
const supplierOrderRoutes = require("./modules/supplierOrders/supplier-order.routes");
const supplierRoutes = require("./modules/suppliers/supplier.routes");
const tableRoutes = require("./modules/tables/table.routes");
const authMiddleware = require("./middlewares/auth.middleware");
const { sendSuccess } = require("./utils/response");

const app = express();

const getCorsOrigins = () => {
  const rawOrigins = process.env.CORS_ORIGINS || "";

  if (!rawOrigins.trim()) {
    return null;
  }

  const origins = rawOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length ? new Set(origins) : null;
};

const allowedOrigins = getCorsOrigins();
const allowAllOrigins = !allowedOrigins || allowedOrigins.has("*");

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowAllOrigins || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
  })
);
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

app.get("/", (req, res) => {
  return sendSuccess(res, 200, "API is running", null);
});

app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api", orderRoutes);
app.use("/api/products", productRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/shifts", shiftRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/supplier-orders", supplierOrderRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/tables", tableRoutes);

app.get("/api/test", authMiddleware, (req, res) => {
  return sendSuccess(res, 200, "Protected route works", {
    user: req.user,
  });
});

module.exports = app;
